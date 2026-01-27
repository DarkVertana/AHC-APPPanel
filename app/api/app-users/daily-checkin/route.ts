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
 * POST - Register a daily check-in for a user
 *
 * Only allows ONE check-in per user per day per button type.
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

    const todayDate = getTodayDate();

    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || undefined;

    // Try to create check-in (will fail if already exists due to unique constraint)
    try {
      const checkIn = await prisma.dailyCheckIn.create({
        data: {
          appUserId: user.id,
          date: todayDate,
          buttonType,
          deviceInfo: deviceInfo || undefined,
          ipAddress: ipAddress || undefined,
        },
      });

      console.log(`Daily check-in recorded: user=${user.email}, date=${todayDate}, button=${buttonType}`);

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
            date: todayDate,
            buttonType,
          },
        });

        console.log(`Daily check-in already exists: user=${user.email}, date=${todayDate}, button=${buttonType}`);

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
    const buttonType = searchParams.get('buttonType') || 'default';
    const includeHistory = searchParams.get('history') === 'true';
    const historyDays = parseInt(searchParams.get('days') || '7');

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

    const todayDate = getTodayDate();

    // Check today's check-in
    const todayCheckIn = await prisma.dailyCheckIn.findFirst({
      where: {
        appUserId: user.id,
        date: todayDate,
        buttonType,
      },
    });

    const response: any = {
      success: true,
      today: todayDate,
      checkedInToday: !!todayCheckIn,
      buttonType,
      todayCheckIn: todayCheckIn ? {
        id: todayCheckIn.id,
        date: todayCheckIn.date,
        buttonType: todayCheckIn.buttonType,
        createdAt: todayCheckIn.createdAt.toISOString(),
      } : null,
      user: {
        email: user.email,
        wpUserId: user.wpUserId,
      },
    };

    // Include history if requested
    if (includeHistory) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - historyDays);
      const startDateStr = startDate.toISOString().split('T')[0];

      const history = await prisma.dailyCheckIn.findMany({
        where: {
          appUserId: user.id,
          buttonType,
          date: { gte: startDateStr },
        },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          buttonType: true,
          createdAt: true,
        },
      });

      response.history = history.map(h => ({
        id: h.id,
        date: h.date,
        buttonType: h.buttonType,
        createdAt: h.createdAt.toISOString(),
      }));

      // Calculate streak (consecutive days)
      let streak = 0;
      const today = new Date(todayDate);
      for (let i = 0; i < historyDays; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        if (history.some(h => h.date === dateStr)) {
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
