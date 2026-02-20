import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET - List all account deletion requests (admin)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.appUser = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { id: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [requests, total, pendingCount, onHoldCount, deletedCount] = await Promise.all([
      prisma.accountDeletionRequest.findMany({
        where: whereClause,
        include: {
          appUser: {
            select: {
              id: true,
              name: true,
              displayName: true,
              email: true,
              wpUserId: true,
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.accountDeletionRequest.count({ where: whereClause }),
      prisma.accountDeletionRequest.count({ where: { status: 'pending' } }),
      prisma.accountDeletionRequest.count({ where: { status: 'on_hold' } }),
      prisma.accountDeletionRequest.count({ where: { status: 'deleted' } }),
    ]);

    return NextResponse.json({
      success: true,
      requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: pendingCount + onHoldCount + deletedCount,
        pending: pendingCount,
        onHold: onHoldCount,
        deleted: deletedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching account deletion requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
