import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

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
 * POST - Register a daily check-in for a user
 *
 * Only allows ONE check-in per user per day per button type.
 *
 * Query Parameters:
 * - date (string, optional): Check-in date in YYYY-MM-DD format (default: today)
 * - time (string, optional): Check-in time in HH:MM or HH:MM:SS format (default: current time)
 *
 * Request Body:
 * - wpUserId (string, required): WordPress user ID
 * - email (string, optional): User email (alternative to wpUserId)
 * - buttonType (string, optional): Type of button pressed (default: "default")
 * - deviceInfo (string, optional): Device information
 *
 * Response:
 * - success: true if check-in was recorded
 * - alreadyCheckedIn: true if user already checked in today
 * - checkIn: the check-in record
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
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
    const { wpUserId, email, buttonType = 'default', deviceInfo } = body;

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
      // Combine date and time into a timestamp
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
          createdAt: checkIn.createdAt.toISOString(),
        },
        user: {
          email: user.email,
          wpUserId: user.wpUserId,
        },
      });
    } catch (error: any) {
      // Check if it's a unique constraint violation (user already checked in today)
      if (error.code === 'P2002') {
        // Fetch the existing check-in
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
 * GET - Check if user has checked in today / get check-in status
 *
 * Query Parameters:
 * - wpUserId (string): WordPress user ID
 * - email (string): User email (alternative to wpUserId)
 * - date (string, optional): Date to check in YYYY-MM-DD format (default: today)
 * - buttonType (string, optional): Type of button to check (default: "default")
 * - history (boolean, optional): If true, returns check-in history
 * - days (number, optional): Number of days of history to return (default: 7)
 */
export async function GET(request: NextRequest) {
  try {
    // Validate API key
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

    const { searchParams } = new URL(request.url);
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');
    const dateParam = searchParams.get('date');
    const buttonType = searchParams.get('buttonType') || 'default';
    const includeHistory = searchParams.get('history') === 'true';
    const historyDays = parseInt(searchParams.get('days') || '7');

    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'wpUserId or email is required' },
        { status: 400 }
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
    const checkDate = dateParam || getTodayDate();
    const todayDate = getTodayDate();
    const isToday = checkDate === todayDate;

    // Check the specified date's check-in
    const dateCheckIn = await prisma.dailyCheckIn.findFirst({
      where: {
        appUserId: user.id,
        date: checkDate,
        buttonType,
      },
    });

    const response: any = {
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
        createdAt: dateCheckIn.createdAt.toISOString(),
      } : null,
      user: {
        email: user.email,
        wpUserId: user.wpUserId,
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
          createdAt: true,
        },
      });

      response.history = history.map((h: { id: string; date: string; buttonType: string; createdAt: Date }) => ({
        id: h.id,
        date: h.date,
        buttonType: h.buttonType,
        createdAt: h.createdAt.toISOString(),
      }));

      // Calculate streak (consecutive days from the specified date backwards)
      let streak = 0;
      for (let i = 0; i < historyDays; i++) {
        const iterDate = new Date(baseDate);
        iterDate.setDate(iterDate.getDate() - i);
        const dateStr = iterDate.toISOString().split('T')[0];
        if (history.some((h: { date: string }) => h.date === dateStr)) {
          streak++;
        } else if (i > 0) {
          break; // Streak broken
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
