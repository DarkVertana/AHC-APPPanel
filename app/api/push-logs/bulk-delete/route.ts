import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Bulk Delete Push Notification Logs
 *
 * Request Body:
 * {
 *   "ids": ["id1", "id2", "id3"]
 * }
 * OR
 * {
 *   "olderThan": "2024-01-01" // Delete all logs older than this date
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
    const { ids, olderThan } = body;

    let result;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete by IDs
      result = await prisma.pushNotificationLog.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });
    } else if (olderThan) {
      // Delete logs older than specified date
      const dateThreshold = new Date(olderThan);
      result = await prisma.pushNotificationLog.deleteMany({
        where: {
          createdAt: {
            lt: dateThreshold,
          },
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid request. Expected array of IDs or olderThan date.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} push notification log(s)`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Bulk delete push notification logs error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting push notification logs' },
      { status: 500 }
    );
  }
}
