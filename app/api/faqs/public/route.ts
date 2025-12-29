import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all active FAQs (public endpoint for mobile app)
export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      );
    }

    // Check if API key exists and is active
    const apiKeys = await prisma.apiKey.findMany({
      where: { isActive: true },
    });

    // Simple comparison for now (in production, use proper hashing)
    const { createHash } = await import('crypto');
    const hashedKey = createHash('sha256').update(apiKey).digest('hex');
    
    const validKey = apiKeys.find(key => key.key === hashedKey);
    
    if (!validKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: validKey.id },
      data: { lastUsed: new Date() },
    });

    // Fetch only active FAQs
    const faqs = await prisma.fAQ.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        question: true,
        answer: true,
        order: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      faqs,
      total: faqs.length,
    });
  } catch (error) {
    console.error('Error fetching public FAQs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

