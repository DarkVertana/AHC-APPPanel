import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * Public Medicine Categories API Endpoint for Mobile App
 * 
 * This endpoint retrieves medicine categories for the Android app.
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Number of categories per page (default: 50, max: 100)
 * - search: Search term to filter categories by title or tagline
 * - id: Get a single category by ID (returns single category object instead of array)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
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
    const categoryId = searchParams.get('id');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // If requesting a single category by ID
    if (categoryId) {
      const parsedCategoryId = parseInt(categoryId);
      if (isNaN(parsedCategoryId)) {
        return NextResponse.json(
          { error: 'Invalid category ID' },
          { status: 400 }
        );
      }

      const category = await prisma.medicineCategory.findUnique({
        where: { id: parsedCategoryId },
        include: {
          _count: {
            select: { medicines: true }
          }
        }
      });

      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        category: {
          id: category.id,
          title: category.title,
          tagline: category.tagline,
          icon: category.icon,
          medicineCount: category._count.medicines,
          createdAt: category.createdAt.toISOString(),
          updatedAt: category.updatedAt.toISOString(),
        },
      });
    }

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { tagline: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get categories with pagination
    const [categories, total] = await Promise.all([
      prisma.medicineCategory.findMany({
        where,
        include: {
          _count: {
            select: { medicines: true }
          }
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.medicineCategory.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      categories: categories.map(cat => ({
        id: cat.id,
        title: cat.title,
        tagline: cat.tagline,
        icon: cat.icon,
        medicineCount: cat._count.medicines,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
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
    console.error('Get public medicine categories error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching medicine categories',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

