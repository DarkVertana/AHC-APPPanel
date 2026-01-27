# WooCommerce Webhook Integration

This document describes how to configure WooCommerce webhooks to send push notifications for order and subscription status changes.

## Webhook Endpoints

### Base URL
```
https://appanel.alternatehealthclub.com
```

### Order Status Webhook
```
POST /api/webhooks/woocommerce/order-status
```

Triggers push notifications when order status changes (e.g., pending, processing, completed, cancelled).

### Subscription Status Webhook
```
POST /api/webhooks/woocommerce/subscription-status
```

Triggers push notifications when subscription status changes (e.g., active, on-hold, cancelled, expired).

### Test/Debug Endpoints
```
GET  /api/webhooks/debug          - Check webhook configuration and recent logs
POST /api/webhooks/debug          - Send test push to a specific user
GET  /api/webhooks/test?email=x   - Look up user by email
POST /api/webhooks/test           - Send test notification
```

## WooCommerce Setup

### Step 1: Navigate to Webhooks
1. Go to your WordPress admin panel
2. Navigate to **WooCommerce > Settings > Advanced > Webhooks**
3. Click **Add webhook**

### Step 2: Create Order Status Webhook
| Field | Value |
|-------|-------|
| Name | Order Status Updates |
| Status | Active |
| Topic | Order updated |
| Delivery URL | `https://appanel.alternatehealthclub.com/api/webhooks/woocommerce/order-status` |
| Secret | Your webhook secret (see below) |
| API Version | WP REST API Integration v3 |

### Step 3: Create Subscription Status Webhook
| Field | Value |
|-------|-------|
| Name | Subscription Status Updates |
| Status | Active |
| Topic | Subscription updated |
| Delivery URL | `https://appanel.alternatehealthclub.com/api/webhooks/woocommerce/subscription-status` |
| Secret | Same secret as order webhook |
| API Version | WP REST API Integration v3 |

## Webhook Secret Configuration

### In WooCommerce
When creating each webhook, enter a secret in the "Secret" field. This is used to sign webhook requests.

### In Your App Panel (.env)
Add the same secret to your environment:
```env
WOOCOMMERCE_WEBHOOK_SECRET="your-webhook-secret-here"
```

**Note:** If your secret contains special characters (backticks, dollar signs, etc.), escape them properly:
```env
WOOCOMMERCE_WEBHOOK_SECRET="Q8,Sr/.gusu\$M~PK-uKhw\`Sy<bVi\`n5(v[;jO|mCV:iKGg%;0U"
```

## Request Headers

WooCommerce sends these headers with webhook requests:
| Header | Description |
|--------|-------------|
| `X-WC-Webhook-Topic` | The webhook topic (e.g., `order.updated`) |
| `X-WC-Webhook-Source` | Your store URL |
| `X-WC-Webhook-Signature` | HMAC-SHA256 signature (base64 encoded) |
| `Content-Type` | `application/json` |

## Push Notification Data Format

When a webhook triggers a push notification, it sends this data to the Flutter app:

### Order Status Notification
```json
{
  "type": "notification",
  "notificationType": "order_status",
  "icon": "ic_order_completed",
  "orderId": "12345",
  "orderStatus": "completed",
  "url": "/orders/12345"
}
```

### Subscription Status Notification
```json
{
  "type": "notification",
  "notificationType": "subscription_status",
  "icon": "ic_sub_active",
  "subscriptionId": "6789",
  "subscriptionStatus": "active",
  "url": "/subscriptions/6789"
}
```

## Deduplication

The webhook handlers include deduplication logic to prevent multiple notifications:
- **Order/Subscription webhooks**: 5-minute deduplication window
- If the same order ID + status combination is received within 5 minutes, the duplicate is ignored

## Troubleshooting

### Webhook not triggering
1. Check webhook status is "Active" in WooCommerce
2. Verify the delivery URL is correct and accessible
3. Check WooCommerce webhook logs for delivery failures

### Signature verification failing
1. Ensure the secret in `.env` matches exactly what's in WooCommerce
2. Check for encoding issues with special characters
3. View server logs for `Webhook signature verification: INVALID`

### Push notification not sent
1. Verify user exists and has an FCM token registered
2. Check user email in webhook payload matches app user email
3. Review server logs for "Sending push to:" messages

### Debug Endpoint
Use the debug endpoint to check configuration:
```bash
curl https://appanel.alternatehealthclub.com/api/webhooks/debug
```

Response includes:
- FCM configuration status
- Environment variable status
- Recent webhook logs

## Webhook Logs

All webhook requests are logged to the `WebhookLog` table with:
- Source and event type
- Resource ID (order/subscription ID)
- Status received
- Customer email
- Push notification result (sent/success/error)
- Raw payload for debugging

View logs in the admin panel or query the database directly.
