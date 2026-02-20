import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// PUT - Update deletion request (hold / resume / delete)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { action } = body; // "hold" | "resume" | "delete"

    if (!action || !['hold', 'resume', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "hold", "resume", or "delete".' },
        { status: 400 }
      );
    }

    const deletionRequest = await prisma.accountDeletionRequest.findUnique({
      where: { id },
      include: {
        appUser: { select: { id: true, email: true, name: true } },
      },
    });

    if (!deletionRequest) {
      return NextResponse.json(
        { error: 'Deletion request not found' },
        { status: 404 }
      );
    }

    if (deletionRequest.status === 'deleted') {
      return NextResponse.json(
        { error: 'This request has already been processed (user deleted).' },
        { status: 400 }
      );
    }

    if (action === 'hold') {
      const updated = await prisma.accountDeletionRequest.update({
        where: { id },
        data: { status: 'on_hold' },
      });
      return NextResponse.json({
        success: true,
        message: 'Deletion request put on hold. Auto-delete paused.',
        request: updated,
      });
    }

    if (action === 'resume') {
      // Reset the 24-hour timer from now
      const newAutoDeleteAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const updated = await prisma.accountDeletionRequest.update({
        where: { id },
        data: {
          status: 'pending',
          autoDeleteAt: newAutoDeleteAt,
        },
      });
      return NextResponse.json({
        success: true,
        message: 'Deletion request resumed. 24-hour timer reset.',
        request: updated,
      });
    }

    if (action === 'delete') {
      // Check if user still exists (may have been deleted by another means)
      const userExists = await prisma.appUser.findUnique({
        where: { id: deletionRequest.appUserId },
      });

      if (!userExists) {
        // User already deleted, just mark the request
        await prisma.accountDeletionRequest.update({
          where: { id },
          data: { status: 'deleted', resolvedAt: new Date() },
        });
        return NextResponse.json({
          success: true,
          message: 'User was already deleted. Request marked as deleted.',
        });
      }

      // Delete the user (cascade will clean up everything including this request)
      // But first update the request status so it's recorded before cascade
      await prisma.accountDeletionRequest.update({
        where: { id },
        data: { status: 'deleted', resolvedAt: new Date() },
      });

      await prisma.appUser.delete({
        where: { id: deletionRequest.appUserId },
      });

      return NextResponse.json({
        success: true,
        message: 'User account deleted successfully.',
        deletedUser: {
          id: deletionRequest.appUserId,
          email: deletionRequest.appUser?.email,
          name: deletionRequest.appUser?.name,
        },
      });
    }
  } catch (error) {
    console.error('Error updating deletion request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
