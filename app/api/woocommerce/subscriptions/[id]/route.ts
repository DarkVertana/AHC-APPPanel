import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { normalizeApiUrl, buildAuthHeaders, getCustomerByEmailCached } from '@/lib/woocommerce-helpers';

// Cache settings for 5 minutes to reduce database queries
let cachedSettings: any = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get Single WooCommerce Subscription Details Endpoint
 *
 * Returns FULL subscription details including billing, shipping, and payment info.
 * This is used for the Subscription Details page in the Flutter app.
 *
 * Path Parameters:
 * - id: Subscription ID (required)
 *
 * Query Parameters:
 * - email: User email (required) - for ownership verification
 *
 * Security:
 * - Requires valid API key in request headers
 * - Verifies subscription belongs to the requesting user's email
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    // Await params (Next.js 15+ requires params to be awaited)
    const { id } = await params;

    // Validate API key
    const apiKey = await validateApiKey(request);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    // Validate email parameter
    if (!email) {
      return NextResponse.json(
        { error: 'Email query parameter is required' },
        { status: 400 }
      );
    }

    // Validate subscription ID
    const subscriptionId = id;
    const subscriptionIdNum = parseInt(subscriptionId, 10);

    if (isNaN(subscriptionIdNum)) {
      return NextResponse.json(
        { error: 'Invalid subscription ID. Must be a valid number.' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Helper function to get WooCommerce settings
    async function getWooCommerceSettings() {
      const now = Date.now();
      if (cachedSettings && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
        return cachedSettings;
      }

      const settings = await prisma.settings.findUnique({
        where: { id: 'settings' },
        select: {
          woocommerceApiUrl: true,
          woocommerceApiKey: true,
          woocommerceApiSecret: true,
        },
      });

      if (settings) {
        cachedSettings = settings;
        settingsCacheTime = now;
      }

      return settings;
    }

    // Get WooCommerce settings
    const settings = await getWooCommerceSettings();

    if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
      return NextResponse.json(
        { error: 'WooCommerce API credentials are not configured. Please configure them in the admin settings.' },
        { status: 500 }
      );
    }

    // Normalize API URL using shared helper
    const apiUrl = normalizeApiUrl(settings.woocommerceApiUrl);

    // Build auth headers using shared helper
    const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);

    // Fetch subscription details from WooCommerce
    let subscriptionUrl = `${apiUrl}/subscriptions/${subscriptionIdNum}`;
    let subscriptionResponse = await fetch(subscriptionUrl, {
      method: 'GET',
      headers: authHeaders,
    });

    // If v3 endpoint doesn't work, try v1 endpoint
    if (!subscriptionResponse.ok && subscriptionResponse.status === 404) {
      const apiUrlV1 = apiUrl.replace('/wc/v3', '/wc/v1');
      subscriptionUrl = `${apiUrlV1}/subscriptions/${subscriptionIdNum}`;
      subscriptionResponse = await fetch(subscriptionUrl, {
        method: 'GET',
        headers: authHeaders,
      });
    }

    // Check if response is JSON
    const contentType = subscriptionResponse.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!subscriptionResponse.ok) {
      if (subscriptionResponse.status === 404) {
        return NextResponse.json(
          { error: 'Subscription not found' },
          { status: 404 }
        );
      }

      const errorText = await subscriptionResponse.text();
      console.error('WooCommerce subscription fetch error:', {
        status: subscriptionResponse.status,
        error: errorText.substring(0, 500),
      });

      return NextResponse.json(
        {
          error: 'Failed to fetch subscription from WooCommerce',
          details: process.env.NODE_ENV === 'development'
            ? `WooCommerce API returned ${subscriptionResponse.status}`
            : undefined,
        },
        { status: 500 }
      );
    }

    if (!isJson) {
      return NextResponse.json(
        { error: 'WooCommerce API returned invalid response format' },
        { status: 500 }
      );
    }

    // Parse subscription data
    const subscription = await subscriptionResponse.json();

    // Verify subscription belongs to the user
    const subscriptionEmail = (
      subscription.billing?.email?.toLowerCase().trim() ||
      subscription.customer_email?.toLowerCase().trim() ||
      ''
    );

    if (subscriptionEmail !== normalizedEmail) {
      return NextResponse.json(
        { error: 'Subscription does not belong to this user' },
        { status: 403 }
      );
    }

    // Transform line_items to required format
    const transformedLineItems = (subscription.line_items || []).map((item: any) => ({
      name: item.name || 'Unknown Product',
      quantity: item.quantity || 1,
      total: item.total || '0',
      image: item.image || { src: null },
    }));

    // Return FULL subscription details per API_PAYLOAD_REQUIREMENTS.md (Section 4)
    const subscriptionDetails = {
      id: subscription.id,
      number: subscription.number || `SUB-${subscription.id}`,
      status: subscription.status || 'unknown',
      date_created: subscription.date_created || subscription.date_created_gmt || null,
      next_payment_date: subscription.next_payment_date || subscription.next_payment_date_gmt || null,
      last_order_date_created: subscription.last_order_date_created || null,
      currency: subscription.currency || 'USD',
      total: subscription.total || '0',
      shipping_total: subscription.shipping_total || '0',
      payment_method: subscription.payment_method || null,
      payment_method_title: subscription.payment_method_title || null,
      billing: subscription.billing ? {
        first_name: subscription.billing.first_name || '',
        last_name: subscription.billing.last_name || '',
        email: subscription.billing.email || '',
        phone: subscription.billing.phone || '',
        address_1: subscription.billing.address_1 || '',
        address_2: subscription.billing.address_2 || '',
        city: subscription.billing.city || '',
        state: subscription.billing.state || '',
        postcode: subscription.billing.postcode || '',
        country: subscription.billing.country || '',
      } : null,
      shipping: subscription.shipping ? {
        first_name: subscription.shipping.first_name || '',
        last_name: subscription.shipping.last_name || '',
        address_1: subscription.shipping.address_1 || '',
        address_2: subscription.shipping.address_2 || '',
        city: subscription.shipping.city || '',
        state: subscription.shipping.state || '',
        postcode: subscription.shipping.postcode || '',
        country: subscription.shipping.country || '',
      } : null,
      line_items: transformedLineItems,
    };

    const responseTime = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      subscription: subscriptionDetails,
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    console.error('Get WooCommerce subscription detail error:', error);

    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching subscription from WooCommerce';

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}
