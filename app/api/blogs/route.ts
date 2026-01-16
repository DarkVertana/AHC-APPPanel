import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET all blogs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tag = searchParams.get('tag') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { tagline: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }
    
    if (tag) {
      where.tags = { has: tag };
    }
    
    if (status) {
      where.status = status;
    }

    // Get blogs with pagination
    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.blog.count({ where }),
    ]);

    return NextResponse.json({
      blogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get blogs error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching blogs' },
      { status: 500 }
    );
  }
}

// CREATE blog
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, tagline, description, tags, featuredImage, status } = body;

    // Validate required fields
    if (!title || !tagline || !description || !tags || !Array.isArray(tags) || tags.length === 0 || !featuredImage) {
      return NextResponse.json(
        { error: 'Title, tagline, description, at least one tag, and featured image are required' },
        { status: 400 }
      );
    }

    // Normalize text to handle encoding issues - only replace characters that cause WIN1252 encoding errors
    // The error specifically mentions byte sequence 0xe2 0x89 0xa5 which is the "≥" character
    const normalizeText = (text: string): string => {
      if (!text) return text;
      // Only replace the specific problematic character that causes the encoding error
      // This is a minimal fix to prevent the WIN1252 encoding issue
      return text.replace(/≥/g, '>=').replace(/≤/g, '<=');
    };

    // Normalize text fields to prevent encoding errors
    title = normalizeText(title);
    tagline = normalizeText(tagline);
    description = normalizeText(description);

    // Create blog
    const blog = await prisma.blog.create({
      data: {
        title,
        tagline,
        description,
        tags,
        featuredImage,
        status: status || 'published',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Blog created successfully',
      blog,
    }, { status: 201 });
  } catch (error) {
    console.error('Create blog error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating blog' },
      { status: 500 }
    );
  }
}

