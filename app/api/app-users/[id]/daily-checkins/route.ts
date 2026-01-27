import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

type CheckInRecord = {
  id: string;
  date: string;
  buttonType: string;
  createdAt: Date;
  deviceInfo: string | null;
};

type CheckInItem = {
  id: string;
  date?: string;
  buttonType: string;
  time: string;
};

/**
 * GET - Fetch daily check-ins for a specific user (Admin only)
 *
 * Query Parameters:
 * - period: 'days' | 'weeks' | 'months' (default: 'days')
 * - count: number of periods to fetch (default: 7 for days, 4 for weeks, 3 for months)
 * - buttonType: filter by button type (default: all)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id: userId } = await params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'days';
    const buttonType = searchParams.get('buttonType');

    // Default counts based on period
    const defaultCounts: Record<string, number> = {
      days: 30,
      weeks: 12,
      months: 6,
    };
    const count = parseInt(searchParams.get('count') || String(defaultCounts[period] || 30));

    // Find the user
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, wpUserId: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate date range
    const now = new Date();
    const startDate = new Date();

    if (period === 'days') {
      startDate.setDate(now.getDate() - count);
    } else if (period === 'weeks') {
      startDate.setDate(now.getDate() - (count * 7));
    } else if (period === 'months') {
      startDate.setMonth(now.getMonth() - count);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = now.toISOString().split('T')[0];

    // Build where clause
    const whereClause: any = {
      appUserId: user.id,
      date: { gte: startDateStr },
    };

    if (buttonType) {
      whereClause.buttonType = buttonType;
    }

    // Fetch check-ins
    const checkIns = await prisma.dailyCheckIn.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        buttonType: true,
        createdAt: true,
        deviceInfo: true,
      },
    });

    // Calculate statistics
    const totalCheckIns = checkIns.length;

    // Calculate current streak
    let streak = 0;
    const today = now.toISOString().split('T')[0];
    const checkInDates = new Set(checkIns.map((c: CheckInRecord) => c.date));

    for (let i = 0; i < count; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      if (checkInDates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        // Allow missing today but break on any other missed day
        break;
      }
    }

    // Group by period for summary
    let groupedData: any[] = [];

    if (period === 'days') {
      // Create a map of all days in range
      const daysMap = new Map<string, any>();
      for (let i = 0; i < count; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        daysMap.set(dateStr, {
          date: dateStr,
          dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }),
          checkIns: [],
          hasCheckIn: false,
        });
      }

      // Fill in check-ins
      checkIns.forEach((c: CheckInRecord) => {
        if (daysMap.has(c.date)) {
          const day = daysMap.get(c.date);
          day.checkIns.push({
            id: c.id,
            buttonType: c.buttonType,
            time: c.createdAt.toISOString(),
          });
          day.hasCheckIn = true;
        }
      });

      groupedData = Array.from(daysMap.values());
    } else if (period === 'weeks') {
      // Group by weeks
      const weeksMap = new Map<number, any>();

      for (let i = 0; i < count; i++) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        weeksMap.set(i, {
          week: i + 1,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          checkIns: [],
          totalDays: 0,
        });
      }

      // Fill in check-ins
      checkIns.forEach((c: CheckInRecord) => {
        const checkDate = new Date(c.date);
        const weeksDiff = Math.floor((now.getTime() - checkDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

        if (weeksMap.has(weeksDiff)) {
          const week = weeksMap.get(weeksDiff);
          week.checkIns.push({
            id: c.id,
            date: c.date,
            buttonType: c.buttonType,
            time: c.createdAt.toISOString(),
          });
        }
      });

      // Calculate unique days per week
      weeksMap.forEach((week) => {
        week.totalDays = new Set(week.checkIns.map((c: CheckInItem) => c.date)).size;
      });

      groupedData = Array.from(weeksMap.values());
    } else if (period === 'months') {
      // Group by months
      const monthsMap = new Map<string, any>();

      for (let i = 0; i < count; i++) {
        const monthDate = new Date(now);
        monthDate.setMonth(monthDate.getMonth() - i);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

        monthsMap.set(monthKey, {
          month: monthKey,
          monthName: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          checkIns: [],
          totalDays: 0,
        });
      }

      // Fill in check-ins
      checkIns.forEach((c: CheckInRecord) => {
        const checkDate = new Date(c.date);
        const monthKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}`;

        if (monthsMap.has(monthKey)) {
          const month = monthsMap.get(monthKey);
          month.checkIns.push({
            id: c.id,
            date: c.date,
            buttonType: c.buttonType,
            time: c.createdAt.toISOString(),
          });
        }
      });

      // Calculate unique days per month
      monthsMap.forEach((month) => {
        month.totalDays = new Set(month.checkIns.map((c: CheckInItem) => c.date)).size;
      });

      groupedData = Array.from(monthsMap.values());
    }

    // Get distinct button types for filter options
    const buttonTypes = await prisma.dailyCheckIn.findMany({
      where: { appUserId: user.id },
      select: { buttonType: true },
      distinct: ['buttonType'],
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        wpUserId: user.wpUserId,
        name: user.name,
      },
      period,
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
      statistics: {
        totalCheckIns,
        currentStreak: streak,
        checkedInToday: checkInDates.has(today),
      },
      buttonTypes: buttonTypes.map((b: { buttonType: string }) => b.buttonType),
      data: groupedData,
      rawCheckIns: checkIns.map((c: CheckInRecord) => ({
        id: c.id,
        date: c.date,
        buttonType: c.buttonType,
        time: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch daily check-ins error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching check-ins' },
      { status: 500 }
    );
  }
}
