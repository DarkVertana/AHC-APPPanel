import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { normalizeApiUrl, buildAuthHeaders } from '@/lib/woocommerce-helpers';

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
    const [users, total, activeCount, inactiveCount] = await Promise.all([
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
    ]);

    // Batch-fetch WooCommerce customer names for users that have a customer ID but no cached name
    const usersNeedingWooName = users.filter(u => u.woocommerceCustomerId && !u.wooCustomerName);

    if (usersNeedingWooName.length > 0) {
      try {
        const settings = await prisma.settings.findFirst({
          select: {
            woocommerceApiUrl: true,
            woocommerceApiKey: true,
            woocommerceApiSecret: true,
          },
        });

        if (settings?.woocommerceApiUrl && settings?.woocommerceApiKey && settings?.woocommerceApiSecret) {
          const apiUrl = normalizeApiUrl(settings.woocommerceApiUrl);
          const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);

          const customerIds = usersNeedingWooName.map(u => u.woocommerceCustomerId!);
          const res = await fetch(
            `${apiUrl}/customers?include=${customerIds.join(',')}&per_page=${customerIds.length}`,
            { method: 'GET', headers: authHeaders }
          );

          if (res.ok) {
            const customers = await res.json();
            if (Array.isArray(customers)) {
              const nameMap = new Map<number, string>();
              for (const c of customers) {
                const name =
                  [c.billing?.first_name, c.billing?.last_name].filter(Boolean).join(' ').trim() ||
                  [c.shipping?.first_name, c.shipping?.last_name].filter(Boolean).join(' ').trim();
                if (name && c.id) nameMap.set(c.id, name);
              }

              const updatePromises: Promise<any>[] = [];
              for (const user of usersNeedingWooName) {
                const name = nameMap.get(user.woocommerceCustomerId!);
                if (name) {
                  (user as any).wooCustomerName = name;
                  updatePromises.push(
                    prisma.appUser.update({
                      where: { id: user.id },
                      data: { wooCustomerName: name },
                    })
                  );
                }
              }
              if (updatePromises.length > 0) {
                Promise.all(updatePromises).catch(err =>
                  console.error('Error caching WooCommerce customer names:', err)
                );
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching WooCommerce customer names:', err);
      }
    }

    // Format users for frontend
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name || user.displayName || user.email.split('@')[0],
      email: user.email,
      customerName: user.wooCustomerName || null,
      status: user.status,
      lastLogin: user.lastLoginAt
        ? formatTimeAgo(user.lastLoginAt)
        : 'Never',
      weight: user.weight || 'N/A',
      goal: user.goal || 'N/A',
      initialWeight: user.initialWeight || 'N/A',
      initialWeightDate: user.initialWeightDate || null,
      weightSet: user.weightSet,
      joinDate: user.createdAt.toISOString().split('T')[0],
      phone: user.phone,
      age: user.age,
      height: user.height,
      feet: user.feet,
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

