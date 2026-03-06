import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Export Backup Data API
 *
 * Exports all data including medicines, categories, blogs, FAQs, notifications,
 * users, weight logs, medication logs, daily check-ins, languages, and translations as JSON
 *
 * Query Parameters:
 * - entities: Comma-separated list of entities to export
 *   Available: settings, languages, translations, medicines, medicine-categories, blogs, faqs, notifications, notification-views, push-notification-logs, users, user-devices, weight-logs, medication-logs, daily-checkins, bug-reports, scheduled-notifications, account-deletion-requests
 *   If not provided, exports all entities
 *
 * Example:
 * GET /api/backup/export?entities=medicines,blogs,users
 * GET /api/backup/export (exports all)
 */

const ALL_ENTITIES = [
  'settings',
  'languages',
  'translations',
  'medicines',
  'medicine-categories',
  'blogs',
  'faq-categories',
  'faqs',
  'notifications',
  'notification-views',
  'push-notification-logs',
  'users',
  'user-devices',
  'weight-logs',
  'medication-logs',
  'daily-checkins',
  'bug-reports',
  'scheduled-notifications',
  'account-deletion-requests',
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

    // Export Settings (includes custom notification messages, maintenance mode, etc.)
    if (requestedEntities.includes('settings')) {
      const settings = await prisma.settings.findUnique({
        where: { id: 'settings' },
      });

      if (settings) {
        exportData.entities.settings = {
          adminEmail: settings.adminEmail,
          timezone: settings.timezone,
          sessionTimeout: settings.sessionTimeout,
          requireStrongPassword: settings.requireStrongPassword,
          enableTwoFactor: settings.enableTwoFactor,
          maintenanceMode: settings.maintenanceMode,
          maintenanceMessage: settings.maintenanceMessage,
          // Custom Notification Messages
          orderProcessingTitle: settings.orderProcessingTitle,
          orderProcessingBody: settings.orderProcessingBody,
          orderCompletedTitle: settings.orderCompletedTitle,
          orderCompletedBody: settings.orderCompletedBody,
        };
      }
    }

    // Export Supported Languages
    if (requestedEntities.includes('languages')) {
      const languages = await prisma.supportedLanguage.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });

      exportData.entities.languages = languages.map(lang => ({
        id: lang.id,
        code: lang.code,
        name: lang.name,
        nativeName: lang.nativeName,
        isActive: lang.isActive,
        order: lang.order,
        createdAt: lang.createdAt.toISOString(),
        updatedAt: lang.updatedAt.toISOString(),
      }));
    }

    // Export Translations
    // Auto-include if any translatable content entity is requested
    const contentEntities = ['medicines', 'medicine-categories', 'blogs', 'faq-categories', 'faqs'];
    const hasContentEntity = contentEntities.some(e => requestedEntities.includes(e));
    if (requestedEntities.includes('translations') || hasContentEntity) {
      // If specific content entities are requested, only export translations for those types
      const entityTypeMap: Record<string, string> = {
        'medicines': 'medicine',
        'medicine-categories': 'medicine_category',
        'blogs': 'blog',
        'faq-categories': 'faq_category',
        'faqs': 'faq',
      };

      const entityTypeFilter = requestedEntities.includes('translations')
        ? undefined // export all translations
        : contentEntities
            .filter(e => requestedEntities.includes(e))
            .map(e => entityTypeMap[e]);

      const translations = await prisma.translation.findMany({
        where: entityTypeFilter ? { entityType: { in: entityTypeFilter } } : undefined,
        orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }, { locale: 'asc' }, { field: 'asc' }],
      });

      exportData.entities.translations = translations.map(t => ({
        id: t.id,
        entityType: t.entityType,
        entityId: t.entityId,
        locale: t.locale,
        field: t.field,
        value: t.value,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }));
    }

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

    // Export FAQ Categories (before FAQs due to foreign key)
    if (requestedEntities.includes('faq-categories') || requestedEntities.includes('faqs')) {
      const faqCategories = await prisma.faqCategory.findMany({
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      });

      exportData.entities['faq-categories'] = faqCategories.map(cat => ({
        id: cat.id,
        title: cat.title,
        order: cat.order,
        isActive: cat.isActive,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
      }));
    }

    // Export FAQs
    if (requestedEntities.includes('faqs')) {
      const faqs = await prisma.fAQ.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      });

      exportData.entities.faqs = faqs.map(faq => ({
        id: faq.id,
        categoryId: faq.categoryId,
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
        type: notif.type,
        icon: notif.icon,
        source: notif.source,
        receiverCount: notif.receiverCount,
        viewCount: notif.viewCount,
        createdAt: notif.createdAt.toISOString(),
        updatedAt: notif.updatedAt.toISOString(),
      }));
    }

    // Export Notification Views
    if (requestedEntities.includes('notification-views')) {
      const notificationViews = await prisma.notificationView.findMany({
        include: {
          notification: {
            select: {
              id: true,
              title: true,
            }
          },
          appUser: {
            select: {
              id: true,
              email: true,
            }
          }
        },
        orderBy: { viewedAt: 'desc' },
      });

      exportData.entities['notification-views'] = notificationViews.map(view => ({
        id: view.id,
        notificationId: view.notificationId,
        notificationTitle: view.notification.title,
        appUserId: view.appUserId,
        userEmail: view.appUser?.email || view.userEmail,
        wpUserId: view.wpUserId,
        viewedAt: view.viewedAt.toISOString(),
        createdAt: view.createdAt.toISOString(),
      }));
    }

    // Export Push Notification Logs
    if (requestedEntities.includes('push-notification-logs')) {
      const pushLogs = await prisma.pushNotificationLog.findMany({
        orderBy: { createdAt: 'desc' },
      });

      exportData.entities['push-notification-logs'] = pushLogs.map(log => ({
        id: log.id,
        recipientEmail: log.recipientEmail,
        recipientWpUserId: log.recipientWpUserId,
        recipientCount: log.recipientCount,
        title: log.title,
        body: log.body,
        imageUrl: log.imageUrl,
        dataPayload: log.dataPayload,
        source: log.source,
        type: log.type,
        sourceId: log.sourceId,
        status: log.status,
        successCount: log.successCount,
        failureCount: log.failureCount,
        errorMessage: log.errorMessage,
        errorCode: log.errorCode,
        fcmMessageId: log.fcmMessageId,
        createdAt: log.createdAt.toISOString(),
        sentAt: log.sentAt?.toISOString() || null,
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
        streak: user.streak,
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

    // Export Bug Reports
    if (requestedEntities.includes('bug-reports')) {
      const bugReports = await prisma.bugReport.findMany({
        include: {
          appUser: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      exportData.entities['bug-reports'] = bugReports.map(report => ({
        id: report.id,
        appUserId: report.appUserId,
        title: report.title,
        description: report.description,
        image: report.image,
        status: report.status,
        platform: report.platform,
        osVersion: report.osVersion,
        deviceName: report.deviceName,
        appVersion: report.appVersion,
        reporterName: report.reporterName,
        reporterEmail: report.reporterEmail,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
      }));
    }

    // Export Scheduled Notifications
    if (requestedEntities.includes('scheduled-notifications')) {
      const scheduledNotifications = await prisma.scheduledNotification.findMany({
        include: {
          appUser: {
            select: {
              id: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      exportData.entities['scheduled-notifications'] = scheduledNotifications.map(sn => ({
        id: sn.id,
        appUserId: sn.appUserId,
        checkInId: sn.checkInId,
        medicationName: sn.medicationName,
        scheduledDate: sn.scheduledDate,
        scheduledType: sn.scheduledType,
        title: sn.title,
        body: sn.body,
        status: sn.status,
        sentAt: sn.sentAt?.toISOString() || null,
        errorMessage: sn.errorMessage,
        createdAt: sn.createdAt.toISOString(),
        updatedAt: sn.updatedAt.toISOString(),
      }));
    }

    // Export Account Deletion Requests
    if (requestedEntities.includes('account-deletion-requests')) {
      const deletionRequests = await prisma.accountDeletionRequest.findMany({
        include: {
          appUser: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      exportData.entities['account-deletion-requests'] = deletionRequests.map(req => ({
        id: req.id,
        appUserId: req.appUserId,
        userEmail: req.appUser.email,
        userName: req.appUser.name,
        status: req.status,
        reason: req.reason,
        requestedAt: req.requestedAt.toISOString(),
        resolvedAt: req.resolvedAt?.toISOString() || null,
        autoDeleteAt: req.autoDeleteAt.toISOString(),
        createdAt: req.createdAt.toISOString(),
        updatedAt: req.updatedAt.toISOString(),
      }));
    }

    // Add summary
    exportData.summary = {
      settings: exportData.entities.settings ? 1 : 0,
      languages: exportData.entities.languages?.length || 0,
      translations: exportData.entities.translations?.length || 0,
      'medicine-categories': exportData.entities['medicine-categories']?.length || 0,
      medicines: exportData.entities.medicines?.length || 0,
      blogs: exportData.entities.blogs?.length || 0,
      faqs: exportData.entities.faqs?.length || 0,
      notifications: exportData.entities.notifications?.length || 0,
      'notification-views': exportData.entities['notification-views']?.length || 0,
      'push-notification-logs': exportData.entities['push-notification-logs']?.length || 0,
      users: exportData.entities.users?.length || 0,
      'user-devices': exportData.entities['user-devices']?.length || 0,
      'weight-logs': exportData.entities['weight-logs']?.length || 0,
      'medication-logs': exportData.entities['medication-logs']?.length || 0,
      'daily-checkins': exportData.entities['daily-checkins']?.length || 0,
      'bug-reports': exportData.entities['bug-reports']?.length || 0,
      'scheduled-notifications': exportData.entities['scheduled-notifications']?.length || 0,
      'account-deletion-requests': exportData.entities['account-deletion-requests']?.length || 0,
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
