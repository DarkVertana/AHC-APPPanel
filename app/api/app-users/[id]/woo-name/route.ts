import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { normalizeApiUrl, buildAuthHeaders } from '@/lib/woocommerce-helpers';

// GET WooCommerce customer name for a user (admin only)
// Returns debug info about the lookup process
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const debug: string[] = [];

  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Step 1: Find the user
    const user = await prisma.appUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        woocommerceCustomerId: true,
        wooCustomerName: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    debug.push(`User found: ${user.email}`);
    debug.push(`DB name: ${user.name || '(null)'}`);
    debug.push(`DB displayName: ${user.displayName || '(null)'}`);
    debug.push(`Cached woocommerceCustomerId: ${user.woocommerceCustomerId ?? '(null)'}`);
    debug.push(`Cached wooCustomerName: ${user.wooCustomerName || '(null)'}`);

    // If already cached, return it
    if (user.wooCustomerName) {
      debug.push('Name already cached, returning cached value');
      return NextResponse.json({
        customerName: user.wooCustomerName,
        source: 'cache',
        debug,
      });
    }

    // Step 2: Get WooCommerce settings
    const settings = await prisma.settings.findFirst({
      select: {
        woocommerceApiUrl: true,
        woocommerceApiKey: true,
        woocommerceApiSecret: true,
      },
    });

    if (!settings?.woocommerceApiUrl || !settings?.woocommerceApiKey || !settings?.woocommerceApiSecret) {
      debug.push('ERROR: WooCommerce API credentials not configured in settings');
      return NextResponse.json({ customerName: null, source: 'error', debug });
    }

    const apiUrl = normalizeApiUrl(settings.woocommerceApiUrl);
    const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);
    debug.push(`WooCommerce API URL: ${apiUrl}`);

    let customer: any = null;

    // Step 3a: Try fetching by cached customer ID
    if (user.woocommerceCustomerId) {
      debug.push(`Fetching customer by cached ID: ${user.woocommerceCustomerId}`);
      try {
        const res = await fetch(`${apiUrl}/customers/${user.woocommerceCustomerId}`, {
          method: 'GET',
          headers: authHeaders,
        });
        debug.push(`Customer by ID response: ${res.status} ${res.statusText}`);
        if (res.ok) {
          customer = await res.json();
          debug.push(`Customer by ID returned: id=${customer.id}, first_name="${customer.first_name}", last_name="${customer.last_name}"`);
        }
      } catch (err) {
        debug.push(`Customer by ID fetch error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Step 3b: Fallback to email lookup
    if (!customer) {
      const normalizedEmail = user.email.toLowerCase().trim();
      debug.push(`Fetching customer by email: ${normalizedEmail}`);
      try {
        const url = `${apiUrl}/customers?email=${encodeURIComponent(normalizedEmail)}&role=all&per_page=1`;
        debug.push(`Request URL: ${url}`);
        const res = await fetch(url, { method: 'GET', headers: authHeaders });
        debug.push(`Customer by email response: ${res.status} ${res.statusText}`);

        if (res.ok) {
          const customers = await res.json();
          debug.push(`Customers returned: ${Array.isArray(customers) ? customers.length : 'not an array'}`);
          if (Array.isArray(customers) && customers.length > 0) {
            customer = customers[0];
            debug.push(`Found customer: id=${customer.id}, first_name="${customer.first_name}", last_name="${customer.last_name}"`);

            // Cache the customer ID
            await prisma.appUser.update({
              where: { id: user.id },
              data: { woocommerceCustomerId: customer.id },
            });
            debug.push(`Cached woocommerceCustomerId: ${customer.id}`);
          } else {
            debug.push('No WooCommerce customer found for this email');
          }
        } else {
          const body = await res.text();
          debug.push(`Error response body: ${body.substring(0, 500)}`);
        }
      } catch (err) {
        debug.push(`Customer by email fetch error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!customer) {
      debug.push('No customer found via any method');
      return NextResponse.json({ customerName: null, source: 'not_found', debug });
    }

    // Step 4: Extract name from billing, then shipping
    debug.push(`Billing: first_name="${customer.billing?.first_name || ''}", last_name="${customer.billing?.last_name || ''}"`);
    debug.push(`Shipping: first_name="${customer.shipping?.first_name || ''}", last_name="${customer.shipping?.last_name || ''}"`);

    const billingName = [customer.billing?.first_name, customer.billing?.last_name].filter(Boolean).join(' ').trim();
    const shippingName = [customer.shipping?.first_name, customer.shipping?.last_name].filter(Boolean).join(' ').trim();
    const fullName = billingName || shippingName;

    debug.push(`Billing name: "${billingName}"`);
    debug.push(`Shipping name: "${shippingName}"`);
    debug.push(`Final name: "${fullName}"`);

    // Step 5: Cache the name if found
    if (fullName) {
      await prisma.appUser.update({
        where: { id: user.id },
        data: { wooCustomerName: fullName },
      });
      debug.push(`Cached wooCustomerName: "${fullName}"`);
    } else {
      debug.push('No name found in billing or shipping details');
    }

    return NextResponse.json({
      customerName: fullName || null,
      source: fullName ? 'woocommerce' : 'empty',
      debug,
    });
  } catch (error) {
    debug.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ customerName: null, source: 'error', debug }, { status: 500 });
  }
}
