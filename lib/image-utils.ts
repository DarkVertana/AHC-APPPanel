/**
 * Utility functions for handling image URLs in both development and production
 */

/**
 * Gets the full URL for an image path
 * Handles both relative paths (from public folder) and absolute URLs
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
  // Next.js Image component handles relative paths from public folder correctly
  // In production, these paths will be resolved correctly by Next.js
  return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
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

