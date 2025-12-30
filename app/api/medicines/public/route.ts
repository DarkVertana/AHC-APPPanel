import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { getImageUrl } from '@/lib/image-utils';

/**
 * Public Medicine API Endpoint for Mobile App
 * 
 * This endpoint retrieves active medicines for the Android app.
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Number of medicines per page (default: 10, max: 50)
 * - search: Search term to filter medicines by title, tagline, or description
 * - categoryId: Filter medicines by category ID
 * - id: Get a single medicine by ID (returns single medicine object instead of array)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * - Only returns medicines with status 'active'
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
    const medicineId = searchParams.get('id');
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Max 50 per page
    const skip = (page - 1) * limit;

    // If requesting a single medicine by ID
    if (medicineId) {
      const medicine = await prisma.medicine.findFirst({
        where: {
          id: medicineId,
          status: 'active', // Only return active medicines
        },
        include: {
          category: {
            select: {
              id: true,
              title: true,
              tagline: true,
              icon: true,
            }
          }
        }
      });

      if (!medicine) {
        return NextResponse.json(
          { error: 'Medicine not found or not active' },
          { status: 404 }
        );
      }

      // Get the request URL for generating absolute image URLs
      const requestUrl = request.url;
      
      return NextResponse.json({
        success: true,
        medicine: {
          id: medicine.id,
          categoryId: medicine.categoryId,
          category: {
            id: medicine.category.id,
            title: medicine.category.title,
            tagline: medicine.category.tagline,
            icon: getImageUrl(medicine.category.icon, requestUrl, true), // Force absolute URL for mobile
          },
          title: medicine.title,
          tagline: medicine.tagline,
          description: medicine.description,
          image: getImageUrl(medicine.image, requestUrl, true), // Force absolute URL for mobile
          url: medicine.url,
          price: medicine.price,
          createdAt: medicine.createdAt.toISOString(),
          updatedAt: medicine.updatedAt.toISOString(),
        },
      });
    }

    // Build where clause for active medicines only
    const where: any = {
      status: 'active', // Only return active medicines
    };
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { tagline: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (categoryId) {
      const parsedCategoryId = parseInt(categoryId);
      if (!isNaN(parsedCategoryId)) {
        where.categoryId = parsedCategoryId;
      }
    }

    // Get medicines with pagination
    const [medicines, total] = await Promise.all([
      prisma.medicine.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              title: true,
              tagline: true,
              icon: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.medicine.count({ where }),
    ]);

    // Get the request URL for generating absolute image URLs
    const requestUrl = request.url;
    
    return NextResponse.json({
      success: true,
      medicines: medicines.map(medicine => ({
        id: medicine.id,
        categoryId: medicine.categoryId,
        category: {
          id: medicine.category.id,
          title: medicine.category.title,
          tagline: medicine.category.tagline,
          icon: getImageUrl(medicine.category.icon, requestUrl, true), // Force absolute URL for mobile
        },
        title: medicine.title,
        tagline: medicine.tagline,
        description: medicine.description,
        image: getImageUrl(medicine.image, requestUrl, true), // Force absolute URL for mobile
        url: medicine.url,
        price: medicine.price,
        createdAt: medicine.createdAt.toISOString(),
        updatedAt: medicine.updatedAt.toISOString(),
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
    console.error('Get public medicines error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching medicines',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

