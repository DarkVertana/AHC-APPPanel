import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { sendPushNotificationToAll } from '@/lib/fcm-service';

// GET all notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching notifications' },
      { status: 500 }
    );
  }
}

// CREATE new notification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, description, image, isActive } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        description,
        image: image || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    // Send push notification if active
    let pushResult = null;
    let pushError = null;
    if (notification.isActive) {
      try {
        // Check if image is already a full URL (e.g., from Cloudinary) or a relative path
        const imageUrl = notification.image 
          ? (notification.image.startsWith('http://') || notification.image.startsWith('https://'))
            ? notification.image
            : `${process.env.NEXTAUTH_URL || 'https://appanel.alternatehealthclub.com'}${notification.image}`
          : undefined;
        
        pushResult = await sendPushNotificationToAll(
          notification.title,
          notification.description,
          imageUrl,
          {
            notificationId: notification.id,
            type: 'notification',
          }
        );

        // Update receiver count if push was successful
        if (pushResult && pushResult.successCount > 0) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: { receiverCount: pushResult.successCount },
          });
        }
      } catch (error: any) {
        console.error('Error sending push notification:', error);
        pushError = {
          message: error.message || 'Failed to send push notification',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        };
        // Don't fail the request if push notification fails
      }
    }

    return NextResponse.json({
      success: true,
      notification,
      message: 'Notification created successfully',
      pushNotification: pushResult ? {
        sent: pushResult.successCount > 0,
        successCount: pushResult.successCount,
        failureCount: pushResult.failureCount,
        totalUsers: pushResult.totalUsers,
        errors: pushResult.errors || [],
        error: pushError || (pushResult.failureCount > 0 && pushResult.errors && pushResult.errors.length > 0 
          ? pushResult.errors[0] 
          : undefined),
      } : pushError ? {
        sent: false,
        successCount: 0,
        failureCount: 0,
        totalUsers: 0,
        errors: [],
        error: pushError,
      } : null,
    }, { status: 201 });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating notification' },
      { status: 500 }
    );
  }
}

