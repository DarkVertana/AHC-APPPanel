import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET push notification logs (Admin only)
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50)
 * - search: Search by recipient email or title
 * - status: Filter by status (pending, sent, failed, partial)
 * - source: Filter by source (admin, webhook, system)
 * - type: Filter by type (general, order, subscription, promotion)
 * - startDate: Filter from date (YYYY-MM-DD)
 * - endDate: Filter to date (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { recipientEmail: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
        { sourceId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    if (type) {
      where.type = type;
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    }

    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      where.createdAt = { ...where.createdAt, lt: endDateObj };
    }

    // Get logs with pagination
    const [logs, total] = await Promise.all([
      prisma.pushNotificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pushNotificationLog.count({ where }),
    ]);

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalSent, totalFailed, todayCount] = await Promise.all([
      prisma.pushNotificationLog.count({
        where: { ...where, status: 'sent' },
      }),
      prisma.pushNotificationLog.count({
        where: { ...where, status: 'failed' },
      }),
      prisma.pushNotificationLog.count({
        where: {
          ...where,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
    ]);

    const successRate = total > 0 ? Math.round((totalSent / total) * 100) : 0;

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        recipientEmail: log.recipientEmail,
        recipientWpUserId: log.recipientWpUserId,
        recipientFcmToken: log.recipientFcmToken,
        recipientCount: log.recipientCount,
        title: log.title,
        body: log.body,
        imageUrl: log.imageUrl,
        dataPayload: log.dataPayload,
        source: log.source,
        type: log.type,
        sourceId: log.sourceId,
        status: log.status,
        successCount: log.successCount,
        failureCount: log.failureCount,
        errorMessage: log.errorMessage,
        errorCode: log.errorCode,
        fcmMessageId: log.fcmMessageId,
        createdAt: log.createdAt.toISOString(),
        sentAt: log.sentAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalSent,
        totalFailed,
        successRate,
        todayCount,
      },
    });
  } catch (error) {
    console.error('Get push notification logs error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching push notification logs' },
      { status: 500 }
    );
  }
}
