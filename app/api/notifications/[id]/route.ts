import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { sendPushNotificationToAll } from '@/lib/fcm-service';

// GET single notification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const notification = await prisma.notification.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Get notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching notification' },
      { status: 500 }
    );
  }
}

// UPDATE notification
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    
    // Get the current notification to check if status is changing
    const currentNotification = await prisma.notification.findUnique({
      where: { id: resolvedParams.id },
      select: { isActive: true },
    });

    if (!currentNotification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, description, image, url, isActive } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.update({
      where: { id: resolvedParams.id },
      data: {
        title,
        description,
        image: image !== undefined ? image : undefined,
        url: url !== undefined ? (url && url.trim() ? url.trim() : null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    // Only send push notification if status changed from inactive to active
    // This prevents duplicate notifications when just updating content
    const wasInactive = !currentNotification.isActive;
    const isNowActive = notification.isActive;
    const statusChangedToActive = wasInactive && isNowActive;

    let pushResult = null;
    let pushError = null;
    if (statusChangedToActive) {
      try {
        // Check if image is already a full URL (e.g., from Cloudinary) or a relative path
        const imageUrl = notification.image 
          ? (notification.image.startsWith('http://') || notification.image.startsWith('https://'))
            ? notification.image
            : `${process.env.NEXTAUTH_URL || 'https://appanel.alternatehealthclub.com'}${notification.image}`
          : undefined;
        
        // Build data payload for FCM
        const fcmData: Record<string, string> = {
          notificationId: notification.id,
          type: 'notification',
        };
        
        // Add URL to data payload if provided
        if (notification.url) {
          fcmData.url = notification.url;
        }
        
        pushResult = await sendPushNotificationToAll(
          notification.title,
          notification.description,
          imageUrl,
          fcmData,
          { source: 'admin', type: 'general', sourceId: notification.id }
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
      message: 'Notification updated successfully',
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
    });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating notification' },
      { status: 500 }
    );
  }
}

// DELETE notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    await prisma.notification.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting notification' },
      { status: 500 }
    );
  }
}

