import { prisma } from './prisma';
import * as admin from 'firebase-admin';

let fcmInitialized = false;
let firebaseApp: admin.app.App | null = null;

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

/**
 * Send push notification to a single device using Firebase Admin SDK
 * (uses new FCM API v1 internally - no legacy API)
 */
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const initialized = await initializeFCM();
    if (!initialized || !firebaseApp) {
      return {
        success: false,
        error: 'FCM not initialized. Please configure FCM settings and service account credentials.',
      };
    }

    // Build message payload for FCM API v1 (via Firebase Admin SDK)
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
        ...(imageUrl && { imageUrl }),
      },
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
        },
      },
    };

    // Send via Firebase Admin SDK (uses FCM API v1 internally)
    const response = await admin.messaging(firebaseApp).send(message);

    return {
      success: true,
      messageId: response,
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
      return {
        success: false,
        error: 'Invalid FCM token',
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to send push notification',
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
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
  try {
    const initialized = await initializeFCM();
    if (!initialized || !firebaseApp) {
      return {
        successCount: 0,
        failureCount: fcmTokens.length,
        errors: ['FCM not initialized. Please configure FCM settings and service account credentials.'],
      };
    }

    if (fcmTokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        errors: [],
      };
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
            ...(imageUrl && { imageUrl }),
          },
          data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              sound: 'default',
              priority: 'high',
            },
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
          
          console.error(`FCM send failed for token ${token.substring(0, 20)}...:`, {
            code: errorCode,
            message: errorMsg,
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

    return {
      successCount: totalSuccess,
      failureCount: totalFailure,
      errors: allErrors,
    };
  } catch (error: any) {
    console.error('Error sending multicast push notification:', error);
    return {
      successCount: 0,
      failureCount: fcmTokens.length,
      errors: [error.message || error.code || 'Failed to send push notifications'],
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
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number; totalUsers: number; error?: string; errors?: string[] }> {
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
    const result = await sendPushNotificationToMultiple(fcmTokens, title, body, imageUrl, data);

    return {
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalUsers: fcmTokens.length,
      errors: result.errors,
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

