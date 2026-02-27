import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET - List all supported languages (admin)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const languages = await prisma.supportedLanguage.findMany({
      orderBy: [
        { order: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      languages,
      total: languages.length,
    });
  } catch (error) {
    console.error('Error fetching languages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new supported language
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, nativeName, isActive, order } = body;

    // Validate required fields
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    // Validate code uniqueness
    const existing = await prisma.supportedLanguage.findUnique({
      where: { code: code.trim().toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Language with code '${code}' already exists` },
        { status: 409 }
      );
    }

    // Get the next order number if not provided
    let languageOrder = order;
    if (languageOrder === undefined || languageOrder === null) {
      const lastLanguage = await prisma.supportedLanguage.findFirst({
        orderBy: { order: 'desc' },
      });
      languageOrder = (lastLanguage?.order || 0) + 1;
    }

    const language = await prisma.supportedLanguage.create({
      data: {
        code: code.trim().toLowerCase(),
        name: name.trim(),
        nativeName: nativeName ? nativeName.trim() : null,
        isActive: isActive !== undefined ? isActive : true,
        order: languageOrder,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Language created successfully',
      language,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating language:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
