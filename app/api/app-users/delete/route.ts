import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * Delete App User Endpoint (Request-Based Flow)
 *
 * Instead of immediately deleting the user, this creates an AccountDeletionRequest.
 * The request will auto-delete the user after 24 hours unless an admin puts it on hold.
 *
 * Query Parameters:
 * - wpUserId: WordPress user ID (required if email not provided)
 * - email: User email (required if wpUserId not provided)
 * - reason: Optional reason for deletion
 *
 * Security:
 * - Requires valid API key in request headers
 */
export async function DELETE(request: NextRequest) {
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
    const reason = searchParams.get('reason');

    // Validate that at least one identifier is provided
    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'Either wpUserId or email query parameter is required' },
        { status: 400 }
      );
    }

    // Find user by wpUserId or email (try wpUserId first, then fallback to email)
    let user;
    if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId: String(wpUserId) },
      });
    }

    // If user not found by wpUserId and email is provided, try email
    if (!user && email) {
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

    // Check for existing pending or on_hold request (idempotent)
    const existingRequest = await prisma.accountDeletionRequest.findFirst({
      where: {
        appUserId: user.id,
        status: { in: ['pending', 'on_hold'] },
      },
    });

    if (existingRequest) {
      return NextResponse.json({
        success: true,
        message: 'Deletion request already exists',
        deletionRequest: existingRequest,
      });
    }

    // Create new deletion request with 24-hour auto-delete window
    const now = new Date();
    const autoDeleteAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours

    const deletionRequest = await prisma.accountDeletionRequest.create({
      data: {
        appUserId: user.id,
        reason: reason || null,
        requestedAt: now,
        autoDeleteAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account deletion requested. Will be processed in 24 hours unless held by admin.',
      deletionRequest,
    });
  } catch (error) {
    console.error('Delete app user error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while processing deletion request',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}
