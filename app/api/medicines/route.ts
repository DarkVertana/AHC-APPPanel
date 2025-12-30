import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET all medicines
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
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
    
    if (status) {
      where.status = status;
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
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.medicine.count({ where }),
    ]);

    return NextResponse.json({
      medicines: medicines.map(medicine => ({
        id: medicine.id,
        categoryId: medicine.categoryId,
        category: {
          id: medicine.category.id,
          title: medicine.category.title,
          tagline: medicine.category.tagline,
        },
        title: medicine.title,
        tagline: medicine.tagline,
        description: medicine.description,
        image: medicine.image,
        url: medicine.url,
        price: medicine.price,
        status: medicine.status,
        createdAt: medicine.createdAt.toISOString(),
        updatedAt: medicine.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get medicines error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching medicines' },
      { status: 500 }
    );
  }
}

// CREATE medicine
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { categoryId, title, tagline, description, image, url, price, status } = body;

    // Validate required fields
    if (!categoryId || !title) {
      return NextResponse.json(
        { error: 'Category ID and title are required' },
        { status: 400 }
      );
    }

    // Validate categoryId is a number
    const parsedCategoryId = parseInt(categoryId);
    if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    // Check if category exists
    const category = await prisma.medicineCategory.findUnique({
      where: { id: parsedCategoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Medicine category not found' },
        { status: 404 }
      );
    }

    // Validate price if provided
    let priceValue: number | null = null;
    if (price !== undefined && price !== null && price !== '') {
      priceValue = parseFloat(price);
      if (isNaN(priceValue) || priceValue < 0) {
        return NextResponse.json(
          { error: 'Price must be a valid positive number' },
          { status: 400 }
        );
      }
    }

    // Create medicine
    const medicine = await prisma.medicine.create({
      data: {
        categoryId: parsedCategoryId,
        title: title.trim(),
        tagline: tagline?.trim() || null,
        description: description?.trim() || null,
        image: image?.trim() || null,
        url: url?.trim() || null,
        price: priceValue,
        status: status || 'active',
      },
      include: {
        category: {
          select: {
            id: true,
            title: true,
            tagline: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Medicine created successfully',
      medicine: {
        id: medicine.id,
        categoryId: medicine.categoryId,
        category: {
          id: medicine.category.id,
          title: medicine.category.title,
          tagline: medicine.category.tagline,
        },
        title: medicine.title,
        tagline: medicine.tagline,
        description: medicine.description,
        image: medicine.image,
        url: medicine.url,
        price: medicine.price,
        status: medicine.status,
        createdAt: medicine.createdAt.toISOString(),
        updatedAt: medicine.updatedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create medicine error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating medicine' },
      { status: 500 }
    );
  }
}

