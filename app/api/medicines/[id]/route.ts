import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET single medicine
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Handle params as Promise (Next.js 15+) or direct object
    const resolvedParams = params instanceof Promise ? await params : params;

    const medicine = await prisma.medicine.findUnique({
      where: { id: resolvedParams.id },
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

    if (!medicine) {
      return NextResponse.json(
        { error: 'Medicine not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
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
      }
    });
  } catch (error) {
    console.error('Get medicine error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching medicine' },
      { status: 500 }
    );
  }
}

// UPDATE medicine
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Handle params as Promise (Next.js 15+) or direct object
    const resolvedParams = params instanceof Promise ? await params : params;

    const body = await request.json();
    const { categoryId, title, tagline, description, image, url, price, status } = body;

    // Check if medicine exists
    const existingMedicine = await prisma.medicine.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!existingMedicine) {
      return NextResponse.json(
        { error: 'Medicine not found' },
        { status: 404 }
      );
    }

    // Validate categoryId if provided
    let parsedCategoryId = existingMedicine.categoryId;
    if (categoryId !== undefined) {
      parsedCategoryId = parseInt(categoryId);
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
    }

    // Build update data
    const updateData: any = {};
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title is required and must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }
    if (categoryId !== undefined) {
      updateData.categoryId = parsedCategoryId;
    }
    if (tagline !== undefined) {
      updateData.tagline = tagline && tagline.trim() ? tagline.trim() : null;
    }
    if (description !== undefined) {
      updateData.description = description && description.trim() ? description.trim() : null;
    }
    if (image !== undefined) {
      updateData.image = image && image.trim() ? image.trim() : null;
    }
    if (url !== undefined) {
      updateData.url = url && url.trim() ? url.trim() : null;
    }
    if (price !== undefined) {
      if (price === null || price === '') {
        updateData.price = null;
      } else {
        const priceValue = parseFloat(price);
        if (isNaN(priceValue) || priceValue < 0) {
          return NextResponse.json(
            { error: 'Price must be a valid positive number' },
            { status: 400 }
          );
        }
        updateData.price = priceValue;
      }
    }
    if (status !== undefined) {
      updateData.status = status;
    }

    // Update medicine
    const medicine = await prisma.medicine.update({
      where: { id: resolvedParams.id },
      data: updateData,
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
      message: 'Medicine updated successfully',
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
    });
  } catch (error) {
    console.error('Update medicine error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while updating medicine',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE medicine
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Handle params as Promise (Next.js 15+) or direct object
    const resolvedParams = params instanceof Promise ? await params : params;

    // Check if medicine exists
    const existingMedicine = await prisma.medicine.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!existingMedicine) {
      return NextResponse.json(
        { error: 'Medicine not found' },
        { status: 404 }
      );
    }

    // Delete medicine
    await prisma.medicine.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Medicine deleted successfully',
    });
  } catch (error) {
    console.error('Delete medicine error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting medicine' },
      { status: 500 }
    );
  }
}

