import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { entityType, entityId, translations } = body;

    if (!entityType || !entityId || !Array.isArray(translations)) {
      return NextResponse.json(
        { error: 'Missing required fields: entityType, entityId, and translations array' },
        { status: 400 }
      );
    }

    const results = [];

    for (const translation of translations) {
      const { locale, field, value } = translation;

      if (!locale || !field) {
        continue;
      }

      if (value === '') {
        // Delete the translation if value is empty string
        await prisma.translation.deleteMany({
          where: {
            entityType,
            entityId,
            locale,
            field,
          },
        });
      } else {
        // Upsert the translation
        const result = await prisma.translation.upsert({
          where: {
            entityType_entityId_locale_field: {
              entityType,
              entityId,
              locale,
              field,
            },
          },
          update: {
            value,
          },
          create: {
            entityType,
            entityId,
            locale,
            field,
            value,
          },
        });
        results.push(result);
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      translations: results,
    });
  } catch (error) {
    console.error('Error upserting translations:', error);
    return NextResponse.json(
      { error: 'Failed to upsert translations' },
      { status: 500 }
    );
  }
}
