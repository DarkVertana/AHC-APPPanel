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
  phone?: string;
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
    // Include role=all to search across all user roles (customer, administrator, etc.)
    const customersUrl = new URL(`${apiUrl}/customers`);
    customersUrl.searchParams.append('email', normalizedEmail);
    customersUrl.searchParams.append('role', 'all');
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
 * Stores WooCommerce customer ID and name in the database for future lookups
 * @param email - Customer email address
 * @param customerId - WooCommerce customer ID to cache
 * @param customerName - Optional WooCommerce customer full name to cache
 */
async function cacheCustomerId(email: string, customerId: number, customerName?: string): Promise<void> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Update the AppUser with the WooCommerce customer ID and name
    const data: { woocommerceCustomerId: number; wooCustomerName?: string } = {
      woocommerceCustomerId: customerId,
    };
    if (customerName) {
      data.wooCustomerName = customerName;
    }

    const result = await prisma.appUser.updateMany({
      where: { email: normalizedEmail },
      data,
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
 * 
 * Flow:
 * 1. Check if customer ID is cached in our database
 * 2. If cached, fetch customer by ID from WooCommerce (fast)
 * 3. If not cached, fetch customer by email from WooCommerce
 * 4. Cache the customer ID for future lookups
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
        // Note: This shouldn't happen since customer IDs don't change, but handle edge cases
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

  // Step 2: Fall back to email lookup via WooCommerce API
  const customer = await getCustomerByEmail(apiUrl, authHeaders, normalizedEmail);

  // Step 3: Cache the customer ID and name if found
  if (customer?.id) {
    // Get name from billing details, fallback to shipping
    const fullName =
      [customer.billing?.first_name, customer.billing?.last_name].filter(Boolean).join(' ').trim() ||
      [customer.shipping?.first_name, customer.shipping?.last_name].filter(Boolean).join(' ').trim();
    await cacheCustomerId(normalizedEmail, customer.id, fullName || undefined);
  }

  return customer;
}
