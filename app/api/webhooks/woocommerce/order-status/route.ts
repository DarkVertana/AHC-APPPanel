import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPushNotificationToUser,
  getOrderStatusIcon,
  getOrderStatusMessage,
} from '@/lib/fcm-service';

/**
 * WooCommerce Webhook for Order Status Updates
 *
 * Configure in WooCommerce → Settings → Advanced → Webhooks:
 * - Name: Order Status Updates
 * - Delivery URL: https://your-domain.com/api/webhooks/woocommerce/order-status
 * - Topic: Order updated
 * - Secret: Set WOOCOMMERCE_WEBHOOK_SECRET env variable
 */
export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret if configured
    const WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    if (WEBHOOK_SECRET) {
      const signature =
        request.headers.get('x-wc-webhook-signature') ||
        request.headers.get('x-webhook-secret') ||
        new URL(request.url).searchParams.get('secret');

      if (signature && signature !== WEBHOOK_SECRET) {
        console.warn('Order webhook: Invalid signature');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Parse request body
    let body;
    try {
      const text = await request.text();
      if (!text.trim()) {
        return NextResponse.json({ error: 'Empty body' }, { status: 400 });
      }
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Extract order data
    const orderId = body.id;
    const orderStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email || body.email;
    const orderNumber = body.number || body.order_number || orderId;

    // Validate required fields
    if (!orderId || !orderStatus) {
      return NextResponse.json(
        { error: 'Missing order id or status' },
        { status: 400 }
      );
    }

    // Get notification content
    const { title, body: message } = getOrderStatusMessage(orderStatus, String(orderNumber));
    const icon = getOrderStatusIcon(orderStatus);
    const url = `/orders/${orderId}`;

    // Initialize push result
    let pushResult: { success: boolean; messageId?: string; error?: string } = {
      success: false,
      error: 'No customer email',
    };

    // Send push notification if customer email exists
    if (customerEmail) {
      pushResult = await sendPushNotificationToUser(
        customerEmail,
        title,
        message,
        undefined,
        {
          type: 'order_status',
          icon,
          orderId: String(orderId),
          orderStatus,
          url,
        }
      );
    }

    // Log webhook to database
    await prisma.webhookLog.create({
      data: {
        source: 'woocommerce',
        event: 'order_status',
        resourceId: String(orderId),
        status: orderStatus,
        customerEmail: customerEmail || null,
        notificationTitle: title,
        notificationBody: message,
        pushSent: !!customerEmail,
        pushSuccess: pushResult.success,
        pushError: pushResult.error || null,
        payload: body,
      },
    });

    return NextResponse.json({
      success: true,
      orderId,
      orderStatus,
      pushSent: pushResult.success,
    });
  } catch (error: any) {
    console.error('Order webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
