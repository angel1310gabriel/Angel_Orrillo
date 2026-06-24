import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  reactProductionProfiling: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "21.0.16.4", "0.0.0.0", "21.0.17.193"],
  async headers() {
    return [
      {
        source: '/:path((?!_next/static|api/).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
