import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { entities, confirmPhrase } = body;

    // Require confirmation phrase for safety
    if (confirmPhrase !== 'RESET DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation phrase. Please type "RESET DATA" to confirm.' },
        { status: 400 }
      );
    }

    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return NextResponse.json(
        { error: 'No entities selected for reset' },
        { status: 400 }
      );
    }

    const validEntities = [
      'app-users',
      'medicine-categories',
      'medicines',
      'blogs',
      'faqs',
      'notifications',
      'weight-logs',
      'medication-logs'
    ];

    const invalidEntities = entities.filter((e: string) => !validEntities.includes(e));
    if (invalidEntities.length > 0) {
      return NextResponse.json(
        { error: `Invalid entities: ${invalidEntities.join(', ')}` },
        { status: 400 }
      );
    }

    const results: Record<string, { deleted: number; error?: string }> = {};

    // Delete in proper order to handle foreign key constraints
    // NotificationViews -> Notifications
    // MedicationLogs -> AppUsers
    // WeightLogs -> AppUsers
    // Medicines -> MedicineCategories

    // 1. Delete notification views first (if notifications selected)
    if (entities.includes('notifications')) {
      try {
        const notificationViewsResult = await prisma.notificationView.deleteMany({});
        results['notification-views'] = { deleted: notificationViewsResult.count };
      } catch (error: any) {
        results['notification-views'] = { deleted: 0, error: error.message };
      }

      try {
        const notificationsResult = await prisma.notification.deleteMany({});
        results['notifications'] = { deleted: notificationsResult.count };
      } catch (error: any) {
        results['notifications'] = { deleted: 0, error: error.message };
      }
    }

    // 2. Delete medication logs
    if (entities.includes('medication-logs') || entities.includes('app-users')) {
      try {
        const medicationLogsResult = await prisma.medicationLog.deleteMany({});
        results['medication-logs'] = { deleted: medicationLogsResult.count };
      } catch (error: any) {
        results['medication-logs'] = { deleted: 0, error: error.message };
      }
    }

    // 3. Delete weight logs
    if (entities.includes('weight-logs') || entities.includes('app-users')) {
      try {
        const weightLogsResult = await prisma.weightLog.deleteMany({});
        results['weight-logs'] = { deleted: weightLogsResult.count };
      } catch (error: any) {
        results['weight-logs'] = { deleted: 0, error: error.message };
      }
    }

    // 4. Delete app users (after their logs are deleted)
    if (entities.includes('app-users')) {
      try {
        const appUsersResult = await prisma.appUser.deleteMany({});
        results['app-users'] = { deleted: appUsersResult.count };
      } catch (error: any) {
        results['app-users'] = { deleted: 0, error: error.message };
      }
    }

    // 5. Delete medicines (before categories due to FK)
    if (entities.includes('medicines') || entities.includes('medicine-categories')) {
      try {
        const medicinesResult = await prisma.medicine.deleteMany({});
        results['medicines'] = { deleted: medicinesResult.count };
      } catch (error: any) {
        results['medicines'] = { deleted: 0, error: error.message };
      }
    }

    // 6. Delete medicine categories
    if (entities.includes('medicine-categories')) {
      try {
        const categoriesResult = await prisma.medicineCategory.deleteMany({});
        results['medicine-categories'] = { deleted: categoriesResult.count };
      } catch (error: any) {
        results['medicine-categories'] = { deleted: 0, error: error.message };
      }
    }

    // 7. Delete blogs
    if (entities.includes('blogs')) {
      try {
        const blogsResult = await prisma.blog.deleteMany({});
        results['blogs'] = { deleted: blogsResult.count };
      } catch (error: any) {
        results['blogs'] = { deleted: 0, error: error.message };
      }
    }

    // 8. Delete FAQs
    if (entities.includes('faqs')) {
      try {
        const faqsResult = await prisma.fAQ.deleteMany({});
        results['faqs'] = { deleted: faqsResult.count };
      } catch (error: any) {
        results['faqs'] = { deleted: 0, error: error.message };
      }
    }

    // Calculate total deleted
    const totalDeleted = Object.values(results).reduce((sum, r) => sum + r.deleted, 0);
    const hasErrors = Object.values(results).some(r => r.error);

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors
        ? 'Reset completed with some errors'
        : `Successfully reset ${totalDeleted} records`,
      results,
      totalDeleted
    });

  } catch (error: any) {
    console.error('Reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset data', details: error.message },
      { status: 500 }
    );
  }
}
