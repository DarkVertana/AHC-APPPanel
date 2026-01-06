import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

// Local cache for API keys to reduce database queries
let localApiKeysCache: Array<{ id: string; key: string; name: string }> | null = null;
let localApiKeysCacheTime = 0;
const LOCAL_CACHE_TTL = 30 * 1000; // 30 seconds local cache

/**
 * Validates API key from request headers
 * Supports both 'X-API-Key' header and 'Authorization: Bearer <key>' format
 * Returns the API key record if valid, null otherwise
 * 
 * Optimized with local caching:
 * - Local memory cache for 30 seconds
 * - Parallel bcrypt comparisons
 * - Async lastUsed updates
 */
export async function validateApiKey(request: NextRequest): Promise<{ id: string; name: string } | null> {
  // Extract API key from headers
  const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
  let apiKey = apiKeyHeader;
  
  // Try Authorization header with Bearer format
  if (!apiKey) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader) {
      const bearerMatch = authHeader.match(/^[Bb]earer\s+(.+)$/);
      if (bearerMatch) {
        apiKey = bearerMatch[1].trim();
      }
    }
  }

  if (!apiKey || !apiKey.startsWith('ahc_live_sk_')) {
    return null;
  }

  try {
    let activeKeys: Array<{ id: string; key: string; name: string }>;
    const now = Date.now();

    // Try local cache first
    if (localApiKeysCache && (now - localApiKeysCacheTime) < LOCAL_CACHE_TTL) {
      activeKeys = localApiKeysCache;
    } 
    // Fetch from database
    else {
      const keys = await prisma.apiKey.findMany({
        where: { isActive: true },
        select: { id: true, key: true, name: true },
      });
      
      if (keys.length === 0) {
        return null;
      }
      
      activeKeys = keys;
      
      // Store in local cache
      localApiKeysCache = activeKeys;
      localApiKeysCacheTime = now;
    }

    // Parallel bcrypt comparisons for speed
    const comparisons = activeKeys.map(async (keyRecord) => {
      try {
        const isMatch = await bcrypt.compare(apiKey!, keyRecord.key);
        return isMatch ? keyRecord : null;
      } catch {
        return null;
      }
    });

    // Wait for all and find match
    const results = await Promise.all(comparisons);
    const matchedKey = results.find(result => result !== null);

    if (matchedKey) {
      // Update lastUsed asynchronously (fire and forget)
      prisma.apiKey.update({
        where: { id: matchedKey.id },
        data: { lastUsed: new Date() },
      }).catch(() => {});
      
      return {
        id: matchedKey.id,
        name: matchedKey.name,
      };
    }

    return null;
  } catch (error) {
    console.error('API key validation error:', error);
    return null;
  }
}

export function withAuth(handler: (req: NextRequest, userId: string) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const token = req.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return handler(req, payload.userId);
  };
}

export function requireAuth(req: NextRequest): { userId: string; email: string; role: string } | null {
  const token = req.cookies.get('auth-token')?.value;

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  };
}
