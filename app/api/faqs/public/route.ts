import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { getLocaleFromRequest, applyTranslation, applyTranslationsBatch } from '@/lib/translations';

/**
 * Public FAQ API Endpoint for Mobile App
 * 
 * This endpoint retrieves active FAQs for the Android app.
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Number of FAQs per page (default: 10, max: 50)
 * - search: Search term to filter FAQs by question or answer
 * - id: Get a single FAQ by ID (returns single FAQ object instead of array)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * - Only returns FAQs with isActive: true
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
    const faqId = searchParams.get('id');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Max 50 per page (matching blogs)
    const skip = (page - 1) * limit;
    const locale = getLocaleFromRequest(request);

    // If requesting a single FAQ by ID
    if (faqId) {
      const faq = await prisma.fAQ.findFirst({
        where: {
          id: faqId,
          isActive: true, // Only return active FAQs
        },
      });

      if (!faq) {
        return NextResponse.json(
          { error: 'FAQ not found or not active' },
          { status: 404 }
        );
      }

      // Apply translations
      const tFaq = await applyTranslation(faq as any, 'faq', faq.id, locale);

      return NextResponse.json({
        success: true,
        locale,
        faq: {
          id: faq.id,
          question: tFaq.question,
          answer: tFaq.answer,
          order: faq.order,
          createdAt: faq.createdAt.toISOString(),
          updatedAt: faq.updatedAt.toISOString(),
        },
      });
    }

    // Build where clause for active FAQs only
    const where: any = {
      isActive: true, // Only return active FAQs
    };
    
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get FAQs with pagination
    const [faqs, total] = await Promise.all([
      prisma.fAQ.findMany({
        where,
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
        select: {
          id: true,
          question: true,
          answer: true,
          order: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.fAQ.count({ where }),
    ]);

    // Apply translations
    const tFaqs = await applyTranslationsBatch(faqs as any[], 'faq', 'id', locale);

    return NextResponse.json({
      success: true,
      locale,
      faqs: faqs.map((faq, i) => {
        const tFaq = tFaqs[i];
        return {
          id: faq.id,
          question: tFaq.question,
          answer: tFaq.answer,
          order: faq.order,
          createdAt: faq.createdAt.toISOString(),
          updatedAt: faq.updatedAt.toISOString(),
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Get public FAQs error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching FAQs',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

