import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware';
import { getCacheWithStale, setCache, buildBlogsCacheKey, CACHE_TTL, refreshCacheInBackground } from '@/lib/redis';

// Enable Next.js caching for this route (60 seconds)
export const revalidate = 60;

/**
 * WooCommerce Blogs API Endpoint - Redis Cached
 * 
 * Flow: Client → Redis Cache → (miss) → WordPress API → Redis → Client
 * 
 * GET: Retrieves the latest 2 blog posts from WordPress REST API.
 * 
 * Query Parameters:
 * - nocache: Skip cache if set to '1' (optional)
 * 
 * Security:
 * - Requires valid API key in request headers
 * 
 * Performance:
 * - Redis cache TTL: 30 minutes
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

    // Check for nocache parameter
    const url = new URL(request.url);
    const noCache = url.searchParams.get('nocache') === '1';

    // Build cache key
    const cacheKey = buildBlogsCacheKey();

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
              return await fetchBlogsFromWordPress();
            },
            CACHE_TTL.BLOGS
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

    // Helper function to fetch blogs from WordPress
    async function fetchBlogsFromWordPress() {
      const WORDPRESS_API_URL = 'https://alternatehealthclub.com/wp-json/wp/v2/posts';
      
      // Build URL with optimized parameters
      const wordpressUrl = new URL(WORDPRESS_API_URL);
      wordpressUrl.searchParams.set('per_page', '2');
      wordpressUrl.searchParams.set('orderby', 'date');
      wordpressUrl.searchParams.set('order', 'desc');
      wordpressUrl.searchParams.set('status', 'publish');
      wordpressUrl.searchParams.set('_embed', '1');
      wordpressUrl.searchParams.set('_fields', 'id,title,excerpt,content,date,modified,link,slug,tags,_embedded');

      // Fetch from WordPress with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let wordpressResponse: Response;
      try {
        wordpressResponse = await fetch(wordpressUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
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

      if (!wordpressResponse.ok) {
        throw new Error(`WordPress API returned ${wordpressResponse.status}`);
      }

      // Parse WordPress response
      const wordpressPosts = await wordpressResponse.json();

      // Transform WordPress posts
      const postsArray = Array.isArray(wordpressPosts) ? wordpressPosts : [wordpressPosts];
      const htmlStripRegex = /<[^>]*>/g;
      
      const blogs = postsArray.map((p: any) => {
        const excerpt = p.excerpt?.rendered ?? '';
        const content = p.content?.rendered ?? '';
        const featuredMedia = p._embedded?.['wp:featuredmedia']?.[0];
        
        // Extract tag names
        const allTerms = p._embedded?.['wp:term'];
        const tagNames = allTerms && Array.isArray(allTerms)
          ? allTerms.flat()
              .filter((t: any) => t?.taxonomy === 'post_tag')
              .map((t: any) => t?.name ?? t?.slug ?? '')
              .filter(Boolean)
          : [];

        return {
          id: String(p.id ?? ''),
          title: p.title?.rendered ?? p.title ?? '',
          tagline: excerpt ? excerpt.replace(htmlStripRegex, '').trim().substring(0, 200) : '',
          description: content ? content.replace(htmlStripRegex, '').trim().substring(0, 500) : '',
          tags: tagNames.length > 0 ? tagNames : (p.tags ?? []),
          featuredImage: featuredMedia?.source_url ?? 
                         featuredMedia?.media_details?.sizes?.full?.source_url ?? 
                         featuredMedia?.media_details?.sizes?.large?.source_url ?? '',
          createdAt: p.date ?? p.date_gmt ?? new Date().toISOString(),
          updatedAt: p.modified ?? p.modified_gmt ?? new Date().toISOString(),
          link: p.link ?? '',
          slug: p.slug ?? '',
        };
      });

      return {
        success: true,
        count: blogs.length,
        blogs: blogs,
      };
    }

    // Cache miss - fetch fresh data from WordPress
    let responseData;
    try {
      responseData = await fetchBlogsFromWordPress();
    } catch (error: any) {
      console.error('Failed to fetch blogs from WordPress:', error);
      
      if (error.message === 'Request timeout') {
        return NextResponse.json(
          {
            error: 'Request timeout. WordPress API took too long to respond.',
            details: process.env.NODE_ENV === 'development' 
              ? 'The request exceeded 8 seconds.' 
              : undefined,
          },
          { status: 504 }
        );
      }

      if (error.message.includes('WordPress API returned')) {
        return NextResponse.json(
          {
            error: 'Failed to fetch blogs from WordPress',
            details: process.env.NODE_ENV === 'development' 
              ? error.message 
              : undefined,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch blogs from WordPress',
        },
        { status: 500 }
      );
    }

    // Store in Redis cache (async - don't wait)
    setCache(cacheKey, responseData, CACHE_TTL.BLOGS).catch((err) => {
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
    console.error('Get WordPress blogs error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching blogs from WordPress',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error') 
          : undefined
      },
      { status: 500 }
    );
  }
}
