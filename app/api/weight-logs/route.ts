import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET weight logs (Admin only)
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50)
 * - search: Search by user name or email
 * - userId: Filter by user ID
 * - userEmail: Filter by user email
 * - date: Filter by specific date (YYYY-MM-DD)
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
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { appUser: { email: { contains: search, mode: 'insensitive' } } },
        { appUser: { name: { contains: search, mode: 'insensitive' } } },
        { appUser: { displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    
    if (userId) {
      // Find app user by wpUserId
      const appUser = await prisma.appUser.findFirst({
        where: { wpUserId: userId },
      });
      if (appUser) {
        where.appUserId = appUser.id;
      } else {
        // Fallback to userId field for backward compatibility
        where.userId = userId;
      }
    }
    
    if (userEmail) {
      // Find app user by email
      const appUser = await prisma.appUser.findFirst({
        where: { email: userEmail },
      });
      if (appUser) {
        where.appUserId = appUser.id;
      } else {
        // Fallback to userEmail field for backward compatibility
        where.userEmail = userEmail;
      }
    }
    
    if (date) {
      const dateObj = new Date(date);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = {
        gte: dateObj,
        lt: nextDay,
      };
    } else {
      if (startDate) {
        where.date = { ...where.date, gte: new Date(startDate) };
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        where.date = { ...where.date, lt: endDateObj };
      }
    }

    // Fetch one extra record to compute change for the last item on this page
    const [allFetched, total, uniqueUsers, todayLogsCount] = await Promise.all([
      prisma.weightLog.findMany({
        where,
        include: {
          appUser: {
            select: {
              id: true,
              email: true,
              name: true,
              displayName: true,
              wpUserId: true,
              initialWeight: true,
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit + 1,
      }),
      prisma.weightLog.count({ where }),
      prisma.weightLog.findMany({
        where,
        select: { appUserId: true },
        distinct: ['appUserId'],
      }),
      prisma.weightLog.count({
        where: {
          ...where,
          date: {
            gte: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })(),
            lt: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); return d; })(),
          },
        },
      }),
    ]);

    const logs = allFetched.slice(0, limit);

    // Compute changes on the fly and calculate stats
    const mappedLogs = logs.map((log, index) => {
      const prevLog = allFetched[index + 1] || null;
      const initialW = log.appUser.initialWeight ? parseFloat(log.appUser.initialWeight) : null;
      const previousWeight = prevLog ? prevLog.weight : (initialW && !isNaN(initialW) ? initialW : null);
      const changeRaw = previousWeight !== null ? log.weight - previousWeight : null;
      const change = changeRaw !== null ? Math.round(changeRaw * 10) / 10 : null;
      const changeType = change !== null ? (change > 0 ? 'increase' : change < 0 ? 'decrease' : 'no-change') : null;

      return {
        id: log.id,
        userId: log.userId,
        userName: log.userName || log.appUser.name || log.appUser.displayName || log.appUser.email.split('@')[0],
        userEmail: log.userEmail,
        appUser: {
          id: log.appUser.id,
          email: log.appUser.email,
          name: log.appUser.name,
          displayName: log.appUser.displayName,
          wpUserId: log.appUser.wpUserId,
        },
        date: log.date.toISOString().split('T')[0],
        weight: log.weight,
        previousWeight,
        change,
        changeType,
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.updatedAt.toISOString(),
      };
    });

    const decreaseLogs = mappedLogs.filter(log => log.changeType === 'decrease');
    const avgWeightLoss = decreaseLogs.length > 0
      ? decreaseLogs.reduce((sum, log) => sum + Math.abs(log.change || 0), 0) / decreaseLogs.length
      : 0;

    return NextResponse.json({
      logs: mappedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        uniqueUsers: uniqueUsers.length,
        avgWeightLoss: parseFloat(avgWeightLoss.toFixed(1)),
        todayLogs: todayLogsCount,
      },
    });
  } catch (error) {
    console.error('Get weight logs error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching weight logs' },
      { status: 500 }
    );
  }
}

