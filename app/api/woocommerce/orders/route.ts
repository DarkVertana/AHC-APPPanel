import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * Get WooCommerce Orders by Customer Email Endpoint
 * 
 * This endpoint retrieves order data from WooCommerce based on the user's email.
 * 
 * Query Parameters:
 * - email: User email (required) - matches the wp_user_email from Flutter app
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - List of orders for the specified customer email
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

    // First, try to get customer by email to get customer ID
    // This ensures we can fetch orders reliably
    const customersUrl = new URL(`${apiUrl}/customers`);
    customersUrl.searchParams.append('email', normalizedEmail);
    customersUrl.searchParams.append('per_page', '1');

    const customersResponse = await fetch(customersUrl.toString(), {
      method: 'GET',
      headers: authHeaders,
    });

    let customerId: number | null = null;

    if (customersResponse.ok) {
      // Check if response is JSON before parsing
      const customersContentType = customersResponse.headers.get('content-type');
      const isCustomersJson = customersContentType && customersContentType.includes('application/json');
      
      if (isCustomersJson) {
        try {
          const customers = await customersResponse.json();
          const customersArray = Array.isArray(customers) ? customers : [customers];
          if (customersArray.length > 0 && customersArray[0].id) {
            customerId = customersArray[0].id;
          }
        } catch (parseError) {
          console.error('Failed to parse customers response:', parseError);
          // Continue without customer ID - will use email fallback
        }
      } else {
        // If customers endpoint returns HTML, log it but continue
        const errorText = await customersResponse.text();
        console.warn('WooCommerce customers API returned non-JSON response. Will use email for orders lookup.');
        if (process.env.NODE_ENV === 'development') {
          console.log('Response preview:', errorText.substring(0, 200));
        }
        // If we get HTML, it might mean the API URL is wrong - but continue anyway
      }
    }

    // Fetch orders from WooCommerce API
    // Use customer ID if available, otherwise try with email
    const ordersUrl = new URL(`${apiUrl}/orders`);
    if (customerId) {
      ordersUrl.searchParams.append('customer', customerId.toString());
    } else {
      // Fallback: try with email (some WooCommerce versions support this)
      ordersUrl.searchParams.append('customer', normalizedEmail);
    }
    ordersUrl.searchParams.append('per_page', '100'); // Get up to 100 orders

    const woocommerceResponse = await fetch(ordersUrl.toString(), {
      method: 'GET',
      headers: authHeaders,
    });

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
    const ordersArray = Array.isArray(orders) ? orders : [orders];

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

        return {
          ...order,
          items: enrichedItems,
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

