import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

/**
 * Cache Management API for Admin Panel
 * 
 * Note: Redis caching has been removed. This endpoint is kept for compatibility
 * but always returns that caching is disabled.
 * 
 * GET: Get cache statistics (returns disabled status)
 * DELETE: Clear cache (returns disabled status)
 * 
 * Security:
 * - Requires admin authentication
 */

// GET: Get cache statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      healthy: false,
      message: 'Caching is disabled. All requests go directly to WooCommerce API.',
      stats: {
        orders: 0,
        subscriptions: 0,
        billingAddress: 0,
        settings: 0,
        total: 0,
      },
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache statistics' },
      { status: 500 }
    );
  }
}

// DELETE: Clear cache
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Caching is disabled. No cache to clear. All requests go directly to WooCommerce API.',
      cleared: [],
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
