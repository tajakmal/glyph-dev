import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Disable canvas for PDF.js (not needed in browser)
    config.resolve.alias.canvas = false;
    return config;
  },
  // Silence Turbopack warning about webpack config
  turbopack: {},
};

export default nextConfig;
