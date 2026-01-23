import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get or create default settings
    let settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.settings.create({
        data: {
          id: 'settings',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching settings' },
      { status: 500 }
    );
  }
}

// UPDATE settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      timezone,
      sessionTimeout,
      requireStrongPassword,
      enableTwoFactor,
      woocommerceApiUrl,
      woocommerceApiKey,
      woocommerceApiSecret,
      fcmServerKey,
      fcmProjectId,
    } = body;

    // Get or create settings
    let settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'settings',
        },
      });
    }

    // Update settings (adminEmail is now user-specific, not stored in Settings)
    const updatedSettings = await prisma.settings.update({
      where: { id: 'settings' },
      data: {
        timezone: timezone !== undefined ? timezone : settings.timezone,
        sessionTimeout: sessionTimeout !== undefined ? sessionTimeout : settings.sessionTimeout,
        requireStrongPassword: requireStrongPassword !== undefined ? requireStrongPassword : settings.requireStrongPassword,
        enableTwoFactor: enableTwoFactor !== undefined ? enableTwoFactor : settings.enableTwoFactor,
        woocommerceApiUrl: woocommerceApiUrl !== undefined ? woocommerceApiUrl : settings.woocommerceApiUrl,
        woocommerceApiKey: woocommerceApiKey !== undefined ? woocommerceApiKey : settings.woocommerceApiKey,
        woocommerceApiSecret: woocommerceApiSecret !== undefined ? woocommerceApiSecret : settings.woocommerceApiSecret,
        fcmServerKey: fcmServerKey !== undefined ? fcmServerKey : settings.fcmServerKey,
        fcmProjectId: fcmProjectId !== undefined ? fcmProjectId : settings.fcmProjectId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating settings' },
      { status: 500 }
    );
  }
}

