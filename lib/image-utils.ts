/**
 * Utility functions for handling image URLs in both development and production
 */

/**
 * Gets the base URL for the application
 * Uses NEXT_PUBLIC_BASE_URL if set (useful for production deployments with custom domains or base paths)
 * Returns empty string otherwise - Next.js will handle relative paths correctly
 */
function getBaseUrl(): string {
  // Check for environment variable (useful for production deployments)
  // This allows setting an explicit base URL if needed (e.g., for CDN, reverse proxy, or base path)
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // Return empty string - Next.js will handle relative paths correctly
  // Relative paths work correctly in both development and production
  return '';
}

/**
 * Gets the full URL for an image path
 * Handles both relative paths (from public folder) and absolute URLs
 * In production, ensures proper URL resolution for static assets
 */
export function getImageUrl(imagePath: string | null | undefined): string {
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
  
  // If NEXT_PUBLIC_BASE_URL is explicitly set, use it to create absolute URL
  // This is useful for production deployments behind reverse proxies or with base paths
  const baseUrl = getBaseUrl();
  if (baseUrl) {
    return `${baseUrl}${normalizedPath}`;
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

