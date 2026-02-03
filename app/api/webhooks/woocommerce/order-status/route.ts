import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPushNotificationToUser,
  getOrderStatusIcon,
  getOrderStatusMessage,
} from '@/lib/fcm-service';

// Force Node.js runtime for crypto support
export const runtime = 'nodejs';

/**
 * Verify WooCommerce webhook signature
 */
async function verifyWebhookSignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  try {
    // Use Web Crypto API for broader compatibility
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = Buffer.from(signatureBuffer).toString('base64');
    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

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
    const webhookSignature = request.headers.get('x-wc-webhook-signature');
    console.log('Headers:', { contentType, webhookTopic, webhookSource, hasSignature: !!webhookSignature });

    // Verify webhook signature if secret is configured (async)
    const webhookSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    if (webhookSecret && text && text.trim() && text.startsWith('{')) {
      const isValid = await verifyWebhookSignature(text, webhookSignature, webhookSecret);
      console.log('Webhook signature verification:', isValid ? 'VALID' : 'INVALID');

      if (!isValid && webhookSignature) {
        // Log but don't block - helps debug signature issues
        console.warn('Webhook signature mismatch - check WOOCOMMERCE_WEBHOOK_SECRET');
      }
    }

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

    // Skip notifications for certain statuses (approved, cancelled)
    const SKIP_NOTIFICATION_STATUSES = ['approved', 'cancelled'];
    if (SKIP_NOTIFICATION_STATUSES.includes(orderStatus.toLowerCase())) {
      console.log('Skipping notification for status:', orderStatus);
      return NextResponse.json({
        success: true,
        message: `Notification skipped for status: ${orderStatus}`,
        orderId,
        orderStatus,
        skipped: true,
      });
    }

    // Deduplication: Check if we've already processed this exact order+status recently (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingLog = await prisma.webhookLog.findFirst({
      where: {
        source: 'woocommerce',
        event: 'order_status',
        resourceId: String(orderId),
        status: orderStatus,
        createdAt: { gte: fiveMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingLog) {
      console.log('Duplicate webhook detected - skipping notification', {
        orderId,
        orderStatus,
        previousLogId: existingLog.id,
        previousLogTime: existingLog.createdAt,
      });
      return NextResponse.json({
        success: true,
        message: 'Duplicate webhook - notification already sent',
        orderId,
        orderStatus,
        duplicate: true,
      });
    }

    // Get notification content (check for custom messages in settings)
    let { title, body: message } = getOrderStatusMessage(orderStatus, String(orderNumber));
    const icon = getOrderStatusIcon(orderStatus);

    try {
      const settings = await prisma.settings.findUnique({ where: { id: 'settings' } });
      if (settings) {
        if (orderStatus === 'processing' && (settings.orderProcessingTitle || settings.orderProcessingBody)) {
          if (settings.orderProcessingTitle) title = settings.orderProcessingTitle;
          if (settings.orderProcessingBody) message = settings.orderProcessingBody.replace('{orderNumber}', String(orderNumber));
        } else if (orderStatus === 'completed' && (settings.orderCompletedTitle || settings.orderCompletedBody)) {
          if (settings.orderCompletedTitle) title = settings.orderCompletedTitle;
          if (settings.orderCompletedBody) message = settings.orderCompletedBody.replace('{orderNumber}', String(orderNumber));
        }
      }
    } catch (settingsError) {
      console.log('Failed to fetch custom notification settings, using defaults');
    }
    const url = `/orders/${orderId}`;

    console.log('Notification:', { title, message, icon });

    // Create webhook log FIRST to prevent race conditions with duplicate webhooks
    let webhookLogId: string | null = null;
    try {
      const webhookLog = await prisma.webhookLog.create({
        data: {
          source: 'woocommerce',
          event: 'order_status',
          resourceId: String(orderId),
          status: orderStatus,
          customerEmail: customerEmail || null,
          notificationTitle: title,
          notificationBody: message,
          pushSent: false,
          pushSuccess: false,
          pushError: null,
          payload: body,
        },
      });
      webhookLogId = webhookLog.id;
      console.log('Webhook log created:', webhookLogId);
    } catch (dbError) {
      console.log('DB log creation failed - continuing without deduplication protection');
    }

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

    // Update webhook log with push result
    if (webhookLogId) {
      try {
        await prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            pushSent: !!customerEmail,
            pushSuccess: pushResult.success,
            pushError: pushResult.error || null,
          },
        });
      } catch (dbError) {
        console.log('DB log update skipped');
      }
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
