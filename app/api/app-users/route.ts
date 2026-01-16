import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET all app users (admin only)
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role using NextAuth
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Get query parameters for pagination and filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (status) {
      where.status = status;
    }

    // Get users with pagination and aggregate stats
    const [users, total, activeCount, inactiveCount, allFilteredUsers] = await Promise.all([
      prisma.appUser.findMany({
        where,
        orderBy: { lastLoginAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.appUser.count({ where }),
      prisma.appUser.count({ 
        where: { ...where, status: 'Active' } 
      }),
      prisma.appUser.count({ 
        where: { ...where, status: 'Inactive' } 
      }),
      // Get all filtered users for accurate average calculation
      prisma.appUser.findMany({
        where,
        select: { tasksToday: true },
      }),
    ]);

    // Format users for frontend
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name || user.displayName || user.email.split('@')[0],
      email: user.email,
      status: user.status,
      lastLogin: user.lastLoginAt 
        ? formatTimeAgo(user.lastLoginAt) 
        : 'Never',
      weight: user.weight || 'N/A',
      goal: user.goal || 'N/A',
      initialWeight: user.initialWeight || 'N/A',
      weightSet: user.weightSet,
      tasksToday: user.tasksToday,
      joinDate: user.createdAt.toISOString().split('T')[0],
      phone: user.phone,
      age: user.age,
      height: user.height,
      feet: user.feet,
      totalWorkouts: user.totalWorkouts,
      totalCalories: user.totalCalories,
      streak: user.streak,
      woocommerceCustomerId: user.woocommerceCustomerId,
    }));

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        active: activeCount,
        inactive: inactiveCount,
        avgTasksToday: allFilteredUsers.length > 0
          ? (allFilteredUsers.reduce((sum, u) => sum + u.tasksToday, 0) / allFilteredUsers.length).toFixed(1)
          : '0.0',
      },
    });
  } catch (error) {
    console.error('Get app users error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching users' },
      { status: 500 }
    );
  }
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
}

