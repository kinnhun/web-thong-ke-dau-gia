import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tối ưu RAM cho Production Server
  output: 'standalone',
  productionBrowserSourceMaps: false,

  // Tối ưu build time memory
  experimental: {
    optimizePackageImports: ['lucide-react', 'antd', '@ant-design/icons'],
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4321/api/:path*',
      },
    ];
  },
};

export default nextConfig;
