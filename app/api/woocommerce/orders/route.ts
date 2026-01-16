import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { filterFieldsArray, parseFieldsParam } from '@/lib/field-filter';
import { normalizeApiUrl, buildAuthHeaders, getCustomerByEmailCached } from '@/lib/woocommerce-helpers';

// Cache settings for 5 minutes to reduce database queries
let cachedSettings: any = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * WooCommerce Orders Endpoint
 * 
 * GET: Retrieves order data from WooCommerce based on the user's email.
 * POST: Cancels an order in WooCommerce.
 * 
 * GET Query Parameters:
 * - email: User email (required) - matches the wp_user_email from Flutter app
 * 
 * POST Body:
 * - orderId: Order ID to cancel (required)
 * - email: User email for verification (required)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - GET: List of orders for the specified customer email
 * - POST: Cancelled order details
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Validate API key
    const apiKey = await validateApiKey(request);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const fieldsParam = url.searchParams.get('fields'); // Dynamic field filtering
    const requestedFields = parseFieldsParam(fieldsParam);

    // Validate email parameter
    if (!email) {
      return NextResponse.json(
        { error: 'Email query parameter is required' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Helper function to get WooCommerce settings
    async function getWooCommerceSettings() {
      const now = Date.now();
      if (cachedSettings && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
        return cachedSettings;
      }
      
      const settings = await prisma.settings.findUnique({
        where: { id: 'settings' },
        select: {
          woocommerceApiUrl: true,
          woocommerceApiKey: true,
          woocommerceApiSecret: true,
        },
      });
      
      if (settings) {
        cachedSettings = settings;
        settingsCacheTime = now;
      }
      
      return settings;
    }

    // Helper function to fetch orders from WooCommerce (OPTIMIZED)
    async function fetchOrdersFromWooCommerce(email: string) {
      const settings = await getWooCommerceSettings();

      if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
        throw new Error('WooCommerce API credentials are not configured');
      }

      // Normalize API URL using shared helper
      const apiUrl = normalizeApiUrl(settings.woocommerceApiUrl);

      // Build auth headers using shared helper
      const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);

      // OPTIMIZED: Get customer by email first (server-side filtering)
      // Use fallback method that also searches orders/subscriptions if customer not found directly
      console.log(`[Orders API] Looking up customer by email: ${email}`);
      const customer = await getCustomerByEmailCached(apiUrl, authHeaders, email);

      let customerId: number | null = null;
      let ordersArray: any[] = [];

      if (!customer) {
        console.log(`[Orders API] No customer found for email ${email}. Returning empty orders.`);
        // Return empty result - no customer means no orders
        return {
          success: true,
          email: email,
          count: 0,
          orders: [],
        };
      }

      customerId = customer.id;
      console.log(`[Orders API] Found customer ID ${customerId}. Fetching orders with server-side filter.`);

      // Fetch orders with customer ID filter (server-side filtering - MUCH faster)
      const ordersUrl = new URL(`${apiUrl}/orders`);
      ordersUrl.searchParams.append('customer', customerId.toString());
      ordersUrl.searchParams.append('per_page', '100');

      const woocommerceResponse = await fetch(ordersUrl.toString(), {
        method: 'GET',
        headers: authHeaders,
      });

      if (!woocommerceResponse.ok) {
        throw new Error(`WooCommerce API returned ${woocommerceResponse.status}`);
      }

      // Parse JSON response
      const contentType = woocommerceResponse.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      if (!isJson) {
        throw new Error('WooCommerce API returned invalid response format');
      }

      const orders = await woocommerceResponse.json();
      ordersArray = Array.isArray(orders) ? orders : [orders];

      console.log(`[Orders API] Found ${ordersArray.length} orders for customer ID ${customerId}`);

      // STEP 1: Collect all unique product_ids from all orders
      const allProductIds: number[] = [];
      ordersArray.forEach((order: any) => {
        if (order.line_items && Array.isArray(order.line_items)) {
          order.line_items.forEach((item: any) => {
            if (item.product_id) {
              allProductIds.push(item.product_id);
            }
          });
        }
      });

      // STEP 2: Get unique product_ids (remove duplicates)
      const uniqueProductIds = [...new Set(allProductIds)];

      // STEP 3: Fetch all unique products in parallel
      const productsMap = new Map<number, any>();
      await Promise.all(
        uniqueProductIds.map(async (productId) => {
          try {
            const productUrl = `${apiUrl}/products/${productId}`;
            const productResponse = await fetch(productUrl, {
              method: 'GET',
              headers: authHeaders,
            });

            if (productResponse.ok) {
              const productContentType = productResponse.headers.get('content-type');
              if (productContentType && productContentType.includes('application/json')) {
                const product = await productResponse.json();
                productsMap.set(productId, product);
              }
            }
          } catch (productError) {
            // Continue without product - will use default values
          }
        })
      );

      // STEP 4: Transform orders to return required fields per API_PAYLOAD_REQUIREMENTS.md
      // Required: id, number, status, date_created, total, line_items, meta_data (tracking + medication_schedule ACF fields)
      const enrichedOrders = ordersArray.map((order: any) => {
        // Filter meta_data to include:
        // 1. Tracking-related entries
        // 2. Medication schedule ACF fields (without underscore prefix - these contain actual values)
        const relevantMetaData = (order.meta_data || []).filter((meta: any) => {
          const key = (meta.key || '');
          const keyLower = key.toLowerCase();
          
          // Include tracking entries
          if (keyLower.includes('tracking') || keyLower.includes('track')) {
            return true;
          }
          
          // Include medication_schedule ACF fields (without underscore prefix - these have actual values)
          // Fields starting with underscore (_medication_schedule) are field references, not values
          if (key.startsWith('medication_schedule') && !key.startsWith('_')) {
            return true;
          }
          
          return false;
        });

        // Transform line items to only include required fields
        const transformedLineItems = (order.line_items || []).map((item: any) => {
          let imageSrc = null;

          // Get product image from cache (if available)
          if (item.product_id && productsMap.has(item.product_id)) {
            const product = productsMap.get(item.product_id);
            if (product.images && product.images.length > 0) {
              imageSrc = product.images[0].src || null;
            }
          }

          return {
            name: item.name || 'Unknown Product',
            quantity: item.quantity || 1,
            price: item.price || item.subtotal || '0',
            total: item.total || '0',
            image: { src: imageSrc },
          };
        });

        // Return only required fields
        return {
          id: order.id,
          number: order.number || `ORD-${order.id}`,
          status: order.status || 'unknown',
          date_created: order.date_created || order.date_created_gmt || null,
          total: order.total || '0',
          line_items: transformedLineItems,
          meta_data: relevantMetaData,
        };
      });

      return {
        success: true,
        email: email,
        count: enrichedOrders.length,
        orders: enrichedOrders,
      };
    }

    // Get WooCommerce settings
    const settings = await getWooCommerceSettings();

    if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
      return NextResponse.json(
        { error: 'WooCommerce API credentials are not configured. Please configure them in the admin settings.' },
        { status: 500 }
      );
    }

    // Fetch fresh data from WooCommerce
    let responseData;
    try {
      responseData = await fetchOrdersFromWooCommerce(normalizedEmail);
    } catch (error: any) {
      console.error('Failed to fetch orders from WooCommerce:', error);
      
      return NextResponse.json(
        {
          error: 'Failed to fetch orders from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? error.message 
            : undefined,
        },
        { status: 500 }
      );
    }

    // Apply field filtering if requested (always include meta_data for orders)
    const filteredData = requestedFields
      ? {
          ...responseData,
          orders: filterFieldsArray(responseData.orders || [], requestedFields, {
            includeMetaData: true, // Always include meta_data for medication_schedule
          }),
        }
      : responseData;

    const responseTime = Date.now() - startTime;
    return NextResponse.json({
      ...filteredData,
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    console.error('Get WooCommerce orders error:', error);
    
    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching orders from WooCommerce';

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Cancel WooCommerce Order Endpoint
 * 
 * This endpoint cancels an order in WooCommerce.
 * 
 * Request Body:
 * - orderId: Order ID to cancel (required)
 * - email: User email for verification (required)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - Cancelled order details
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      console.error('API key validation error:', apiKeyError);
      return NextResponse.json(
        { error: 'API key validation failed', details: process.env.NODE_ENV === 'development' ? (apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error') : undefined },
        { status: 500 }
      );
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { orderId, email } = body;

    // Validate required fields
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required for order verification' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Get WooCommerce settings from database
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
    });

    if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
      return NextResponse.json(
        { error: 'WooCommerce API credentials are not configured. Please configure them in the admin settings.' },
        { status: 500 }
      );
    }

    // Prepare WooCommerce API URL
    let apiUrl = settings.woocommerceApiUrl.replace(/\/$/, '');
    
    // Auto-fix API URL if it's missing the wp-json path
    if (!apiUrl.includes('/wp-json/wc/')) {
      const baseUrl = apiUrl.replace(/\/wp-json.*$/, '');
      apiUrl = `${baseUrl}/wp-json/wc/v3`;
      console.warn(`WooCommerce API URL was missing /wp-json/wc/ path. Auto-corrected to: ${apiUrl}`);
    }
    
    // Validate API URL format
    if (!apiUrl.includes('/wp-json/wc/')) {
      return NextResponse.json(
        {
          error: 'Invalid WooCommerce API URL format',
          details: process.env.NODE_ENV === 'development' 
            ? `The API URL "${settings.woocommerceApiUrl}" is invalid. It should be in the format: https://yourstore.com/wp-json/wc/v3` 
            : 'Please check your WooCommerce API URL in admin settings.',
        },
        { status: 400 }
      );
    }

    // Create Basic Auth header for WooCommerce API
    const authString = Buffer.from(
      `${settings.woocommerceApiKey}:${settings.woocommerceApiSecret}`
    ).toString('base64');

    const authHeaders = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // First, verify the order exists and belongs to the user
    const orderUrl = `${apiUrl}/orders/${orderId}`;
    const orderResponse = await fetch(orderUrl, {
      method: 'GET',
      headers: authHeaders,
    });

    // Check if response is JSON
    const orderContentType = orderResponse.headers.get('content-type');
    const isOrderJson = orderContentType && orderContentType.includes('application/json');

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      
      if (!isOrderJson && errorText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an HTML page instead of JSON',
            details: process.env.NODE_ENV === 'development' 
              ? 'Please check your WooCommerce API URL and credentials.' 
              : undefined,
          },
          { status: 500 }
        );
      }

      if (orderResponse.status === 404) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch order from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${orderResponse.status}: ${orderResponse.statusText}` 
            : undefined,
        },
        { status: orderResponse.status || 500 }
      );
    }

    // Parse order data
    let order;
    try {
      const orderText = await orderResponse.text();
      if (!isOrderJson) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an invalid response format',
            details: process.env.NODE_ENV === 'development' 
              ? 'The API returned HTML or non-JSON content.' 
              : undefined,
          },
          { status: 500 }
        );
      }
      order = JSON.parse(orderText);
    } catch (parseError) {
      console.error('Failed to parse order response:', parseError);
      return NextResponse.json(
        {
          error: 'Failed to parse response from WooCommerce API',
          details: process.env.NODE_ENV === 'development' && parseError instanceof Error
            ? parseError.message
            : undefined,
        },
        { status: 500 }
      );
    }

    // Verify the order belongs to the user
    const orderEmail = order.billing?.email?.toLowerCase().trim() || order.customer_email?.toLowerCase().trim();
    if (orderEmail !== normalizedEmail) {
      return NextResponse.json(
        { error: 'Order does not belong to this user' },
        { status: 403 }
      );
    }

    // Check if order can be cancelled
    const cancellableStatuses = ['pending', 'processing', 'on-hold'];
    if (!cancellableStatuses.includes(order.status)) {
      return NextResponse.json(
        { 
          error: `Order cannot be cancelled. Current status: ${order.status}`,
          details: 'Only orders with status "pending", "processing", or "on-hold" can be cancelled.',
        },
        { status: 400 }
      );
    }

    // Cancel the order by updating status to "cancelled"
    const cancelResponse = await fetch(orderUrl, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'cancelled',
      }),
    });

    // Check if response is JSON
    const cancelContentType = cancelResponse.headers.get('content-type');
    const isCancelJson = cancelContentType && cancelContentType.includes('application/json');

    if (!cancelResponse.ok) {
      const errorText = await cancelResponse.text();
      console.error('WooCommerce cancel order error:', {
        status: cancelResponse.status,
        statusText: cancelResponse.statusText,
        error: errorText.substring(0, 500),
      });

      if (!isCancelJson && errorText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an HTML page instead of JSON',
            details: process.env.NODE_ENV === 'development' 
              ? 'Please check your WooCommerce API URL and credentials.' 
              : undefined,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to cancel order in WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${cancelResponse.status}: ${cancelResponse.statusText}` 
            : undefined,
        },
        { status: cancelResponse.status || 500 }
      );
    }

    // Parse cancelled order response
    let cancelledOrder;
    try {
      const cancelText = await cancelResponse.text();
      if (!isCancelJson) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an invalid response format',
            details: process.env.NODE_ENV === 'development' 
              ? 'The API returned HTML or non-JSON content.' 
              : undefined,
          },
          { status: 500 }
        );
      }
      cancelledOrder = JSON.parse(cancelText);
    } catch (parseError) {
      console.error('Failed to parse cancel order response:', parseError);
      return NextResponse.json(
        {
          error: 'Failed to parse response from WooCommerce API',
          details: process.env.NODE_ENV === 'development' && parseError instanceof Error
            ? parseError.message
            : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      order: cancelledOrder,
    });
  } catch (error) {
    console.error('Cancel WooCommerce order error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while cancelling the order';

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}

