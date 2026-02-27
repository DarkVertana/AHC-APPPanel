import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * Public Languages API Endpoint for Mobile App
 *
 * Returns all active supported languages.
 * English is always included as the first entry.
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

    // Fetch active languages ordered by order then name
    const languages = await prisma.supportedLanguage.findMany({
      where: { isActive: true },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' },
      ],
      select: {
        code: true,
        name: true,
        nativeName: true,
      },
    });

    // Build response with English hardcoded as the first entry
    const languageList = [
      { code: 'en', name: 'English', nativeName: 'English' },
      ...languages
        .filter(lang => lang.code !== 'en') // Avoid duplicating English if it exists in the table
        .map(lang => ({
          code: lang.code,
          name: lang.name,
          nativeName: lang.nativeName || lang.name,
        })),
    ];

    return NextResponse.json({
      success: true,
      languages: languageList,
    });
  } catch (error) {
    console.error('Get public languages error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while fetching languages',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined,
      },
      { status: 500 }
    );
  }
}
