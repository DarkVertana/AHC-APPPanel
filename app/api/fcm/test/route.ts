import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { initializeFCM } from '@/lib/fcm-service';
import { prisma } from '@/lib/prisma';

/**
 * Diagnostic endpoint to test FCM configuration
 * Returns detailed information about FCM setup status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      fcmConfigured: false,
      issues: [],
      warnings: [],
      info: {},
    };

    // Check database settings
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
    });

    if (!settings) {
      diagnostics.issues.push('Settings record not found in database');
      return NextResponse.json(diagnostics);
    }

    // Check FCM Project ID
    if (!settings.fcmProjectId) {
      diagnostics.issues.push('FCM Project ID is not configured in database settings');
    } else {
      diagnostics.info.fcmProjectId = settings.fcmProjectId;
    }

    // Check environment variables
    const hasServiceAccountJson = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    const hasCredentialsPath = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

    diagnostics.info.envVars = {
      FIREBASE_SERVICE_ACCOUNT: hasServiceAccountJson ? 'SET' : 'NOT SET',
      GOOGLE_APPLICATION_CREDENTIALS: hasCredentialsPath ? 'SET' : 'NOT SET',
    };

    if (!hasServiceAccountJson && !hasCredentialsPath) {
      diagnostics.issues.push(
        'Neither FIREBASE_SERVICE_ACCOUNT nor GOOGLE_APPLICATION_CREDENTIALS environment variable is set'
      );
      diagnostics.issues.push(
        '⚠️ Make sure to set the environment variable in your .env.local file and restart the server'
      );
    } else {
      if (hasServiceAccountJson) {
        try {
          const jsonString = process.env.FIREBASE_SERVICE_ACCOUNT!;
          diagnostics.info.serviceAccountMethod = 'FIREBASE_SERVICE_ACCOUNT (JSON string)';
          diagnostics.info.jsonLength = jsonString.length;
          
          const parsed = JSON.parse(jsonString);
          
          // Check required fields
          const requiredFields = ['project_id', 'private_key', 'client_email'];
          const missingFields = requiredFields.filter(field => !parsed[field]);
          
          if (missingFields.length > 0) {
            diagnostics.issues.push(
              `FIREBASE_SERVICE_ACCOUNT JSON is missing required fields: ${missingFields.join(', ')}`
            );
          } else {
            diagnostics.info.serviceAccountProjectId = parsed.project_id;
            diagnostics.info.clientEmail = parsed.client_email?.substring(0, 30) + '...';
            
            if (parsed.project_id !== settings.fcmProjectId) {
              diagnostics.warnings.push(
                `Service account project_id (${parsed.project_id}) does not match database FCM Project ID (${settings.fcmProjectId})`
              );
            }
            
            // Check if private key looks valid
            if (parsed.private_key && !parsed.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
              diagnostics.warnings.push(
                'Private key format may be incorrect (should start with "-----BEGIN PRIVATE KEY-----")'
              );
            }
          }
        } catch (error: any) {
          diagnostics.issues.push(
            `FIREBASE_SERVICE_ACCOUNT contains invalid JSON: ${error.message}`
          );
          diagnostics.issues.push(
            'Make sure the entire JSON is on one line, or properly escaped if using .env file'
          );
        }
      }
      if (hasCredentialsPath) {
        diagnostics.info.serviceAccountMethod = 'GOOGLE_APPLICATION_CREDENTIALS (file path)';
        diagnostics.info.credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        
        // Try to check if file exists (in Node.js environment)
        try {
          const fs = require('fs');
          const path = require('path');
          const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS!;
          
          if (!fs.existsSync(filePath)) {
            diagnostics.issues.push(
              `Credentials file not found at path: ${filePath}`
            );
          } else {
            diagnostics.info.fileExists = true;
            const fileContent = fs.readFileSync(filePath, 'utf8');
            try {
              const parsed = JSON.parse(fileContent);
              diagnostics.info.serviceAccountProjectId = parsed.project_id;
              if (parsed.project_id !== settings.fcmProjectId) {
                diagnostics.warnings.push(
                  `Service account project_id (${parsed.project_id}) does not match database FCM Project ID (${settings.fcmProjectId})`
                );
              }
            } catch (e) {
              diagnostics.issues.push('Credentials file exists but contains invalid JSON');
            }
          }
        } catch (e) {
          // Can't check file system in some environments, skip
        }
      }
    }

    // Try to initialize FCM
    try {
      const initialized = await initializeFCM();
      if (initialized) {
        diagnostics.fcmConfigured = true;
        diagnostics.info.status = 'FCM initialized successfully';
        diagnostics.info.initializationSuccess = true;
      } else {
        diagnostics.issues.push('FCM initialization failed');
        diagnostics.issues.push('Check server console logs for detailed error messages');
        diagnostics.issues.push('Common issues:');
        diagnostics.issues.push('  - Environment variables not loaded (restart server after adding to .env.local)');
        diagnostics.issues.push('  - Invalid JSON in FIREBASE_SERVICE_ACCOUNT');
        diagnostics.issues.push('  - Missing required fields in service account JSON');
        diagnostics.issues.push('  - Credentials file path incorrect');
      }
    } catch (error: any) {
      diagnostics.issues.push(`FCM initialization error: ${error.message}`);
      diagnostics.issues.push(`Error stack: ${error.stack}`);
    }

    // Check for users with FCM tokens
    const usersWithTokens = await prisma.appUser.count({
      where: {
        fcmToken: {
          not: null,
        },
        status: 'Active',
      },
    });

    diagnostics.info.activeUsersWithTokens = usersWithTokens;
    if (usersWithTokens === 0) {
      diagnostics.warnings.push('No active users with FCM tokens found');
    }

    // Overall status
    diagnostics.status = diagnostics.issues.length === 0 ? 'ready' : 'not_ready';

    // Add helpful next steps
    if (diagnostics.issues.length > 0) {
      diagnostics.nextSteps = [
        '1. Check the issues list above',
        '2. Set the required environment variable in .env.local file',
        '3. RESTART your Next.js server after adding environment variables',
        '4. Visit this endpoint again to verify',
        '5. See FCM_SETUP_GUIDE.md for detailed instructions',
      ];
    }

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    console.error('FCM diagnostic error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while running diagnostics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
