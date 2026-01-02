import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

// Cache settings for 5 minutes to reduce database queries
let cachedSettings: any = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Enable Next.js caching for this route (60 seconds)
export const revalidate = 60;

/**
 * WooCommerce Products Endpoint
 * 
 * GET: Retrieves product data from WooCommerce.
 * 
 * GET Query Parameters:
 * - search: Search term to filter products by name (optional)
 * - category: Category ID to filter products (optional)
 * - per_page: Number of products per page (optional, default: 10)
 * - page: Page number for pagination (optional, default: 1)
 * - status: Product status filter - 'publish', 'draft', 'pending', 'private' (optional, default: 'publish')
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Returns:
 * - List of products with details (name, price, images, description, etc.)
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
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const perPage = searchParams.get('per_page') || '10';
    const page = searchParams.get('page') || '1';
    const status = searchParams.get('status') || 'publish';

    // Validate pagination parameters
    const perPageNum = parseInt(perPage, 10);
    const pageNum = parseInt(page, 10);
    
    if (isNaN(perPageNum) || perPageNum < 1 || perPageNum > 100) {
      return NextResponse.json(
        { error: 'per_page must be a number between 1 and 100' },
        { status: 400 }
      );
    }

    if (isNaN(pageNum) || pageNum < 1) {
      return NextResponse.json(
        { error: 'page must be a positive number' },
        { status: 400 }
      );
    }

    // Get WooCommerce settings from database (with caching)
    let settings;
    const now = Date.now();
    if (cachedSettings && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
      settings = cachedSettings;
    } else {
      settings = await prisma.settings.findUnique({
        where: { id: 'settings' },
      });
      if (settings) {
        cachedSettings = settings;
        settingsCacheTime = now;
      }
    }

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

    // Build products URL with query parameters
    const productsUrl = new URL(`${apiUrl}/products`);
    
    // Add query parameters
    productsUrl.searchParams.append('per_page', perPageNum.toString());
    productsUrl.searchParams.append('page', pageNum.toString());
    productsUrl.searchParams.append('status', status);
    
    if (search) {
      productsUrl.searchParams.append('search', search);
    }
    
    if (category) {
      const categoryNum = parseInt(category, 10);
      if (!isNaN(categoryNum)) {
        productsUrl.searchParams.append('category', categoryNum.toString());
      }
    }

    // Fetch products from WooCommerce API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

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
        return NextResponse.json(
          {
            error: 'Request timeout. WooCommerce API took too long to respond.',
            details: process.env.NODE_ENV === 'development' 
              ? 'The request exceeded 5 seconds. Please check your WooCommerce API connection.' 
              : undefined,
          },
          { status: 504 }
        );
      }
      throw fetchError;
    }

    // Check if response is JSON
    const contentType = woocommerceResponse.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!woocommerceResponse.ok) {
      const errorText = await woocommerceResponse.text();
      console.error('WooCommerce Products API error:', {
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
          error: 'Failed to fetch products from WooCommerce',
          details: process.env.NODE_ENV === 'development' 
            ? `WooCommerce API returned ${woocommerceResponse.status}: ${woocommerceResponse.statusText}` 
            : undefined,
        },
        { status: woocommerceResponse.status || 500 }
      );
    }

    // Parse JSON response
    let products;
    try {
      const responseText = await woocommerceResponse.text();
      if (!isJson) {
        console.error('WooCommerce Products API returned non-JSON response:', responseText.substring(0, 500));
        
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
      products = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse WooCommerce products response:', parseError);
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

    // Handle case where WooCommerce returns a single product object instead of array
    const productsArray = Array.isArray(products) ? products : [products];

    // Get pagination info from response headers
    const totalProducts = woocommerceResponse.headers.get('x-wp-total');
    const totalPages = woocommerceResponse.headers.get('x-wp-totalpages');

    // Enrich products with formatted data (optimized - only essential fields)
    const enrichedProducts = productsArray.map((product: any) => ({
      id: product.id || null,
      name: product.name || '',
      slug: product.slug || '',
      permalink: product.permalink || '',
      type: product.type || 'simple',
      status: product.status || 'publish',
      featured: product.featured || false,
      description: product.description || '',
      short_description: product.short_description || '',
      sku: product.sku || '',
      price: product.price || '0',
      regular_price: product.regular_price || '0',
      sale_price: product.sale_price || '',
      on_sale: product.on_sale || false,
      stock_status: product.stock_status || 'instock',
      stock_quantity: product.stock_quantity || null,
      images: product.images || [],
      categories: product.categories || [],
      tags: product.tags || [],
      date_created: product.date_created || product.date_created_gmt || null,
      date_modified: product.date_modified || product.date_modified_gmt || null,
    }));

    return NextResponse.json({
      success: true,
      page: pageNum,
      per_page: perPageNum,
      total: totalProducts ? parseInt(totalProducts, 10) : enrichedProducts.length,
      total_pages: totalPages ? parseInt(totalPages, 10) : 1,
      count: enrichedProducts.length,
      products: enrichedProducts,
    });
  } catch (error) {
    console.error('Get WooCommerce products error:', error);
    
    // Return detailed error in development, generic in production
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
