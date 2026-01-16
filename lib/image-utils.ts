/**
 * Utility functions for handling image URLs in both development and production
 */

/**
 * Gets the base URL for the application
 * Uses NEXT_PUBLIC_BASE_URL if set (useful for production deployments with custom domains or base paths)
 * For server-side use, can extract from request URL
 * Returns empty string otherwise - Next.js will handle relative paths correctly
 */
function getBaseUrl(requestUrl?: string): string {
  // Check for environment variable first (useful for production deployments)
  // This allows setting an explicit base URL if needed (e.g., for CDN, reverse proxy, or base path)
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // If request URL is provided (server-side), extract origin from it
  if (requestUrl) {
    try {
      const url = new URL(requestUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      // Invalid URL, continue
    }
  }
  
  // Return empty string - Next.js will handle relative paths correctly
  // Relative paths work correctly in both development and production
  return '';
}

/**
 * Gets the full URL for an image path
 * Handles both relative paths (from public folder) and absolute URLs
 * In production, ensures proper URL resolution for static assets
 * 
 * @param imagePath - The image path (relative or absolute)
 * @param requestUrl - Optional request URL for server-side absolute URL generation
 * @param forceAbsolute - If true, always return absolute URL (useful for mobile API)
 */
export function getImageUrl(
  imagePath: string | null | undefined, 
  requestUrl?: string,
  forceAbsolute: boolean = false
): string {
  if (!imagePath) {
    return '';
  }

  // If it's already an absolute URL (starts with http:// or https://), return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // If it's a data URL (base64), return as is
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }

  // For relative paths, ensure they start with /
  // Next.js serves files from the public folder at the root
  // The path should be relative to the public folder (e.g., /blog/image/file.jpg)
  let normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  // Remove any double slashes (except at the start)
  normalizedPath = normalizedPath.replace(/([^:]\/)\/+/g, '$1');
  
  // Get base URL (from env var or request URL)
  const baseUrl = getBaseUrl(requestUrl);
  
  // If forceAbsolute is true (for mobile API) or baseUrl is set, return absolute URL
  if (forceAbsolute || baseUrl) {
    // If we have a base URL, use it
    if (baseUrl) {
      return `${baseUrl}${normalizedPath}`;
    }
    // If forceAbsolute but no baseUrl, try to get from request or use localhost
    if (forceAbsolute && requestUrl) {
      try {
        const url = new URL(requestUrl);
        return `${url.protocol}//${url.host}${normalizedPath}`;
      } catch {
        // Fallback to relative path if URL parsing fails
        return normalizedPath;
      }
    }
  }
  
  // Return the normalized relative path
  // Next.js Image component with unoptimized=true will serve files directly from public folder
  // This works correctly in both development and production
  return normalizedPath;
}

/**
 * Checks if an image path is valid
 */
export function isValidImagePath(imagePath: string | null | undefined): boolean {
  if (!imagePath) {
    return false;
  }

  // Allow absolute URLs, data URLs, and relative paths
  return (
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('data:') ||
    imagePath.startsWith('/')
  );
}

