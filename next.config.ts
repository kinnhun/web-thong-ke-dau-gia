import type { NextConfig } from "next";

const deploymentId = process.env.NEXT_DEPLOYMENT_ID ?? process.env.GITHUB_SHA;

const nextConfig: NextConfig = {
  deploymentId,


  // Tối ưu build time memory
  experimental: {
    optimizePackageImports: ['lucide-react', 'antd', '@ant-design/icons'],
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:4321/api/:path*',
      },
    ];
  },
};

export default nextConfig;
