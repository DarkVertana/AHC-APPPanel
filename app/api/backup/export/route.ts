import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Export Backup Data API
 *
 * Exports all data including medicines, categories, blogs, FAQs, notifications,
 * users, weight logs, medication logs, and daily check-ins as JSON
 *
 * Query Parameters:
 * - entities: Comma-separated list of entities to export
 *   Available: medicines, medicine-categories, blogs, faqs, notifications, users, weight-logs, medication-logs, daily-checkins
 *   If not provided, exports all entities
 *
 * Example:
 * GET /api/backup/export?entities=medicines,blogs,users
 * GET /api/backup/export (exports all)
 */

const ALL_ENTITIES = [
  'medicines',
  'medicine-categories',
  'blogs',
  'faqs',
  'notifications',
  'users',
  'user-devices',
  'weight-logs',
  'medication-logs',
  'daily-checkins',
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entitiesParam = searchParams.get('entities');

    // Parse which entities to export
    const requestedEntities = entitiesParam
      ? entitiesParam.split(',').map(e => e.trim().toLowerCase())
      : ALL_ENTITIES;

    const exportData: any = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      entities: {},
    };

    // Export Medicine Categories (must be exported before medicines due to foreign key)
    // Always include categories if medicines are requested
    if (requestedEntities.includes('medicine-categories') || requestedEntities.includes('medicines')) {
      const categories = await prisma.medicineCategory.findMany({
        orderBy: { id: 'asc' },
      });

      exportData.entities['medicine-categories'] = categories.map(cat => ({
        id: cat.id,
        title: cat.title,
        tagline: cat.tagline,
        icon: cat.icon,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
      }));
    }

    // Export Medicines
    if (requestedEntities.includes('medicines')) {
      const medicines = await prisma.medicine.findMany({
        include: {
          category: {
            select: {
              id: true,
              title: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      exportData.entities.medicines = medicines.map(med => ({
        id: med.id,
        categoryId: med.categoryId,
        categoryTitle: med.category.title,
        title: med.title,
        tagline: med.tagline,
        description: med.description,
        image: med.image,
        url: med.url,
        price: med.price,
        productType: med.productType,
        status: med.status,
        createdAt: med.createdAt.toISOString(),
        updatedAt: med.updatedAt.toISOString(),
      }));
    }

    // Export Blogs (Featured Content)
    if (requestedEntities.includes('blogs')) {
      const blogs = await prisma.blog.findMany({
        orderBy: { createdAt: 'desc' },
      });

      exportData.entities.blogs = blogs.map(blog => ({
        id: blog.id,
        title: blog.title,
        tagline: blog.tagline,
        description: blog.description,
        tags: blog.tags,
        featuredImage: blog.featuredImage,
        status: blog.status,
        createdAt: blog.createdAt.toISOString(),
        updatedAt: blog.updatedAt.toISOString(),
      }));
    }

    // Export FAQs
    if (requestedEntities.includes('faqs')) {
      const faqs = await prisma.fAQ.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      });

      exportData.entities.faqs = faqs.map(faq => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        order: faq.order,
        isActive: faq.isActive,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      }));
    }

    // Export Notifications
    if (requestedEntities.includes('notifications')) {
      const notifications = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
      });

      exportData.entities.notifications = notifications.map(notif => ({
        id: notif.id,
        title: notif.title,
        description: notif.description,
        image: notif.image,
        url: notif.url,
        isActive: notif.isActive,
        receiverCount: notif.receiverCount,
        viewCount: notif.viewCount,
        createdAt: notif.createdAt.toISOString(),
        updatedAt: notif.updatedAt.toISOString(),
      }));
    }

    // Export Users (AppUser) with Fitness Information
    if (requestedEntities.includes('users')) {
      const users = await prisma.appUser.findMany({
        orderBy: { createdAt: 'desc' },
      });

      exportData.entities.users = users.map(user => ({
        id: user.id,
        wpUserId: user.wpUserId,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        phone: user.phone,
        age: user.age,
        height: user.height,
        feet: user.feet,
        // Fitness Information
        weight: user.weight,
        goal: user.goal,
        initialWeight: user.initialWeight,
        weightSet: user.weightSet,
        tasksToday: user.tasksToday,
        totalWorkouts: user.totalWorkouts,
        totalCalories: user.totalCalories,
        streak: user.streak,
        taskStatus: user.taskStatus,
        // Status
        status: user.status,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        fcmToken: user.fcmToken,
        woocommerceCustomerId: user.woocommerceCustomerId,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      }));
    }

    // Export User Devices (multi-device FCM support)
    if (requestedEntities.includes('user-devices')) {
      const devices = await prisma.userDevice.findMany({
        include: {
          appUser: {
            select: {
              id: true,
              email: true,
            }
          }
        },
        orderBy: { lastActiveAt: 'desc' },
      });

      exportData.entities['user-devices'] = devices.map(device => ({
        id: device.id,
        appUserId: device.appUserId,
        userEmail: device.appUser.email,
        deviceId: device.deviceId,
        platform: device.platform,
        fcmToken: device.fcmToken,
        deviceName: device.deviceName,
        appVersion: device.appVersion,
        lastActiveAt: device.lastActiveAt.toISOString(),
        createdAt: device.createdAt.toISOString(),
        updatedAt: device.updatedAt.toISOString(),
      }));
    }

    // Export Weight Logs
    if (requestedEntities.includes('weight-logs')) {
      const weightLogs = await prisma.weightLog.findMany({
        include: {
          appUser: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          }
        },
        orderBy: { date: 'desc' },
      });

      exportData.entities['weight-logs'] = weightLogs.map(log => ({
        id: log.id,
        appUserId: log.appUserId,
        userId: log.userId,
        userEmail: log.userEmail,
        userName: log.userName,
        date: log.date.toISOString(),
        weight: log.weight,
        previousWeight: log.previousWeight,
        change: log.change,
        changeType: log.changeType,
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.updatedAt.toISOString(),
      }));
    }

    // Export Medication Logs
    if (requestedEntities.includes('medication-logs')) {
      const medicationLogs = await prisma.medicationLog.findMany({
        include: {
          appUser: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          }
        },
        orderBy: { takenAt: 'desc' },
      });

      exportData.entities['medication-logs'] = medicationLogs.map(log => ({
        id: log.id,
        appUserId: log.appUserId,
        medicineId: log.medicineId,
        medicineName: log.medicineName,
        dosage: log.dosage,
        takenAt: log.takenAt.toISOString(),
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.updatedAt.toISOString(),
      }));
    }

    // Export Daily Check-ins
    if (requestedEntities.includes('daily-checkins')) {
      const dailyCheckins = await prisma.dailyCheckIn.findMany({
        include: {
          appUser: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          }
        },
        orderBy: { date: 'desc' },
      });

      exportData.entities['daily-checkins'] = dailyCheckins.map(checkin => ({
        id: checkin.id,
        appUserId: checkin.appUserId,
        date: checkin.date,
        buttonType: checkin.buttonType,
        medicationName: checkin.medicationName,
        nextDate: checkin.nextDate,
        deviceInfo: checkin.deviceInfo,
        ipAddress: checkin.ipAddress,
        createdAt: checkin.createdAt.toISOString(),
      }));
    }

    // Add summary
    exportData.summary = {
      'medicine-categories': exportData.entities['medicine-categories']?.length || 0,
      medicines: exportData.entities.medicines?.length || 0,
      blogs: exportData.entities.blogs?.length || 0,
      faqs: exportData.entities.faqs?.length || 0,
      notifications: exportData.entities.notifications?.length || 0,
      users: exportData.entities.users?.length || 0,
      'user-devices': exportData.entities['user-devices']?.length || 0,
      'weight-logs': exportData.entities['weight-logs']?.length || 0,
      'medication-logs': exportData.entities['medication-logs']?.length || 0,
      'daily-checkins': exportData.entities['daily-checkins']?.length || 0,
    };

    // Return as JSON with proper headers for download (no size limit)
    const jsonString = JSON.stringify(exportData);

    return new NextResponse(jsonString, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`,
        'Content-Length': String(Buffer.byteLength(jsonString, 'utf8')),
      },
    });
  } catch (error) {
    console.error('Export backup error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export backup',
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : undefined
      },
      { status: 500 }
    );
  }
}
