import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Automatic Backup Cron Job
 *
 * Generates a JSON backup every day at 6 AM and stores it in public/backup/json-ahc/
 * Filename format: ahc-DDMMYYA (e.g., ahc-010526A for Jan 5, 2026)
 * Keeps only the last 2 days of backups, deletes older ones
 *
 * Setup with Vercel Cron or external cron service:
 * Schedule: 0 6 * * * (6 AM daily)
 *
 * Security: Requires CRON_SECRET header or environment variable
 */

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for large backups

// Generate backup filename based on date
function generateBackupFilename(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  // Add suffix A, B, C for multiple backups on same day
  return `ahc-${day}${month}${year}A.json`;
}

// Get backup directory path
function getBackupDir(): string {
  return path.join(process.cwd(), 'public', 'backup', 'json-ahc');
}

// Ensure backup directory exists
function ensureBackupDir(): void {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

// Clean up old backups, keep only last 2 days
function cleanupOldBackups(): { deleted: string[]; kept: string[] } {
  const backupDir = getBackupDir();
  const deleted: string[] = [];
  const kept: string[] = [];

  if (!fs.existsSync(backupDir)) {
    return { deleted, kept };
  }

  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('ahc-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      stat: fs.statSync(path.join(backupDir, f)),
    }))
    .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

  // Keep the 2 most recent backups
  files.forEach((file, index) => {
    if (index < 2) {
      kept.push(file.name);
    } else {
      try {
        fs.unlinkSync(file.path);
        deleted.push(file.name);
      } catch (error) {
        console.error(`Failed to delete old backup ${file.name}:`, error);
      }
    }
  });

  return { deleted, kept };
}

// Generate full backup data
async function generateBackupData() {
  const exportData: any = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    autoBackup: true,
    entities: {},
  };

  // Export Medicine Categories
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

  // Export Medicines
  const medicines = await prisma.medicine.findMany({
    include: {
      category: {
        select: { id: true, title: true }
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

  // Export Blogs
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

  // Export FAQs
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

  // Export Notifications
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

  // Export Users with Fitness Information
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
    weight: user.weight,
    goal: user.goal,
    initialWeight: user.initialWeight,
    weightSet: user.weightSet,
    streak: user.streak,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    fcmToken: user.fcmToken,
    woocommerceCustomerId: user.woocommerceCustomerId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }));

  // Export Weight Logs
  const weightLogs = await prisma.weightLog.findMany({
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

  // Export Medication Logs
  const medicationLogs = await prisma.medicationLog.findMany({
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

  // Export Daily Check-ins
  const dailyCheckins = await prisma.dailyCheckIn.findMany({
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

  // Add summary
  exportData.summary = {
    'medicine-categories': exportData.entities['medicine-categories']?.length || 0,
    medicines: exportData.entities.medicines?.length || 0,
    blogs: exportData.entities.blogs?.length || 0,
    faqs: exportData.entities.faqs?.length || 0,
    notifications: exportData.entities.notifications?.length || 0,
    users: exportData.entities.users?.length || 0,
    'weight-logs': exportData.entities['weight-logs']?.length || 0,
    'medication-logs': exportData.entities['medication-logs']?.length || 0,
    'daily-checkins': exportData.entities['daily-checkins']?.length || 0,
  };

  return exportData;
}

export async function GET(request: NextRequest) {
  console.log('=== AUTO BACKUP CRON JOB STARTED ===');

  try {
    // Verify cron secret for security
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '') ||
      request.headers.get('x-cron-secret');

    // Allow if no secret is configured (development) or if secret matches
    if (cronSecret && providedSecret !== cronSecret) {
      console.log('Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized. Invalid CRON_SECRET.' },
        { status: 401 }
      );
    }

    // Check for dry run mode
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dry_run') === 'true';

    if (dryRun) {
      console.log('Dry run mode - no backup will be created');
    }

    // Ensure backup directory exists
    ensureBackupDir();

    // Generate backup data
    console.log('Generating backup data...');
    const backupData = await generateBackupData();
    const jsonString = JSON.stringify(backupData, null, 2);

    // Calculate file size
    const fileSizeBytes = Buffer.byteLength(jsonString, 'utf8');
    const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

    console.log(`Backup data generated: ${fileSizeMB} MB`);
    console.log('Summary:', backupData.summary);

    let savedFilename = '';
    let savedPath = '';

    if (!dryRun) {
      // Generate filename and save
      const now = new Date();
      savedFilename = generateBackupFilename(now);
      savedPath = path.join(getBackupDir(), savedFilename);

      // Check if file already exists, add suffix if needed
      let suffix = 'A';
      while (fs.existsSync(savedPath) && suffix.charCodeAt(0) <= 'Z'.charCodeAt(0)) {
        savedFilename = savedFilename.replace(/[A-Z]\.json$/, `${suffix}.json`);
        savedPath = path.join(getBackupDir(), savedFilename);
        suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
      }

      // Write backup file
      fs.writeFileSync(savedPath, jsonString, 'utf8');
      console.log(`Backup saved: ${savedFilename}`);

      // Cleanup old backups (keep last 2)
      const cleanup = cleanupOldBackups();
      console.log('Cleanup result:', cleanup);
    }

    console.log('=== AUTO BACKUP CRON JOB COMPLETED ===');

    return NextResponse.json({
      success: true,
      message: dryRun ? 'Dry run completed - no backup created' : 'Backup created successfully',
      backup: {
        filename: savedFilename || 'N/A (dry run)',
        path: savedPath || 'N/A (dry run)',
        size: `${fileSizeMB} MB`,
        sizeBytes: fileSizeBytes,
      },
      summary: backupData.summary,
      timestamp: new Date().toISOString(),
      dryRun,
    });
  } catch (error: any) {
    console.error('Auto backup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create backup',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Also support POST for some cron services
export async function POST(request: NextRequest) {
  return GET(request);
}
