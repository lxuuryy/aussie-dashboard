import type { NextConfig } from 'next';
import type { Configuration } from 'webpack'; 

// next.config.js
/** @type {import('next').NextConfig} */
interface WebpackOptions {
  isServer: boolean;
}

interface NextConfigWithWebpack extends NextConfig {
  webpack: (config: Configuration, options: WebpackOptions) => Configuration;
}

const nextConfig: NextConfigWithWebpack = {
  webpack: (config: Configuration, { isServer }: WebpackOptions): Configuration => {
    if (!isServer) {
      // Don't include canvas on client side
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig