import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { normalizeApiUrl, buildAuthHeaders } from '@/lib/woocommerce-helpers';

// POST /api/app-users/sync-names - Bulk sync all WooCommerce customer names (admin only)
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.settings.findFirst({
      select: {
        woocommerceApiUrl: true,
        woocommerceApiKey: true,
        woocommerceApiSecret: true,
      },
    });

    if (!settings?.woocommerceApiUrl || !settings?.woocommerceApiKey || !settings?.woocommerceApiSecret) {
      return NextResponse.json({ error: 'WooCommerce credentials not configured' }, { status: 500 });
    }

    const apiUrl = normalizeApiUrl(settings.woocommerceApiUrl);
    const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);

    // Get all users with a customer ID but no cached name
    const users = await prisma.appUser.findMany({
      where: {
        wooCustomerName: null,
        woocommerceCustomerId: { not: null },
      },
      select: { id: true, woocommerceCustomerId: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ message: 'All users already have names cached', synced: 0, total: 0 });
    }

    let synced = 0;
    let notFound = 0;
    let errors = 0;

    // Fetch each customer individually by ID (reliable, like the single-user endpoint)
    // Process 5 at a time to avoid overwhelming WooCommerce API
    for (let i = 0; i < users.length; i += 5) {
      const batch = users.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (user) => {
          try {
            const res = await fetch(
              `${apiUrl}/customers/${user.woocommerceCustomerId}`,
              { method: 'GET', headers: authHeaders }
            );
            if (!res.ok) {
              errors++;
              return;
            }
            const customer = await res.json();
            const name =
              [customer.billing?.first_name, customer.billing?.last_name].filter(Boolean).join(' ').trim() ||
              [customer.shipping?.first_name, customer.shipping?.last_name].filter(Boolean).join(' ').trim();
            if (name) {
              await prisma.appUser.update({
                where: { id: user.id },
                data: { wooCustomerName: name },
              });
              synced++;
            } else {
              notFound++;
            }
          } catch {
            errors++;
          }
        })
      );
    }

    return NextResponse.json({
      message: 'Bulk sync complete',
      total: users.length,
      synced,
      notFound,
      errors,
    });
  } catch (error) {
    console.error('Bulk sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
