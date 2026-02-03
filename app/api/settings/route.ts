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

    // Use upsert to get or create default settings atomically
    const settings = await prisma.settings.upsert({
      where: { id: 'settings' },
      update: {}, // No updates, just return existing
      create: {
        id: 'settings',
      },
    });

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Get settings error:', error);

    // Check if it's a schema/column error
    if (error?.message?.includes('Unknown field') || error?.message?.includes('column')) {
      return NextResponse.json(
        { error: 'Database schema needs to be updated. Please run: npx prisma db push' },
        { status: 500 }
      );
    }

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
      customApiKey,
      maintenanceMode,
      maintenanceMessage,
      orderProcessingTitle,
      orderProcessingBody,
      orderCompletedTitle,
      orderCompletedBody,
    } = body;

    // Build update data object - only include fields that are provided
    const updateData: any = {};
    if (timezone !== undefined) updateData.timezone = timezone;
    if (sessionTimeout !== undefined) updateData.sessionTimeout = sessionTimeout;
    if (requireStrongPassword !== undefined) updateData.requireStrongPassword = requireStrongPassword;
    if (enableTwoFactor !== undefined) updateData.enableTwoFactor = enableTwoFactor;
    if (woocommerceApiUrl !== undefined) updateData.woocommerceApiUrl = woocommerceApiUrl;
    if (woocommerceApiKey !== undefined) updateData.woocommerceApiKey = woocommerceApiKey;
    if (woocommerceApiSecret !== undefined) updateData.woocommerceApiSecret = woocommerceApiSecret;
    if (fcmServerKey !== undefined) updateData.fcmServerKey = fcmServerKey;
    if (fcmProjectId !== undefined) updateData.fcmProjectId = fcmProjectId;
    if (customApiKey !== undefined) updateData.customApiKey = customApiKey;
    if (maintenanceMode !== undefined) updateData.maintenanceMode = maintenanceMode;
    if (maintenanceMessage !== undefined) updateData.maintenanceMessage = maintenanceMessage;
    if (orderProcessingTitle !== undefined) updateData.orderProcessingTitle = orderProcessingTitle || null;
    if (orderProcessingBody !== undefined) updateData.orderProcessingBody = orderProcessingBody || null;
    if (orderCompletedTitle !== undefined) updateData.orderCompletedTitle = orderCompletedTitle || null;
    if (orderCompletedBody !== undefined) updateData.orderCompletedBody = orderCompletedBody || null;

    // Use upsert to create or update settings atomically
    const updatedSettings = await prisma.settings.upsert({
      where: { id: 'settings' },
      update: updateData,
      create: {
        id: 'settings',
        ...updateData,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: updatedSettings,
    });
  } catch (error: any) {
    console.error('Update settings error:', error);

    // Check for specific Prisma errors
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Settings conflict - please refresh and try again' },
        { status: 409 }
      );
    }

    // Check if it's a schema/column error
    if (error?.message?.includes('Unknown field') || error?.message?.includes('column')) {
      return NextResponse.json(
        { error: 'Database schema needs to be updated. Please run: npx prisma db push' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An error occurred while updating settings. Please try again.' },
      { status: 500 }
    );
  }
}

