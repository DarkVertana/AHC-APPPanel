import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow images from the same origin
    remotePatterns: [],
    // Allow all image formats
    formats: ['image/avif', 'image/webp'],
    // Disable image optimization to ensure images are served directly from public folder
    // This prevents issues with image loading in production
    unoptimized: true,
  },
};

export default nextConfig;
