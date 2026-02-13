import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

/**
 * Intercom JWT Endpoint
 *
 * Generates a signed JWT for Intercom Identity Verification.
 *
 * Request Body:
 * - user_id: string (required)
 * - email: string (optional)
 *
 * Security:
 * - Requires valid API key in request headers
 *
 * Response:
 * - token: string - The signed JWT (expires in 1 hour)
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
        {
          error: 'API key validation failed',
          details: process.env.NODE_ENV === 'development'
            ? (apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error')
            : undefined
        },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Intercom JWT Secret from settings
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
      select: { intercomJwtSecret: true },
    });

    const intercomSecret = settings?.intercomJwtSecret;

    if (!intercomSecret) {
      console.error('Intercom JWT secret is not configured in settings');
      return NextResponse.json(
        { error: 'Intercom identity verification is not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { user_id, email } = body;

    // Validate required fields
    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Build JWT payload
    const payload: Record<string, string> = {
      user_id: String(user_id),
    };
    if (email) {
      payload.email = String(email);
    }

    // Sign JWT with 1 hour expiry
    const token = jwt.sign(payload, intercomSecret, { expiresIn: '1h' });

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Intercom JWT generation error:', error);

    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while generating Intercom JWT';

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
