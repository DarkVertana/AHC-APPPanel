import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPushNotificationToUser,
  getSubscriptionStatusIcon,
  getSubscriptionStatusMessage,
} from '@/lib/fcm-service';

/**
 * WooCommerce Webhook for Subscription Status Updates
 *
 * Configure in WooCommerce → Settings → Advanced → Webhooks:
 * - Name: Subscription Status Updates
 * - Delivery URL: https://your-domain.com/api/webhooks/woocommerce/subscription-status
 * - Topic: Subscription updated
 * - Secret: Set WOOCOMMERCE_WEBHOOK_SECRET env variable
 */
export async function POST(request: NextRequest) {
  console.log('Subscription webhook received');

  try {
    // Check for WooCommerce ping (webhook verification)
    const webhookTopic = request.headers.get('x-wc-webhook-topic');
    const webhookResource = request.headers.get('x-wc-webhook-resource');

    console.log('Webhook headers:', { webhookTopic, webhookResource });

    // Handle ping request (sent when webhook is created/updated)
    if (webhookTopic === 'action.woocommerce_webhook_ping' || !webhookTopic) {
      // Try to read body to check if it's a ping
      const text = await request.text();
      console.log('Webhook body:', text.substring(0, 200));

      if (!text.trim() || text.includes('webhook_id')) {
        console.log('Webhook ping received - responding OK');
        return NextResponse.json({ success: true, message: 'Webhook ping received' });
      }

      // Re-parse the body if it's not a ping
      try {
        const body = JSON.parse(text);
        return await processSubscriptionWebhook(body, request);
      } catch {
        return NextResponse.json({ success: true, message: 'Webhook acknowledged' });
      }
    }

    // Parse request body
    const text = await request.text();
    console.log('Webhook body:', text.substring(0, 500));

    if (!text.trim()) {
      console.log('Empty body - treating as ping');
      return NextResponse.json({ success: true, message: 'Webhook acknowledged' });
    }

    const body = JSON.parse(text);
    return await processSubscriptionWebhook(body, request);

  } catch (error: any) {
    console.error('Subscription webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

async function processSubscriptionWebhook(body: any, request: NextRequest) {
  // Validate webhook secret if configured
  const WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  if (WEBHOOK_SECRET) {
    const signature =
      request.headers.get('x-wc-webhook-signature') ||
      request.headers.get('x-webhook-secret') ||
      new URL(request.url).searchParams.get('secret');

    if (signature && signature !== WEBHOOK_SECRET) {
      console.warn('Subscription webhook: Invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Extract subscription data
  const subscriptionId = body.id;
  const subscriptionStatus = body.status;
  const customerEmail = body.billing?.email || body.customer_email || body.email;
  const subscriptionNumber = body.number || body.subscription_number || subscriptionId;
  const nextPaymentDate = body.next_payment_date;

  console.log('Subscription data:', { subscriptionId, subscriptionStatus, customerEmail, subscriptionNumber });

  // Validate required fields
  if (!subscriptionId || !subscriptionStatus) {
    console.log('Missing required fields - might be a different event type');
    return NextResponse.json({
      success: true,
      message: 'Event acknowledged but not processed (missing subscription data)'
    });
  }

  // Get notification content
  let { title, body: message } = getSubscriptionStatusMessage(subscriptionStatus, String(subscriptionNumber));
  const icon = getSubscriptionStatusIcon(subscriptionStatus);
  const url = `/subscriptions/${subscriptionId}`;

  // Add next payment date if available and subscription is active
  if (nextPaymentDate && subscriptionStatus === 'active') {
    const paymentDate = new Date(nextPaymentDate).toLocaleDateString();
    message += ` Next payment: ${paymentDate}`;
  }

  console.log('Notification:', { title, message, icon });

  // Initialize push result
  let pushResult: { success: boolean; messageId?: string; error?: string } = {
    success: false,
    error: 'No customer email',
  };

  // Send push notification if customer email exists
  if (customerEmail) {
    console.log('Sending push notification to:', customerEmail);
    pushResult = await sendPushNotificationToUser(
      customerEmail,
      title,
      message,
      undefined,
      {
        type: 'subscription_status',
        icon,
        subscriptionId: String(subscriptionId),
        subscriptionStatus,
        url,
      }
    );
    console.log('Push result:', pushResult);
  }

  // Log webhook to database (optional - might fail if migration not run)
  try {
    await prisma.webhookLog.create({
      data: {
        source: 'woocommerce',
        event: 'subscription_status',
        resourceId: String(subscriptionId),
        status: subscriptionStatus,
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
    console.warn('Failed to log webhook to database:', dbError);
    // Continue anyway - don't fail the webhook
  }

  return NextResponse.json({
    success: true,
    subscriptionId,
    subscriptionStatus,
    customerEmail: customerEmail || null,
    pushSent: !!customerEmail,
    pushSuccess: pushResult.success,
    pushError: pushResult.error,
  });
}

// Also handle GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Subscription status webhook endpoint active'
  });
}
