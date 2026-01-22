import { prisma } from './prisma';
import * as admin from 'firebase-admin';

let fcmInitialized = false;
let firebaseApp: admin.app.App | null = null;

// ============================================
// TYPE DEFINITIONS
// ============================================

export type NotificationType = 'general' | 'order' | 'subscription' | 'promotion';
export type NotificationSource = 'admin' | 'webhook' | 'system';
export type PushLogStatus = 'pending' | 'sent' | 'failed' | 'partial';

export interface PushNotificationLogData {
  recipientEmail?: string;
  recipientWpUserId?: string;
  recipientFcmToken?: string;
  recipientCount?: number;
  title: string;
  body: string;
  imageUrl?: string;
  dataPayload?: Record<string, string>;
  source: NotificationSource;
  type?: NotificationType;
  sourceId?: string;
}

export interface PushNotificationOptions {
  title: string;
  body: string;
  imageUrl?: string;
  type?: NotificationType;
  icon?: string;
  data?: Record<string, string>;
}

// ============================================
// PUSH NOTIFICATION LOGGING FUNCTIONS
// ============================================

/**
 * Create a new push notification log entry
 */
export async function logPushNotification(data: PushNotificationLogData): Promise<string> {
  try {
    const log = await prisma.pushNotificationLog.create({
      data: {
        recipientEmail: data.recipientEmail,
        recipientWpUserId: data.recipientWpUserId,
        recipientFcmToken: data.recipientFcmToken ? data.recipientFcmToken.substring(0, 20) + '...' : undefined,
        recipientCount: data.recipientCount || 1,
        title: data.title,
        body: data.body,
        imageUrl: data.imageUrl,
        dataPayload: data.dataPayload || undefined,
        source: data.source,
        type: data.type || 'general',
        sourceId: data.sourceId,
        status: 'pending',
      },
    });
    return log.id;
  } catch (error) {
    console.error('Failed to create push notification log:', error);
    return '';
  }
}

/**
 * Update an existing push notification log entry
 */
export async function updatePushNotificationLog(
  logId: string,
  update: {
    status: PushLogStatus;
    successCount?: number;
    failureCount?: number;
    errorMessage?: string;
    errorCode?: string;
    fcmMessageId?: string;
  }
): Promise<void> {
  if (!logId) return;

  try {
    await prisma.pushNotificationLog.update({
      where: { id: logId },
      data: {
        status: update.status,
        successCount: update.successCount,
        failureCount: update.failureCount,
        errorMessage: update.errorMessage,
        errorCode: update.errorCode,
        fcmMessageId: update.fcmMessageId,
        sentAt: update.status !== 'pending' ? new Date() : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to update push notification log:', error);
  }
}

// ============================================
// ICON MAPPING FOR ORDER/SUBSCRIPTION STATUS
// ============================================

export const ORDER_STATUS_ICONS: Record<string, string> = {
  'pending': 'ic_order_pending',
  'processing': 'ic_order_processing',
  'on-hold': 'ic_order_hold',
  'completed': 'ic_order_completed',
  'cancelled': 'ic_order_cancelled',
  'refunded': 'ic_order_refunded',
  'failed': 'ic_order_failed',
};

export const SUBSCRIPTION_STATUS_ICONS: Record<string, string> = {
  'active': 'ic_sub_active',
  'on-hold': 'ic_sub_hold',
  'pending': 'ic_sub_pending',
  'pending-cancel': 'ic_sub_pending',
  'cancelled': 'ic_sub_cancelled',
  'expired': 'ic_sub_expired',
  'switched': 'ic_sub_active',
};

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  'general': 'ic_notification',
  'order': 'ic_order_pending',
  'subscription': 'ic_sub_active',
  'promotion': 'ic_promo',
};

/**
 * Get icon for order status
 */
export function getOrderStatusIcon(status: string): string {
  return ORDER_STATUS_ICONS[status] || 'ic_order_pending';
}

/**
 * Get icon for subscription status
 */
export function getSubscriptionStatusIcon(status: string): string {
  return SUBSCRIPTION_STATUS_ICONS[status] || 'ic_sub_pending';
}

/**
 * Get icon for notification type
 */
export function getNotificationTypeIcon(type: NotificationType): string {
  return NOTIFICATION_TYPE_ICONS[type] || 'ic_notification';
}

/**
 * Initialize FCM using Firebase Admin SDK (uses new FCM API v1 internally)
 * Requires service account credentials in environment variable FIREBASE_SERVICE_ACCOUNT
 * or GOOGLE_APPLICATION_CREDENTIALS pointing to service account JSON file
 */
export async function initializeFCM(): Promise<boolean> {
  if (fcmInitialized && firebaseApp) {
    return true;
  }

  try {
    // Get FCM settings from database
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
    });

    if (!settings?.fcmProjectId) {
      console.error('FCM project ID not configured in database settings');
      return false;
    }

    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      // Try to get service account from environment variable
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (serviceAccountJson) {
        try {
          // Check if JSON string is empty or just whitespace
          if (!serviceAccountJson.trim()) {
            console.error('FIREBASE_SERVICE_ACCOUNT is set but appears to be empty');
            return false;
          }

          const serviceAccount = JSON.parse(serviceAccountJson);
          
          // Validate required fields
          const missingFields = [];
          if (!serviceAccount.project_id) missingFields.push('project_id');
          if (!serviceAccount.private_key) missingFields.push('private_key');
          if (!serviceAccount.client_email) missingFields.push('client_email');
          
          if (missingFields.length > 0) {
            console.error(`FIREBASE_SERVICE_ACCOUNT JSON is missing required fields: ${missingFields.join(', ')}`);
            console.error('Service account JSON should contain: project_id, private_key, client_email, and other fields');
            return false;
          }

          // Check if project ID matches
          if (serviceAccount.project_id !== settings.fcmProjectId) {
            console.warn(`Service account project_id (${serviceAccount.project_id}) does not match database fcmProjectId (${settings.fcmProjectId})`);
            console.warn('Using project_id from service account JSON instead');
          }

          firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: settings.fcmProjectId,
          });
          console.log('FCM initialized successfully using FIREBASE_SERVICE_ACCOUNT');
          console.log(`Project ID: ${serviceAccount.project_id}, Client Email: ${serviceAccount.client_email}`);
        } catch (error: any) {
          console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', error.message);
          console.error('Make sure the JSON is valid and properly formatted');
          if (error.message.includes('JSON')) {
            console.error('Tip: If using .env file, make sure the JSON is on one line or properly escaped');
          }
          return false;
        }
      } else if (credentialsPath) {
        try {
          firebaseApp = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: settings.fcmProjectId,
          });
          console.log('FCM initialized successfully using GOOGLE_APPLICATION_CREDENTIALS');
        } catch (error: any) {
          console.error('Failed to initialize FCM with GOOGLE_APPLICATION_CREDENTIALS:', error.message);
          return false;
        }
      } else {
        console.error('Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path)');
        return false;
      }
    } else {
      firebaseApp = admin.app();
      console.log('FCM using existing Firebase Admin app');
    }

    fcmInitialized = true;
    return true;
  } catch (error: any) {
    console.error('Failed to initialize FCM:', error.message || error);
    return false;
  }
}

// ============================================
// ORDER/SUBSCRIPTION STATUS MESSAGES
// ============================================

export const ORDER_STATUS_MESSAGES: Record<string, { title: string; getMessage: (orderNumber: string) => string }> = {
  'pending': {
    title: 'Order Received',
    getMessage: (n) => `Your order #${n} has been received and is being processed.`,
  },
  'processing': {
    title: 'Order Processing',
    getMessage: (n) => `Your order #${n} is being processed.`,
  },
  'on-hold': {
    title: 'Order On Hold',
    getMessage: (n) => `Your order #${n} is currently on hold.`,
  },
  'completed': {
    title: 'Order Completed',
    getMessage: (n) => `Your order #${n} has been completed! Thank you for your purchase.`,
  },
  'cancelled': {
    title: 'Order Cancelled',
    getMessage: (n) => `Your order #${n} has been cancelled.`,
  },
  'refunded': {
    title: 'Order Refunded',
    getMessage: (n) => `Your order #${n} has been refunded.`,
  },
  'failed': {
    title: 'Order Failed',
    getMessage: (n) => `Your order #${n} payment failed. Please try again.`,
  },
};

export const SUBSCRIPTION_STATUS_MESSAGES: Record<string, { title: string; getMessage: (subNumber: string) => string }> = {
  'active': {
    title: 'Subscription Active',
    getMessage: (n) => `Your subscription #${n} is now active.`,
  },
  'on-hold': {
    title: 'Subscription On Hold',
    getMessage: (n) => `Your subscription #${n} is currently on hold.`,
  },
  'pending': {
    title: 'Subscription Pending',
    getMessage: (n) => `Your subscription #${n} is pending activation.`,
  },
  'pending-cancel': {
    title: 'Cancellation Pending',
    getMessage: (n) => `Your subscription #${n} cancellation is pending.`,
  },
  'cancelled': {
    title: 'Subscription Cancelled',
    getMessage: (n) => `Your subscription #${n} has been cancelled.`,
  },
  'expired': {
    title: 'Subscription Expired',
    getMessage: (n) => `Your subscription #${n} has expired.`,
  },
  'switched': {
    title: 'Subscription Switched',
    getMessage: (n) => `Your subscription #${n} has been switched.`,
  },
};

/**
 * Get order status message
 */
export function getOrderStatusMessage(status: string, orderNumber: string): { title: string; body: string } {
  const msg = ORDER_STATUS_MESSAGES[status];
  if (msg) {
    return { title: msg.title, body: msg.getMessage(orderNumber) };
  }
  return { title: 'Order Updated', body: `Your order #${orderNumber} status has been updated to ${status}.` };
}

/**
 * Get subscription status message
 */
export function getSubscriptionStatusMessage(status: string, subNumber: string): { title: string; body: string } {
  const msg = SUBSCRIPTION_STATUS_MESSAGES[status];
  if (msg) {
    return { title: msg.title, body: msg.getMessage(subNumber) };
  }
  return { title: 'Subscription Updated', body: `Your subscription #${subNumber} status has been updated to ${status}.` };
}

// ============================================
// PUSH NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send push notification to a single device using Firebase Admin SDK
 * (uses new FCM API v1 internally - no legacy API)
 */
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>,
  logOptions?: { source?: NotificationSource; type?: NotificationType; sourceId?: string; recipientEmail?: string; recipientWpUserId?: string }
): Promise<{ success: boolean; messageId?: string; error?: string; logId?: string }> {
  // Create log entry if source is provided
  let logId = '';
  if (logOptions?.source) {
    logId = await logPushNotification({
      recipientEmail: logOptions.recipientEmail,
      recipientWpUserId: logOptions.recipientWpUserId,
      recipientFcmToken: fcmToken,
      title,
      body,
      imageUrl,
      dataPayload: data,
      source: logOptions.source,
      type: logOptions.type,
      sourceId: logOptions.sourceId,
    });
  }

  try {
    const initialized = await initializeFCM();
    if (!initialized || !firebaseApp) {
      if (logId) {
        await updatePushNotificationLog(logId, {
          status: 'failed',
          failureCount: 1,
          errorMessage: 'FCM not initialized. Please configure FCM settings and service account credentials.',
          errorCode: 'FCM_NOT_INITIALIZED',
        });
      }
      return {
        success: false,
        error: 'FCM not initialized. Please configure FCM settings and service account credentials.',
        logId,
      };
    }

    // Validate image URL if provided
    let validImageUrl: string | undefined = undefined;
    if (imageUrl && imageUrl.trim()) {
      try {
        const url = new URL(imageUrl.trim());
        // Only allow http/https URLs
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          validImageUrl = imageUrl.trim();
          console.log(`Valid image URL for notification: ${validImageUrl.substring(0, 50)}...`);
        } else {
          console.warn(`Invalid image URL protocol: ${url.protocol}. Only http/https allowed. Image URL: ${imageUrl.substring(0, 50)}...`);
        }
      } catch (e) {
        console.warn(`Invalid image URL format: ${imageUrl}`, e);
      }
    }

    // Build message payload for FCM API v1 (via Firebase Admin SDK)
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
        ...(validImageUrl && { imageUrl: validImageUrl }),
      },
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
          ...(validImageUrl && { imageUrl: validImageUrl }),
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            ...(validImageUrl && { mutableContent: true }),
          },
        },
        ...(validImageUrl && {
          fcmOptions: {
            imageUrl: validImageUrl,
          },
        }),
      },
    };

    // Send via Firebase Admin SDK (uses FCM API v1 internally)
    const response = await admin.messaging(firebaseApp).send(message);

    // Update log on success
    if (logId) {
      await updatePushNotificationLog(logId, {
        status: 'sent',
        successCount: 1,
        fcmMessageId: response,
      });
    }

    return {
      success: true,
      messageId: response,
      logId,
    };
  } catch (error: any) {
    console.error('Error sending push notification:', error);

    // Handle invalid token
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      // Remove invalid token from database
      await prisma.appUser.updateMany({
        where: { fcmToken },
        data: { fcmToken: null },
      });

      if (logId) {
        await updatePushNotificationLog(logId, {
          status: 'failed',
          failureCount: 1,
          errorMessage: 'Invalid FCM token',
          errorCode: error.code,
        });
      }

      return {
        success: false,
        error: 'Invalid FCM token',
        logId,
      };
    }

    // Update log on failure
    if (logId) {
      await updatePushNotificationLog(logId, {
        status: 'failed',
        failureCount: 1,
        errorMessage: error.message || 'Failed to send push notification',
        errorCode: error.code,
      });
    }

    return {
      success: false,
      error: error.message || 'Failed to send push notification',
      logId,
    };
  }
}

/**
 * Send push notification to multiple devices using Firebase Admin SDK
 * (uses new FCM API v1 internally - no legacy API)
 * Processes tokens in parallel with a concurrency limit
 */
export async function sendPushNotificationToMultiple(
  fcmTokens: string[],
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>,
  logOptions?: { source?: NotificationSource; type?: NotificationType; sourceId?: string }
): Promise<{ successCount: number; failureCount: number; errors: string[]; logId?: string }> {
  // Create log entry if source is provided
  let logId = '';
  if (logOptions?.source) {
    logId = await logPushNotification({
      recipientCount: fcmTokens.length,
      title,
      body,
      imageUrl,
      dataPayload: data,
      source: logOptions.source,
      type: logOptions.type,
      sourceId: logOptions.sourceId,
    });
  }

  try {
    const initialized = await initializeFCM();
    if (!initialized || !firebaseApp) {
      if (logId) {
        await updatePushNotificationLog(logId, {
          status: 'failed',
          failureCount: fcmTokens.length,
          errorMessage: 'FCM not initialized. Please configure FCM settings and service account credentials.',
          errorCode: 'FCM_NOT_INITIALIZED',
        });
      }
      return {
        successCount: 0,
        failureCount: fcmTokens.length,
        errors: ['FCM not initialized. Please configure FCM settings and service account credentials.'],
        logId,
      };
    }

    if (fcmTokens.length === 0) {
      if (logId) {
        await updatePushNotificationLog(logId, {
          status: 'sent',
          successCount: 0,
          failureCount: 0,
        });
      }
      return {
        successCount: 0,
        failureCount: 0,
        errors: [],
        logId,
      };
    }

    // Validate image URL once before processing (optimization)
    let validImageUrl: string | undefined = undefined;
    if (imageUrl && imageUrl.trim()) {
      try {
        const url = new URL(imageUrl.trim());
        // Only allow http/https URLs
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          validImageUrl = imageUrl.trim();
          console.log(`Validated image URL for batch: ${validImageUrl.substring(0, 50)}...`);
        } else {
          console.warn(`Invalid image URL protocol: ${url.protocol}. Only http/https allowed. Image: ${imageUrl.substring(0, 50)}...`);
        }
      } catch (e) {
        console.warn(`Invalid image URL format: ${imageUrl}`, e);
      }
    }

    let totalSuccess = 0;
    let totalFailure = 0;
    const allErrors: string[] = [];
    const invalidTokens: string[] = [];

    // Process tokens in parallel with concurrency limit (50 concurrent requests)
    const concurrencyLimit = 50;
    for (let i = 0; i < fcmTokens.length; i += concurrencyLimit) {
      const batch = fcmTokens.slice(i, i + concurrencyLimit);

      const promises = batch.map(async (token) => {

        const message: admin.messaging.Message = {
          token,
          notification: {
            title,
            body,
            ...(validImageUrl && { imageUrl: validImageUrl }),
          },
          data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              sound: 'default',
              priority: 'high',
              ...(validImageUrl && { imageUrl: validImageUrl }),
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                ...(validImageUrl && { mutableContent: true }),
              },
            },
            ...(validImageUrl && {
              fcmOptions: {
                imageUrl: validImageUrl,
              },
            }),
          },
        };

        try {
          // Send via Firebase Admin SDK (uses FCM API v1 internally)
          await admin.messaging(firebaseApp!).send(message);
          totalSuccess++;
          return { success: true, token };
        } catch (error: any) {
          totalFailure++;
          // Create detailed error message with error code
          const errorCode = error.code || 'unknown';
          const errorMsg = error.message || 'Unknown error';
          const detailedError = errorCode !== 'unknown' 
            ? `${errorCode}: ${errorMsg}`
            : errorMsg;
          allErrors.push(detailedError);
          
          // Enhanced logging for debugging
          console.error(`FCM send failed for token ${token.substring(0, 20)}...:`, {
            code: errorCode,
            message: errorMsg,
            hasImage: !!validImageUrl,
            imageUrl: validImageUrl ? validImageUrl.substring(0, 50) + '...' : 'none',
            error: error,
          });

          // Track invalid tokens
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(token);
            console.warn(`Invalid FCM token detected and will be removed: ${token.substring(0, 20)}...`);
          }
          return { success: false, token };
        }
      });

      await Promise.all(promises);
    }

    // Remove invalid tokens from database
    if (invalidTokens.length > 0) {
      await prisma.appUser.updateMany({
        where: {
          fcmToken: {
            in: invalidTokens,
          },
        },
        data: {
          fcmToken: null,
        },
      });
      console.log(`Removed ${invalidTokens.length} invalid FCM token(s) from database`);
    }

    // Log summary
    if (totalFailure > 0) {
      console.warn(`FCM send summary: ${totalSuccess} succeeded, ${totalFailure} failed`);
      console.warn('Errors:', allErrors);
    } else if (totalSuccess > 0) {
      console.log(`FCM send summary: ${totalSuccess} succeeded`);
    }

    // Update log with final results
    if (logId) {
      const status: PushLogStatus = totalFailure === 0 ? 'sent' : (totalSuccess === 0 ? 'failed' : 'partial');
      await updatePushNotificationLog(logId, {
        status,
        successCount: totalSuccess,
        failureCount: totalFailure,
        errorMessage: allErrors.length > 0 ? allErrors.slice(0, 5).join('; ') : undefined,
      });
    }

    return {
      successCount: totalSuccess,
      failureCount: totalFailure,
      errors: allErrors,
      logId,
    };
  } catch (error: any) {
    console.error('Error sending multicast push notification:', error);

    if (logId) {
      await updatePushNotificationLog(logId, {
        status: 'failed',
        failureCount: fcmTokens.length,
        errorMessage: error.message || 'Failed to send push notifications',
        errorCode: error.code,
      });
    }

    return {
      successCount: 0,
      failureCount: fcmTokens.length,
      errors: [error.message || error.code || 'Failed to send push notifications'],
      logId,
    };
  }
}

/**
 * Send push notification to all active users
 */
export async function sendPushNotificationToAll(
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>,
  logOptions?: { source?: NotificationSource; type?: NotificationType; sourceId?: string }
): Promise<{ successCount: number; failureCount: number; totalUsers: number; error?: string; errors?: string[]; logId?: string }> {
  try {
    // Get all active users with FCM tokens
    const users = await prisma.appUser.findMany({
      where: {
        fcmToken: {
          not: null,
        },
        status: 'Active',
      },
      select: {
        fcmToken: true,
      },
    });

    const fcmTokens = users
      .map((u) => u.fcmToken)
      .filter((token): token is string => token !== null);

    if (fcmTokens.length === 0) {
      console.warn('No active users with FCM tokens found');
      return {
        successCount: 0,
        failureCount: 0,
        totalUsers: 0,
        error: 'No active users with FCM tokens found',
      };
    }

    console.log(`Sending push notification to ${fcmTokens.length} users`);
    const result = await sendPushNotificationToMultiple(fcmTokens, title, body, imageUrl, data, logOptions);

    return {
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalUsers: fcmTokens.length,
      errors: result.errors,
      logId: result.logId,
      error: result.failureCount > 0 && result.errors.length > 0 
        ? result.errors[0] 
        : undefined,
    };
  } catch (error: any) {
    console.error('Error sending push notification to all users:', error);
    return {
      successCount: 0,
      failureCount: 0,
      totalUsers: 0,
      error: error.message || 'Failed to send push notifications',
      errors: [error.message || error.code || 'Failed to send push notifications'],
    };
  }
}



/**
 * Send push notification to a specific user by email or wpUserId
 */
export async function sendPushNotificationToUser(
  emailOrWpUserId: string,
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>,
  logOptions?: { source?: NotificationSource; type?: NotificationType; sourceId?: string }
): Promise<{ success: boolean; messageId?: string; error?: string; logId?: string }> {
  try {
    console.log('Looking up user for push notification:', emailOrWpUserId);

    // Case-insensitive email lookup
    const user = await prisma.appUser.findFirst({
      where: {
        OR: [
          { email: { equals: emailOrWpUserId, mode: 'insensitive' } },
          { wpUserId: emailOrWpUserId },
        ],
        fcmToken: {
          not: null,
        },
        status: 'Active',
      },
      select: {
        id: true,
        email: true,
        wpUserId: true,
        fcmToken: true,
      },
    });

    if (!user || !user.fcmToken) {
      console.log('User not found or no FCM token for:', emailOrWpUserId);
      return {
        success: false,
        error: `User not found or no FCM token for: ${emailOrWpUserId}`,
      };
    }

    console.log('Found user:', user.email, 'sending push...');

    return await sendPushNotification(
      user.fcmToken,
      title,
      body,
      imageUrl,
      data,
      logOptions ? {
        ...logOptions,
        recipientEmail: user.email,
        recipientWpUserId: user.wpUserId,
      } : undefined
    );
  } catch (error: any) {
    console.error('Error sending push notification to user:', error);
    return {
      success: false,
      error: error.message || 'Failed to send push notification',
    };
  }
}

