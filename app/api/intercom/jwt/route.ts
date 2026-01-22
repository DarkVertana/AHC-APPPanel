import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateApiKey } from '@/lib/middleware';

/**
 * Intercom User Hash Endpoint
 *
 * This endpoint generates an HMAC-SHA256 hash for Intercom Identity Verification.
 * Intercom uses HMAC, not JWT, for identity verification.
 *
 * Request Body:
 * - user_id: string (required) - The unique identifier for the user
 *
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 *
 * Response:
 * - hash: string - The HMAC-SHA256 hash for Intercom identity verification
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

    // Get Intercom Identity Verification Secret from environment
    const intercomSecret = process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET;

    if (!intercomSecret) {
      console.error('INTERCOM_IDENTITY_VERIFICATION_SECRET is not configured');
      return NextResponse.json(
        { error: 'Intercom identity verification is not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { user_id } = body;

    // Validate required fields
    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Generate HMAC-SHA256 hash for Intercom identity verification
    const hash = crypto
      .createHmac('sha256', intercomSecret)
      .update(String(user_id))
      .digest('hex');

    return NextResponse.json({ hash });
  } catch (error) {
    console.error('Intercom hash generation error:', error);

    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while generating Intercom hash';

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
