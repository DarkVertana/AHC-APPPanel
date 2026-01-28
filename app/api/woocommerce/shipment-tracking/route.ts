import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

// Cache settings for 5 minutes to reduce database queries
let cachedSettings: {
  woocommerceApiUrl: string | null;
  woocommerceApiKey: string | null;
  woocommerceApiSecret: string | null;
} | null = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get WooCommerce settings from database with caching
 */
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

/**
 * Normalize WooCommerce API URL
 */
function normalizeApiUrl(apiUrl: string): string {
  let url = apiUrl.replace(/\/$/, '');

  // For shipment tracking, we need to use wc-shipment-tracking/v3 endpoint
  // but we still need the base URL
  if (url.includes('/wp-json/wc/')) {
    // Extract base URL (everything before /wp-json/)
    url = url.replace(/\/wp-json\/wc\/v\d+.*$/, '');
  }

  return url;
}

/**
 * Build Basic Auth headers for WooCommerce API
 */
function buildAuthHeaders(apiKey: string, apiSecret: string): Record<string, string> {
  const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  return {
    'Authorization': `Basic ${authString}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

type ShipmentTracking = {
  tracking_id: string;
  tracking_provider: string;
  tracking_link: string;
  tracking_number: string;
  date_shipped: string;
  custom_tracking_provider?: string;
  custom_tracking_link?: string;
};

/**
 * WooCommerce Shipment Tracking Endpoint
 *
 * GET: Retrieves shipment tracking data for a specific order.
 *
 * Query Parameters:
 * - orderId: WooCommerce order ID (required)
 * - email: User email for verification (optional but recommended)
 *
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 *
 * Returns:
 * - List of shipment trackings for the specified order
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
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
    const orderId = url.searchParams.get('orderId');
    const email = url.searchParams.get('email');

    // Validate orderId parameter
    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId query parameter is required' },
        { status: 400 }
      );
    }

    // Get WooCommerce settings
    const settings = await getWooCommerceSettings();

    if (!settings || !settings.woocommerceApiUrl || !settings.woocommerceApiKey || !settings.woocommerceApiSecret) {
      return NextResponse.json(
        { error: 'WooCommerce API credentials are not configured. Please configure them in the admin settings.' },
        { status: 500 }
      );
    }

    // Normalize API URL and build auth headers
    const baseUrl = normalizeApiUrl(settings.woocommerceApiUrl);
    const authHeaders = buildAuthHeaders(settings.woocommerceApiKey, settings.woocommerceApiSecret);

    // If email is provided, verify the order belongs to the user
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const orderUrl = `${baseUrl}/wp-json/wc/v3/orders/${orderId}`;

      const orderResponse = await fetch(orderUrl, {
        method: 'GET',
        headers: authHeaders,
      });

      if (!orderResponse.ok) {
        if (orderResponse.status === 404) {
          return NextResponse.json(
            { error: 'Order not found' },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: 'Failed to verify order' },
          { status: orderResponse.status }
        );
      }

      const order = await orderResponse.json();
      const orderEmail = order.billing?.email?.toLowerCase().trim() || order.customer_email?.toLowerCase().trim();

      if (orderEmail !== normalizedEmail) {
        return NextResponse.json(
          { error: 'Order does not belong to this user' },
          { status: 403 }
        );
      }
    }

    // Fetch shipment tracking data from WooCommerce
    const trackingUrl = `${baseUrl}/wp-json/wc-shipment-tracking/v3/orders/${orderId}/shipment-trackings`;

    console.log(`[Shipment Tracking API] Fetching tracking for order ${orderId}`);

    const trackingResponse = await fetch(trackingUrl, {
      method: 'GET',
      headers: authHeaders,
    });

    // Check if response is JSON
    const contentType = trackingResponse.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!trackingResponse.ok) {
      const errorText = await trackingResponse.text();

      if (!isJson && errorText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          {
            error: 'WooCommerce Shipment Tracking API returned an HTML page instead of JSON',
            details: process.env.NODE_ENV === 'development'
              ? 'Please ensure the WooCommerce Shipment Tracking extension is installed and activated.'
              : undefined,
          },
          { status: 500 }
        );
      }

      if (trackingResponse.status === 404) {
        // No tracking found for this order - return empty array
        return NextResponse.json({
          success: true,
          orderId: parseInt(orderId, 10),
          count: 0,
          trackings: [],
          responseTime: `${Date.now() - startTime}ms`,
        });
      }

      console.error('WooCommerce Shipment Tracking API error:', {
        status: trackingResponse.status,
        statusText: trackingResponse.statusText,
        error: errorText.substring(0, 500),
      });

      return NextResponse.json(
        {
          error: 'Failed to fetch shipment tracking from WooCommerce',
          details: process.env.NODE_ENV === 'development'
            ? `WooCommerce API returned ${trackingResponse.status}: ${trackingResponse.statusText}`
            : undefined,
        },
        { status: trackingResponse.status || 500 }
      );
    }

    // Parse tracking data
    let trackings: ShipmentTracking[] = [];
    try {
      if (!isJson) {
        return NextResponse.json(
          {
            error: 'WooCommerce API returned an invalid response format',
            details: process.env.NODE_ENV === 'development'
              ? 'The API returned HTML or non-JSON content.'
              : undefined,
          },
          { status: 500 }
        );
      }

      const trackingData = await trackingResponse.json();
      trackings = Array.isArray(trackingData) ? trackingData : [trackingData];
    } catch (parseError) {
      console.error('Failed to parse tracking response:', parseError);
      return NextResponse.json(
        {
          error: 'Failed to parse response from WooCommerce API',
          details: process.env.NODE_ENV === 'development' && parseError instanceof Error
            ? parseError.message
            : undefined,
        },
        { status: 500 }
      );
    }

    // Transform tracking data to a cleaner format
    const transformedTrackings = trackings.map((tracking) => ({
      trackingId: tracking.tracking_id,
      trackingNumber: tracking.tracking_number,
      trackingProvider: tracking.custom_tracking_provider || tracking.tracking_provider,
      trackingLink: tracking.custom_tracking_link || tracking.tracking_link,
      dateShipped: tracking.date_shipped,
    }));

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      orderId: parseInt(orderId, 10),
      count: transformedTrackings.length,
      trackings: transformedTrackings,
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    console.error('Get shipment tracking error:', error);

    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching shipment tracking';

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined,
      },
      { status: 500 }
    );
  }
}
