import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * Medication Log Endpoint
 * 
 * GET: Retrieve medication logs for a user, organized by weeks (4 weeks)
 * POST: Log a medication intake
 * 
 * Query Parameters (GET):
 * - wpUserId: WordPress user ID (required if email not provided)
 * - email: User email (required if wpUserId not provided)
 * 
 * Body (POST):
 * - wpUserId or email: User identifier
 * - medicineId: Optional medicine ID
 * - medicineName: Name of the medicine (required)
 * - dosage: Dosage information (required)
 * - takenAt: Optional timestamp (defaults to now)
 * 
 * Security:
 * - Requires valid API key (for mobile app) OR admin session (for dashboard)
 */
async function validateAccess(request: NextRequest) {
  // Try session-based auth first (for admin dashboard)
  const session = await getServerSession(authOptions);
  if (session && (session.user as { role?: string })?.role === 'ADMIN') {
    return { authorized: true, isAdmin: true };
  }

  // Try API key validation (for mobile app)
  try {
    const apiKey = await validateApiKey(request);
    if (apiKey) {
      return { authorized: true, isAdmin: false };
    }
  } catch {
    // API key validation failed, continue to return unauthorized
  }

  return { authorized: false, isAdmin: false };
}

export async function GET(request: NextRequest) {
  try {
    // Validate access (API key or admin session)
    const access = await validateAccess(request);
    
    if (!access.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key or admin session required.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');

    // Validate that at least one identifier is provided
    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'Either wpUserId or email query parameter is required' },
        { status: 400 }
      );
    }

    // Find user by wpUserId or email
    let user;
    if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId: String(wpUserId) },
      });
    } else if (email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get medication logs for the last 4 weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const logs = await prisma.medicationLog.findMany({
      where: {
        appUserId: user.id,
        takenAt: {
          gte: fourWeeksAgo,
        },
      },
      orderBy: {
        takenAt: 'desc',
      },
    });

    // Organize logs by weeks (4 weeks)
    const now = new Date();
    const weeks: { week: number; startDate: string; endDate: string; logs: typeof logs }[] = [];
    
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - 6); // Start of week (7 days ago)
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekLogs = logs.filter(log => {
        const logDate = new Date(log.takenAt);
        return logDate >= weekStart && logDate <= weekEnd;
      });

      weeks.push({
        week: i + 1,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        logs: weekLogs,
      });
    }

    return NextResponse.json({
      success: true,
      weeks: weeks,
      totalLogs: logs.length,
    });
  } catch (error) {
    console.error('Get medication logs error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching medication logs';

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate access (API key or admin session)
    const access = await validateAccess(request);
    
    if (!access.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key or admin session required.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { wpUserId, email, medicineId, medicineName, dosage, takenAt } = body;

    // Validate required fields
    if (!medicineName || !dosage) {
      return NextResponse.json(
        { error: 'medicineName and dosage are required' },
        { status: 400 }
      );
    }

    // Validate that at least one user identifier is provided
    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'Either wpUserId or email is required' },
        { status: 400 }
      );
    }

    // Find user by wpUserId or email
    let user;
    if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId: String(wpUserId) },
      });
    } else if (email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create medication log
    const log = await prisma.medicationLog.create({
      data: {
        appUserId: user.id,
        medicineId: medicineId || null,
        medicineName: medicineName,
        dosage: dosage,
        takenAt: takenAt ? new Date(takenAt) : new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      log: log,
    }, { status: 201 });
  } catch (error) {
    console.error('Create medication log error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while creating medication log';

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}

