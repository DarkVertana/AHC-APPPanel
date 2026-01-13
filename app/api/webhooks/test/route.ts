import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPushNotificationToUser,
  getOrderStatusIcon,
  getOrderStatusMessage,
} from '@/lib/fcm-service';

/**
 * Test endpoint for debugging webhooks and push notifications
 *
 * Usage:
 * POST /api/webhooks/test
 * {
 *   "email": "customer@example.com",
 *   "type": "order",
 *   "status": "completed",
 *   "resourceId": "12345"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, type = 'order', status = 'completed', resourceId = '12345' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user exists and has FCM token
    const user = await prisma.appUser.findFirst({
      where: {
        OR: [
          { email: email },
          { wpUserId: email },
        ],
      },
      select: {
        id: true,
        email: true,
        wpUserId: true,
        fcmToken: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        searchedFor: email,
        hint: 'Make sure the user has registered via the Flutter app and the email matches exactly',
      }, { status: 404 });
    }

    if (!user.fcmToken) {
      return NextResponse.json({
        success: false,
        error: 'User has no FCM token',
        user: {
          id: user.id,
          email: user.email,
          wpUserId: user.wpUserId,
          status: user.status,
        },
        hint: 'The Flutter app needs to register the FCM token first',
      }, { status: 400 });
    }

    if (user.status !== 'Active') {
      return NextResponse.json({
        success: false,
        error: 'User is not active',
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
        },
      }, { status: 400 });
    }

    // Get notification content
    const { title, body: message } = getOrderStatusMessage(status, resourceId);
    const icon = getOrderStatusIcon(status);

    console.log('Test push notification:', { email, title, message, icon });

    // Send push notification
    const pushResult = await sendPushNotificationToUser(
      email,
      title,
      message,
      undefined,
      {
        type: type === 'subscription' ? 'subscription_status' : 'order_status',
        icon,
        orderId: resourceId,
        orderStatus: status,
        url: `/${type}s/${resourceId}`,
      }
    );

    return NextResponse.json({
      success: pushResult.success,
      user: {
        id: user.id,
        email: user.email,
        fcmToken: user.fcmToken.substring(0, 20) + '...',
      },
      notification: {
        title,
        message,
        icon,
      },
      pushResult,
    });

  } catch (error: any) {
    console.error('Test webhook error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error.message,
    }, { status: 500 });
  }
}

// GET endpoint to check registered users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (email) {
      // Search for specific user
      const user = await prisma.appUser.findFirst({
        where: {
          OR: [
            { email: { contains: email, mode: 'insensitive' } },
            { wpUserId: email },
          ],
        },
        select: {
          id: true,
          email: true,
          wpUserId: true,
          name: true,
          fcmToken: true,
          status: true,
          createdAt: true,
        },
      });

      if (!user) {
        return NextResponse.json({
          found: false,
          searchedFor: email,
        });
      }

      return NextResponse.json({
        found: true,
        user: {
          ...user,
          fcmToken: user.fcmToken ? user.fcmToken.substring(0, 30) + '...' : null,
        },
      });
    }

    // List users with FCM tokens
    const usersWithTokens = await prisma.appUser.findMany({
      where: {
        fcmToken: { not: null },
        status: 'Active',
      },
      select: {
        id: true,
        email: true,
        wpUserId: true,
        name: true,
        status: true,
        createdAt: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const totalWithTokens = await prisma.appUser.count({
      where: {
        fcmToken: { not: null },
        status: 'Active',
      },
    });

    return NextResponse.json({
      message: 'Users with FCM tokens registered',
      total: totalWithTokens,
      users: usersWithTokens,
    });

  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      error: 'Failed to fetch users',
      details: error.message,
    }, { status: 500 });
  }
}
