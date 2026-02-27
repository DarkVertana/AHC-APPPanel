import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> | { entityType: string; entityId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { entityType, entityId } = resolvedParams;

    const translations = await prisma.translation.findMany({
      where: {
        entityType,
        entityId,
      },
      select: {
        id: true,
        locale: true,
        field: true,
        value: true,
      },
      orderBy: [
        { locale: 'asc' },
        { field: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      translations,
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch translations' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> | { entityType: string; entityId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { entityType, entityId } = resolvedParams;

    const deleted = await prisma.translation.deleteMany({
      where: {
        entityType,
        entityId,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
    });
  } catch (error) {
    console.error('Error deleting translations:', error);
    return NextResponse.json(
      { error: 'Failed to delete translations' },
      { status: 500 }
    );
  }
}
