import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware';

// Cache blogs for 5 minutes to reduce WordPress API calls
let cachedBlogs: any = null;
let blogsCacheTime = 0;
const BLOGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Enable Next.js caching for this route (60 seconds)
export const revalidate = 60;

/**
 * WooCommerce Blogs API Endpoint
 * 
 * GET: Retrieves the latest 2 blog posts from WordPress REST API.
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * - Fetches from WordPress REST API: https://alternatehealthclub.com/wp-json/wp/v2/posts
 * - Always returns the 2 most recent blogs ordered by date
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

    // Check cache first
    const now = Date.now();
    if (cachedBlogs && (now - blogsCacheTime) < BLOGS_CACHE_TTL) {
      return NextResponse.json(cachedBlogs);
    }

    // WordPress REST API endpoint
    const WORDPRESS_API_URL = 'https://alternatehealthclub.com/wp-json/wp/v2/posts';
    
    // Fetch latest 2 posts from WordPress
    // WordPress API parameters:
    // - per_page: number of posts to retrieve (2)
    // - orderby: order by date
    // - order: descending (newest first)
    // - status: only published posts
    // - _embed: include embedded resources (featured media, author, etc.)
    // - _fields: only request needed fields to reduce payload size
    const wordpressUrl = new URL(WORDPRESS_API_URL);
    wordpressUrl.searchParams.append('per_page', '2');
    wordpressUrl.searchParams.append('orderby', 'date');
    wordpressUrl.searchParams.append('order', 'desc');
    wordpressUrl.searchParams.append('status', 'publish');
    wordpressUrl.searchParams.append('_embed', '1');
    // Request only needed fields to reduce response size
    wordpressUrl.searchParams.append('_fields', 'id,title,excerpt,content,date,modified,link,slug,tags,_embedded');

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    let wordpressResponse: Response;
    try {
      wordpressResponse = await fetch(wordpressUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          {
            error: 'Request timeout. WordPress API took too long to respond.',
            details: process.env.NODE_ENV === 'development' 
              ? 'The request exceeded 5 seconds. Please check your WordPress API connection.' 
              : undefined,
          },
          { status: 504 }
        );
      }
      throw fetchError;
    }

    if (!wordpressResponse.ok) {
      const errorText = await wordpressResponse.text();
      console.error('WordPress API error:', {
        status: wordpressResponse.status,
        statusText: wordpressResponse.statusText,
        error: errorText.substring(0, 500),
      });

      return NextResponse.json(
        {
          error: 'Failed to fetch blogs from WordPress',
          details: process.env.NODE_ENV === 'development' 
            ? `WordPress API returned ${wordpressResponse.status}: ${wordpressResponse.statusText}` 
            : undefined,
        },
        { status: wordpressResponse.status || 500 }
      );
    }

    // Parse WordPress response
    let wordpressPosts;
    try {
      wordpressPosts = await wordpressResponse.json();
    } catch (parseError) {
      console.error('Failed to parse WordPress response:', parseError);
      return NextResponse.json(
        {
          error: 'Failed to parse response from WordPress API',
          details: process.env.NODE_ENV === 'development' && parseError instanceof Error
            ? parseError.message
            : undefined,
        },
        { status: 500 }
      );
    }

    // Handle case where WordPress returns a single post object instead of array
    const postsArray = Array.isArray(wordpressPosts) ? wordpressPosts : [wordpressPosts];

    // Transform WordPress posts to match expected format (optimized)
    const blogs = postsArray.map((post: any) => {
      // Extract excerpt - optimized HTML stripping
      const excerpt = post.excerpt?.rendered || '';
      const tagline = excerpt ? excerpt.replace(/<[^>]*>/g, '').trim().substring(0, 200) : '';
      
      // Extract description - only process if needed
      const content = post.content?.rendered || '';
      const description = content ? content.replace(/<[^>]*>/g, '').trim().substring(0, 500) : '';
      
      // Get featured image URL from embedded media (optimized)
      let featuredImage = '';
      const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
      if (featuredMedia) {
        featuredImage = featuredMedia.source_url || 
                        featuredMedia.media_details?.sizes?.full?.source_url || 
                        featuredMedia.media_details?.sizes?.large?.source_url || '';
      }
      
      // Extract tag names from embedded terms (optimized)
      let tagNames: string[] = [];
      const allTerms = post._embedded?.['wp:term'];
      if (allTerms && Array.isArray(allTerms)) {
        const flatTerms = allTerms.flat();
        tagNames = flatTerms
          .filter((term: any) => term?.taxonomy === 'post_tag')
          .map((term: any) => term?.name || term?.slug || '')
          .filter(Boolean);
      }

      return {
        id: post.id?.toString() || '',
        title: post.title?.rendered || post.title || '',
        tagline: tagline,
        description: description,
        tags: tagNames.length > 0 ? tagNames : (post.tags || []),
        featuredImage: featuredImage,
        createdAt: post.date || post.date_gmt || new Date().toISOString(),
        updatedAt: post.modified || post.modified_gmt || new Date().toISOString(),
        link: post.link || '',
        slug: post.slug || '',
      };
    });

    const response = {
      success: true,
      count: blogs.length,
      blogs: blogs,
    };

    // Cache the response
    cachedBlogs = response;
    blogsCacheTime = now;

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get WooCommerce blogs error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching blogs from WordPress',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}
