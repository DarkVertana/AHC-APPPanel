import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as { role?: string })?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const results: Record<string, number> = {};

    // Delete in proper order to handle foreign key constraints
    // 1. Notification views
    const notificationViews = await prisma.notificationView.deleteMany({});
    results['notificationViews'] = notificationViews.count;

    // 2. Notifications
    const notifications = await prisma.notification.deleteMany({});
    results['notifications'] = notifications.count;

    // 3. Medication logs
    const medicationLogs = await prisma.medicationLog.deleteMany({});
    results['medicationLogs'] = medicationLogs.count;

    // 4. Weight logs
    const weightLogs = await prisma.weightLog.deleteMany({});
    results['weightLogs'] = weightLogs.count;

    // 5. App users
    const appUsers = await prisma.appUser.deleteMany({});
    results['appUsers'] = appUsers.count;

    // 6. Medicines
    const medicines = await prisma.medicine.deleteMany({});
    results['medicines'] = medicines.count;

    // 7. Medicine categories
    const categories = await prisma.medicineCategory.deleteMany({});
    results['medicineCategories'] = categories.count;

    // 8. Blogs
    const blogs = await prisma.blog.deleteMany({});
    results['blogs'] = blogs.count;

    // 9. FAQs
    const faqs = await prisma.fAQ.deleteMany({});
    results['faqs'] = faqs.count;

    const totalDeleted = Object.values(results).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${totalDeleted} records`,
      totalDeleted,
      results
    });

  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
