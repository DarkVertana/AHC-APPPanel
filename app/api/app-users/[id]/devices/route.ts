import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET devices for a specific app user (admin only)
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

    const devices = await prisma.userDevice.findMany({
      where: { appUserId: id },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        platform: true,
        deviceName: true,
        appVersion: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      devices: devices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        platform: d.platform,
        deviceName: d.deviceName,
        appVersion: d.appVersion,
        lastActiveAt: d.lastActiveAt.toISOString(),
        createdAt: d.createdAt.toISOString(),
      })),
      totalDevices: devices.length,
    });
  } catch (error) {
    console.error('Get user devices error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching user devices' },
      { status: 500 }
    );
  }
}
