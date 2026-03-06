import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Import Backup Data API
 *
 * Imports all data from JSON backup including settings, languages, translations,
 * medicines, categories, blogs, FAQs, notifications, notification views, push logs,
 * users, user devices, weight logs, medication logs, daily check-ins, bug reports,
 * scheduled notifications, and account deletion requests
 *
 * Request Body:
 * {
 *   "entities": {
 *     "settings": {...},
 *     "languages": [...],
 *     "translations": [...],
 *     "medicine-categories": [...],
 *     "medicines": [...],
 *     "blogs": [...],
 *     "faqs": [...],
 *     "notifications": [...],
 *     "notification-views": [...],
 *     "push-notification-logs": [...],
 *     "users": [...],
 *     "user-devices": [...],
 *     "weight-logs": [...],
 *     "medication-logs": [...],
 *     "daily-checkins": [...],
 *     "bug-reports": [...],
 *     "scheduled-notifications": [...],
 *     "account-deletion-requests": [...]
 *   },
 *   "options": {
 *     "mode": "replace" | "merge" | "skip-existing",
 *     "importEntities": ["medicines", "blogs", ...]
 *   }
 * }
 *
 * Import Modes:
 * - replace: Delete all existing data and import new data
 * - merge: Import new data, update existing records (default)
 * - skip-existing: Only import records that don't exist
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

    // User ID mapping: backup user ID -> actual database user ID
    // Needed when merging into a database where users exist with different IDs
    const userIdMap = new Map<string, string>();

    // ========== 0. Import Settings ==========
    if (importEntities.includes('settings') && entities.settings) {
      try {
        const s = entities.settings;

        await prisma.settings.upsert({
          where: { id: 'settings' },
          update: {
            adminEmail: s.adminEmail,
            timezone: s.timezone,
            sessionTimeout: s.sessionTimeout,
            requireStrongPassword: s.requireStrongPassword,
            enableTwoFactor: s.enableTwoFactor,
            maintenanceMode: s.maintenanceMode,
            maintenanceMessage: s.maintenanceMessage || null,
            orderProcessingTitle: s.orderProcessingTitle || null,
            orderProcessingBody: s.orderProcessingBody || null,
            orderCompletedTitle: s.orderCompletedTitle || null,
            orderCompletedBody: s.orderCompletedBody || null,
          },
          create: {
            id: 'settings',
            adminEmail: s.adminEmail || 'admin@alternatehealthclub.com',
            timezone: s.timezone || 'America/New_York',
            sessionTimeout: s.sessionTimeout || 30,
            requireStrongPassword: s.requireStrongPassword ?? true,
            enableTwoFactor: s.enableTwoFactor ?? false,
            maintenanceMode: s.maintenanceMode ?? false,
            maintenanceMessage: s.maintenanceMessage || null,
            orderProcessingTitle: s.orderProcessingTitle || null,
            orderProcessingBody: s.orderProcessingBody || null,
            orderCompletedTitle: s.orderCompletedTitle || null,
            orderCompletedBody: s.orderCompletedBody || null,
          },
        });

        results.imported.settings = { imported: 0, updated: 1, skipped: 0, errors: [] };
        results.summary.settings = 1;
      } catch (error: any) {
        results.errors.settings = error.message;
        results.success = false;
      }
    }

    // ========== 0b. Import Languages ==========
    if (importEntities.includes('languages') && entities.languages) {
      try {
        const languages = entities.languages;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          // Delete translations first since they reference language codes
          await prisma.translation.deleteMany({});
          await prisma.supportedLanguage.deleteMany({});
        }

        for (const lang of languages) {
          try {
            if (!lang.code || !lang.name) {
              errors.push(`Language missing required fields: ${JSON.stringify(lang).substring(0, 100)}`);
              continue;
            }

            // Find existing by id or code (unique constraint on code)
            const existing = await prisma.supportedLanguage.findFirst({
              where: {
                OR: [
                  { id: lang.id },
                  { code: lang.code.trim().toLowerCase() },
                ]
              }
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const langData = {
              code: lang.code.trim().toLowerCase(),
              name: lang.name.trim(),
              nativeName: lang.nativeName || null,
              isActive: lang.isActive !== undefined ? lang.isActive : true,
              order: lang.order || 0,
            };

            if (existing) {
              await prisma.supportedLanguage.update({
                where: { id: existing.id },
                data: langData,
              });
              updated++;
            } else {
              await prisma.supportedLanguage.create({
                data: { id: lang.id, ...langData },
              });
              imported++;
            }
          } catch (error: any) {
            errors.push(`Language ${lang.id || lang.code}: ${error.message}`);
          }
        }

        results.imported.languages = { imported, updated, skipped, errors };
        results.summary.languages = imported + updated;
      } catch (error: any) {
        results.errors.languages = error.message;
        results.success = false;
      }
    }

    // ========== 1. Import Medicine Categories ==========
    if (importEntities.includes('medicine-categories') && entities['medicine-categories']) {
      try {
        const categories = entities['medicine-categories'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          // Cascade will delete medicines too
          await prisma.medicineCategory.deleteMany({});
        }

        for (const cat of categories) {
          try {
            if (!cat.title) {
              errors.push(`Category missing title: ${JSON.stringify(cat).substring(0, 100)}`);
              continue;
            }

            const existing = await prisma.medicineCategory.findUnique({
              where: { id: cat.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            if (existing) {
              await prisma.medicineCategory.update({
                where: { id: cat.id },
                data: {
                  title: cat.title,
                  tagline: cat.tagline || null,
                  icon: cat.icon || null,
                },
              });
              updated++;
            } else {
              await prisma.medicineCategory.create({
                data: {
                  id: cat.id,
                  title: cat.title,
                  tagline: cat.tagline || null,
                  icon: cat.icon || null,
                },
              });
              imported++;
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

    // ========== 2. Import Medicines ==========
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

            const existing = await prisma.medicine.findUnique({
              where: { id: med.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const medicineData = {
              categoryId: med.categoryId,
              title: med.title,
              tagline: med.tagline || null,
              description: med.description || null,
              image: med.image || null,
              url: med.url || null,
              price: med.price || null,
              productType: med.productType || 'simple',
              status: med.status || 'active',
            };

            if (existing) {
              await prisma.medicine.update({
                where: { id: med.id },
                data: medicineData,
              });
              updated++;
            } else {
              await prisma.medicine.create({
                data: { id: med.id, ...medicineData },
              });
              imported++;
            }
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

    // ========== 3. Import Blogs ==========
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

            const existing = await prisma.blog.findUnique({
              where: { id: blog.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const blogData = {
              title: blog.title,
              tagline: blog.tagline,
              description: blog.description,
              tags: blog.tags || [],
              featuredImage: blog.featuredImage,
              status: blog.status || 'published',
            };

            if (existing) {
              await prisma.blog.update({
                where: { id: blog.id },
                data: blogData,
              });
              updated++;
            } else {
              await prisma.blog.create({
                data: { id: blog.id, ...blogData },
              });
              imported++;
            }
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

    // ========== 3.5 Import FAQ Categories (before FAQs due to FK) ==========
    if ((importEntities.includes('faq-categories') || importEntities.includes('faqs')) && entities['faq-categories']) {
      try {
        const faqCategories = entities['faq-categories'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.faqCategory.deleteMany({});
        }

        for (const cat of faqCategories) {
          try {
            if (!cat.title) {
              errors.push(`FAQ Category missing title: ${JSON.stringify(cat).substring(0, 100)}`);
              continue;
            }

            const existing = await prisma.faqCategory.findUnique({
              where: { id: cat.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const catData = {
              title: cat.title,
              order: cat.order || 0,
              isActive: cat.isActive !== undefined ? cat.isActive : true,
            };

            if (existing) {
              await prisma.faqCategory.update({
                where: { id: cat.id },
                data: catData,
              });
              updated++;
            } else {
              await prisma.faqCategory.create({
                data: { id: cat.id, ...catData },
              });
              imported++;
            }
          } catch (error: any) {
            errors.push(`FAQ Category ${cat.id || cat.title}: ${error.message}`);
          }
        }

        results.imported['faq-categories'] = { imported, updated, skipped, errors };
        results.summary['faq-categories'] = imported + updated;
      } catch (error: any) {
        results.errors['faq-categories'] = error.message;
        results.success = false;
      }
    }

    // ========== 4. Import FAQs ==========
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

            const existing = await prisma.fAQ.findUnique({
              where: { id: faq.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const faqData = {
              question: faq.question,
              answer: faq.answer,
              order: faq.order || 0,
              isActive: faq.isActive !== undefined ? faq.isActive : true,
              categoryId: faq.categoryId || null,
            };

            if (existing) {
              await prisma.fAQ.update({
                where: { id: faq.id },
                data: faqData,
              });
              updated++;
            } else {
              await prisma.fAQ.create({
                data: { id: faq.id, ...faqData },
              });
              imported++;
            }
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

    // ========== 5. Import Notifications ==========
    if (importEntities.includes('notifications') && entities.notifications) {
      try {
        const notifications = entities.notifications;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          // Delete views first, then notifications
          await prisma.notificationView.deleteMany({});
          await prisma.notification.deleteMany({});
        }

        for (const notif of notifications) {
          try {
            if (!notif.title || !notif.description) {
              errors.push(`Notification missing required fields: ${JSON.stringify(notif).substring(0, 100)}`);
              continue;
            }

            const existing = await prisma.notification.findUnique({
              where: { id: notif.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const notifData = {
              title: notif.title,
              description: notif.description,
              image: notif.image || null,
              url: notif.url || null,
              isActive: notif.isActive !== undefined ? notif.isActive : true,
              type: notif.type || 'general',
              icon: notif.icon || null,
              source: notif.source || 'admin',
              receiverCount: notif.receiverCount || 0,
              viewCount: notif.viewCount || 0,
            };

            if (existing) {
              await prisma.notification.update({
                where: { id: notif.id },
                data: notifData,
              });
              updated++;
            } else {
              await prisma.notification.create({
                data: { id: notif.id, ...notifData },
              });
              imported++;
            }
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

    // ========== 5b. Import Translations ==========
    if (importEntities.includes('translations') && entities.translations) {
      try {
        const translations = entities.translations;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.translation.deleteMany({});
        }

        for (const t of translations) {
          try {
            if (!t.entityType || !t.entityId || !t.locale || !t.field) {
              errors.push(`Translation missing required fields: ${JSON.stringify(t).substring(0, 100)}`);
              continue;
            }

            // Find existing by id or composite unique [entityType, entityId, locale, field]
            const existing = await prisma.translation.findFirst({
              where: {
                OR: [
                  { id: t.id },
                  { entityType: t.entityType, entityId: t.entityId, locale: t.locale, field: t.field },
                ]
              }
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const translationData = {
              entityType: t.entityType,
              entityId: t.entityId,
              locale: t.locale,
              field: t.field,
              value: t.value || '',
            };

            if (existing) {
              await prisma.translation.update({
                where: { id: existing.id },
                data: translationData,
              });
              updated++;
            } else {
              await prisma.translation.create({
                data: { id: t.id, ...translationData },
              });
              imported++;
            }
          } catch (error: any) {
            errors.push(`Translation ${t.id || `${t.entityType}/${t.entityId}/${t.locale}/${t.field}`}: ${error.message}`);
          }
        }

        results.imported.translations = { imported, updated, skipped, errors };
        results.summary.translations = imported + updated;
      } catch (error: any) {
        results.errors.translations = error.message;
        results.success = false;
      }
    }

    // ========== 6. Import Users (AppUser) ==========
    // Must be imported before weight-logs, medication-logs, daily-checkins, user-devices
    // Handles unique constraints on email and wpUserId by finding existing records first
    if (importEntities.includes('users') && entities.users) {
      try {
        const users = entities.users;
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          // Delete dependent records first (order matters for foreign keys)
          await prisma.accountDeletionRequest.deleteMany({});
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

            // Find existing user by id, email, or wpUserId to avoid unique constraint violations
            const existingUser = mode !== 'replace'
              ? await prisma.appUser.findFirst({
                  where: {
                    OR: [
                      { id: user.id },
                      { email: user.email.toLowerCase().trim() },
                      { wpUserId: String(user.wpUserId) },
                    ]
                  }
                })
              : null;

            if (mode === 'skip-existing' && existingUser) {
              userIdMap.set(user.id, existingUser.id);
              skipped++;
              continue;
            }

            const userData = {
              wpUserId: String(user.wpUserId),
              email: user.email.toLowerCase().trim(),
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
              streak: user.streak || 0,
              status: user.status || 'Active',
              lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
              fcmToken: user.fcmToken || null,
              woocommerceCustomerId: user.woocommerceCustomerId || null,
            };

            if (existingUser) {
              // Update existing user (found by id, email, or wpUserId)
              await prisma.appUser.update({
                where: { id: existingUser.id },
                data: userData,
              });
              userIdMap.set(user.id, existingUser.id);
              updated++;
            } else {
              // Create new user
              await prisma.appUser.create({
                data: { id: user.id, ...userData },
              });
              userIdMap.set(user.id, user.id);
              imported++;
            }
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

    // ========== 7. Import User Devices ==========
    // Handles composite unique constraint on [appUserId, deviceId]
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

            // Resolve user ID through mapping
            const resolvedUserId = userIdMap.get(device.appUserId) || device.appUserId;

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: resolvedUserId },
            });

            if (!user) {
              errors.push(`User device ${device.id}: User ${device.appUserId} not found`);
              continue;
            }

            // Find existing device by id OR by composite unique [appUserId, deviceId]
            const existingDevice = await prisma.userDevice.findFirst({
              where: {
                OR: [
                  { id: device.id },
                  { appUserId: resolvedUserId, deviceId: device.deviceId },
                ]
              }
            });

            if (mode === 'skip-existing' && existingDevice) {
              skipped++;
              continue;
            }

            const deviceData = {
              appUserId: resolvedUserId,
              deviceId: device.deviceId,
              platform: device.platform || 'unknown',
              fcmToken: device.fcmToken,
              deviceName: device.deviceName || null,
              appVersion: device.appVersion || null,
              lastActiveAt: device.lastActiveAt ? new Date(device.lastActiveAt) : new Date(),
            };

            if (existingDevice) {
              await prisma.userDevice.update({
                where: { id: existingDevice.id },
                data: deviceData,
              });
              updated++;
            } else {
              await prisma.userDevice.create({
                data: { id: device.id, ...deviceData },
              });
              imported++;
            }
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

    // ========== 8. Import Weight Logs ==========
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

            // Resolve user ID through mapping
            const resolvedUserId = userIdMap.get(log.appUserId) || log.appUserId;

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: resolvedUserId },
            });

            if (!user) {
              errors.push(`Weight log ${log.id}: User ${log.appUserId} not found`);
              continue;
            }

            const existing = await prisma.weightLog.findUnique({
              where: { id: log.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const logData = {
              appUserId: resolvedUserId,
              userId: log.userId || resolvedUserId,
              userEmail: log.userEmail || user.email,
              userName: log.userName || user.name,
              date: new Date(log.date),
              weight: log.weight,
              previousWeight: log.previousWeight || null,
              change: log.change || null,
              changeType: log.changeType || null,
            };

            if (existing) {
              await prisma.weightLog.update({
                where: { id: log.id },
                data: logData,
              });
              updated++;
            } else {
              await prisma.weightLog.create({
                data: { id: log.id, ...logData },
              });
              imported++;
            }
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

    // ========== 9. Import Medication Logs ==========
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

            // Resolve user ID through mapping
            const resolvedUserId = userIdMap.get(log.appUserId) || log.appUserId;

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: resolvedUserId },
            });

            if (!user) {
              errors.push(`Medication log ${log.id}: User ${log.appUserId} not found`);
              continue;
            }

            const existing = await prisma.medicationLog.findUnique({
              where: { id: log.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const logData = {
              appUserId: resolvedUserId,
              medicineId: log.medicineId || null,
              medicineName: log.medicineName,
              dosage: log.dosage,
              takenAt: new Date(log.takenAt),
            };

            if (existing) {
              await prisma.medicationLog.update({
                where: { id: log.id },
                data: logData,
              });
              updated++;
            } else {
              await prisma.medicationLog.create({
                data: { id: log.id, ...logData },
              });
              imported++;
            }
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

    // ========== 10. Import Daily Check-ins ==========
    // Handles composite unique constraint on [appUserId, date, medicationName]
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

            // Resolve user ID through mapping
            const resolvedUserId = userIdMap.get(checkin.appUserId) || checkin.appUserId;

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: resolvedUserId },
            });

            if (!user) {
              errors.push(`Daily check-in ${checkin.id}: User ${checkin.appUserId} not found`);
              continue;
            }

            const medicationName = checkin.medicationName || 'default';

            // Find existing by id OR by composite unique [appUserId, date, medicationName]
            const existingCheckIn = await prisma.dailyCheckIn.findFirst({
              where: {
                OR: [
                  { id: checkin.id },
                  { appUserId: resolvedUserId, date: checkin.date, medicationName },
                ]
              }
            });

            if (mode === 'skip-existing' && existingCheckIn) {
              skipped++;
              continue;
            }

            const checkinData = {
              appUserId: resolvedUserId,
              date: checkin.date,
              buttonType: checkin.buttonType || 'default',
              medicationName,
              nextDate: checkin.nextDate || null,
              deviceInfo: checkin.deviceInfo || null,
              ipAddress: checkin.ipAddress || null,
            };

            if (existingCheckIn) {
              await prisma.dailyCheckIn.update({
                where: { id: existingCheckIn.id },
                data: checkinData,
              });
              updated++;
            } else {
              await prisma.dailyCheckIn.create({
                data: { id: checkin.id, ...checkinData },
              });
              imported++;
            }
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

    // ========== 11. Import Bug Reports ==========
    if (importEntities.includes('bug-reports') && entities['bug-reports']) {
      try {
        const bugReports = entities['bug-reports'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.bugReport.deleteMany({});
        }

        for (const report of bugReports) {
          try {
            if (!report.title || !report.description) {
              errors.push(`Bug report missing required fields: ${JSON.stringify(report).substring(0, 100)}`);
              continue;
            }

            // Resolve user ID through mapping (appUserId is optional for bug reports)
            const resolvedUserId = report.appUserId
              ? (userIdMap.get(report.appUserId) || report.appUserId)
              : null;

            // Verify user exists if appUserId is provided
            if (resolvedUserId) {
              const user = await prisma.appUser.findUnique({
                where: { id: resolvedUserId },
              });
              if (!user) {
                // Bug reports can exist without a linked user, so just null it out
              }
            }

            const existing = await prisma.bugReport.findUnique({
              where: { id: report.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            // Check if resolved user actually exists
            let finalUserId: string | null = null;
            if (resolvedUserId) {
              const userExists = await prisma.appUser.findUnique({
                where: { id: resolvedUserId },
              });
              finalUserId = userExists ? resolvedUserId : null;
            }

            const reportData = {
              title: report.title,
              description: report.description,
              image: report.image || null,
              status: report.status || 'open',
              platform: report.platform || null,
              osVersion: report.osVersion || null,
              deviceName: report.deviceName || null,
              appVersion: report.appVersion || null,
              reporterName: report.reporterName || null,
              reporterEmail: report.reporterEmail || null,
              appUserId: finalUserId,
            };

            if (existing) {
              await prisma.bugReport.update({
                where: { id: report.id },
                data: reportData,
              });
              updated++;
            } else {
              await prisma.bugReport.create({
                data: { id: report.id, ...reportData },
              });
              imported++;
            }
          } catch (error: any) {
            errors.push(`Bug report ${report.id || report.title}: ${error.message}`);
          }
        }

        results.imported['bug-reports'] = { imported, updated, skipped, errors };
        results.summary['bug-reports'] = imported + updated;
      } catch (error: any) {
        results.errors['bug-reports'] = error.message;
        results.success = false;
      }
    }

    // ========== 12. Import Scheduled Notifications ==========
    if (importEntities.includes('scheduled-notifications') && entities['scheduled-notifications']) {
      try {
        const scheduledNotifs = entities['scheduled-notifications'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.scheduledNotification.deleteMany({});
        }

        for (const sn of scheduledNotifs) {
          try {
            if (!sn.appUserId || !sn.scheduledDate || !sn.title || !sn.body) {
              errors.push(`Scheduled notification missing required fields: ${JSON.stringify(sn).substring(0, 100)}`);
              continue;
            }

            // Resolve user ID through mapping
            const resolvedUserId = userIdMap.get(sn.appUserId) || sn.appUserId;

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: resolvedUserId },
            });

            if (!user) {
              errors.push(`Scheduled notification ${sn.id}: User ${sn.appUserId} not found`);
              continue;
            }

            const existing = await prisma.scheduledNotification.findUnique({
              where: { id: sn.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const snData = {
              appUserId: resolvedUserId,
              checkInId: sn.checkInId,
              medicationName: sn.medicationName,
              scheduledDate: sn.scheduledDate,
              scheduledType: sn.scheduledType,
              title: sn.title,
              body: sn.body,
              status: sn.status || 'pending',
              sentAt: sn.sentAt ? new Date(sn.sentAt) : null,
              errorMessage: sn.errorMessage || null,
            };

            if (existing) {
              await prisma.scheduledNotification.update({
                where: { id: sn.id },
                data: snData,
              });
              updated++;
            } else {
              await prisma.scheduledNotification.create({
                data: { id: sn.id, ...snData },
              });
              imported++;
            }
          } catch (error: any) {
            errors.push(`Scheduled notification ${sn.id}: ${error.message}`);
          }
        }

        results.imported['scheduled-notifications'] = { imported, updated, skipped, errors };
        results.summary['scheduled-notifications'] = imported + updated;
      } catch (error: any) {
        results.errors['scheduled-notifications'] = error.message;
        results.success = false;
      }
    }

    // ========== 13. Import Notification Views ==========
    if (importEntities.includes('notification-views') && entities['notification-views']) {
      try {
        const views = entities['notification-views'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.notificationView.deleteMany({});
        }

        for (const view of views) {
          try {
            if (!view.notificationId) {
              errors.push(`Notification view missing notificationId: ${JSON.stringify(view).substring(0, 100)}`);
              continue;
            }

            // Verify notification exists
            const notification = await prisma.notification.findUnique({
              where: { id: view.notificationId },
            });

            if (!notification) {
              errors.push(`Notification view ${view.id}: Notification ${view.notificationId} not found`);
              continue;
            }

            // Resolve user ID through mapping
            const resolvedUserId = view.appUserId
              ? (userIdMap.get(view.appUserId) || view.appUserId)
              : null;

            // Find existing by id or composite unique [notificationId, appUserId]
            const existing = await prisma.notificationView.findFirst({
              where: {
                OR: [
                  { id: view.id },
                  ...(resolvedUserId
                    ? [{ notificationId: view.notificationId, appUserId: resolvedUserId }]
                    : []),
                ]
              }
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            // Verify user exists if provided
            let finalUserId: string | null = null;
            if (resolvedUserId) {
              const userExists = await prisma.appUser.findUnique({
                where: { id: resolvedUserId },
              });
              finalUserId = userExists ? resolvedUserId : null;
            }

            const viewData = {
              notificationId: view.notificationId,
              appUserId: finalUserId,
              wpUserId: view.wpUserId || null,
              userEmail: view.userEmail || null,
              viewedAt: view.viewedAt ? new Date(view.viewedAt) : new Date(),
            };

            if (existing) {
              await prisma.notificationView.update({
                where: { id: existing.id },
                data: viewData,
              });
              updated++;
            } else {
              await prisma.notificationView.create({
                data: { id: view.id, ...viewData },
              });
              imported++;
            }
          } catch (error: any) {
            errors.push(`Notification view ${view.id}: ${error.message}`);
          }
        }

        results.imported['notification-views'] = { imported, updated, skipped, errors };
        results.summary['notification-views'] = imported + updated;
      } catch (error: any) {
        results.errors['notification-views'] = error.message;
        results.success = false;
      }
    }

    // ========== 14. Import Push Notification Logs ==========
    if (importEntities.includes('push-notification-logs') && entities['push-notification-logs']) {
      try {
        const pushLogs = entities['push-notification-logs'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.pushNotificationLog.deleteMany({});
        }

        for (const log of pushLogs) {
          try {
            if (!log.title || !log.body || !log.source) {
              errors.push(`Push log missing required fields: ${JSON.stringify(log).substring(0, 100)}`);
              continue;
            }

            const existing = await prisma.pushNotificationLog.findUnique({
              where: { id: log.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const logData = {
              recipientEmail: log.recipientEmail || null,
              recipientWpUserId: log.recipientWpUserId || null,
              recipientCount: log.recipientCount || 1,
              title: log.title,
              body: log.body,
              imageUrl: log.imageUrl || null,
              dataPayload: log.dataPayload || null,
              source: log.source,
              type: log.type || 'general',
              sourceId: log.sourceId || null,
              status: log.status || 'pending',
              successCount: log.successCount || 0,
              failureCount: log.failureCount || 0,
              errorMessage: log.errorMessage || null,
              errorCode: log.errorCode || null,
              fcmMessageId: log.fcmMessageId || null,
              sentAt: log.sentAt ? new Date(log.sentAt) : null,
            };

            if (existing) {
              await prisma.pushNotificationLog.update({
                where: { id: log.id },
                data: logData,
              });
              updated++;
            } else {
              await prisma.pushNotificationLog.create({
                data: { id: log.id, ...logData },
              });
              imported++;
            }
          } catch (error: any) {
            errors.push(`Push log ${log.id}: ${error.message}`);
          }
        }

        results.imported['push-notification-logs'] = { imported, updated, skipped, errors };
        results.summary['push-notification-logs'] = imported + updated;
      } catch (error: any) {
        results.errors['push-notification-logs'] = error.message;
        results.success = false;
      }
    }

    // ========== 15. Import Account Deletion Requests ==========
    if (importEntities.includes('account-deletion-requests') && entities['account-deletion-requests']) {
      try {
        const deletionRequests = entities['account-deletion-requests'];
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (mode === 'replace') {
          await prisma.accountDeletionRequest.deleteMany({});
        }

        for (const req of deletionRequests) {
          try {
            if (!req.appUserId || !req.autoDeleteAt) {
              errors.push(`Account deletion request missing required fields: ${JSON.stringify(req).substring(0, 100)}`);
              continue;
            }

            // Resolve user ID through mapping
            const resolvedUserId = userIdMap.get(req.appUserId) || req.appUserId;

            // Verify user exists
            const user = await prisma.appUser.findUnique({
              where: { id: resolvedUserId },
            });

            if (!user) {
              errors.push(`Account deletion request ${req.id}: User ${req.appUserId} not found`);
              continue;
            }

            const existing = await prisma.accountDeletionRequest.findUnique({
              where: { id: req.id },
            });

            if (mode === 'skip-existing' && existing) {
              skipped++;
              continue;
            }

            const reqData = {
              appUserId: resolvedUserId,
              status: req.status || 'pending',
              reason: req.reason || null,
              requestedAt: req.requestedAt ? new Date(req.requestedAt) : new Date(),
              resolvedAt: req.resolvedAt ? new Date(req.resolvedAt) : null,
              autoDeleteAt: new Date(req.autoDeleteAt),
            };

            if (existing) {
              await prisma.accountDeletionRequest.update({
                where: { id: req.id },
                data: reqData,
              });
              updated++;
            } else {
              await prisma.accountDeletionRequest.create({
                data: { id: req.id, ...reqData },
              });
              imported++;
            }
          } catch (error: any) {
            errors.push(`Account deletion request ${req.id}: ${error.message}`);
          }
        }

        results.imported['account-deletion-requests'] = { imported, updated, skipped, errors };
        results.summary['account-deletion-requests'] = imported + updated;
      } catch (error: any) {
        results.errors['account-deletion-requests'] = error.message;
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
