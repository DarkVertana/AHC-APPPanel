import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

// Cache settings for 5 minutes to reduce database queries
let cachedSettings: any = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * WooCommerce Billing Address Endpoint
 * 
 * GET: Retrieves billing address for a customer by email
 * PUT: Updates billing address for a customer by email
 * 
 * GET Query Parameters:
 * - email: User email (required)
 * 
 * PUT Request Body:
 * - email: User email (required)
 * - billing: Billing address object (required)
 *   - first_name: First name
 *   - last_name: Last name
 *   - company: Company name (optional)
 *   - address_1: Street address line 1
 *   - address_2: Street address line 2 (optional)
 *   - city: City
 *   - state: State/Province code
 *   - postcode: Postal/ZIP code
 *   - country: Country code (ISO 3166-1 alpha-2)
 *   - email: Email address
 *   - phone: Phone number
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
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

    // Helper function to fetch billing address from WooCommerce
    async function fetchBillingAddressFromWooCommerce(email: string) {
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

      // Try to get customer by email
      let customerId: number | null = null;
      let customer: any = null;
      
      try {
        const customersUrl = new URL(`${apiUrl}/customers`);
        customersUrl.searchParams.append('email', email);
        customersUrl.searchParams.append('per_page', '1');

        const customersResponse = await fetch(customersUrl.toString(), {
          method: 'GET',
          headers: authHeaders,
        });

        const customersContentType = customersResponse.headers.get('content-type');
        const isCustomersJson = customersContentType && customersContentType.includes('application/json');

        if (customersResponse.ok && isCustomersJson) {
          const customers = await customersResponse.json();
          const customersArray = Array.isArray(customers) ? customers : [customers];
          
          if (customersArray.length > 0 && customersArray[0].id) {
            customer = customersArray[0];
            customerId = parseInt(customersArray[0].id);
          }
        }
      } catch (customerError) {
        // Continue to try alternative methods
      }

      // If customer not found, try to find from orders or subscriptions
      if (!customer) {
        // Try orders first
        try {
          const ordersUrl = new URL(`${apiUrl}/orders`);
          ordersUrl.searchParams.append('per_page', '10');
          
          const ordersResponse = await fetch(ordersUrl.toString(), {
            method: 'GET',
            headers: authHeaders,
          });

          if (ordersResponse.ok) {
            const ordersContentType = ordersResponse.headers.get('content-type');
            const isOrdersJson = ordersContentType && ordersContentType.includes('application/json');
            
            if (isOrdersJson) {
              const orders = await ordersResponse.json();
              const ordersArray = Array.isArray(orders) ? orders : [orders];
              
              const matchingOrder = ordersArray.find((order: any) => {
                const orderEmail = (
                  order.billing?.email?.toLowerCase().trim() ||
                  order.customer_email?.toLowerCase().trim() ||
                  ''
                );
                return orderEmail === email && order.customer_id;
              });
              
              if (matchingOrder && matchingOrder.customer_id) {
                customerId = parseInt(matchingOrder.customer_id);
                
                const customerByIdUrl = `${apiUrl}/customers/${customerId}`;
                const customerByIdResponse = await fetch(customerByIdUrl, {
                  method: 'GET',
                  headers: authHeaders,
                });
                
                if (customerByIdResponse.ok) {
                  const customerContentType = customerByIdResponse.headers.get('content-type');
                  if (customerContentType && customerContentType.includes('application/json')) {
                    customer = await customerByIdResponse.json();
                  }
                }
              }
            }
          }
        } catch (orderError) {
          // Continue
        }

        // Try subscriptions if still not found
        if (!customer) {
          try {
            const subscriptionsUrl = new URL(`${apiUrl}/subscriptions`);
            subscriptionsUrl.searchParams.append('per_page', '10');
            
            const subscriptionsResponse = await fetch(subscriptionsUrl.toString(), {
              method: 'GET',
              headers: authHeaders,
            });

            if (subscriptionsResponse.ok) {
              const subsContentType = subscriptionsResponse.headers.get('content-type');
              const isSubsJson = subsContentType && subsContentType.includes('application/json');
              
              if (isSubsJson) {
                const subscriptions = await subscriptionsResponse.json();
                const subsArray = Array.isArray(subscriptions) ? subscriptions : [subscriptions];
                
                const matchingSub = subsArray.find((sub: any) => {
                  const subEmail = (
                    sub.billing?.email?.toLowerCase().trim() ||
                    sub.customer_email?.toLowerCase().trim() ||
                    ''
                  );
                  return subEmail === email && sub.customer_id;
                });
                
                if (matchingSub && matchingSub.customer_id) {
                  customerId = parseInt(matchingSub.customer_id);
                  
                  const customerByIdUrl = `${apiUrl}/customers/${customerId}`;
                  const customerByIdResponse = await fetch(customerByIdUrl, {
                    method: 'GET',
                    headers: authHeaders,
                  });
                  
                  if (customerByIdResponse.ok) {
                    const customerContentType = customerByIdResponse.headers.get('content-type');
                    if (customerContentType && customerContentType.includes('application/json')) {
                      customer = await customerByIdResponse.json();
                    }
                  }
                }
              }
            }
          } catch (subError) {
            // Continue
          }
        }
      }

      // If customer still not found, return empty billing address
      if (!customer) {
        return {
          success: true,
          email: email,
          customerId: null,
          billing: {
            first_name: '',
            last_name: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
            email: email,
            phone: '',
          },
          message: 'Customer not found in WooCommerce. Billing address is empty.',
        };
      }

      // Extract billing address
      const billingAddress = {
        first_name: customer.billing?.first_name || customer.first_name || '',
        last_name: customer.billing?.last_name || customer.last_name || '',
        company: customer.billing?.company || '',
        address_1: customer.billing?.address_1 || '',
        address_2: customer.billing?.address_2 || '',
        city: customer.billing?.city || '',
        state: customer.billing?.state || '',
        postcode: customer.billing?.postcode || '',
        country: customer.billing?.country || '',
        email: customer.billing?.email || customer.email || email,
        phone: customer.billing?.phone || customer.phone || '',
      };

      return {
        success: true,
        email: email,
        customerId: customer.id,
        billing: billingAddress,
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
      responseData = await fetchBillingAddressFromWooCommerce(normalizedEmail);
    } catch (error: any) {
      console.error('Failed to fetch billing address from WooCommerce:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch billing address from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? error.message 
            : undefined,
        },
        { status: 500 }
      );
    }

    const responseTime = Date.now() - startTime;
    return NextResponse.json({
      ...responseData,
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    console.error('Get WooCommerce billing address error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching billing address from WooCommerce';

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
 * Update WooCommerce Billing Address
 */
export async function PUT(request: NextRequest) {
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
    const { email, billing } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!billing) {
      return NextResponse.json(
        { error: 'Billing address object is required' },
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

    // Try to get customer by email - similar to orders/subscriptions approach
    let customerId: number | null = null;
    let customer: any = null;
    
    try {
      const customersUrl = new URL(`${apiUrl}/customers`);
      customersUrl.searchParams.append('email', normalizedEmail);
      customersUrl.searchParams.append('per_page', '1');

      const customersResponse = await fetch(customersUrl.toString(), {
        method: 'GET',
        headers: authHeaders,
      });

      // Check if response is JSON
      const customersContentType = customersResponse.headers.get('content-type');
      const isCustomersJson = customersContentType && customersContentType.includes('application/json');

      if (customersResponse.ok && isCustomersJson) {
        try {
          const customersText = await customersResponse.text();
          const customers = JSON.parse(customersText);
          const customersArray = Array.isArray(customers) ? customers : [customers];
          
          if (customersArray.length > 0 && customersArray[0].id) {
            customer = customersArray[0];
            customerId = parseInt(customersArray[0].id);
            console.log(`Found customer ID ${customerId} for email ${normalizedEmail}`);
          } else {
            console.log(`No customer found for email ${normalizedEmail}, will try to find from orders/subscriptions`);
          }
        } catch (parseError) {
          console.error('Failed to parse customers response:', parseError);
          // Continue to try alternative methods
        }
      } else {
        console.log(`Customer lookup returned ${customersResponse.status}, will try to find from orders/subscriptions`);
      }
    } catch (customerError) {
      console.error('Error fetching customer:', customerError);
      // Continue to try alternative methods
    }

    // If customer not found, try to find customer ID from orders or subscriptions in parallel
    if (!customer) {
      // Make parallel requests to orders and subscriptions to find customer ID
      // Use smaller per_page (3) for faster lookup
      const [ordersResponse, subscriptionsResponse] = await Promise.allSettled([
        fetch(`${apiUrl}/orders?per_page=3`, { method: 'GET', headers: authHeaders }),
        fetch(`${apiUrl}/subscriptions?per_page=3`, { method: 'GET', headers: authHeaders }),
      ]);

      // Try orders first (more common)
      if (ordersResponse.status === 'fulfilled' && ordersResponse.value.ok) {
        try {
          const ordersContentType = ordersResponse.value.headers.get('content-type');
          if (ordersContentType && ordersContentType.includes('application/json')) {
            const orders = await ordersResponse.value.json();
            const ordersArray = Array.isArray(orders) ? orders : [orders];
            
            // Find first order with matching email
            const matchingOrder = ordersArray.find((order: any) => {
              const orderEmail = (
                order.billing?.email?.toLowerCase().trim() ||
                order.customer_email?.toLowerCase().trim() ||
                ''
              );
              return orderEmail === normalizedEmail && order.customer_id;
            });
            
            if (matchingOrder?.customer_id) {
              customerId = parseInt(matchingOrder.customer_id);
            }
          }
        } catch (e) {
          // Ignore parse errors, continue
        }
      }

      // Try subscriptions if orders didn't find customer
      if (!customerId && subscriptionsResponse.status === 'fulfilled' && subscriptionsResponse.value.ok) {
        try {
          const subsContentType = subscriptionsResponse.value.headers.get('content-type');
          if (subsContentType && subsContentType.includes('application/json')) {
            const subscriptions = await subscriptionsResponse.value.json();
            const subsArray = Array.isArray(subscriptions) ? subscriptions : [subscriptions];
            
            const matchingSub = subsArray.find((sub: any) => {
              const subEmail = (
                sub.billing?.email?.toLowerCase().trim() ||
                sub.customer_email?.toLowerCase().trim() ||
                ''
              );
              return subEmail === normalizedEmail && sub.customer_id;
            });
            
            if (matchingSub?.customer_id) {
              customerId = parseInt(matchingSub.customer_id);
            }
          }
        } catch (e) {
          // Ignore parse errors, continue
        }
      }

      // If we found customer ID, fetch customer details
      if (customerId) {
        try {
          const customerByIdResponse = await fetch(`${apiUrl}/customers/${customerId}`, {
            method: 'GET',
            headers: authHeaders,
          });
          
          if (customerByIdResponse.ok) {
            const customerContentType = customerByIdResponse.headers.get('content-type');
            if (customerContentType && customerContentType.includes('application/json')) {
              customer = await customerByIdResponse.json();
            }
          }
        } catch (e) {
          // Ignore errors, will create new customer
        }
      }
    }

    // If customer still not found, create a new customer with the billing address
    if (!customer) {
      console.log('Customer not found, creating new customer with billing address...');
      
      try {
        // Create new customer with billing address
        const createCustomerUrl = `${apiUrl}/customers`;
        const newCustomerData = {
          email: normalizedEmail,
          billing: {
            ...billing,
            email: billing.email || normalizedEmail,
          },
        };

        const createResponse = await fetch(createCustomerUrl, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(newCustomerData),
        });

        if (createResponse.ok) {
          const createContentType = createResponse.headers.get('content-type');
          const isCreateJson = createContentType && createContentType.includes('application/json');
          
          if (isCreateJson) {
            const createText = await createResponse.text();
            customer = JSON.parse(createText);
            customerId = customer.id;
            console.log(`Created new customer with ID ${customerId} for email ${normalizedEmail}`);
          }
        } else {
          const errorText = await createResponse.text();
          console.error('Failed to create customer:', errorText);
          return NextResponse.json(
            {
              error: 'Customer not found and could not be created',
              details: process.env.NODE_ENV === 'development' 
                ? `WooCommerce API returned ${createResponse.status}: ${errorText.substring(0, 500)}` 
                : 'Please ensure the customer exists in WooCommerce or contact support.',
            },
            { status: 500 }
          );
        }
      } catch (createError) {
        console.error('Error creating customer:', createError);
        return NextResponse.json(
          {
            error: 'Customer not found and could not be created',
            details: process.env.NODE_ENV === 'development' && createError instanceof Error
              ? createError.message
              : 'Please ensure the customer exists in WooCommerce or contact support.',
          },
          { status: 500 }
        );
      }
    }

    // Ensure customerId is set from customer object
    if (!customerId && customer && customer.id) {
      customerId = parseInt(customer.id);
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Unable to determine customer ID' },
        { status: 500 }
      );
    }

    // Prepare billing address update
    // Merge with existing billing data to preserve fields not being updated
    // Only update fields that are provided in the request
    const updatedBilling = {
      ...(customer.billing || {}),
      ...billing,
      // Ensure email is set
      email: billing.email || customer.billing?.email || normalizedEmail,
    };

    // Validate required fields for billing address
    if (!updatedBilling.first_name || !updatedBilling.last_name) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    if (!updatedBilling.address_1 || !updatedBilling.city || !updatedBilling.state || !updatedBilling.postcode || !updatedBilling.country) {
      return NextResponse.json(
        { error: 'Address line 1, city, state, postcode, and country are required' },
        { status: 400 }
      );
    }

    // Update customer billing address
    const updateUrl = `${apiUrl}/customers/${customerId}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        billing: updatedBilling,
      }),
    });

    // Check if response is JSON
    const updateContentType = updateResponse.headers.get('content-type');
    const isUpdateJson = updateContentType && updateContentType.includes('application/json');

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('WooCommerce update billing address error:', {
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        error: errorText.substring(0, 500),
      });

      if (!isUpdateJson && errorText.includes('<!DOCTYPE')) {
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
          error: 'Failed to update billing address in WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${updateResponse.status}: ${updateResponse.statusText}` 
            : undefined,
        },
        { status: updateResponse.status || 500 }
      );
    }

    // Parse updated customer data
    let updatedCustomer;
    try {
      const updateText = await updateResponse.text();
      if (!isUpdateJson) {
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
      updatedCustomer = JSON.parse(updateText);
    } catch (parseError) {
      console.error('Failed to parse update response:', parseError);
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

    // Extract updated billing address - ensure all fields are properly extracted
    const billingAddress = {
      first_name: updatedCustomer.billing?.first_name || updatedCustomer.first_name || '',
      last_name: updatedCustomer.billing?.last_name || updatedCustomer.last_name || '',
      company: updatedCustomer.billing?.company || '',
      address_1: updatedCustomer.billing?.address_1 || '',
      address_2: updatedCustomer.billing?.address_2 || '',
      city: updatedCustomer.billing?.city || '',
      state: updatedCustomer.billing?.state || '',
      postcode: updatedCustomer.billing?.postcode || '',
      country: updatedCustomer.billing?.country || '',
      email: updatedCustomer.billing?.email || updatedCustomer.email || normalizedEmail,
      phone: updatedCustomer.billing?.phone || updatedCustomer.phone || '',
    };

    return NextResponse.json({
      success: true,
      message: 'Billing address updated successfully',
      email: normalizedEmail,
      customerId: updatedCustomer.id,
      billing: billingAddress,
    });
  } catch (error) {
    console.error('Update WooCommerce billing address error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while updating billing address in WooCommerce';

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




