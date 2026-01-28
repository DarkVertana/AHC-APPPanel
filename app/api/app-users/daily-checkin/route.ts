import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

type CheckInHistoryItem = {
  id: string;
  date: string;
  buttonType: string;
  medicationName: string | null;
  createdAt: string;
};

type CheckInStatusResponse = {
  success: boolean;
  date: string;
  today: string;
  isToday: boolean;
  checkedIn: boolean;
  buttonType: string;
  checkIn: {
    id: string;
    date: string;
    buttonType: string;
    medicationName: string | null;
    createdAt: string;
  } | null;
  user: {
    id: string;
    email: string;
    wpUserId: string;
    name: string | null;
  };
  history?: CheckInHistoryItem[];
  streak?: number;
};

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate time format (HH:MM or HH:MM:SS)
 */
function isValidTime(timeStr: string): boolean {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
  return regex.test(timeStr);
}

/**
 * Authenticate request - supports both API key (mobile app) and session (admin dashboard)
 * Returns: { type: 'apiKey' | 'session', isAdmin: boolean } or null if unauthorized
 */
async function authenticateRequest(request: NextRequest): Promise<{ type: 'apiKey' | 'session'; isAdmin: boolean } | null> {
  // Try API key first (for mobile app)
  try {
    const apiKey = await validateApiKey(request);
    if (apiKey) {
      return { type: 'apiKey', isAdmin: false };
    }
  } catch {
    // API key validation failed, try session
  }

  // Try session auth (for admin dashboard)
  const session = await getServerSession(authOptions);
  if (session) {
    return { type: 'session', isAdmin: true };
  }

  return null;
}

/**
 * POST - Register a daily check-in for a user
 *
 * Authentication: API key required (mobile app only)
 *
 * Query Parameters:
 * - date (string, optional): Check-in date in YYYY-MM-DD format (default: today)
 * - time (string, optional): Check-in time in HH:MM or HH:MM:SS format (default: current time)
 *
 * Request Body:
 * - wpUserId (string, required): WordPress user ID
 * - email (string, optional): User email (alternative to wpUserId)
 * - buttonType (string, optional): Type of button pressed (default: "default")
 * - medicationName (string, optional): Name of medication associated with check-in
 * - deviceInfo (string, optional): Device information
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key (POST is only for mobile app)
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      console.error('API key validation error:', apiKeyError);
      return NextResponse.json(
        { error: 'API key validation failed' },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    // Get date and time from query parameters
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const timeParam = searchParams.get('time');

    // Validate date parameter if provided
    if (dateParam && !isValidDate(dateParam)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Validate time parameter if provided
    if (timeParam && !isValidTime(timeParam)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:MM or HH:MM:SS.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { wpUserId, email, buttonType = 'default', deviceInfo, medicationName } = body;

    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'wpUserId or email is required' },
        { status: 400 }
      );
    }

    // Find the user
    let user;
    if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId },
        select: { id: true, email: true, wpUserId: true },
      });
    }

    if (!user && email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
        select: { id: true, email: true, wpUserId: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Use provided date or default to today
    const checkInDate = dateParam || getTodayDate();

    // Build createdAt timestamp if time is provided
    let createdAt: Date | undefined;
    if (timeParam) {
      const timeWithSeconds = timeParam.includes(':') && timeParam.split(':').length === 2
        ? `${timeParam}:00`
        : timeParam;
      createdAt = new Date(`${checkInDate}T${timeWithSeconds}Z`);
    }

    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || undefined;

    // Try to create check-in (will fail if already exists due to unique constraint)
    try {
      const checkIn = await prisma.dailyCheckIn.create({
        data: {
          appUserId: user.id,
          date: checkInDate,
          buttonType,
          medicationName: medicationName || undefined,
          deviceInfo: deviceInfo || undefined,
          ipAddress: ipAddress || undefined,
          ...(createdAt && { createdAt }),
        },
      });

      console.log(`Daily check-in recorded: user=${user.email}, date=${checkInDate}, button=${buttonType}`);

      return NextResponse.json({
        success: true,
        alreadyCheckedIn: false,
        message: 'Check-in recorded successfully',
        checkIn: {
          id: checkIn.id,
          date: checkIn.date,
          buttonType: checkIn.buttonType,
          medicationName: checkIn.medicationName,
          createdAt: checkIn.createdAt.toISOString(),
        },
        user: {
          email: user.email,
          wpUserId: user.wpUserId,
        },
      });
    } catch (error: unknown) {
      // Check if it's a unique constraint violation (user already checked in today)
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        const existingCheckIn = await prisma.dailyCheckIn.findFirst({
          where: {
            appUserId: user.id,
            date: checkInDate,
            buttonType,
          },
        });

        console.log(`Daily check-in already exists: user=${user.email}, date=${checkInDate}, button=${buttonType}`);

        return NextResponse.json({
          success: false,
          alreadyCheckedIn: true,
          message: 'You have already checked in today',
          checkIn: existingCheckIn ? {
            id: existingCheckIn.id,
            date: existingCheckIn.date,
            buttonType: existingCheckIn.buttonType,
            medicationName: existingCheckIn.medicationName,
            createdAt: existingCheckIn.createdAt.toISOString(),
          } : null,
          user: {
            email: user.email,
            wpUserId: user.wpUserId,
          },
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Daily check-in error:', error);
    return NextResponse.json(
      { error: 'An error occurred during check-in' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get check-in status and history
 *
 * Authentication: API key (mobile app) OR session (admin dashboard)
 *
 * Query Parameters:
 * - userId (string, admin only): Internal user ID to query
 * - wpUserId (string): WordPress user ID
 * - email (string): User email (alternative to wpUserId)
 * - date (string, optional): Date to check in YYYY-MM-DD format (default: today)
 * - buttonType (string, optional): Type of button to check (default: "default")
 * - history (boolean, optional): If true, returns check-in history
 * - days (number, optional): Number of days of history to return (default: 7)
 * - view (string, optional): Calendar view mode - 'days' | 'weeks' | 'month' (admin only)
 * - offset (number, optional): Pagination offset for calendar view (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key or admin session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); // Admin only - internal user ID
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');
    const dateParam = searchParams.get('date');
    const buttonType = searchParams.get('buttonType') || 'default';
    const includeHistory = searchParams.get('history') === 'true';
    const historyDays = parseInt(searchParams.get('days') || '7');

    // Admin-only calendar view parameters
    const view = searchParams.get('view'); // 'days' | 'weeks' | 'month'
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate user identification
    if (!userId && !wpUserId && !email) {
      return NextResponse.json(
        { error: 'userId, wpUserId, or email is required' },
        { status: 400 }
      );
    }

    // userId parameter is admin-only
    if (userId && !auth.isAdmin) {
      return NextResponse.json(
        { error: 'userId parameter requires admin access' },
        { status: 403 }
      );
    }

    // view parameter is admin-only
    if (view && !auth.isAdmin) {
      return NextResponse.json(
        { error: 'view parameter requires admin access' },
        { status: 403 }
      );
    }

    // Validate date parameter if provided
    if (dateParam && !isValidDate(dateParam)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Find the user
    let user;
    if (userId) {
      user = await prisma.appUser.findUnique({
        where: { id: userId },
        select: { id: true, email: true, wpUserId: true, name: true },
      });
    } else if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId },
        select: { id: true, email: true, wpUserId: true, name: true },
      });
    }

    if (!user && email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
        select: { id: true, email: true, wpUserId: true, name: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If view is specified (admin calendar view), return calendar-formatted data
    if (view && auth.isAdmin) {
      return getCalendarView(user, view, offset);
    }

    // Standard check-in status response (for mobile app or simple queries)
    const checkDate = dateParam || getTodayDate();
    const todayDate = getTodayDate();
    const isToday = checkDate === todayDate;

    const dateCheckIn = await prisma.dailyCheckIn.findFirst({
      where: {
        appUserId: user.id,
        date: checkDate,
        buttonType,
      },
    });

    const response: CheckInStatusResponse = {
      success: true,
      date: checkDate,
      today: todayDate,
      isToday,
      checkedIn: !!dateCheckIn,
      buttonType,
      checkIn: dateCheckIn ? {
        id: dateCheckIn.id,
        date: dateCheckIn.date,
        buttonType: dateCheckIn.buttonType,
        medicationName: dateCheckIn.medicationName,
        createdAt: dateCheckIn.createdAt.toISOString(),
      } : null,
      user: {
        id: user.id,
        email: user.email,
        wpUserId: user.wpUserId,
        name: user.name,
      },
    };

    // Include history if requested
    if (includeHistory) {
      const baseDate = new Date(checkDate);
      const startDate = new Date(baseDate);
      startDate.setDate(startDate.getDate() - historyDays);
      const startDateStr = startDate.toISOString().split('T')[0];

      const history = await prisma.dailyCheckIn.findMany({
        where: {
          appUserId: user.id,
          buttonType,
          date: { gte: startDateStr, lte: checkDate },
        },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          buttonType: true,
          medicationName: true,
          createdAt: true,
        },
      });

      response.history = history.map((h) => ({
        id: h.id,
        date: h.date,
        buttonType: h.buttonType,
        medicationName: h.medicationName,
        createdAt: h.createdAt.toISOString(),
      }));

      // Calculate streak
      let streak = 0;
      for (let i = 0; i < historyDays; i++) {
        const iterDate = new Date(baseDate);
        iterDate.setDate(iterDate.getDate() - i);
        const dateStr = iterDate.toISOString().split('T')[0];
        if (history.some((h) => h.date === dateStr)) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }
      response.streak = streak;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get check-in status error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching check-in status' },
      { status: 500 }
    );
  }
}

/**
 * Get calendar view data for admin dashboard
 */
async function getCalendarView(
  user: { id: string; email: string; wpUserId: string; name: string | null },
  view: string,
  offset: number
) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (view === 'month') {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
  } else if (view === 'weeks') {
    const currentSunday = new Date(now);
    currentSunday.setDate(now.getDate() - now.getDay() - (offset * 28));
    startDate = new Date(currentSunday);
    endDate = new Date(currentSunday);
    endDate.setDate(endDate.getDate() + 27);
  } else {
    // 'days' - 7 days (current week)
    const currentSunday = new Date(now);
    currentSunday.setDate(now.getDate() - now.getDay() - (offset * 7));
    startDate = new Date(currentSunday);
    endDate = new Date(currentSunday);
    endDate.setDate(endDate.getDate() + 6);
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Fetch check-ins for the date range
  const checkIns = await prisma.dailyCheckIn.findMany({
    where: {
      appUserId: user.id,
      date: {
        gte: startDateStr,
        lte: endDateStr,
      },
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      date: true,
      buttonType: true,
      medicationName: true,
      createdAt: true,
    },
  });

  // Create check-in map for quick lookup
  const checkInMap = new Map<string, typeof checkIns[0]>();
  checkIns.forEach((c) => {
    checkInMap.set(c.date, c);
  });

  // Build days array
  const days = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const checkIn = checkInMap.get(dateStr);

    days.push({
      date: dateStr,
      hasCheckIn: !!checkIn,
      time: checkIn?.createdAt.toISOString(),
      medicationName: checkIn?.medicationName || null,
    });

    current.setDate(current.getDate() + 1);
  }

  // Calculate current streak
  let streak = 0;
  const today = now.toISOString().split('T')[0];

  const streakCheckIns = await prisma.dailyCheckIn.findMany({
    where: {
      appUserId: user.id,
      date: { lte: today },
    },
    orderBy: { date: 'desc' },
    select: { date: true },
    take: 60,
  });

  const streakDates = new Set(streakCheckIns.map((c: { date: string }) => c.date));

  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (streakDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      wpUserId: user.wpUserId,
      name: user.name,
    },
    view,
    dateRange: {
      start: startDateStr,
      end: endDateStr,
    },
    statistics: {
      currentStreak: streak,
      totalInRange: checkIns.length,
    },
    data: days,
  });
}
