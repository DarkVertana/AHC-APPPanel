import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * Get App User Endpoint
 * 
 * This endpoint retrieves user data from the app_user table.
 * 
 * Query Parameters:
 * - wpUserId: WordPress user ID (required if email not provided)
 * - email: User email (required if wpUserId not provided)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
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

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get app user error:', error);
    
    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching user';

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

