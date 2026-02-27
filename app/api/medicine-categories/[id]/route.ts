import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { deleteTranslationsForEntity } from '@/lib/translations';

// GET single medicine category
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

    const categoryId = parseInt(resolvedParams.id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    const category = await prisma.medicineCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Medicine category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      category: {
        id: category.id,
        title: category.title,
        tagline: category.tagline,
        icon: category.icon,
        medicineCount: category._count.medicines,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('Get medicine category error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching medicine category' },
      { status: 500 }
    );
  }
}

// UPDATE medicine category
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
    const { title, tagline, icon } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const categoryId = parseInt(resolvedParams.id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    // Check if category exists
    const existingCategory = await prisma.medicineCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Medicine category not found' },
        { status: 404 }
      );
    }

    // If title is being updated, check for duplicates
    if (title && title !== existingCategory.title) {
      const duplicateCategory = await prisma.medicineCategory.findFirst({
        where: { 
          title: { equals: title, mode: 'insensitive' },
          id: { not: categoryId }
        },
      });

      if (duplicateCategory) {
        return NextResponse.json(
          { error: 'Category with this title already exists' },
          { status: 409 }
        );
      }
    }

    // Update category
    const updateData: any = {
      title: title.trim(),
    };
    
    if (tagline !== undefined) {
      updateData.tagline = tagline && tagline.trim() ? tagline.trim() : null;
    }
    
    if (icon !== undefined) {
      updateData.icon = icon && icon.trim() ? icon.trim() : null;
    }

    const category = await prisma.medicineCategory.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Medicine category updated successfully',
      category: {
        id: category.id,
        title: category.title,
        tagline: category.tagline,
        icon: category.icon,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update medicine category error:', error);
    
    // Provide more detailed error information
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }
    
    return NextResponse.json(
      { 
        error: 'An error occurred while updating medicine category',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE medicine category
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

    const categoryId = parseInt(resolvedParams.id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    // Check if category exists
    const existingCategory = await prisma.medicineCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Medicine category not found' },
        { status: 404 }
      );
    }

    // Check if category has medicines
    if (existingCategory._count.medicines > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that has medicines. Please delete or move medicines first.' },
        { status: 400 }
      );
    }

    // Delete category and its translations
    await prisma.medicineCategory.delete({
      where: { id: categoryId },
    });
    await deleteTranslationsForEntity('medicine_category', String(categoryId));

    return NextResponse.json({
      success: true,
      message: 'Medicine category deleted successfully',
    });
  } catch (error) {
    console.error('Delete medicine category error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting medicine category' },
      { status: 500 }
    );
  }
}

