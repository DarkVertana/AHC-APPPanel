import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { filterFieldsArray, parseFieldsParam } from '@/lib/field-filter';

// Cache settings for 5 minutes to reduce database queries
let cachedSettings: any = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get WooCommerce Subscription Orders Endpoint
 * 
 * This endpoint retrieves all orders associated with a specific subscription ID from WooCommerce.
 * Includes parent order, renewal orders, and any other related orders.
 * 
 * Path Parameters:
 * - id: Subscription ID (required)
 * 
 * Query Parameters:
 * - email: User email (required) - for ownership verification
 * - nocache: Set to '1' to bypass cache (optional)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - List of orders for the specified subscription with all metadata (including ACF fields)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    // Await params (Next.js 15+ requires params to be awaited)
    const { id } = await params;
    
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

    // Validate and parse subscription ID
    const subscriptionId = id;
    const subscriptionIdNum = parseInt(subscriptionId, 10);
    
    if (isNaN(subscriptionIdNum)) {
      return NextResponse.json(
        { error: 'Invalid subscription ID. Must be a valid number.' },
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

    // Helper function to determine order type
    function determineOrderType(order: any, subscription: any): string {
      // Check if this is the parent order
      if (subscription.parent_id && order.id === subscription.parent_id) {
        return 'parent';
      }
      
      // Check order metadata for order type
      if (order.meta_data && Array.isArray(order.meta_data)) {
        const orderTypeMeta = order.meta_data.find((meta: any) => 
          meta.key === '_subscription_renewal' || 
          meta.key === '_subscription_switch' ||
          meta.key === '_subscription_resubscribe'
        );
        
        if (orderTypeMeta) {
          if (orderTypeMeta.key === '_subscription_renewal') return 'renewal';
          if (orderTypeMeta.key === '_subscription_switch') return 'switch';
          if (orderTypeMeta.key === '_subscription_resubscribe') return 'resubscribe';
        }
      }
      
      // Default to renewal if it's not the parent
      return subscription.parent_id && order.id !== subscription.parent_id ? 'renewal' : 'unknown';
    }

    // Helper function to enrich order with product details using cached products
    // Returns required fields per API_PAYLOAD_REQUIREMENTS.md
    function enrichOrderWithProducts(order: any, productsMap: Map<number, any>) {
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

      // Return required fields per API_PAYLOAD_REQUIREMENTS.md
      return {
        id: order.id,
        number: order.number || `ORD-${order.id}`,
        status: order.status || 'unknown',
        date_created: order.date_created || order.date_created_gmt || null,
        total: order.total || '0',
        line_items: transformedLineItems,
        meta_data: relevantMetaData,
        type: null as string | null, // Will be set after enrichment
      };
    }

    // Helper function to fetch subscription orders from WooCommerce
    async function fetchSubscriptionOrders(subscriptionId: number, email: string) {
      const settings = await getWooCommerceSettings();

      if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
        throw new Error('WooCommerce API credentials are not configured');
      }

      // Prepare WooCommerce API URL
      let apiUrl = settings.woocommerceApiUrl.replace(/\/$/, '');
      
      if (!apiUrl.includes('/wp-json/wc/')) {
        const baseUrl = apiUrl.replace(/\/wp-json.*$/, '');
        apiUrl = `${baseUrl}/wp-json/wc/v3`;
      }
      
      if (!apiUrl.includes('/wp-json/wc/')) {
        throw new Error('Invalid WooCommerce API URL format');
      }

      // Create Basic Auth header
      const authString = Buffer.from(`${settings.woocommerceApiKey}:${settings.woocommerceApiSecret}`).toString('base64');
      const authHeaders = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // First, fetch and verify the subscription exists and belongs to the user
      let subscriptionUrl = `${apiUrl}/subscriptions/${subscriptionId}`;
      let subscriptionResponse = await fetch(subscriptionUrl, {
        method: 'GET',
        headers: authHeaders,
      });

      // If v3 doesn't work, try v1
      if (!subscriptionResponse.ok && subscriptionResponse.status === 404) {
        const apiUrlV1 = apiUrl.replace('/wc/v3', '/wc/v1');
        subscriptionUrl = `${apiUrlV1}/subscriptions/${subscriptionId}`;
        subscriptionResponse = await fetch(subscriptionUrl, {
          method: 'GET',
          headers: authHeaders,
        });
      }

      // Check if response is JSON
      const subscriptionContentType = subscriptionResponse.headers.get('content-type');
      const isSubscriptionJson = subscriptionContentType && subscriptionContentType.includes('application/json');

      if (!subscriptionResponse.ok) {
        const errorText = await subscriptionResponse.text();
        
        if (!isSubscriptionJson && errorText.includes('<!DOCTYPE')) {
          throw new Error('WooCommerce API returned an HTML page instead of JSON');
        }

        if (subscriptionResponse.status === 404) {
          throw new Error('Subscription not found');
        }

        throw new Error(`WooCommerce API returned ${subscriptionResponse.status}`);
      }

      // Parse subscription data
      let subscription;
      try {
        const subscriptionText = await subscriptionResponse.text();
        if (!isSubscriptionJson) {
          throw new Error('WooCommerce API returned an invalid response format');
        }
        subscription = JSON.parse(subscriptionText);
      } catch (parseError) {
        console.error('Failed to parse subscription response:', parseError);
        throw new Error('Failed to parse response from WooCommerce API');
      }

      // Verify the subscription belongs to the user
      const subscriptionEmail = (
        subscription.billing?.email?.toLowerCase().trim() ||
        subscription.customer_email?.toLowerCase().trim() ||
        ''
      );
      if (subscriptionEmail !== email) {
        throw new Error('Subscription does not belong to this user');
      }

      // Fetch orders for the subscription using primary method
      let ordersUrl = `${apiUrl}/subscriptions/${subscriptionId}/orders`;
      let ordersResponse = await fetch(ordersUrl, {
        method: 'GET',
        headers: authHeaders,
      });

      // If v3 endpoint returns 404, try v1 endpoint
      if (!ordersResponse.ok && ordersResponse.status === 404) {
        const apiUrlV1 = apiUrl.replace('/wc/v3', '/wc/v1');
        ordersUrl = `${apiUrlV1}/subscriptions/${subscriptionId}/orders`;
        ordersResponse = await fetch(ordersUrl, {
          method: 'GET',
          headers: authHeaders,
        });
      }

      if (!ordersResponse.ok) {
        if (ordersResponse.status === 404) {
          // No orders found - return empty array
          return {
            success: true,
            subscriptionId: subscriptionId,
            email: email,
            subscription: {
              id: subscription.id,
              status: subscription.status || 'unknown',
              date_created: subscription.date_created || subscription.date_created_gmt || null,
              date_modified: subscription.date_modified || subscription.date_modified_gmt || null,
              next_payment_date: subscription.next_payment_date || subscription.next_payment_date_gmt || null,
              end_date: subscription.end_date || subscription.end_date_gmt || null,
              trial_end_date: subscription.trial_end_date || subscription.trial_end_date_gmt || null,
              billing_period: subscription.billing_period || null,
              billing_interval: subscription.billing_interval || null,
              total: subscription.total || null,
              currency: subscription.currency || null,
            },
            count: 0,
            orders: [],
          };
        }
        throw new Error(`WooCommerce API returned ${ordersResponse.status}`);
      }

      // Parse JSON response
      const contentType = ordersResponse.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      if (!isJson) {
        throw new Error('WooCommerce API returned invalid response format');
      }

      const orders = await ordersResponse.json();
      const ordersArray = Array.isArray(orders) ? orders : [orders];

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

      // STEP 4: Enrich orders using the cached productsMap
      const enrichedOrders = ordersArray.map((order: any) => {
        const enrichedOrder = enrichOrderWithProducts(order, productsMap);
        
        // Determine order type
        enrichedOrder.type = determineOrderType(order, subscription);
        
        return enrichedOrder;
      });

      // Enrich subscription with all status information
      const enrichedSubscription = {
        id: subscription.id,
        status: subscription.status || 'unknown',
        date_created: subscription.date_created || subscription.date_created_gmt || null,
        date_modified: subscription.date_modified || subscription.date_modified_gmt || null,
        next_payment_date: subscription.next_payment_date || subscription.next_payment_date_gmt || null,
        end_date: subscription.end_date || subscription.end_date_gmt || null,
        trial_end_date: subscription.trial_end_date || subscription.trial_end_date_gmt || null,
        billing_period: subscription.billing_period || null,
        billing_interval: subscription.billing_interval || null,
        total: subscription.total || null,
        currency: subscription.currency || null,
        customer_id: subscription.customer_id || null,
        billing: subscription.billing || null,
        shipping: subscription.shipping || null,
      };

      return {
        success: true,
        subscriptionId: subscriptionId,
        email: email,
        subscription: enrichedSubscription,
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
      responseData = await fetchSubscriptionOrders(subscriptionIdNum, normalizedEmail);
    } catch (error: any) {
      console.error('Failed to fetch subscription orders from WooCommerce:', error);
      
      if (error.message === 'Subscription not found') {
        return NextResponse.json(
          { error: 'Subscription not found' },
          { status: 404 }
        );
      }

      if (error.message === 'Subscription does not belong to this user') {
        return NextResponse.json(
          { error: 'Subscription does not belong to this user' },
          { status: 403 }
        );
      }

      if (error.message === 'WooCommerce Subscriptions plugin not found or not active') {
        return NextResponse.json(
          {
            error: 'WooCommerce Subscriptions plugin not found or not active',
            details: process.env.NODE_ENV === 'development' 
              ? 'The /subscriptions/{id}/orders endpoint is not available. Please ensure WooCommerce Subscriptions plugin is installed and activated.' 
              : undefined,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch subscription orders from WooCommerce',
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
    console.error('Get WooCommerce subscription orders error:', error);
    
    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching subscription orders from WooCommerce';

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
