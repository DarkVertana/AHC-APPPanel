import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET single push notification log (Admin only)
 */
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

    const log = await prisma.pushNotificationLog.findUnique({
      where: { id },
    });

    if (!log) {
      return NextResponse.json(
        { error: 'Push notification log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: log.id,
      recipientEmail: log.recipientEmail,
      recipientWpUserId: log.recipientWpUserId,
      recipientFcmToken: log.recipientFcmToken,
      recipientCount: log.recipientCount,
      title: log.title,
      body: log.body,
      imageUrl: log.imageUrl,
      dataPayload: log.dataPayload,
      source: log.source,
      type: log.type,
      sourceId: log.sourceId,
      status: log.status,
      successCount: log.successCount,
      failureCount: log.failureCount,
      errorMessage: log.errorMessage,
      errorCode: log.errorCode,
      fcmMessageId: log.fcmMessageId,
      createdAt: log.createdAt.toISOString(),
      sentAt: log.sentAt?.toISOString(),
    });
  } catch (error) {
    console.error('Get push notification log error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching push notification log' },
      { status: 500 }
    );
  }
}

/**
 * DELETE single push notification log (Admin only)
 */
export async function DELETE(
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

    const log = await prisma.pushNotificationLog.findUnique({
      where: { id },
    });

    if (!log) {
      return NextResponse.json(
        { error: 'Push notification log not found' },
        { status: 404 }
      );
    }

    await prisma.pushNotificationLog.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Push notification log deleted successfully',
    });
  } catch (error) {
    console.error('Delete push notification log error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting push notification log' },
      { status: 500 }
    );
  }
}
