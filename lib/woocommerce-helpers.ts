/**
 * WooCommerce API Helper Functions
 *
 * Shared utilities for interacting with WooCommerce REST API
 * Used across multiple API endpoints to maintain DRY principles
 */

import { prisma } from '@/lib/prisma';

export interface WooCommerceCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    email?: string;
    phone?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

/**
 * Normalizes a WooCommerce API URL to ensure correct format
 * @param url - The WooCommerce API URL to normalize
 * @returns Normalized URL with /wp-json/wc/v3 path
 * @throws Error if URL cannot be normalized
 */
export function normalizeApiUrl(url: string): string {
  let apiUrl = url.replace(/\/$/, '');

  if (!apiUrl.includes('/wp-json/wc/')) {
    const baseUrl = apiUrl.replace(/\/wp-json.*$/, '');
    apiUrl = `${baseUrl}/wp-json/wc/v3`;
  }

  if (!apiUrl.includes('/wp-json/wc/')) {
    throw new Error('Invalid WooCommerce API URL format');
  }

  return apiUrl;
}

/**
 * Builds Basic Authentication headers for WooCommerce API
 * @param apiKey - WooCommerce API consumer key
 * @param apiSecret - WooCommerce API consumer secret
 * @returns Headers object with Authorization and Content-Type
 */
export function buildAuthHeaders(apiKey: string, apiSecret: string): HeadersInit {
  const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  return {
    'Authorization': `Basic ${authString}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

/**
 * Gets a WooCommerce customer by email address
 * Uses the official WooCommerce REST API customer endpoint with email filter
 *
 * @param apiUrl - Normalized WooCommerce API URL (e.g., https://example.com/wp-json/wc/v3)
 * @param authHeaders - Authentication headers for WooCommerce API
 * @param email - Customer email address to search for
 * @returns Customer object if found, null otherwise
 */
export async function getCustomerByEmail(
  apiUrl: string,
  authHeaders: HeadersInit,
  email: string
): Promise<WooCommerceCustomer | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Use official WooCommerce customer endpoint with email filter
    const customersUrl = new URL(`${apiUrl}/customers`);
    customersUrl.searchParams.append('email', normalizedEmail);
    customersUrl.searchParams.append('per_page', '1');

    console.log(`[WooCommerce Helper] Looking up customer by email: ${normalizedEmail}`);

    const customersResponse = await fetch(customersUrl.toString(), {
      method: 'GET',
      headers: authHeaders,
    });

    // Check if response is JSON
    const customersContentType = customersResponse.headers.get('content-type');
    const isCustomersJson = customersContentType && customersContentType.includes('application/json');

    if (!customersResponse.ok) {
      console.log(`[WooCommerce Helper] Customer lookup returned ${customersResponse.status}`);
      return null;
    }

    if (!isCustomersJson) {
      console.warn('[WooCommerce Helper] Customer endpoint returned non-JSON response');
      return null;
    }

    const customers = await customersResponse.json();
    const customersArray = Array.isArray(customers) ? customers : [customers];

    if (customersArray.length > 0 && customersArray[0].id) {
      const customer = customersArray[0];
      console.log(`[WooCommerce Helper] Found customer ID ${customer.id} for email ${normalizedEmail}`);
      return customer;
    }

    console.log(`[WooCommerce Helper] No customer found for email ${normalizedEmail}`);
    return null;
  } catch (error) {
    console.error('[WooCommerce Helper] Error fetching customer by email:', error);
    return null;
  }
}

/**
 * Gets a WooCommerce customer by email with fallback methods
 * First tries direct customer lookup, then tries to find customer from orders/subscriptions
 *
 * @param apiUrl - Normalized WooCommerce API URL
 * @param authHeaders - Authentication headers for WooCommerce API
 * @param email - Customer email address
 * @returns Customer object if found, null otherwise
 */
export async function getCustomerByEmailWithFallback(
  apiUrl: string,
  authHeaders: HeadersInit,
  email: string
): Promise<WooCommerceCustomer | null> {
  // Try direct customer lookup first
  let customer = await getCustomerByEmail(apiUrl, authHeaders, email);

  if (customer) {
    return customer;
  }

  // Fallback: Try to find customer ID from recent orders or subscriptions
  console.log('[WooCommerce Helper] Trying fallback: searching orders and subscriptions for customer ID');

  const normalizedEmail = email.toLowerCase().trim();
  let customerId: number | null = null;

  try {
    // Make parallel requests to orders and subscriptions
    const [ordersResponse, subscriptionsResponse] = await Promise.allSettled([
      fetch(`${apiUrl}/orders?per_page=5`, { method: 'GET', headers: authHeaders }),
      fetch(`${apiUrl}/subscriptions?per_page=5`, { method: 'GET', headers: authHeaders }),
    ]);

    // Try orders first
    if (ordersResponse.status === 'fulfilled' && ordersResponse.value.ok) {
      try {
        const ordersContentType = ordersResponse.value.headers.get('content-type');
        if (ordersContentType && ordersContentType.includes('application/json')) {
          const orders = await ordersResponse.value.json();
          const ordersArray = Array.isArray(orders) ? orders : [orders];

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
        // Ignore errors
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
        // Ignore errors
      }
    }

    // If we found customer ID via fallback, fetch full customer details
    if (customerId) {
      console.log(`[WooCommerce Helper] Found customer ID ${customerId} via fallback method`);

      const customerByIdResponse = await fetch(`${apiUrl}/customers/${customerId}`, {
        method: 'GET',
        headers: authHeaders,
      });

      if (customerByIdResponse.ok) {
        const customerContentType = customerByIdResponse.headers.get('content-type');
        if (customerContentType && customerContentType.includes('application/json')) {
          customer = await customerByIdResponse.json();
          console.log(`[WooCommerce Helper] Successfully retrieved customer ${customerId} details`);
          return customer;
        }
      }
    }
  } catch (error) {
    console.error('[WooCommerce Helper] Error in fallback customer lookup:', error);
  }

  return null;
}

/**
 * Gets cached WooCommerce customer ID from the database
 * @param email - Customer email address
 * @returns Cached customer ID if found, null otherwise
 */
async function getCachedCustomerId(email: string): Promise<number | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const appUser = await prisma.appUser.findFirst({
      where: { email: normalizedEmail },
      select: { woocommerceCustomerId: true },
    });

    if (appUser?.woocommerceCustomerId) {
      console.log(`[WooCommerce Helper] Found cached customer ID ${appUser.woocommerceCustomerId} for email ${normalizedEmail}`);
      return appUser.woocommerceCustomerId;
    }

    return null;
  } catch (error) {
    console.error('[WooCommerce Helper] Error fetching cached customer ID:', error);
    return null;
  }
}

/**
 * Stores WooCommerce customer ID in the database for future lookups
 * @param email - Customer email address
 * @param customerId - WooCommerce customer ID to cache
 */
async function cacheCustomerId(email: string, customerId: number): Promise<void> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Update the AppUser with the WooCommerce customer ID
    const result = await prisma.appUser.updateMany({
      where: { email: normalizedEmail },
      data: { woocommerceCustomerId: customerId },
    });

    if (result.count > 0) {
      console.log(`[WooCommerce Helper] Cached customer ID ${customerId} for email ${normalizedEmail}`);
    } else {
      console.log(`[WooCommerce Helper] No AppUser found for email ${normalizedEmail} to cache customer ID`);
    }
  } catch (error) {
    console.error('[WooCommerce Helper] Error caching customer ID:', error);
    // Don't throw - caching failure shouldn't break the main flow
  }
}

/**
 * Gets a WooCommerce customer by email with database caching
 * First checks if customer ID is cached in database, then falls back to API call
 * Caches the customer ID for future lookups
 *
 * @param apiUrl - Normalized WooCommerce API URL
 * @param authHeaders - Authentication headers for WooCommerce API
 * @param email - Customer email address
 * @returns Customer object if found, null otherwise
 */
export async function getCustomerByEmailCached(
  apiUrl: string,
  authHeaders: HeadersInit,
  email: string
): Promise<WooCommerceCustomer | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Step 1: Check if customer ID is cached in database
  const cachedCustomerId = await getCachedCustomerId(normalizedEmail);

  if (cachedCustomerId) {
    // Fetch customer by ID directly (faster than email search)
    console.log(`[WooCommerce Helper] Using cached customer ID ${cachedCustomerId}`);

    try {
      const customerByIdResponse = await fetch(`${apiUrl}/customers/${cachedCustomerId}`, {
        method: 'GET',
        headers: authHeaders,
      });

      if (customerByIdResponse.ok) {
        const contentType = customerByIdResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const customer = await customerByIdResponse.json();
          console.log(`[WooCommerce Helper] Retrieved customer ${cachedCustomerId} from cache`);
          return customer;
        }
      } else if (customerByIdResponse.status === 404) {
        // Customer ID no longer valid in WooCommerce - clear the cache
        console.log(`[WooCommerce Helper] Cached customer ID ${cachedCustomerId} not found in WooCommerce, clearing cache`);
        await prisma.appUser.updateMany({
          where: { email: normalizedEmail },
          data: { woocommerceCustomerId: null },
        });
      }
    } catch (error) {
      console.error('[WooCommerce Helper] Error fetching customer by cached ID:', error);
    }
  }

  // Step 2: Fall back to email lookup
  const customer = await getCustomerByEmail(apiUrl, authHeaders, normalizedEmail);

  // Step 3: Cache the customer ID if found
  if (customer?.id) {
    await cacheCustomerId(normalizedEmail, customer.id);
  }

  return customer;
}

/**
 * Gets a WooCommerce customer by email with database caching and fallback methods
 * First checks database cache, then API, then fallback to orders/subscriptions
 * Caches the customer ID for future lookups
 *
 * @param apiUrl - Normalized WooCommerce API URL
 * @param authHeaders - Authentication headers for WooCommerce API
 * @param email - Customer email address
 * @returns Customer object if found, null otherwise
 */
export async function getCustomerByEmailCachedWithFallback(
  apiUrl: string,
  authHeaders: HeadersInit,
  email: string
): Promise<WooCommerceCustomer | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Step 1: Check if customer ID is cached in database
  const cachedCustomerId = await getCachedCustomerId(normalizedEmail);

  if (cachedCustomerId) {
    // Fetch customer by ID directly (faster than email search)
    console.log(`[WooCommerce Helper] Using cached customer ID ${cachedCustomerId}`);

    try {
      const customerByIdResponse = await fetch(`${apiUrl}/customers/${cachedCustomerId}`, {
        method: 'GET',
        headers: authHeaders,
      });

      if (customerByIdResponse.ok) {
        const contentType = customerByIdResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const customer = await customerByIdResponse.json();
          console.log(`[WooCommerce Helper] Retrieved customer ${cachedCustomerId} from cache`);
          return customer;
        }
      } else if (customerByIdResponse.status === 404) {
        // Customer ID no longer valid in WooCommerce - clear the cache
        console.log(`[WooCommerce Helper] Cached customer ID ${cachedCustomerId} not found in WooCommerce, clearing cache`);
        await prisma.appUser.updateMany({
          where: { email: normalizedEmail },
          data: { woocommerceCustomerId: null },
        });
      }
    } catch (error) {
      console.error('[WooCommerce Helper] Error fetching customer by cached ID:', error);
    }
  }

  // Step 2: Fall back to email lookup with fallback methods
  const customer = await getCustomerByEmailWithFallback(apiUrl, authHeaders, normalizedEmail);

  // Step 3: Cache the customer ID if found
  if (customer?.id) {
    await cacheCustomerId(normalizedEmail, customer.id);
  }

  return customer;
}
