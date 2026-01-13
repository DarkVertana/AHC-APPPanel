import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Bulk Delete Medicine Categories
 * 
 * Request Body:
 * {
 *   "ids": [1, 2, 3]
 * }
 * 
 * Note: Categories with medicines cannot be deleted
 */
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
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Expected array of IDs.' },
        { status: 400 }
      );
    }

    // Validate IDs are numbers
    const categoryIds = ids.map(id => parseInt(String(id))).filter(id => !isNaN(id) && id > 0);
    
    if (categoryIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid category IDs. Expected array of positive integers.' },
        { status: 400 }
      );
    }

    // Check which categories have medicines
    const categoriesWithMedicines = await prisma.medicineCategory.findMany({
      where: {
        id: {
          in: categoryIds,
        },
      },
      include: {
        _count: {
          select: { medicines: true },
        },
      },
    });

    const categoriesToDelete = categoriesWithMedicines.filter(cat => cat._count.medicines === 0);
    const categoriesWithMedicinesList = categoriesWithMedicines.filter(cat => cat._count.medicines > 0);

    if (categoriesWithMedicinesList.length > 0) {
      return NextResponse.json(
        {
          error: 'Some categories cannot be deleted because they have medicines',
          cannotDelete: categoriesWithMedicinesList.map(cat => ({
            id: cat.id,
            title: cat.title,
            medicineCount: cat._count.medicines,
          })),
        },
        { status: 400 }
      );
    }

    // Delete categories
    const result = await prisma.medicineCategory.deleteMany({
      where: {
        id: {
          in: categoryIds,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} category(ies)`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Bulk delete medicine categories error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting medicine categories' },
      { status: 500 }
    );
  }
}
