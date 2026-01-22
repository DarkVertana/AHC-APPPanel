import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPushNotificationToUser,
  getOrderStatusIcon,
  getOrderStatusMessage,
} from '@/lib/fcm-service';

/**
 * WooCommerce Webhook for Order Status Updates
 */
export async function POST(request: NextRequest) {
  console.log('=== ORDER WEBHOOK RECEIVED ===');

  try {
    // Read body once
    const text = await request.text();
    console.log('Raw body length:', text.length);
    console.log('Raw body preview:', text.substring(0, 300));

    // Check headers
    const contentType = request.headers.get('content-type') || '';
    const webhookTopic = request.headers.get('x-wc-webhook-topic');
    const webhookSource = request.headers.get('x-wc-webhook-source');
    console.log('Headers:', { contentType, webhookTopic, webhookSource });

    // Handle empty body
    if (!text || !text.trim()) {
      console.log('Empty body - ping response');
      return NextResponse.json({ success: true, message: 'Ping received' });
    }

    // Handle form-urlencoded ping (e.g., "webhook_id=68")
    if (text.includes('webhook_id=') && !text.startsWith('{')) {
      console.log('WooCommerce ping (form-urlencoded):', text);
      return NextResponse.json({ success: true, message: 'Webhook ping received' });
    }

    // Parse JSON
    let body;
    try {
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error - treating as ping');
      return NextResponse.json({ success: true, message: 'Acknowledged' });
    }

    // Handle WooCommerce ping (has webhook_id but no order data)
    if (body.webhook_id && !body.id) {
      console.log('WooCommerce ping with webhook_id:', body.webhook_id);
      return NextResponse.json({ success: true, message: 'Webhook ping received' });
    }

    // Extract order data
    const orderId = body.id;
    const orderStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email || body.email;
    const orderNumber = body.number || body.order_number || orderId;

    console.log('Order Data:', { orderId, orderStatus, customerEmail, orderNumber });

    // Validate required fields
    if (!orderId || !orderStatus) {
      console.log('Missing order data - not an order webhook');
      return NextResponse.json({ success: true, message: 'Not an order event' });
    }

    // Get notification content
    const { title, body: message } = getOrderStatusMessage(orderStatus, String(orderNumber));
    const icon = getOrderStatusIcon(orderStatus);
    const url = `/orders/${orderId}`;

    console.log('Notification:', { title, message, icon });

    // Send push notification
    let pushResult = { success: false, error: 'No customer email' } as { success: boolean; messageId?: string; error?: string };

    if (customerEmail) {
      console.log('Sending push to:', customerEmail);
      // Use same data format as CRUD notifications for Flutter compatibility
      pushResult = await sendPushNotificationToUser(
        customerEmail,
        title,
        message,
        undefined,
        {
          type: 'notification',  // Same as CRUD notifications
          notificationType: 'order_status',
          icon,
          orderId: String(orderId),
          orderStatus,
          url,
        },
        { source: 'webhook', type: 'order', sourceId: String(orderId) }
      );
      console.log('Push result:', pushResult);
    } else {
      console.log('No customer email found in webhook payload');
    }

    // Try to log to database
    try {
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
    } catch (dbError) {
      console.log('DB log skipped');
    }

    console.log('=== ORDER WEBHOOK COMPLETE ===');

    return NextResponse.json({
      success: true,
      orderId,
      orderStatus,
      customerEmail,
      pushSent: !!customerEmail,
      pushSuccess: pushResult.success,
      pushError: pushResult.error,
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Order webhook endpoint active' });
}
