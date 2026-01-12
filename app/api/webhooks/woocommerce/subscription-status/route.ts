import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotificationToUser } from '@/lib/fcm-service';

/**
 * WordPress/WooCommerce Webhook for Subscription Status Updates
 * 
 * Configure this URL in WooCommerce → Settings → Advanced → Webhooks
 * Event: Subscription updated
 * Delivery URL: https://your-domain.com/api/webhooks/woocommerce/subscription-status
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify webhook secret
    const WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    if (WEBHOOK_SECRET) {
      const secret = request.headers.get('x-webhook-secret') || 
                     new URL(request.url).searchParams.get('secret');
      
      if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    
    // Extract subscription data from WooCommerce webhook
    const subscriptionId = body.id;
    const subscriptionStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email;
    const customerId = body.customer_id;
    const nextPaymentDate = body.next_payment_date;
    const subscriptionNumber = body.number || subscriptionId;
    
    // Validate required fields
    if (!subscriptionId || !subscriptionStatus || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: id, status, or customer email' },
        { status: 400 }
      );
    }

    // Map WooCommerce subscription statuses to user-friendly messages
    const statusMessages: Record<string, { title: string; message: string }> = {
      'active': {
        title: 'Subscription Active',
        message: `Your subscription #${subscriptionNumber} is now active.`,
      },
      'on-hold': {
        title: 'Subscription On Hold',
        message: `Your subscription #${subscriptionNumber} is currently on hold.`,
      },
      'pending-cancel': {
        title: 'Subscription Cancellation Pending',
        message: `Your subscription #${subscriptionNumber} cancellation is pending.`,
      },
      'cancelled': {
        title: 'Subscription Cancelled',
        message: `Your subscription #${subscriptionNumber} has been cancelled.`,
      },
      'expired': {
        title: 'Subscription Expired',
        message: `Your subscription #${subscriptionNumber} has expired.`,
      },
      'switched': {
        title: 'Subscription Switched',
        message: `Your subscription #${subscriptionNumber} has been switched.`,
      },
      'pending': {
        title: 'Subscription Pending',
        message: `Your subscription #${subscriptionNumber} is pending activation.`,
      },
    };

    const statusInfo = statusMessages[subscriptionStatus] || {
      title: 'Subscription Status Updated',
      message: `Your subscription #${subscriptionNumber} status has been updated to ${subscriptionStatus}.`,
    };

    // Add next payment date if available
    let message = statusInfo.message;
    if (nextPaymentDate && subscriptionStatus === 'active') {
      const paymentDate = new Date(nextPaymentDate).toLocaleDateString();
      message += ` Next payment: ${paymentDate}`;
    }

    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        title: statusInfo.title,
        description: message,
        isActive: true,
        url: `/subscriptions/${subscriptionId}`, // Navigate to subscription details in app
      },
    });

    // Send push notification to user
    const pushResult = await sendPushNotificationToUser(
      customerEmail,
      statusInfo.title,
      message,
      undefined, // No image for subscription notifications
      {
        notificationId: notification.id,
        type: 'subscription_status',
        subscriptionId: String(subscriptionId),
        subscriptionStatus: subscriptionStatus,
        url: `/subscriptions/${subscriptionId}`,
      }
    );

    // Update receiver count
    if (pushResult.success) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { receiverCount: 1 },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription status notification sent',
      notificationId: notification.id,
      pushNotification: {
        sent: pushResult.success,
        error: pushResult.error,
      },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}
