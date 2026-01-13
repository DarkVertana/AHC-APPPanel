import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Bulk Delete Blogs
 * 
 * Request Body:
 * {
 *   "ids": ["id1", "id2", "id3"]
 * }
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

    // Delete blogs
    const result = await prisma.blog.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} blog(s)`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Bulk delete blogs error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting blogs' },
      { status: 500 }
    );
  }
}
