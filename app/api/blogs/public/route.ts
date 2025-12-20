import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { getImageUrl } from '@/lib/image-utils';

/**
 * Public Blog API Endpoint for Mobile App
 * 
 * This endpoint retrieves published blog posts for the Android app.
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Number of blogs per page (default: 10, max: 50)
 * - search: Search term to filter blogs by title, tagline, description, or tags
 * - tag: Filter blogs by a specific tag
 * - id: Get a single blog by ID (returns single blog object instead of array)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * - Only returns blogs with status 'published'
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
    const blogId = searchParams.get('id');
    const search = searchParams.get('search') || '';
    const tag = searchParams.get('tag') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Max 50 per page
    const skip = (page - 1) * limit;

    // If requesting a single blog by ID
    if (blogId) {
      const blog = await prisma.blog.findFirst({
        where: {
          id: blogId,
          status: 'published', // Only return published blogs
        },
      });

      if (!blog) {
        return NextResponse.json(
          { error: 'Blog not found or not published' },
          { status: 404 }
        );
      }

      // Get the request URL for generating absolute image URLs
      const requestUrl = request.url;
      
      return NextResponse.json({
        success: true,
        blog: {
          id: blog.id,
          title: blog.title,
          tagline: blog.tagline,
          description: blog.description,
          tags: blog.tags,
          featuredImage: getImageUrl(blog.featuredImage, requestUrl, true), // Force absolute URL for mobile
          createdAt: blog.createdAt.toISOString(),
          updatedAt: blog.updatedAt.toISOString(),
        },
      });
    }

    // Build where clause for published blogs only
    const where: any = {
      status: 'published', // Only return published blogs
    };
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { tagline: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }
    
    if (tag) {
      where.tags = { has: tag };
    }

    // Get blogs with pagination
    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          tagline: true,
          description: true,
          tags: true,
          featuredImage: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.blog.count({ where }),
    ]);

    // Get the request URL for generating absolute image URLs
    const requestUrl = request.url;
    
    return NextResponse.json({
      success: true,
      blogs: blogs.map(blog => ({
        id: blog.id,
        title: blog.title,
        tagline: blog.tagline,
        description: blog.description,
        tags: blog.tags,
        featuredImage: getImageUrl(blog.featuredImage, requestUrl, true), // Force absolute URL for mobile
        createdAt: blog.createdAt.toISOString(),
        updatedAt: blog.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Get public blogs error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching blogs',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

