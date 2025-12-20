import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow images from the same origin
    remotePatterns: [],
    // Allow all image formats
    formats: ['image/avif', 'image/webp'],
    // Disable image optimization if causing issues in production
    // Set to true if you want to enable Next.js image optimization
    unoptimized: process.env.NODE_ENV === 'production' ? false : false,
  },
};

export default nextConfig;
