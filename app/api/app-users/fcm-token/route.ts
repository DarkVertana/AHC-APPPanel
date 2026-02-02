import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { generateNextUserId } from '@/lib/user-id-generator';

/**
 * Register or update FCM token for a user device
 *
 * This endpoint allows the mobile app to register or update the FCM token
 * for push notifications. Supports multi-device - each device is tracked separately.
 *
 * Request Body:
 * - wpUserId (string, required): WordPress user ID
 * - email (string, required): User email
 * - fcmToken (string, required): Firebase Cloud Messaging token
 * - deviceId (string, required): Unique device identifier
 * - platform (string, required): "ios" or "android"
 * - deviceName (string, optional): Device name/model for reference
 * - appVersion (string, optional): App version for debugging
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      console.error('API key validation error:', apiKeyError);
      return NextResponse.json(
        { error: 'API key validation failed', details: process.env.NODE_ENV === 'development' ? (apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error') : undefined },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { wpUserId, email, fcmToken, deviceId, platform, deviceName, appVersion } = body;

    // Validate required fields
    if (!wpUserId || !email || !fcmToken) {
      return NextResponse.json(
        { error: 'wpUserId, email, and fcmToken are required' },
        { status: 400 }
      );
    }

    // Validate deviceId and platform for multi-device support
    if (!deviceId || !platform) {
      return NextResponse.json(
        { error: 'deviceId and platform are required for multi-device support' },
        { status: 400 }
      );
    }

    // Validate platform value
    if (!['ios', 'android'].includes(platform.toLowerCase())) {
      return NextResponse.json(
        { error: 'platform must be "ios" or "android"' },
        { status: 400 }
      );
    }

    // Normalize values
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPlatform = platform.toLowerCase();

    // CRITICAL: Clear this FCM token from ALL other devices first
    // This prevents duplicate notifications when:
    // - Token gets recycled by Firebase
    // - User logs into different account on same device
    const clearedDevices = await prisma.userDevice.deleteMany({
      where: {
        fcmToken: fcmToken,
        NOT: {
          deviceId: deviceId,
        },
      },
    });

    if (clearedDevices.count > 0) {
      console.log(`Cleared FCM token from ${clearedDevices.count} other device(s) to prevent duplicates`);
    }

    // Also clear from legacy fcmToken field on AppUser
    await prisma.appUser.updateMany({
      where: {
        fcmToken: fcmToken,
        NOT: {
          OR: [
            { wpUserId: wpUserId },
            { email: normalizedEmail },
          ],
        },
      },
      data: {
        fcmToken: null,
      },
    });

    // Find user by wpUserId OR email (to prevent duplicates)
    let user = await prisma.appUser.findUnique({
      where: { wpUserId },
    });

    // If not found by wpUserId, try to find by email
    if (!user) {
      user = await prisma.appUser.findFirst({
        where: { email: normalizedEmail },
      });
    }

    if (!user) {
      // Generate custom user ID (AHC2601, AHC2602, etc.)
      const userId = await generateNextUserId();

      // Create new user if doesn't exist by either wpUserId or email
      user = await prisma.appUser.create({
        data: {
          id: userId,
          wpUserId,
          email: normalizedEmail,
          fcmToken, // Keep legacy field updated for backward compatibility
        },
      });
    } else {
      // Update legacy fcmToken field for backward compatibility
      user = await prisma.appUser.update({
        where: { id: user.id },
        data: {
          fcmToken, // Keep legacy field updated
          wpUserId: wpUserId !== user.wpUserId ? wpUserId : user.wpUserId,
        },
      });
    }

    // Upsert device entry (create or update)
    const device = await prisma.userDevice.upsert({
      where: {
        appUserId_deviceId: {
          appUserId: user.id,
          deviceId: deviceId,
        },
      },
      update: {
        fcmToken,
        platform: normalizedPlatform,
        deviceName: deviceName || undefined,
        appVersion: appVersion || undefined,
        lastActiveAt: new Date(),
      },
      create: {
        appUserId: user.id,
        deviceId,
        platform: normalizedPlatform,
        fcmToken,
        deviceName: deviceName || undefined,
        appVersion: appVersion || undefined,
      },
    });

    // Get total device count for this user
    const deviceCount = await prisma.userDevice.count({
      where: { appUserId: user.id },
    });

    console.log(`FCM token registered: user=${user.email}, device=${deviceId}, platform=${normalizedPlatform}, totalDevices=${deviceCount}`);

    return NextResponse.json({
      success: true,
      message: 'FCM token registered successfully',
      user: {
        id: user.id,
        wpUserId: user.wpUserId,
        email: user.email,
      },
      device: {
        id: device.id,
        deviceId: device.deviceId,
        platform: device.platform,
        fcmTokenRegistered: !!device.fcmToken,
      },
      totalDevices: deviceCount,
    });
  } catch (error) {
    console.error('Register FCM token error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while registering FCM token',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Remove FCM token for a user device (logout/unsubscribe)
 *
 * Query Parameters:
 * - wpUserId or email: User identifier
 * - deviceId (optional): Specific device to remove. If not provided, removes all devices.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Validate API key
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      console.error('API key validation error:', apiKeyError);
      return NextResponse.json(
        { error: 'API key validation failed', details: process.env.NODE_ENV === 'development' ? (apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error') : undefined },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');
    const deviceId = searchParams.get('deviceId');

    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'wpUserId or email is required' },
        { status: 400 }
      );
    }

    // Find user
    let user;
    if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId },
      });
    }
    if (!user && email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let deletedCount = 0;

    if (deviceId) {
      // Remove specific device
      const result = await prisma.userDevice.deleteMany({
        where: {
          appUserId: user.id,
          deviceId: deviceId,
        },
      });
      deletedCount = result.count;
    } else {
      // Remove all devices for this user
      const result = await prisma.userDevice.deleteMany({
        where: { appUserId: user.id },
      });
      deletedCount = result.count;

      // Also clear legacy fcmToken
      await prisma.appUser.update({
        where: { id: user.id },
        data: { fcmToken: null },
      });
    }

    console.log(`FCM token(s) removed: user=${user.email}, devices=${deletedCount}`);

    return NextResponse.json({
      success: true,
      message: deviceId
        ? 'Device FCM token removed successfully'
        : 'All FCM tokens removed successfully',
      devicesRemoved: deletedCount,
    });
  } catch (error) {
    console.error('Remove FCM token error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while removing FCM token',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET - List all devices for a user (admin/debug)
 */
export async function GET(request: NextRequest) {
  try {
    // Validate API key
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      return NextResponse.json(
        { error: 'API key validation failed' },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');

    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'wpUserId or email is required' },
        { status: 400 }
      );
    }

    // Find user
    let user;
    if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId },
        include: {
          devices: {
            orderBy: { lastActiveAt: 'desc' },
          },
        },
      });
    }
    if (!user && email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
        include: {
          devices: {
            orderBy: { lastActiveAt: 'desc' },
          },
        },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        wpUserId: user.wpUserId,
        email: user.email,
      },
      devices: user.devices.map(d => ({
        id: d.id,
        deviceId: d.deviceId,
        platform: d.platform,
        deviceName: d.deviceName,
        appVersion: d.appVersion,
        lastActiveAt: d.lastActiveAt.toISOString(),
        createdAt: d.createdAt.toISOString(),
      })),
      totalDevices: user.devices.length,
    });
  } catch (error) {
    console.error('Get user devices error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching devices' },
      { status: 500 }
    );
  }
}
