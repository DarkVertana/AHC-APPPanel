import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { deleteTranslationsForEntity } from '@/lib/translations';

// GET single blog
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const blog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ blog });
  } catch (error) {
    console.error('Get blog error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching blog' },
      { status: 500 }
    );
  }
}

// UPDATE blog
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { title, tagline, description, tags, featuredImage, status } = body;

    // Check if blog exists
    const existingBlog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!existingBlog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    // Validate tags if provided
    if (tags !== undefined) {
      if (!Array.isArray(tags) || tags.length === 0) {
        return NextResponse.json(
          { error: 'At least one tag is required' },
          { status: 400 }
        );
      }
    }

    // Normalize text to handle encoding issues - only replace characters that cause WIN1252 encoding errors
    const normalizeText = (text: string): string => {
      if (!text) return text;
      // Only replace the specific problematic character that causes the encoding error
      return text.replace(/≥/g, '>=').replace(/≤/g, '<=');
    };

    // Normalize text fields to prevent encoding errors
    const normalizedTitle = title ? normalizeText(title) : title;
    const normalizedTagline = tagline ? normalizeText(tagline) : tagline;
    const normalizedDescription = description ? normalizeText(description) : description;

    // Update blog
    const blog = await prisma.blog.update({
      where: { id },
      data: {
        ...(normalizedTitle && { title: normalizedTitle }),
        ...(normalizedTagline && { tagline: normalizedTagline }),
        ...(normalizedDescription && { description: normalizedDescription }),
        ...(tags && { tags }),
        ...(featuredImage && { featuredImage }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Blog updated successfully',
      blog,
    });
  } catch (error) {
    console.error('Update blog error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating blog' },
      { status: 500 }
    );
  }
}

// DELETE blog
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if blog exists
    const existingBlog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!existingBlog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    // Delete blog and its translations
    await prisma.blog.delete({
      where: { id },
    });
    await deleteTranslationsForEntity('blog', id);

    return NextResponse.json({
      success: true,
      message: 'Blog deleted successfully',
    });
  } catch (error) {
    console.error('Delete blog error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting blog' },
      { status: 500 }
    );
  }
}

