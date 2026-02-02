import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Cleanup endpoint to remove duplicate FCM tokens and migrate to multi-device support
 *
 * POST: Clean up duplicates and optionally migrate legacy tokens to UserDevice table
 * GET: Check for duplicate tokens and device statistics
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const migrateToDevices = searchParams.get('migrate') === 'true';

    let totalCleaned = 0;
    let totalMigrated = 0;
    const cleanupDetails: { token: string; kept: string; cleared: number }[] = [];

    // Step 1: Clean up duplicate FCM tokens in legacy AppUser.fcmToken field
    const duplicateTokens = await prisma.$queryRaw<{ fcmToken: string; count: bigint }[]>`
      SELECT "fcmToken", COUNT(*) as count
      FROM "app_user"
      WHERE "fcmToken" IS NOT NULL
      GROUP BY "fcmToken"
      HAVING COUNT(*) > 1
    `;

    for (const { fcmToken } of duplicateTokens) {
      const usersWithToken = await prisma.appUser.findMany({
        where: { fcmToken },
        orderBy: [
          { lastLoginAt: 'desc' },
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          email: true,
          lastLoginAt: true,
          updatedAt: true,
        },
      });

      if (usersWithToken.length > 1) {
        const [keepUser, ...clearUsers] = usersWithToken;
        const clearIds = clearUsers.map(u => u.id);
        await prisma.appUser.updateMany({
          where: { id: { in: clearIds } },
          data: { fcmToken: null },
        });

        totalCleaned += clearUsers.length;
        cleanupDetails.push({
          token: fcmToken.substring(0, 20) + '...',
          kept: keepUser.email,
          cleared: clearUsers.length,
        });
      }
    }

    // Step 2: Clean up duplicate tokens in UserDevice table
    const duplicateDeviceTokens = await prisma.$queryRaw<{ fcmToken: string; count: bigint }[]>`
      SELECT "fcmToken", COUNT(*) as count
      FROM "user_devices"
      GROUP BY "fcmToken"
      HAVING COUNT(*) > 1
    `;

    let deviceDuplicatesCleaned = 0;
    for (const { fcmToken } of duplicateDeviceTokens) {
      const devicesWithToken = await prisma.userDevice.findMany({
        where: { fcmToken },
        orderBy: [
          { lastActiveAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        select: {
          id: true,
          deviceId: true,
          appUserId: true,
        },
      });

      if (devicesWithToken.length > 1) {
        // Keep the most recent, delete others
        const [, ...deleteDevices] = devicesWithToken;
        const deleteIds = deleteDevices.map(d => d.id);

        await prisma.userDevice.deleteMany({
          where: { id: { in: deleteIds } },
        });

        deviceDuplicatesCleaned += deleteDevices.length;
      }
    }

    // Step 3: Optionally migrate legacy fcmToken to UserDevice table
    if (migrateToDevices) {
      const usersWithLegacyToken = await prisma.appUser.findMany({
        where: {
          fcmToken: { not: null },
        },
        select: {
          id: true,
          email: true,
          fcmToken: true,
          devices: {
            select: { fcmToken: true },
          },
        },
      });

      for (const user of usersWithLegacyToken) {
        if (!user.fcmToken) continue;

        // Check if this token already exists in devices
        const existingDeviceTokens = user.devices.map(d => d.fcmToken);
        if (existingDeviceTokens.includes(user.fcmToken)) {
          continue; // Already migrated
        }

        // Create a device entry for the legacy token
        await prisma.userDevice.create({
          data: {
            appUserId: user.id,
            deviceId: `legacy_${user.id}`,
            platform: 'unknown',
            fcmToken: user.fcmToken,
            deviceName: 'Migrated from legacy',
          },
        });

        totalMigrated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed`,
      legacyDuplicatesFound: duplicateTokens.length,
      legacyTokensCleaned: totalCleaned,
      deviceDuplicatesCleaned,
      tokensMigratedToDevices: totalMigrated,
      details: cleanupDetails,
    });
  } catch (error) {
    console.error('Cleanup FCM tokens error:', error);
    return NextResponse.json(
      { error: 'An error occurred during cleanup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Check token status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Check legacy duplicates
    const legacyDuplicates = await prisma.$queryRaw<{ fcmToken: string; count: bigint }[]>`
      SELECT "fcmToken", COUNT(*) as count
      FROM "app_user"
      WHERE "fcmToken" IS NOT NULL
      GROUP BY "fcmToken"
      HAVING COUNT(*) > 1
    `;

    // Check device table duplicates
    let deviceDuplicates: { fcmToken: string; count: bigint }[] = [];
    try {
      deviceDuplicates = await prisma.$queryRaw<{ fcmToken: string; count: bigint }[]>`
        SELECT "fcmToken", COUNT(*) as count
        FROM "user_devices"
        GROUP BY "fcmToken"
        HAVING COUNT(*) > 1
      `;
    } catch {
      // Table might not exist yet
    }

    // Get statistics
    const [
      totalUsers,
      usersWithLegacyToken,
      totalDevices,
      devicesByPlatform,
    ] = await Promise.all([
      prisma.appUser.count({ where: { status: 'Active' } }),
      prisma.appUser.count({ where: { fcmToken: { not: null }, status: 'Active' } }),
      prisma.userDevice.count().catch(() => 0),
      prisma.userDevice.groupBy({
        by: ['platform'],
        _count: { platform: true },
      }).catch(() => []),
    ]);

    // Users with multiple devices
    let usersWithMultipleDevices = 0;
    try {
      const multiDeviceUsers = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT "appUserId") as count
        FROM "user_devices"
        GROUP BY "appUserId"
        HAVING COUNT(*) > 1
      `;
      usersWithMultipleDevices = multiDeviceUsers.length;
    } catch {
      // Table might not exist yet
    }

    return NextResponse.json({
      statistics: {
        totalActiveUsers: totalUsers,
        usersWithLegacyToken,
        totalDevices,
        usersWithMultipleDevices,
        devicesByPlatform: devicesByPlatform.map((d: any) => ({
          platform: d.platform,
          count: d._count.platform,
        })),
      },
      duplicates: {
        legacyDuplicatesFound: legacyDuplicates.length,
        deviceDuplicatesFound: deviceDuplicates.length,
      },
      actions: {
        cleanup: 'POST to this endpoint to clean up duplicates',
        migrate: 'POST with ?migrate=true to migrate legacy tokens to UserDevice table',
      },
    });
  } catch (error) {
    console.error('Check token status error:', error);
    return NextResponse.json(
      { error: 'An error occurred', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
