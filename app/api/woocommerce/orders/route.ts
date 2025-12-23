import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    // Validate email parameter
    if (!email) {
      return NextResponse.json(
        { error: 'Email query parameter is required' },
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
    // Remove trailing slash if present and ensure proper endpoint
    let apiUrl = settings.woocommerceApiUrl.replace(/\/$/, '');
    
    // Auto-fix API URL if it's missing the wp-json path
    // If URL doesn't contain /wp-json/wc/, try to construct it
    if (!apiUrl.includes('/wp-json/wc/')) {
      // Try to append the standard WooCommerce REST API path
      const baseUrl = apiUrl.replace(/\/wp-json.*$/, ''); // Remove any existing wp-json path
      apiUrl = `${baseUrl}/wp-json/wc/v3`; // Default to v3
      console.warn(`WooCommerce API URL was missing /wp-json/wc/ path. Auto-corrected to: ${apiUrl}`);
    }
    
    // Validate API URL format - should contain wp-json/wc/v3 or wp-json/wc/v1
    if (!apiUrl.includes('/wp-json/wc/')) {
      return NextResponse.json(
        {
          error: 'Invalid WooCommerce API URL format',
          details: process.env.NODE_ENV === 'development' 
            ? `The API URL "${settings.woocommerceApiUrl}" is invalid. It should be in the format: https://yourstore.com/wp-json/wc/v3 or https://yourstore.com/wp-json/wc/v1` 
            : 'Please check your WooCommerce API URL in admin settings. It should include /wp-json/wc/v3 or /wp-json/wc/v1',
        },
        { status: 400 }
      );
    }

    // Create Basic Auth header for WooCommerce API
    // WooCommerce uses Consumer Key as username and Consumer Secret as password
    const authString = Buffer.from(
      `${settings.woocommerceApiKey}:${settings.woocommerceApiSecret}`
    ).toString('base64');

    const authHeaders = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Try to get customer by email to get customer ID (optimized with timeout)
    // If this fails, we'll fetch all orders and filter by email
    let customerId: number | null = null;
    
    try {
      const customersUrl = new URL(`${apiUrl}/customers`);
      customersUrl.searchParams.append('email', normalizedEmail);
      customersUrl.searchParams.append('per_page', '1');

      // Use AbortController for timeout to avoid hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const customersResponse = await fetch(customersUrl.toString(), {
        method: 'GET',
        headers: authHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (customersResponse.ok) {
        const customersContentType = customersResponse.headers.get('content-type');
        const isCustomersJson = customersContentType && customersContentType.includes('application/json');
        
        if (isCustomersJson) {
          try {
            const customers = await customersResponse.json();
            const customersArray = Array.isArray(customers) ? customers : [customers];
            if (customersArray.length > 0 && customersArray[0].id) {
              customerId = parseInt(customersArray[0].id);
            }
          } catch (parseError) {
            // Continue without customer ID
          }
        }
      }
    } catch (customerError) {
      // Timeout or error - continue without customer ID, will fetch all and filter
      if (process.env.NODE_ENV === 'development') {
        console.log('Customer lookup skipped or failed, will fetch all orders and filter by email');
      }
    }

    // Fetch orders from WooCommerce API
    // WooCommerce orders API only accepts customer ID, not email
    // If we don't have customer ID, fetch all orders and filter by email
    let ordersUrl = new URL(`${apiUrl}/orders`);
    
    // Only use customer ID if we have it, otherwise fetch all and filter by email
    if (customerId) {
      ordersUrl.searchParams.append('customer', customerId.toString());
    }
    // Don't filter by status - include all statuses so app can show all orders like website
    ordersUrl.searchParams.append('per_page', '100'); // Get up to 100 orders

    let woocommerceResponse = await fetch(ordersUrl.toString(), {
      method: 'GET',
      headers: authHeaders,
    });

    // If we have customerId but got no orders or error, try fetching all and filter by email
    // This handles cases where customer ID lookup was incorrect
    if (customerId && (!woocommerceResponse.ok || woocommerceResponse.status === 404)) {
      console.log('No orders found with customer ID, trying to fetch all and filter by email');
      const allOrdersUrl = new URL(`${apiUrl}/orders`);
      allOrdersUrl.searchParams.append('per_page', '100');
      
      woocommerceResponse = await fetch(allOrdersUrl.toString(), {
        method: 'GET',
        headers: authHeaders,
      });
      customerId = null; // Mark that we're fetching all orders
    }

    // Check if response is JSON
    const contentType = woocommerceResponse.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!woocommerceResponse.ok) {
      const errorText = await woocommerceResponse.text();
      console.error('WooCommerce API error:', {
        status: woocommerceResponse.status,
        statusText: woocommerceResponse.statusText,
        contentType,
        error: errorText.substring(0, 500), // Limit error text length
      });

      // If HTML error page is returned, provide a better error message
      if (!isJson && errorText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an HTML error page. Please check your API credentials and URL.',
            details: process.env.NODE_ENV === 'development' 
              ? `Status: ${woocommerceResponse.status}. The API URL might be incorrect or authentication failed.` 
              : undefined,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch orders from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${woocommerceResponse.status}: ${woocommerceResponse.statusText}` 
            : undefined,
        },
        { status: woocommerceResponse.status || 500 }
      );
    }

    // Parse JSON response
    let orders;
    try {
      const responseText = await woocommerceResponse.text();
      if (!isJson) {
        console.error('WooCommerce API returned non-JSON response:', responseText.substring(0, 500));
        
        // Check if it's an HTML error page
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          return NextResponse.json(
            {
              error: 'WooCommerce API returned an HTML page instead of JSON',
              details: process.env.NODE_ENV === 'development' 
                ? `The API URL "${apiUrl}" appears to be incorrect. It should point to your WooCommerce REST API endpoint (e.g., https://yourstore.com/wp-json/wc/v3). Please verify the API URL in admin settings.` 
                : 'Please check your WooCommerce API URL configuration in admin settings.',
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an invalid response format',
            details: process.env.NODE_ENV === 'development' 
              ? 'The API returned non-JSON content. Please check your API URL and credentials.' 
              : undefined,
          },
          { status: 500 }
        );
      }
      orders = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse WooCommerce response:', parseError);
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

    // Handle case where WooCommerce returns a single order object instead of array
    let ordersArray = Array.isArray(orders) ? orders : [orders];

    // If we don't have customerId or fetched all orders, filter by email
    // This ensures we only return orders for the specified email
    if (!customerId && ordersArray.length > 0) {
      ordersArray = ordersArray.filter((order: any) => {
        const orderEmail = (
          order.billing?.email?.toLowerCase().trim() ||
          order.customer_email?.toLowerCase().trim() ||
          ''
        );
        return orderEmail === normalizedEmail;
      });
    }

    // Enrich orders with product details (name, quantity, image)
    const enrichedOrders = await Promise.all(
      ordersArray.map(async (order: any) => {
        if (!order.line_items || !Array.isArray(order.line_items)) {
          return {
            ...order,
            items: [],
          };
        }

        // Enrich each line item with product details
        const enrichedItems = await Promise.all(
          order.line_items.map(async (item: any) => {
            const productDetails: any = {
              id: item.id,
              name: item.name || 'Unknown Product',
              quantity: item.quantity || 0,
              price: item.price || '0',
              subtotal: item.subtotal || '0',
              total: item.total || '0',
              sku: item.sku || '',
              image: null,
              product_id: item.product_id || null,
              variation_id: item.variation_id || null,
            };

            // Fetch product details to get image
            if (item.product_id) {
              try {
                const productUrl = `${apiUrl}/products/${item.product_id}`;
                const productResponse = await fetch(productUrl, {
                  method: 'GET',
                  headers: authHeaders,
                });

                if (productResponse.ok) {
                  const productContentType = productResponse.headers.get('content-type');
                  if (productContentType && productContentType.includes('application/json')) {
                    try {
                      const product = await productResponse.json();
                      // Get the first image URL
                      if (product.images && product.images.length > 0) {
                        productDetails.image = product.images[0].src || null;
                      }
                      // Update name if product has a different name
                      if (product.name) {
                        productDetails.name = product.name;
                      }
                    } catch (productParseError) {
                      console.error(`Failed to parse product ${item.product_id} response:`, productParseError);
                      // Continue without product image
                    }
                  }
                }
              } catch (productError) {
                console.error(`Failed to fetch product ${item.product_id}:`, productError);
                // Continue without product image
              }
            }

            return productDetails;
          })
        );

        // Return order with all status information included
        // Include all status fields: status, date_created, date_modified, date_completed, etc.
        return {
          ...order,
          items: enrichedItems,
          // Ensure all status-related fields are included
          status: order.status || 'unknown',
          date_created: order.date_created || order.date_created_gmt || null,
          date_modified: order.date_modified || order.date_modified_gmt || null,
          date_completed: order.date_completed || order.date_completed_gmt || null,
          date_paid: order.date_paid || order.date_paid_gmt || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      count: enrichedOrders.length,
      orders: enrichedOrders,
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

