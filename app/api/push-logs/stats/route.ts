import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET push notification log statistics (Admin only)
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

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this week's date range
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);

    // Get this month's date range
    const monthStart = new Date(today);
    monthStart.setDate(monthStart.getDate() - 30);

    // Run all queries in parallel
    const [
      totalLogs,
      totalSent,
      totalFailed,
      totalPartial,
      totalPending,
      todayLogs,
      todaySent,
      weekLogs,
      weekSent,
      monthLogs,
      monthSent,
      bySource,
      byType,
      totalSuccessCount,
      totalFailureCount,
    ] = await Promise.all([
      prisma.pushNotificationLog.count(),
      prisma.pushNotificationLog.count({ where: { status: 'sent' } }),
      prisma.pushNotificationLog.count({ where: { status: 'failed' } }),
      prisma.pushNotificationLog.count({ where: { status: 'partial' } }),
      prisma.pushNotificationLog.count({ where: { status: 'pending' } }),
      prisma.pushNotificationLog.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.pushNotificationLog.count({
        where: { createdAt: { gte: today, lt: tomorrow }, status: 'sent' },
      }),
      prisma.pushNotificationLog.count({
        where: { createdAt: { gte: weekStart } },
      }),
      prisma.pushNotificationLog.count({
        where: { createdAt: { gte: weekStart }, status: 'sent' },
      }),
      prisma.pushNotificationLog.count({
        where: { createdAt: { gte: monthStart } },
      }),
      prisma.pushNotificationLog.count({
        where: { createdAt: { gte: monthStart }, status: 'sent' },
      }),
      prisma.pushNotificationLog.groupBy({
        by: ['source'],
        _count: { id: true },
      }),
      prisma.pushNotificationLog.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      prisma.pushNotificationLog.aggregate({
        _sum: { successCount: true },
      }),
      prisma.pushNotificationLog.aggregate({
        _sum: { failureCount: true },
      }),
    ]);

    const overallSuccessRate = totalLogs > 0
      ? Math.round((totalSent / totalLogs) * 100)
      : 0;

    const todaySuccessRate = todayLogs > 0
      ? Math.round((todaySent / todayLogs) * 100)
      : 0;

    const weekSuccessRate = weekLogs > 0
      ? Math.round((weekSent / weekLogs) * 100)
      : 0;

    const monthSuccessRate = monthLogs > 0
      ? Math.round((monthSent / monthLogs) * 100)
      : 0;

    return NextResponse.json({
      overview: {
        totalLogs,
        totalSent,
        totalFailed,
        totalPartial,
        totalPending,
        overallSuccessRate,
        totalRecipientsSent: totalSuccessCount._sum.successCount || 0,
        totalRecipientsFailed: totalFailureCount._sum.failureCount || 0,
      },
      today: {
        logs: todayLogs,
        sent: todaySent,
        successRate: todaySuccessRate,
      },
      week: {
        logs: weekLogs,
        sent: weekSent,
        successRate: weekSuccessRate,
      },
      month: {
        logs: monthLogs,
        sent: monthSent,
        successRate: monthSuccessRate,
      },
      bySource: bySource.reduce(
        (acc, item) => {
          acc[item.source] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
    });
  } catch (error) {
    console.error('Get push notification stats error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching push notification stats' },
      { status: 500 }
    );
  }
}
