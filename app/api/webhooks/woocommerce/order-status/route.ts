import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotificationToUser } from '@/lib/fcm-service';

/**
 * WordPress/WooCommerce Webhook for Order Status Updates
 * 
 * Configure this URL in WooCommerce → Settings → Advanced → Webhooks
 * Event: Order updated
 * Delivery URL: https://your-domain.com/api/webhooks/woocommerce/order-status
 * 
 * You can secure this with a secret key in the query string or header
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
    
    // Extract order data from WooCommerce webhook
    const orderId = body.id;
    const orderStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email;
    const customerId = body.customer_id;
    const orderTotal = body.total;
    const orderNumber = body.number || orderId;
    
    // Validate required fields
    if (!orderId || !orderStatus || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: id, status, or customer email' },
        { status: 400 }
      );
    }

    // Map WooCommerce order statuses to user-friendly messages
    const statusMessages: Record<string, { title: string; message: string }> = {
      'pending': {
        title: 'Order Received',
        message: `Your order #${orderNumber} has been received and is being processed.`,
      },
      'processing': {
        title: 'Order Processing',
        message: `Your order #${orderNumber} is being processed.`,
      },
      'on-hold': {
        title: 'Order On Hold',
        message: `Your order #${orderNumber} is currently on hold.`,
      },
      'completed': {
        title: 'Order Completed',
        message: `Your order #${orderNumber} has been completed! Thank you for your purchase.`,
      },
      'cancelled': {
        title: 'Order Cancelled',
        message: `Your order #${orderNumber} has been cancelled.`,
      },
      'refunded': {
        title: 'Order Refunded',
        message: `Your order #${orderNumber} has been refunded.`,
      },
      'failed': {
        title: 'Order Failed',
        message: `Your order #${orderNumber} payment failed. Please try again.`,
      },
    };

    const statusInfo = statusMessages[orderStatus] || {
      title: 'Order Status Updated',
      message: `Your order #${orderNumber} status has been updated to ${orderStatus}.`,
    };

    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        title: statusInfo.title,
        description: statusInfo.message,
        isActive: true,
        url: `/orders/${orderId}`, // Navigate to order details in app
      },
    });

    // Send push notification to user
    const pushResult = await sendPushNotificationToUser(
      customerEmail,
      statusInfo.title,
      statusInfo.message,
      undefined, // No image for order notifications
      {
        notificationId: notification.id,
        type: 'order_status',
        orderId: String(orderId),
        orderStatus: orderStatus,
        url: `/orders/${orderId}`,
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
      message: 'Order status notification sent',
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
