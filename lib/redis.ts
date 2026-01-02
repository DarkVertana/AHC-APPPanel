import { Redis } from '@upstash/redis';

/**
 * Upstash Redis Configuration
 * 
 * Performance optimizations:
 * - Connection pooling (handled by Upstash SDK)
 * - Automatic retries with exponential backoff
 * - Edge-optimized for low latency
 * 
 * Cache TTL Strategy:
 * - Products: 5 minutes (frequently updated inventory)
 * - Blogs: 30 minutes (less frequently updated)
 * - Settings: 10 minutes (rarely changes)
 * - API Keys: 2 minutes (security balance)
 */

// Initialize Redis client with Upstash URL
const redis = new Redis({
  url: 'https://endless-platypus-10721.upstash.io',
  token: 'ASnhAAIncDIyNDAxYmU3YTRkODY0MzU4OTRiOTFiZjQwNTIyZGY1YXAyMTA3MjE',
});

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  PRODUCTS: 5 * 60,        // 5 minutes
  PRODUCTS_SEARCH: 2 * 60, // 2 minutes for search results
  BLOGS: 30 * 60,          // 30 minutes
  SETTINGS: 10 * 60,       // 10 minutes
  API_KEYS: 2 * 60,        // 2 minutes
  ORDERS: 3 * 60,          // 3 minutes (orders change frequently)
  SUBSCRIPTIONS: 5 * 60,   // 5 minutes (subscriptions change less frequently)
  BILLING_ADDRESS: 10 * 60, // 10 minutes (billing address changes infrequently)
} as const;

// Cache key prefixes
export const CACHE_KEYS = {
  PRODUCTS: 'wc:products',
  BLOGS: 'wp:blogs',
  SETTINGS: 'app:settings',
  API_KEYS: 'app:apikeys',
  ORDERS: 'wc:orders',
  SUBSCRIPTIONS: 'wc:subscriptions',
  BILLING_ADDRESS: 'wc:billing',
} as const;

/**
 * Get cached data from Redis
 * @param key - Cache key
 * @returns Cached data or null
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(key);
    return data;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
}

/**
 * Get cached data with stale detection (for stale-while-revalidate pattern)
 * @param key - Cache key
 * @param staleThreshold - TTL threshold in seconds to consider data stale (default: 30)
 * @returns Object with data, isStale flag, and ttl remaining
 */
export async function getCacheWithStale<T>(
  key: string,
  staleThreshold: number = 30
): Promise<{ data: T | null; isStale: boolean; ttl: number }> {
  try {
    // Get data and TTL in parallel
    const [data, ttl] = await Promise.all([
      redis.get<T>(key),
      redis.ttl(key),
    ]);

    if (data === null) {
      return { data: null, isStale: false, ttl: -1 };
    }

    // TTL < 0 means key doesn't exist or has no expiration
    // TTL < staleThreshold means data is stale (expiring soon)
    const isStale = ttl >= 0 && ttl < staleThreshold;

    return { data, isStale, ttl };
  } catch (error) {
    console.error('Redis getCacheWithStale error:', error);
    return { data: null, isStale: false, ttl: -1 };
  }
}

/**
 * Refresh cache in background (non-blocking)
 * Fetches fresh data and updates Redis cache asynchronously
 * @param key - Cache key
 * @param fetchFn - Function to fetch fresh data
 * @param ttl - Time to live in seconds
 */
export async function refreshCacheInBackground<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number
): Promise<void> {
  // Run asynchronously without blocking
  Promise.resolve().then(async () => {
    try {
      const freshData = await fetchFn();
      await setCache(key, freshData, ttl);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Background cache refresh completed for key: ${key}`);
      }
    } catch (error) {
      // Silently handle errors - don't block or throw
      console.error(`Background cache refresh failed for key ${key}:`, error);
    }
  }).catch((err) => {
    // Catch any unhandled errors
    console.error(`Background refresh promise error for key ${key}:`, err);
  });
}

/**
 * Set data in Redis cache with TTL
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in seconds
 */
export async function setCache<T>(key: string, data: T, ttl: number): Promise<boolean> {
  try {
    await redis.set(key, data, { ex: ttl });
    return true;
  } catch (error) {
    console.error('Redis SET error:', error);
    return false;
  }
}

/**
 * Delete a specific cache key
 * @param key - Cache key to delete
 */
export async function deleteCache(key: string): Promise<boolean> {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error);
    return false;
  }
}

/**
 * Delete multiple cache keys by pattern
 * @param pattern - Pattern prefix to match (e.g., 'wc:products')
 */
export async function deleteCacheByPattern(pattern: string): Promise<boolean> {
  try {
    // Get all keys matching pattern
    const keys = await redis.keys(`${pattern}*`);
    if (keys.length > 0) {
      // Delete all matching keys
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Redis pattern delete error:', error);
    return false;
  }
}

/**
 * Get or set cache with automatic fetch
 * @param key - Cache key
 * @param ttl - Time to live in seconds
 * @param fetchFn - Function to fetch data if not cached
 */
export async function getCacheOrFetch<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<{ data: T; fromCache: boolean }> {
  try {
    // Try to get from cache first
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }

    // Fetch fresh data
    const freshData = await fetchFn();
    
    // Store in cache (don't await - fire and forget for speed)
    redis.set(key, freshData, { ex: ttl }).catch((err) => {
      console.error('Redis cache set error:', err);
    });

    return { data: freshData, fromCache: false };
  } catch (error) {
    console.error('Redis getCacheOrFetch error:', error);
    // If Redis fails, still try to fetch fresh data
    const freshData = await fetchFn();
    return { data: freshData, fromCache: false };
  }
}

/**
 * Build cache key for products with query params
 */
export function buildProductsCacheKey(params: {
  page: number;
  perPage: number;
  search?: string | null;
  category?: string | null;
  status?: string;
}): string {
  const parts = [
    CACHE_KEYS.PRODUCTS,
    `p${params.page}`,
    `pp${params.perPage}`,
    `s${params.status || 'publish'}`,
  ];
  if (params.search) parts.push(`q${params.search}`);
  if (params.category) parts.push(`c${params.category}`);
  return parts.join(':');
}

/**
 * Build cache key for blogs
 */
export function buildBlogsCacheKey(): string {
  return `${CACHE_KEYS.BLOGS}:latest2`;
}

/**
 * Build cache key for orders by email
 */
export function buildOrdersCacheKey(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  // Use hash of email to avoid special characters in cache key
  return `${CACHE_KEYS.ORDERS}:${normalizedEmail}`;
}

/**
 * Build cache key for subscriptions by email
 */
export function buildSubscriptionsCacheKey(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  return `${CACHE_KEYS.SUBSCRIPTIONS}:${normalizedEmail}`;
}

/**
 * Build cache key for billing address by email
 */
export function buildBillingAddressCacheKey(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  return `${CACHE_KEYS.BILLING_ADDRESS}:${normalizedEmail}`;
}

/**
 * Check Redis connection health
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis ping error:', error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  productsKeys: number;
  blogsKeys: number;
  settingsKeys: number;
}> {
  try {
    const [productsKeys, blogsKeys, settingsKeys] = await Promise.all([
      redis.keys(`${CACHE_KEYS.PRODUCTS}*`),
      redis.keys(`${CACHE_KEYS.BLOGS}*`),
      redis.keys(`${CACHE_KEYS.SETTINGS}*`),
    ]);
    return {
      productsKeys: productsKeys.length,
      blogsKeys: blogsKeys.length,
      settingsKeys: settingsKeys.length,
    };
  } catch (error) {
    console.error('Redis stats error:', error);
    return { productsKeys: 0, blogsKeys: 0, settingsKeys: 0 };
  }
}

export default redis;
