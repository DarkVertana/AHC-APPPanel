import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Public Weight Log API Endpoint for Mobile App
 * 
 * This endpoint allows the Android app to submit weight log data.
 * 
 * POST Body:
 * - userId: User ID (wpUserId or email)
 * - userEmail: User email
 * - userName: User name (optional)
 * - weight: Weight value in lbs (required)
 * - date: Date in ISO format (optional, defaults to now)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
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
        { error: 'API key validation failed', details: process.env.NODE_ENV === 'development' ? (apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error') : undefined },
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
    const { userId, userEmail, userName, weight, date } = body;

    // Validate required fields
    if (!userId || !userEmail || weight === undefined || weight === null) {
      return NextResponse.json(
        { error: 'userId, userEmail, and weight are required' },
        { status: 400 }
      );
    }

    // Validate weight is a number
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      return NextResponse.json(
        { error: 'Weight must be a positive number' },
        { status: 400 }
      );
    }

    // Normalize email for consistent lookups
    const normalizedEmail = userEmail.toLowerCase().trim();

    // Find or get AppUser - check by both wpUserId and email
    let appUser = await prisma.appUser.findFirst({
      where: {
        OR: [
          { wpUserId: userId.toString() },
          { email: normalizedEmail },
        ],
      },
    });

    // If user doesn't exist, create one (optional - you can remove this if you want to require registration first)
    if (!appUser) {
      appUser = await prisma.appUser.create({
        data: {
          wpUserId: userId.toString(),
          email: normalizedEmail,
          name: userName || null,
          displayName: userName || null,
        },
      });
    }

    // Parse date or use current date
    const logDate = date ? new Date(date) : new Date();

    // Get the previous weight log for this user
    const previousLog = await prisma.weightLog.findFirst({
      where: {
        appUserId: appUser.id,
      },
      orderBy: { date: 'desc' },
    });

    // Use previous log weight, or fall back to initialWeight if this is the first log
    let previousWeight = previousLog?.weight || null;
    if (previousWeight === null && appUser.initialWeight) {
      previousWeight = parseFloat(appUser.initialWeight);
    }

    const changeRaw = previousWeight !== null ? weightNum - previousWeight : null;
    // Round change to 1 decimal place to avoid floating point precision issues
    const change = changeRaw !== null ? Math.round(changeRaw * 10) / 10 : null;

    let changeType: string | null = null;
    if (change !== null) {
      if (change > 0) {
        changeType = 'increase';
      } else if (change < 0) {
        changeType = 'decrease';
      } else {
        changeType = 'no-change';
      }
    }

    // Create weight log with relation
    const weightLog = await prisma.weightLog.create({
      data: {
        appUserId: appUser.id,
        userId: userId.toString(),
        userEmail: userEmail,
        userName: userName || appUser.name || appUser.displayName || null,
        date: logDate,
        weight: weightNum,
        previousWeight: previousWeight,
        change: change,
        changeType: changeType,
      },
      include: {
        appUser: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
            wpUserId: true,
          },
        },
      },
    });

    // Update app_user weight
    try {
      await prisma.appUser.update({
        where: { id: appUser.id },
        data: {
          weight: weightNum.toString(),
          weightSet: true,
        },
      });
    } catch (updateError) {
      // Log but don't fail the request if user update fails
      console.error('Error updating app user weight:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Weight log created successfully',
      weightLog: {
        id: weightLog.id,
        userId: weightLog.userId,
        userEmail: weightLog.userEmail,
        userName: weightLog.userName,
        date: weightLog.date.toISOString().split('T')[0],
        weight: weightLog.weight,
        previousWeight: weightLog.previousWeight,
        change: weightLog.change !== null ? Math.round(weightLog.change * 10) / 10 : null,
        changeType: weightLog.changeType,
        createdAt: weightLog.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create weight log error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while creating weight log',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET weight logs for a specific user (Public API for Mobile App)
 * 
 * Query Parameters:
 * - userId: User ID (required)
 * - userEmail: User email (alternative to userId)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 50)
 * - startDate: Filter from date (YYYY-MM-DD)
 * - endDate: Filter to date (YYYY-MM-DD)
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
        { error: 'API key validation failed', details: process.env.NODE_ENV === 'development' ? (apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error') : undefined },
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
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Increased default to 50, max 100
    const skip = (page - 1) * limit;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: 'userId or userEmail is required' },
        { status: 400 }
      );
    }

    // Normalize email if provided
    const normalizedEmail = userEmail ? userEmail.toLowerCase().trim() : null;

    // Find AppUser first - try both userId and email
    let appUser = null;
    if (userId) {
      appUser = await prisma.appUser.findFirst({
        where: { wpUserId: userId.toString() },
      });
    }
    
    // If not found by userId, try email
    if (!appUser && normalizedEmail) {
      appUser = await prisma.appUser.findFirst({
        where: { 
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
      });
    }

    // Build where clause - search by appUserId if found, otherwise by email/userId fields for backward compatibility
    const where: any = {};
    
    if (appUser) {
      // Primary: search by appUserId (most accurate)
      where.appUserId = appUser.id;
    } else {
      // Fallback: search by email or userId fields for backward compatibility
      where.OR = [];
      
      if (normalizedEmail) {
        where.OR.push({
          userEmail: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        });
      }
      
      if (userId) {
        where.OR.push({
          userId: userId.toString(),
        });
      }
      
      // If no OR conditions, return empty
      if (where.OR.length === 0) {
        return NextResponse.json({
          success: true,
          logs: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
      }
    }
    
    if (startDate) {
      where.date = { ...where.date, gte: new Date(startDate) };
    }
    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      where.date = { ...where.date, lt: endDateObj };
    }

    // Log the query for debugging
    console.log('Fetching weight logs with query:', JSON.stringify(where, null, 2));

    // Get weight logs with pagination and relation
    const [logs, total] = await Promise.all([
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
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.weightLog.count({ where }),
    ]);

    console.log(`Found ${total} weight logs, returning ${logs.length} logs`);

    return NextResponse.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        userId: log.userId,
        userName: log.userName || (log.appUser ? (log.appUser.name || log.appUser.displayName || log.appUser.email.split('@')[0]) : log.userEmail.split('@')[0]),
        userEmail: log.userEmail,
        appUser: log.appUser ? {
          id: log.appUser.id,
          email: log.appUser.email,
          name: log.appUser.name,
          displayName: log.appUser.displayName,
          wpUserId: log.appUser.wpUserId,
        } : null,
        date: log.date.toISOString().split('T')[0],
        weight: log.weight,
        previousWeight: log.previousWeight,
        change: log.change !== null ? Math.round(log.change * 10) / 10 : null,
        changeType: log.changeType,
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Get public weight logs error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching weight logs',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

