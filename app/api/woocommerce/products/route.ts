import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { getCacheWithStale, setCache, buildProductsCacheKey, CACHE_TTL, refreshCacheInBackground } from '@/lib/redis';

// Cache settings for 5 minutes to reduce database queries
let cachedSettings: any = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Enable Next.js caching for this route (60 seconds)
export const revalidate = 60;

/**
 * WooCommerce Products Endpoint - Redis Cached
 * 
 * Flow: Client → Redis Cache → (miss) → WooCommerce API → Redis → Client
 * 
 * GET Query Parameters:
 * - search: Search term to filter products by name (optional)
 * - category: Category ID to filter products (optional)
 * - per_page: Number of products per page (optional, default: 10)
 * - page: Page number for pagination (optional, default: 1)
 * - status: Product status filter (optional, default: 'publish')
 * - nocache: Skip cache if set to '1' (optional)
 * 
 * Security:
 * - Requires valid API key in request headers
 * 
 * Performance:
 * - Redis cache TTL: 5 minutes (2 minutes for search)
 * - Response includes 'fromCache' indicator
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
    const searchParams = url.searchParams;
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const perPage = searchParams.get('per_page') || '10';
    const page = searchParams.get('page') || '1';
    const status = searchParams.get('status') || 'publish';
    const noCache = searchParams.get('nocache') === '1';

    // Validate pagination parameters
    const perPageNum = parseInt(perPage, 10);
    const pageNum = parseInt(page, 10);
    
    if (perPageNum < 1 || perPageNum > 100 || pageNum < 1) {
      return NextResponse.json(
        { error: perPageNum < 1 || perPageNum > 100 
          ? 'per_page must be a number between 1 and 100' 
          : 'page must be a positive number' },
        { status: 400 }
      );
    }

    // Build cache key
    const cacheKey = buildProductsCacheKey({
      page: pageNum,
      perPage: perPageNum,
      search,
      category,
      status,
    });

    // Check Redis cache with stale detection (unless nocache is set)
    if (!noCache) {
      const cacheResult = await getCacheWithStale<any>(cacheKey, 30); // 30 seconds stale threshold
      
      if (cacheResult.data) {
        const responseTime = Date.now() - startTime;
        
        // If data is stale, trigger background refresh and return stale data immediately
        if (cacheResult.isStale) {
          // Trigger background refresh (non-blocking)
          refreshCacheInBackground(
            cacheKey,
            async () => {
              // This function will be called in background to fetch fresh data
              return await fetchProductsFromWooCommerce({
                settings: await getWooCommerceSettings(),
                page: pageNum,
                perPage: perPageNum,
                search,
                category,
                status,
              });
            },
            search ? CACHE_TTL.PRODUCTS_SEARCH : CACHE_TTL.PRODUCTS
          ).catch(() => {}); // Ignore errors

          return NextResponse.json({
            ...cacheResult.data,
            fromCache: true,
            stale: true,
            refreshing: true,
            responseTime: `${responseTime}ms`,
          });
        }

        // Fresh cache hit - return immediately
        return NextResponse.json({
          ...cacheResult.data,
          fromCache: true,
          stale: false,
          refreshing: false,
          responseTime: `${responseTime}ms`,
        });
      }
    }

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

    // Helper function to fetch products from WooCommerce
    async function fetchProductsFromWooCommerce(params: {
      settings: any;
      page: number;
      perPage: number;
      search?: string | null;
      category?: string | null;
      status: string;
    }) {
      const { settings, page, perPage, search, category, status } = params;

      if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
        throw new Error('WooCommerce API credentials are not configured');
      }

      // Prepare WooCommerce API URL
      let apiUrl = settings.woocommerceApiUrl.endsWith('/') 
        ? settings.woocommerceApiUrl.slice(0, -1) 
        : settings.woocommerceApiUrl;
      
      if (!apiUrl.includes('/wp-json/wc/')) {
        const baseUrl = apiUrl.split('/wp-json')[0] || apiUrl;
        apiUrl = `${baseUrl}/wp-json/wc/v3`;
      }
      
      if (!apiUrl.includes('/wp-json/wc/')) {
        throw new Error('Invalid WooCommerce API URL format');
      }

      // Create Basic Auth header
      const authString = Buffer.from(`${settings.woocommerceApiKey}:${settings.woocommerceApiSecret}`).toString('base64');
      const authHeaders = {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      };

      // Build products URL
      const productsUrl = new URL(`${apiUrl}/products`);
      productsUrl.searchParams.set('per_page', perPage.toString());
      productsUrl.searchParams.set('page', page.toString());
      productsUrl.searchParams.set('status', status);
      
      if (search) productsUrl.searchParams.set('search', search);
      if (category) {
        const categoryNum = parseInt(category, 10);
        if (!isNaN(categoryNum)) productsUrl.searchParams.set('category', categoryNum.toString());
      }

      // Fetch from WooCommerce API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let woocommerceResponse: Response;
      try {
        woocommerceResponse = await fetch(productsUrl.toString(), {
          method: 'GET',
          headers: authHeaders,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw fetchError;
      }

      if (!woocommerceResponse.ok) {
        throw new Error(`WooCommerce API returned ${woocommerceResponse.status}`);
      }

      // Parse JSON response
      const contentType = woocommerceResponse.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      if (!isJson) {
        throw new Error('WooCommerce API returned invalid response format');
      }

      const products = await woocommerceResponse.json();
      const productsArray = Array.isArray(products) ? products : [products];
      const totalProducts = woocommerceResponse.headers.get('x-wp-total');
      const totalPages = woocommerceResponse.headers.get('x-wp-totalpages');

      // Transform products
      const enrichedProducts = productsArray.map((p: any) => ({
        id: p.id ?? null,
        name: p.name ?? '',
        slug: p.slug ?? '',
        permalink: p.permalink ?? '',
        type: p.type ?? 'simple',
        status: p.status ?? 'publish',
        featured: p.featured ?? false,
        description: p.description ?? '',
        short_description: p.short_description ?? '',
        sku: p.sku ?? '',
        price: p.price ?? '0',
        regular_price: p.regular_price ?? '0',
        sale_price: p.sale_price ?? '',
        on_sale: p.on_sale ?? false,
        stock_status: p.stock_status ?? 'instock',
        stock_quantity: p.stock_quantity ?? null,
        images: p.images ?? [],
        categories: p.categories ?? [],
        tags: p.tags ?? [],
        date_created: p.date_created ?? p.date_created_gmt ?? null,
        date_modified: p.date_modified ?? p.date_modified_gmt ?? null,
      }));

      return {
        success: true,
        page,
        per_page: perPage,
        total: totalProducts ? parseInt(totalProducts, 10) : enrichedProducts.length,
        total_pages: totalPages ? parseInt(totalPages, 10) : 1,
        count: enrichedProducts.length,
        products: enrichedProducts,
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

    // Cache miss - fetch fresh data from WooCommerce
    let responseData;
    try {
      responseData = await fetchProductsFromWooCommerce({
        settings,
        page: pageNum,
        perPage: perPageNum,
        search,
        category,
        status,
      });
    } catch (error: any) {
      console.error('Failed to fetch products from WooCommerce:', error);
      
      if (error.message === 'Request timeout') {
        return NextResponse.json(
          {
            error: 'Request timeout. WooCommerce API took too long to respond.',
            details: process.env.NODE_ENV === 'development' 
              ? 'The request exceeded 8 seconds.' 
              : undefined,
          },
          { status: 504 }
        );
      }

      if (error.message.includes('WooCommerce API returned')) {
        return NextResponse.json(
          {
            error: 'Failed to fetch products from WooCommerce',
            details: process.env.NODE_ENV === 'development' 
              ? error.message 
              : undefined,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch products from WooCommerce',
        },
        { status: 500 }
      );
    }

    // Store in Redis cache (async - don't wait)
    const cacheTTL = search ? CACHE_TTL.PRODUCTS_SEARCH : CACHE_TTL.PRODUCTS;
    setCache(cacheKey, responseData, cacheTTL).catch((err) => {
      console.error('Redis cache set error:', err);
    });

    const responseTime = Date.now() - startTime;
    return NextResponse.json({
      ...responseData,
      fromCache: false,
      stale: false,
      refreshing: false,
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    console.error('Get WooCommerce products error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching products from WooCommerce';

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
