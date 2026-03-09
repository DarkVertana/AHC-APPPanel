import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET user engagement analytics for dashboard (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const totalUsers = await prisma.appUser.count();

    // Count users who have at least 1 medication log
    const usersWithMedicineLogs = await prisma.medicationLog.groupBy({
      by: ['appUserId'],
    });
    const usersWithAtLeastOneMedicine = usersWithMedicineLogs.length;
    const usersWithNoMedicine = totalUsers - usersWithAtLeastOneMedicine;

    // Total medicine shots logged
    const totalMedicineShots = await prisma.medicationLog.count();

    // Count users who have more than 1 weight log (first log is the initial one, so >1 means at least 1 new additional log)
    const weightLogCounts = await prisma.weightLog.groupBy({
      by: ['appUserId'],
      _count: { id: true },
    });
    const usersWithAdditionalWeightLog = weightLogCounts.filter(
      (u) => u._count.id > 1
    ).length;
    const usersWithWeightLogsTotal = weightLogCounts.length;
    const usersWithNoAdditionalWeightLog = totalUsers - usersWithAdditionalWeightLog;

    // Total weight logs (excluding first per user)
    const totalWeightLogs = await prisma.weightLog.count();
    const additionalWeightLogs = totalWeightLogs - usersWithWeightLogsTotal;

    return NextResponse.json({
      totalUsers,
      medicine: {
        usersWithAtLeastOne: usersWithAtLeastOneMedicine,
        usersWithNone: usersWithNoMedicine,
        totalShots: totalMedicineShots,
      },
      weight: {
        usersWithAdditionalLog: usersWithAdditionalWeightLog,
        usersWithNoAdditionalLog: usersWithNoAdditionalWeightLog,
        totalAdditionalLogs: Math.max(0, additionalWeightLogs),
      },
    });
  } catch (error) {
    console.error('Engagement analytics error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching engagement analytics' },
      { status: 500 }
    );
  }
}
