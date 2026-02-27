import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// PUT - Update a supported language
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);

    const existing = await prisma.supportedLanguage.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Language not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, nativeName, isActive, order } = body;

    const language = await prisma.supportedLanguage.update({
      where: { id: resolvedParams.id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        nativeName: nativeName !== undefined ? (nativeName ? nativeName.trim() : null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        order: order !== undefined ? order : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Language updated successfully',
      language,
    });
  } catch (error) {
    console.error('Error updating language:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a supported language and its translations
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);

    const language = await prisma.supportedLanguage.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!language) {
      return NextResponse.json(
        { error: 'Language not found' },
        { status: 404 }
      );
    }

    // Prevent deleting English
    if (language.code === 'en') {
      return NextResponse.json(
        { error: 'Cannot delete English language' },
        { status: 400 }
      );
    }

    // Delete all translations for this locale first
    await prisma.translation.deleteMany({
      where: { locale: language.code },
    });

    // Delete the language
    await prisma.supportedLanguage.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Language and associated translations deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting language:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
