import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET device analytics for dashboard (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Get all devices with platform and deviceName
    const devices = await prisma.userDevice.findMany({
      select: {
        platform: true,
        deviceName: true,
      },
    });

    // Categorize devices
    let iphone = 0;
    let ipad = 0;
    let androidPhone = 0;
    let androidTablet = 0;
    let otherIos = 0;
    let otherAndroid = 0;

    for (const device of devices) {
      const name = (device.deviceName || '').toLowerCase();
      const platform = device.platform.toLowerCase();

      if (platform === 'ios') {
        if (name.includes('ipad')) {
          ipad++;
        } else if (name.includes('iphone') || name === '') {
          iphone++;
        } else {
          otherIos++;
        }
      } else if (platform === 'android') {
        // Common tablet indicators in device names
        const isTablet =
          name.includes('tablet') ||
          name.includes('tab') ||
          name.includes('pad') ||
          name.includes('sm-t') || // Samsung tablets
          name.includes('sm-x') || // Samsung tablets (newer)
          name.includes('mediapad') || // Huawei tablets
          name.includes('matepad') || // Huawei tablets
          name.includes('lenovo tb') || // Lenovo tablets
          name.includes('pixel tablet') ||
          name.includes('galaxy tab');

        if (isTablet) {
          androidTablet++;
        } else {
          androidPhone++;
        }
      }
    }

    // Get total unique users with devices
    const usersWithDevices = await prisma.userDevice.groupBy({
      by: ['appUserId'],
    });

    // Get platform breakdown by unique users
    const usersByPlatform = await prisma.userDevice.groupBy({
      by: ['appUserId', 'platform'],
    });

    const iosUsers = new Set(
      usersByPlatform.filter((u) => u.platform === 'ios').map((u) => u.appUserId)
    );
    const androidUsers = new Set(
      usersByPlatform.filter((u) => u.platform === 'android').map((u) => u.appUserId)
    );

    return NextResponse.json({
      totalDevices: devices.length,
      totalUsersWithDevices: usersWithDevices.length,
      byDeviceType: [
        { type: 'iPhone', count: iphone, platform: 'ios' },
        { type: 'iPad', count: ipad, platform: 'ios' },
        { type: 'Android Phone', count: androidPhone, platform: 'android' },
        { type: 'Android Tablet', count: androidTablet, platform: 'android' },
        ...(otherIos > 0 ? [{ type: 'Other iOS', count: otherIos, platform: 'ios' }] : []),
        ...(otherAndroid > 0 ? [{ type: 'Other Android', count: otherAndroid, platform: 'android' }] : []),
      ],
      byPlatform: {
        ios: { devices: iphone + ipad + otherIos, users: iosUsers.size },
        android: { devices: androidPhone + androidTablet + otherAndroid, users: androidUsers.size },
      },
    });
  } catch (error) {
    console.error('Device analytics error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching device analytics' },
      { status: 500 }
    );
  }
}
