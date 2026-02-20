import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Process Account Deletion Requests Cron Job
 *
 * Finds pending requests where autoDeleteAt has passed and deletes those user accounts.
 * Cascade deletes will clean up all related data.
 *
 * Security:
 * - Requires CRON_SECRET header for automated calls
 *
 * Query Parameters:
 * - dryRun (boolean, optional): If true, only reports what would be deleted
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization (CRON_SECRET)
    const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid CRON_SECRET required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    const now = new Date();
    console.log(`[Cron] Processing account deletion requests${dryRun ? ' (DRY RUN)' : ''}`);

    // Find all pending requests where autoDeleteAt has passed
    const expiredRequests = await prisma.accountDeletionRequest.findMany({
      where: {
        status: 'pending',
        autoDeleteAt: { lte: now },
      },
      include: {
        appUser: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    console.log(`[Cron] Found ${expiredRequests.length} expired deletion requests`);

    if (expiredRequests.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired deletion requests to process',
        processed: 0,
        deleted: 0,
        failed: 0,
      });
    }

    let deleted = 0;
    let failed = 0;
    const results: Array<{
      requestId: string;
      userId: string;
      userEmail: string;
      status: 'deleted' | 'failed';
      error?: string;
    }> = [];

    for (const req of expiredRequests) {
      if (dryRun) {
        console.log(`[Cron DRY RUN] Would delete user ${req.appUser?.email} (${req.appUserId})`);
        results.push({
          requestId: req.id,
          userId: req.appUserId,
          userEmail: req.appUser?.email || 'unknown',
          status: 'deleted',
        });
        deleted++;
        continue;
      }

      try {
        // Mark request as deleted first
        await prisma.accountDeletionRequest.update({
          where: { id: req.id },
          data: { status: 'deleted', resolvedAt: now },
        });

        // Delete the user (cascade cleans up everything)
        await prisma.appUser.delete({
          where: { id: req.appUserId },
        });

        deleted++;
        results.push({
          requestId: req.id,
          userId: req.appUserId,
          userEmail: req.appUser?.email || 'unknown',
          status: 'deleted',
        });
        console.log(`[Cron] Deleted user ${req.appUser?.email} (${req.appUserId})`);
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          requestId: req.id,
          userId: req.appUserId,
          userEmail: req.appUser?.email || 'unknown',
          status: 'failed',
          error: errorMessage,
        });
        console.error(`[Cron] Failed to delete user ${req.appUserId}:`, errorMessage);
      }
    }

    console.log(`[Cron] Completed: ${deleted} deleted, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Deletion requests processed',
      processed: expiredRequests.length,
      deleted,
      failed,
      results,
    });
  } catch (error) {
    console.error('[Cron] Error processing deletion requests:', error);
    return NextResponse.json(
      {
        error: 'Failed to process deletion requests',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
