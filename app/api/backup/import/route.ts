import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Import Backup Data API
 *
 * Imports all data from JSON backup including medicines, categories, blogs, FAQs,
 * notifications, users, weight logs, medication logs, and daily check-ins
 *
 * Request Body:
 * {
 *   "entities": {
 *     "medicine-categories": [...],
 *     "medicines": [...],
 *     "blogs": [...],
 *     "faqs": [...],
 *     "notifications": [...],
 *     "users": [...],
 *     "weight-logs": [...],
 *     "medication-logs": [...],
 *     "daily-checkins": [...]
 *   },
 *   "options": {
 *     "mode": "replace" | "merge" | "skip-existing",
 *     "importEntities": ["medicines", "blogs", ...]
 *   }
 * }
 *
 * Import Modes:
 * - replace: Delete all existing data and import new data
 * - merge: Import new data, update existing records by ID (default)
 * - skip-existing: Only import records that don't exist (by ID)
 */

// Route segment config for App Router - no size limit
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for large imports

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entities, options = {} } = body;

    if (!entities || typeof entities !== 'object') {
      return NextResponse.json(
        { error: 'Invalid backup data. Expected "entities" object.' },
        { status: 400 }
      );
    }

    const mode = options.mode || 'merge';
    const importEntities = options.importEntities || Object.keys(entities);

    const results: any = {
      success: true,
      imported: {},
      errors: {},
      summary: {},
    };

    // Import Medicine Categories first (medicines depend on them)
    if (importEntities.includes('medicine-categories') && entities['medicine-categories']) {
      try {
        const categories = entities['medicine-categories'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.medicineCategory.deleteMany({});
        }

        for (const cat of categories) {
          try {
            if (!cat.title) {
              errors.push(`Category missing title: ${JSON.stringify(cat).substring(0, 100)}`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.medicineCategory.findUnique({
                where: { id: cat.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.medicineCategory.upsert({
              where: { id: cat.id },
              update: {
                title: cat.title,
                tagline: cat.tagline || null,
                icon: cat.icon || null,
              },
              create: {
                id: cat.id,
                title: cat.title,
                tagline: cat.tagline || null,
                icon: cat.icon || null,
              },
            });

            if (mode === 'replace') {
              imported++;
            } else {
              const existing = await prisma.medicineCategory.findUnique({ where: { id: cat.id } });
              if (existing) updated++;
              else imported++;
            }
          } catch (error: any) {
            errors.push(`Category ${cat.id || cat.title}: ${error.message}`);
          }
        }

        results.imported['medicine-categories'] = { imported, updated, skipped, errors };
        results.summary['medicine-categories'] = imported + updated;
      } catch (error: any) {
        results.errors['medicine-categories'] = error.message;
        results.success = false;
      }
    }

    // Import Medicines
    if (importEntities.includes('medicines') && entities.medicines) {
      try {
        const medicines = entities.medicines;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.medicine.deleteMany({});
        }

        for (const med of medicines) {
          try {
            if (!med.title || !med.categoryId) {
              errors.push(`Medicine missing required fields: ${JSON.stringify(med).substring(0, 100)}`);
              continue;
            }

            const category = await prisma.medicineCategory.findUnique({
              where: { id: med.categoryId },
            });

            if (!category) {
              errors.push(`Medicine ${med.id || med.title}: Category ${med.categoryId} not found`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.medicine.findUnique({
                where: { id: med.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.medicine.upsert({
              where: { id: med.id },
              update: {
                categoryId: med.categoryId,
                title: med.title,
                tagline: med.tagline || null,
                description: med.description || null,
                image: med.image || null,
                url: med.url || null,
                price: med.price || null,
                productType: med.productType || 'simple',
                status: med.status || 'active',
              },
              create: {
                id: med.id,
                categoryId: med.categoryId,
                title: med.title,
                tagline: med.tagline || null,
                description: med.description || null,
                image: med.image || null,
                url: med.url || null,
                price: med.price || null,
                productType: med.productType || 'simple',
                status: med.status || 'active',
              },
            });

            if (mode === 'replace') imported++;
            else updated++;
          } catch (error: any) {
            errors.push(`Medicine ${med.id || med.title}: ${error.message}`);
          }
        }

        results.imported.medicines = { imported, updated, skipped, errors };
        results.summary.medicines = imported + updated;
      } catch (error: any) {
        results.errors.medicines = error.message;
        results.success = false;
      }
    }

    // Import Blogs
    if (importEntities.includes('blogs') && entities.blogs) {
      try {
        const blogs = entities.blogs;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.blog.deleteMany({});
        }

        for (const blog of blogs) {
          try {
            if (!blog.title || !blog.tagline || !blog.description) {
              errors.push(`Blog missing required fields: ${JSON.stringify(blog).substring(0, 100)}`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.blog.findUnique({
                where: { id: blog.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.blog.upsert({
              where: { id: blog.id },
              update: {
                title: blog.title,
                tagline: blog.tagline,
                description: blog.description,
                tags: blog.tags || [],
                featuredImage: blog.featuredImage,
                status: blog.status || 'published',
              },
              create: {
                id: blog.id,
                title: blog.title,
                tagline: blog.tagline,
                description: blog.description,
                tags: blog.tags || [],
                featuredImage: blog.featuredImage,
                status: blog.status || 'published',
              },
            });

            if (mode === 'replace') imported++;
            else updated++;
          } catch (error: any) {
            errors.push(`Blog ${blog.id || blog.title}: ${error.message}`);
          }
        }

        results.imported.blogs = { imported, updated, skipped, errors };
        results.summary.blogs = imported + updated;
      } catch (error: any) {
        results.errors.blogs = error.message;
        results.success = false;
      }
    }

    // Import FAQs
    if (importEntities.includes('faqs') && entities.faqs) {
      try {
        const faqs = entities.faqs;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.fAQ.deleteMany({});
        }

        for (const faq of faqs) {
          try {
            if (!faq.question || !faq.answer) {
              errors.push(`FAQ missing required fields: ${JSON.stringify(faq).substring(0, 100)}`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.fAQ.findUnique({
                where: { id: faq.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.fAQ.upsert({
              where: { id: faq.id },
              update: {
                question: faq.question,
                answer: faq.answer,
                order: faq.order || 0,
                isActive: faq.isActive !== undefined ? faq.isActive : true,
              },
              create: {
                id: faq.id,
                question: faq.question,
                answer: faq.answer,
                order: faq.order || 0,
                isActive: faq.isActive !== undefined ? faq.isActive : true,
              },
            });

            if (mode === 'replace') imported++;
            else updated++;
          } catch (error: any) {
            errors.push(`FAQ ${faq.id || faq.question}: ${error.message}`);
          }
        }

        results.imported.faqs = { imported, updated, skipped, errors };
        results.summary.faqs = imported + updated;
      } catch (error: any) {
        results.errors.faqs = error.message;
        results.success = false;
      }
    }

    // Import Notifications
    if (importEntities.includes('notifications') && entities.notifications) {
      try {
        const notifications = entities.notifications;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.notification.deleteMany({});
        }

        for (const notif of notifications) {
          try {
            if (!notif.title || !notif.description) {
              errors.push(`Notification missing required fields: ${JSON.stringify(notif).substring(0, 100)}`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.notification.findUnique({
                where: { id: notif.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.notification.upsert({
              where: { id: notif.id },
              update: {
                title: notif.title,
                description: notif.description,
                image: notif.image || null,
                url: notif.url || null,
                isActive: notif.isActive !== undefined ? notif.isActive : true,
                receiverCount: notif.receiverCount || 0,
                viewCount: notif.viewCount || 0,
              },
              create: {
                id: notif.id,
                title: notif.title,
                description: notif.description,
                image: notif.image || null,
                url: notif.url || null,
                isActive: notif.isActive !== undefined ? notif.isActive : true,
                receiverCount: notif.receiverCount || 0,
                viewCount: notif.viewCount || 0,
              },
            });

            if (mode === 'replace') imported++;
            else updated++;
          } catch (error: any) {
            errors.push(`Notification ${notif.id || notif.title}: ${error.message}`);
          }
        }

        results.imported.notifications = { imported, updated, skipped, errors };
        results.summary.notifications = imported + updated;
      } catch (error: any) {
        results.errors.notifications = error.message;
        results.success = false;
      }
    }

    // Import Users (AppUser) - must be imported before weight-logs, medication-logs, daily-checkins
    if (importEntities.includes('users') && entities.users) {
      try {
        const users = entities.users;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          // Delete related records first due to foreign keys
          await prisma.dailyCheckIn.deleteMany({});
          await prisma.scheduledNotification.deleteMany({});
          await prisma.medicationLog.deleteMany({});
          await prisma.weightLog.deleteMany({});
          await prisma.notificationView.deleteMany({});
          await prisma.userDevice.deleteMany({});
          await prisma.appUser.deleteMany({});
        }

        for (const user of users) {
          try {
            if (!user.email || !user.wpUserId) {
              errors.push(`User missing required fields: ${JSON.stringify(user).substring(0, 100)}`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.appUser.findUnique({
                where: { id: user.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.appUser.upsert({
              where: { id: user.id },
              update: {
                wpUserId: user.wpUserId,
                email: user.email,
                name: user.name || null,
                displayName: user.displayName || null,
                phone: user.phone || null,
                age: user.age || null,
                height: user.height || null,
                feet: user.feet || null,
                weight: user.weight || null,
                goal: user.goal || null,
                initialWeight: user.initialWeight || null,
                weightSet: user.weightSet || false,
                tasksToday: user.tasksToday || 0,
                totalWorkouts: user.totalWorkouts || 0,
                totalCalories: user.totalCalories || 0,
                streak: user.streak || 0,
                taskStatus: user.taskStatus || null,
                status: user.status || 'Active',
                lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
                fcmToken: user.fcmToken || null,
                woocommerceCustomerId: user.woocommerceCustomerId || null,
              },
              create: {
                id: user.id,
                wpUserId: user.wpUserId,
                email: user.email,
                name: user.name || null,
                displayName: user.displayName || null,
                phone: user.phone || null,
                age: user.age || null,
                height: user.height || null,
                feet: user.feet || null,
                weight: user.weight || null,
                goal: user.goal || null,
                initialWeight: user.initialWeight || null,
                weightSet: user.weightSet || false,
                tasksToday: user.tasksToday || 0,
                totalWorkouts: user.totalWorkouts || 0,
                totalCalories: user.totalCalories || 0,
                streak: user.streak || 0,
                taskStatus: user.taskStatus || null,
                status: user.status || 'Active',
                lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
                fcmToken: user.fcmToken || null,
                woocommerceCustomerId: user.woocommerceCustomerId || null,
              },
            });

            if (mode === 'replace') imported++;
            else updated++;
          } catch (error: any) {
            errors.push(`User ${user.id || user.email}: ${error.message}`);
          }
        }

        results.imported.users = { imported, updated, skipped, errors };
        results.summary.users = imported + updated;
      } catch (error: any) {
        results.errors.users = error.message;
        results.success = false;
      }
    }

    // Import User Devices (multi-device FCM support)
    if (importEntities.includes('user-devices') && entities['user-devices']) {
      try {
        const devices = entities['user-devices'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.userDevice.deleteMany({});
        }

        for (const device of devices) {
          try {
            if (!device.appUserId || !device.deviceId || !device.fcmToken) {
              errors.push(`User device missing required fields: ${JSON.stringify(device).substring(0, 100)}`);
              continue;
            }

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: device.appUserId },
            });

            if (!user) {
              errors.push(`User device ${device.id}: User ${device.appUserId} not found`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.userDevice.findUnique({
                where: { id: device.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.userDevice.upsert({
              where: { id: device.id },
              update: {
                appUserId: device.appUserId,
                deviceId: device.deviceId,
                platform: device.platform || 'unknown',
                fcmToken: device.fcmToken,
                deviceName: device.deviceName || null,
                appVersion: device.appVersion || null,
                lastActiveAt: device.lastActiveAt ? new Date(device.lastActiveAt) : new Date(),
              },
              create: {
                id: device.id,
                appUserId: device.appUserId,
                deviceId: device.deviceId,
                platform: device.platform || 'unknown',
                fcmToken: device.fcmToken,
                deviceName: device.deviceName || null,
                appVersion: device.appVersion || null,
                lastActiveAt: device.lastActiveAt ? new Date(device.lastActiveAt) : new Date(),
              },
            });

            if (mode === 'replace') imported++;
            else updated++;
          } catch (error: any) {
            errors.push(`User device ${device.id}: ${error.message}`);
          }
        }

        results.imported['user-devices'] = { imported, updated, skipped, errors };
        results.summary['user-devices'] = imported + updated;
      } catch (error: any) {
        results.errors['user-devices'] = error.message;
        results.success = false;
      }
    }

    // Import Weight Logs
    if (importEntities.includes('weight-logs') && entities['weight-logs']) {
      try {
        const weightLogs = entities['weight-logs'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.weightLog.deleteMany({});
        }

        for (const log of weightLogs) {
          try {
            if (!log.appUserId || !log.weight) {
              errors.push(`Weight log missing required fields: ${JSON.stringify(log).substring(0, 100)}`);
              continue;
            }

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: log.appUserId },
            });

            if (!user) {
              errors.push(`Weight log ${log.id}: User ${log.appUserId} not found`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.weightLog.findUnique({
                where: { id: log.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.weightLog.upsert({
              where: { id: log.id },
              update: {
                appUserId: log.appUserId,
                userId: log.userId || log.appUserId,
                userEmail: log.userEmail || user.email,
                userName: log.userName || user.name,
                date: new Date(log.date),
                weight: log.weight,
                previousWeight: log.previousWeight || null,
                change: log.change || null,
                changeType: log.changeType || null,
              },
              create: {
                id: log.id,
                appUserId: log.appUserId,
                userId: log.userId || log.appUserId,
                userEmail: log.userEmail || user.email,
                userName: log.userName || user.name,
                date: new Date(log.date),
                weight: log.weight,
                previousWeight: log.previousWeight || null,
                change: log.change || null,
                changeType: log.changeType || null,
              },
            });

            if (mode === 'replace') imported++;
            else updated++;
          } catch (error: any) {
            errors.push(`Weight log ${log.id}: ${error.message}`);
          }
        }

        results.imported['weight-logs'] = { imported, updated, skipped, errors };
        results.summary['weight-logs'] = imported + updated;
      } catch (error: any) {
        results.errors['weight-logs'] = error.message;
        results.success = false;
      }
    }

    // Import Medication Logs
    if (importEntities.includes('medication-logs') && entities['medication-logs']) {
      try {
        const medicationLogs = entities['medication-logs'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.medicationLog.deleteMany({});
        }

        for (const log of medicationLogs) {
          try {
            if (!log.appUserId || !log.medicineName || !log.dosage) {
              errors.push(`Medication log missing required fields: ${JSON.stringify(log).substring(0, 100)}`);
              continue;
            }

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: log.appUserId },
            });

            if (!user) {
              errors.push(`Medication log ${log.id}: User ${log.appUserId} not found`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.medicationLog.findUnique({
                where: { id: log.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.medicationLog.upsert({
              where: { id: log.id },
              update: {
                appUserId: log.appUserId,
                medicineId: log.medicineId || null,
                medicineName: log.medicineName,
                dosage: log.dosage,
                takenAt: new Date(log.takenAt),
              },
              create: {
                id: log.id,
                appUserId: log.appUserId,
                medicineId: log.medicineId || null,
                medicineName: log.medicineName,
                dosage: log.dosage,
                takenAt: new Date(log.takenAt),
              },
            });

            if (mode === 'replace') imported++;
            else updated++;
          } catch (error: any) {
            errors.push(`Medication log ${log.id}: ${error.message}`);
          }
        }

        results.imported['medication-logs'] = { imported, updated, skipped, errors };
        results.summary['medication-logs'] = imported + updated;
      } catch (error: any) {
        results.errors['medication-logs'] = error.message;
        results.success = false;
      }
    }

    // Import Daily Check-ins
    if (importEntities.includes('daily-checkins') && entities['daily-checkins']) {
      try {
        const dailyCheckins = entities['daily-checkins'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.dailyCheckIn.deleteMany({});
        }

        for (const checkin of dailyCheckins) {
          try {
            if (!checkin.appUserId || !checkin.date) {
              errors.push(`Daily check-in missing required fields: ${JSON.stringify(checkin).substring(0, 100)}`);
              continue;
            }

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: checkin.appUserId },
            });

            if (!user) {
              errors.push(`Daily check-in ${checkin.id}: User ${checkin.appUserId} not found`);
              continue;
            }

            if (mode === 'skip-existing') {
              const existing = await prisma.dailyCheckIn.findUnique({
                where: { id: checkin.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            await prisma.dailyCheckIn.upsert({
              where: { id: checkin.id },
              update: {
                appUserId: checkin.appUserId,
                date: checkin.date,
                buttonType: checkin.buttonType || 'default',
                medicationName: checkin.medicationName || 'default',
                nextDate: checkin.nextDate || null,
                deviceInfo: checkin.deviceInfo || null,
                ipAddress: checkin.ipAddress || null,
              },
              create: {
                id: checkin.id,
                appUserId: checkin.appUserId,
                date: checkin.date,
                buttonType: checkin.buttonType || 'default',
                medicationName: checkin.medicationName || 'default',
                nextDate: checkin.nextDate || null,
                deviceInfo: checkin.deviceInfo || null,
                ipAddress: checkin.ipAddress || null,
              },
            });

            if (mode === 'replace') imported++;
            else updated++;
          } catch (error: any) {
            errors.push(`Daily check-in ${checkin.id}: ${error.message}`);
          }
        }

        results.imported['daily-checkins'] = { imported, updated, skipped, errors };
        results.summary['daily-checkins'] = imported + updated;
      } catch (error: any) {
        results.errors['daily-checkins'] = error.message;
        results.success = false;
      }
    }

    return NextResponse.json(results, {
      status: results.success ? 200 : 207,
    });
  } catch (error) {
    console.error('Import backup error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import backup',
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : undefined
      },
      { status: 500 }
    );
  }
}
