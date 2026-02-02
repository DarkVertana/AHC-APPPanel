import { prisma } from './prisma';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

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
    // Get FCM settings from database (optional - can use project_id from service account)
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
    });

    const dbProjectId = settings?.fcmProjectId;

    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      let initialized = false;

      // Method 1: Try local key file FIRST (most reliable)
      const localKeyPaths = [
        path.join(process.cwd(), 'key', 'key-1.json'),
        path.join(process.cwd(), 'key', 'firebase-key.json'),
        path.join(process.cwd(), 'key', 'service-account.json'),
      ];

      for (const keyPath of localKeyPaths) {
        if (initialized) break;
        try {
          if (fs.existsSync(keyPath)) {
            console.log(`Found service account file at: ${keyPath}`);
            const fileContent = fs.readFileSync(keyPath, 'utf8');
            const serviceAccount = JSON.parse(fileContent);

            // Validate required fields
            if (serviceAccount.project_id && serviceAccount.private_key && serviceAccount.client_email) {
              firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id,
              });
              console.log(`FCM initialized successfully using local file: ${keyPath}`);
              console.log(`Project ID: ${serviceAccount.project_id}, Client Email: ${serviceAccount.client_email}`);
              initialized = true;
            } else {
              console.warn(`Service account file ${keyPath} missing required fields, trying next method...`);
            }
          }
        } catch (e: any) {
          console.warn(`Failed to use service account from ${keyPath}: ${e.message}`);
        }
      }

      // Method 2: Try FIREBASE_SERVICE_ACCOUNT env variable (JSON string)
      if (!initialized) {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
          try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            if (serviceAccount.project_id && serviceAccount.private_key && serviceAccount.client_email) {
              firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id,
              });
              console.log('FCM initialized successfully using FIREBASE_SERVICE_ACCOUNT env variable');
              console.log(`Project ID: ${serviceAccount.project_id}, Client Email: ${serviceAccount.client_email}`);
              initialized = true;
            }
          } catch (e: any) {
            console.warn(`Failed to parse FIREBASE_SERVICE_ACCOUNT: ${e.message}`);
          }
        }
      }

      // Method 3: Try GOOGLE_APPLICATION_CREDENTIALS env variable (file path)
      if (!initialized) {
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (credentialsPath) {
          try {
            // Try to read the file directly if it's a path
            const resolvedPath = path.isAbsolute(credentialsPath)
              ? credentialsPath
              : path.join(process.cwd(), credentialsPath);

            if (fs.existsSync(resolvedPath)) {
              const fileContent = fs.readFileSync(resolvedPath, 'utf8');
              const serviceAccount = JSON.parse(fileContent);

              if (serviceAccount.project_id && serviceAccount.private_key && serviceAccount.client_email) {
                firebaseApp = admin.initializeApp({
                  credential: admin.credential.cert(serviceAccount),
                  projectId: serviceAccount.project_id,
                });
                console.log(`FCM initialized successfully using GOOGLE_APPLICATION_CREDENTIALS: ${resolvedPath}`);
                console.log(`Project ID: ${serviceAccount.project_id}, Client Email: ${serviceAccount.client_email}`);
                initialized = true;
              }
            }
          } catch (e: any) {
            console.warn(`Failed to use GOOGLE_APPLICATION_CREDENTIALS: ${e.message}`);
          }
        }
      }

      if (!initialized) {
        console.error('FCM initialization failed. Tried:');
        console.error('1. Local key files: /key/key-1.json, /key/firebase-key.json, /key/service-account.json');
        console.error('2. FIREBASE_SERVICE_ACCOUNT env variable (JSON string)');
        console.error('3. GOOGLE_APPLICATION_CREDENTIALS env variable (file path)');
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
// In-memory deduplication cache (prevents duplicate sends within 30 seconds)
const recentPushes = new Map<string, number>();
const DEDUP_WINDOW_MS = 30 * 1000; // 30 seconds

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentPushes.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      recentPushes.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

/**
 * Generate a deduplication key for a push notification
 */
function generateDedupKey(fcmToken: string, sourceId?: string, title?: string): string {
  // Use sourceId if available (most reliable), otherwise use token + title hash
  if (sourceId) {
    return `${fcmToken.substring(0, 20)}_${sourceId}`;
  }
  return `${fcmToken.substring(0, 20)}_${title?.substring(0, 30) || 'notif'}`;
}

export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>,
  logOptions?: { source?: NotificationSource; type?: NotificationType; sourceId?: string; recipientEmail?: string; recipientWpUserId?: string }
): Promise<{ success: boolean; messageId?: string; error?: string; logId?: string }> {
  // Generate deduplication key
  const dedupKey = generateDedupKey(fcmToken, logOptions?.sourceId, title);

  // Check in-memory deduplication cache
  const lastSent = recentPushes.get(dedupKey);
  if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) {
    console.log(`Duplicate push blocked (in-memory cache): ${dedupKey}`);
    return {
      success: true,
      error: 'Duplicate notification blocked',
      logId: '',
    };
  }

  // Also check database for recent sends to this token (belt and suspenders)
  if (logOptions?.sourceId) {
    const thirtySecondsAgo = new Date(Date.now() - DEDUP_WINDOW_MS);
    const recentDbLog = await prisma.pushNotificationLog.findFirst({
      where: {
        sourceId: logOptions.sourceId,
        recipientFcmToken: { startsWith: fcmToken.substring(0, 20) },
        status: 'sent',
        createdAt: { gte: thirtySecondsAgo },
      },
    });
    if (recentDbLog) {
      console.log(`Duplicate push blocked (database check): ${dedupKey}`);
      return {
        success: true,
        error: 'Duplicate notification blocked',
        logId: recentDbLog.id,
      };
    }
  }

  // Mark as sent in cache immediately (before async operations)
  recentPushes.set(dedupKey, Date.now());

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

    // Generate collapse key for deduplication at FCM level
    // This prevents FCM from delivering multiple identical notifications
    const collapseKey = logOptions?.sourceId
      ? `notif_${logOptions.sourceId}`
      : `notif_${Date.now()}`;

    // Build message payload for FCM API v1 (via Firebase Admin SDK)
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
        ...(validImageUrl && { imageUrl: validImageUrl }),
      },
      data: {
        ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {}),
        // Add dedup info to data payload for client-side deduplication
        _dedupKey: collapseKey,
        _timestamp: String(Date.now()),
      },
      android: {
        priority: 'high',
        collapseKey, // Prevents duplicate delivery on Android
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
          tag: collapseKey, // Additional Android deduplication
          ...(validImageUrl && { imageUrl: validImageUrl }),
        },
      },
      apns: {
        headers: {
          'apns-collapse-id': collapseKey, // Prevents duplicate delivery on iOS
          'apns-priority': '10', // High priority for immediate delivery
          'apns-push-type': 'alert', // Alert type notification
        },
        payload: {
          aps: {
            sound: 'default',
            'thread-id': collapseKey, // Groups notifications on iOS
            'content-available': 1, // Enable background processing
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
    console.log(`Push sent successfully: ${collapseKey} -> ${response}`);

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
    const skippedDuplicates: string[] = [];

    // Generate collapse key for deduplication at FCM level
    const collapseKey = logOptions?.sourceId
      ? `notif_${logOptions.sourceId}`
      : `notif_batch_${Date.now()}`;

    // Process tokens in parallel with concurrency limit (50 concurrent requests)
    const concurrencyLimit = 50;
    for (let i = 0; i < fcmTokens.length; i += concurrencyLimit) {
      const batch = fcmTokens.slice(i, i + concurrencyLimit);

      const promises = batch.map(async (token) => {
        // Check in-memory deduplication cache
        const dedupKey = generateDedupKey(token, logOptions?.sourceId, title);
        const lastSent = recentPushes.get(dedupKey);
        if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) {
          skippedDuplicates.push(token.substring(0, 20));
          return { success: true, token, skipped: true };
        }

        // Mark as sent in cache
        recentPushes.set(dedupKey, Date.now());

        const message: admin.messaging.Message = {
          token,
          notification: {
            title,
            body,
            ...(validImageUrl && { imageUrl: validImageUrl }),
          },
          data: {
            ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {}),
            _dedupKey: collapseKey,
            _timestamp: String(Date.now()),
          },
          android: {
            priority: 'high',
            collapseKey, // Prevents duplicate delivery on Android
            notification: {
              channelId: 'default',
              sound: 'default',
              priority: 'high',
              tag: collapseKey, // Additional Android deduplication
              ...(validImageUrl && { imageUrl: validImageUrl }),
            },
          },
          apns: {
            headers: {
              'apns-collapse-id': collapseKey, // Prevents duplicate delivery on iOS
              'apns-priority': '10', // High priority for immediate delivery
              'apns-push-type': 'alert', // Alert type notification
            },
            payload: {
              aps: {
                sound: 'default',
                'thread-id': collapseKey,
                'content-available': 1, // Enable background processing
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
    if (skippedDuplicates.length > 0) {
      console.log(`FCM deduplication: ${skippedDuplicates.length} duplicate(s) blocked`);
    }
    if (totalFailure > 0) {
      console.warn(`FCM send summary: ${totalSuccess} succeeded, ${totalFailure} failed, ${skippedDuplicates.length} duplicates blocked`);
      console.warn('Errors:', allErrors);
    } else if (totalSuccess > 0) {
      console.log(`FCM send summary: ${totalSuccess} succeeded, ${skippedDuplicates.length} duplicates blocked`);
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
 * Send push notification to all active users (all devices)
 * Uses UserDevice table for multi-device support, falls back to legacy fcmToken
 */
export async function sendPushNotificationToAll(
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>,
  logOptions?: { source?: NotificationSource; type?: NotificationType; sourceId?: string }
): Promise<{ successCount: number; failureCount: number; totalUsers: number; totalDevices: number; error?: string; errors?: string[]; logId?: string }> {
  try {
    // Get all FCM tokens from UserDevice table (multi-device support)
    const devices = await prisma.userDevice.findMany({
      where: {
        appUser: {
          status: 'Active',
        },
      },
      select: {
        fcmToken: true,
        appUserId: true,
      },
    });

    // Also get legacy fcmToken from AppUser for backward compatibility
    const usersWithLegacyToken = await prisma.appUser.findMany({
      where: {
        fcmToken: {
          not: null,
        },
        status: 'Active',
      },
      select: {
        id: true,
        fcmToken: true,
      },
    });

    // Collect all unique tokens
    const allTokens: string[] = [];
    const userIds = new Set<string>();

    // Add tokens from devices table
    for (const device of devices) {
      allTokens.push(device.fcmToken);
      userIds.add(device.appUserId);
    }

    // Add legacy tokens that aren't already in the list
    for (const user of usersWithLegacyToken) {
      if (user.fcmToken && !allTokens.includes(user.fcmToken)) {
        allTokens.push(user.fcmToken);
        userIds.add(user.id);
      }
    }

    // Remove duplicates
    const fcmTokens = [...new Set(allTokens)];

    if (allTokens.length !== fcmTokens.length) {
      console.warn(`Removed ${allTokens.length - fcmTokens.length} duplicate FCM token(s) from send list`);
    }

    if (fcmTokens.length === 0) {
      console.warn('No active users with FCM tokens found');
      return {
        successCount: 0,
        failureCount: 0,
        totalUsers: 0,
        totalDevices: 0,
        error: 'No active users with FCM tokens found',
      };
    }

    console.log(`Sending push notification to ${fcmTokens.length} device(s) across ${userIds.size} user(s)`);
    const result = await sendPushNotificationToMultiple(fcmTokens, title, body, imageUrl, data, logOptions);

    return {
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalUsers: userIds.size,
      totalDevices: fcmTokens.length,
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
      totalDevices: 0,
      error: error.message || 'Failed to send push notifications',
      errors: [error.message || error.code || 'Failed to send push notifications'],
    };
  }
}



/**
 * Send push notification to a specific user by email or wpUserId
 * Sends to ALL registered devices for multi-device support
 */
export async function sendPushNotificationToUser(
  emailOrWpUserId: string,
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>,
  logOptions?: { source?: NotificationSource; type?: NotificationType; sourceId?: string }
): Promise<{ success: boolean; messageId?: string; error?: string; logId?: string; devicesSent?: number; devicesFailed?: number }> {
  try {
    console.log('Looking up user for push notification:', emailOrWpUserId);

    // Case-insensitive email lookup with devices
    const user = await prisma.appUser.findFirst({
      where: {
        OR: [
          { email: { equals: emailOrWpUserId, mode: 'insensitive' } },
          { wpUserId: emailOrWpUserId },
        ],
        status: 'Active',
      },
      select: {
        id: true,
        email: true,
        wpUserId: true,
        fcmToken: true, // Legacy field
        devices: {
          select: {
            id: true,
            deviceId: true,
            platform: true,
            fcmToken: true,
          },
        },
      },
    });

    if (!user) {
      console.log('User not found:', emailOrWpUserId);
      return {
        success: false,
        error: `User not found: ${emailOrWpUserId}`,
      };
    }

    // Collect all FCM tokens (from devices table + legacy field)
    const deviceTokens = user.devices.map(d => d.fcmToken);
    const allTokens = new Set(deviceTokens);

    // Include legacy fcmToken if it exists and isn't already in devices
    if (user.fcmToken && !allTokens.has(user.fcmToken)) {
      allTokens.add(user.fcmToken);
    }

    const fcmTokens = Array.from(allTokens);

    if (fcmTokens.length === 0) {
      console.log('No FCM tokens for user:', emailOrWpUserId);
      return {
        success: false,
        error: `No FCM tokens for user: ${emailOrWpUserId}`,
      };
    }

    console.log(`Found user: ${user.email}, sending to ${fcmTokens.length} device(s)...`);

    // Send to all devices
    if (fcmTokens.length === 1) {
      // Single device - use direct send
      const result = await sendPushNotification(
        fcmTokens[0],
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
      return {
        ...result,
        devicesSent: result.success ? 1 : 0,
        devicesFailed: result.success ? 0 : 1,
      };
    } else {
      // Multiple devices - use batch send
      const result = await sendPushNotificationToMultiple(
        fcmTokens,
        title,
        body,
        imageUrl,
        data,
        logOptions ? {
          ...logOptions,
        } : undefined
      );

      return {
        success: result.successCount > 0,
        error: result.failureCount > 0 && result.errors.length > 0 ? result.errors[0] : undefined,
        logId: result.logId,
        devicesSent: result.successCount,
        devicesFailed: result.failureCount,
      };
    }
  } catch (error: any) {
    console.error('Error sending push notification to user:', error);
    return {
      success: false,
      error: error.message || 'Failed to send push notification',
    };
  }
}

