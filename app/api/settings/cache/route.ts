import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { 
  deleteCacheByPattern, 
  getCacheStats, 
  pingRedis,
  CACHE_KEYS 
} from '@/lib/redis';

/**
 * Cache Management API for Admin Panel
 * 
 * GET: Get cache statistics
 * DELETE: Clear cache (all or by type)
 * 
 * Security:
 * - Requires admin authentication
 */

// GET: Get cache statistics and health
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Redis health
    const isHealthy = await pingRedis();
    
    // Get cache statistics
    const stats = await getCacheStats();

    return NextResponse.json({
      success: true,
      healthy: isHealthy,
      stats: {
        orders: stats.ordersKeys,
        subscriptions: stats.subscriptionsKeys,
        billingAddress: stats.billingAddressKeys,
        settings: stats.settingsKeys,
        total: stats.ordersKeys + stats.subscriptionsKeys + stats.billingAddressKeys + stats.settingsKeys,
      },
      ttl: {
        orders: '3 minutes',
        subscriptions: '5 minutes',
        billingAddress: '10 minutes',
        settings: '10 minutes',
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

    // Get cache type from query params
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'all', 'orders', 'subscriptions', 'billing_address', 'settings'

    let cleared: string[] = [];
    let errors: string[] = [];

    // Clear based on type
    if (!type || type === 'all') {
      // Clear all caches
      const results = await Promise.all([
        deleteCacheByPattern(CACHE_KEYS.ORDERS),
        deleteCacheByPattern(CACHE_KEYS.SUBSCRIPTIONS),
        deleteCacheByPattern(CACHE_KEYS.BILLING_ADDRESS),
        deleteCacheByPattern(CACHE_KEYS.SETTINGS),
        deleteCacheByPattern(CACHE_KEYS.API_KEYS),
      ]);
      
      if (results[0]) cleared.push('orders');
      else errors.push('orders');
      
      if (results[1]) cleared.push('subscriptions');
      else errors.push('subscriptions');
      
      if (results[2]) cleared.push('billing_address');
      else errors.push('billing_address');
      
      if (results[3]) cleared.push('settings');
      else errors.push('settings');
      
      if (results[4]) cleared.push('api_keys');
      else errors.push('api_keys');
    } else {
      // Clear specific cache type
      let pattern: string;
      switch (type) {
        case 'orders':
          pattern = CACHE_KEYS.ORDERS;
          break;
        case 'subscriptions':
          pattern = CACHE_KEYS.SUBSCRIPTIONS;
          break;
        case 'billing_address':
          pattern = CACHE_KEYS.BILLING_ADDRESS;
          break;
        case 'settings':
          pattern = CACHE_KEYS.SETTINGS;
          break;
        case 'api_keys':
          pattern = CACHE_KEYS.API_KEYS;
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid cache type. Valid types: all, orders, subscriptions, billing_address, settings, api_keys' },
            { status: 400 }
          );
      }

      const result = await deleteCacheByPattern(pattern);
      if (result) {
        cleared.push(type);
      } else {
        errors.push(type);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: errors.length === 0 
        ? `Cache cleared successfully: ${cleared.join(', ')}`
        : `Partial success. Cleared: ${cleared.join(', ')}. Errors: ${errors.join(', ')}`,
      cleared,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
