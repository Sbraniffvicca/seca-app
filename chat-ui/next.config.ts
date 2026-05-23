import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const authApiUrl = process.env.AUTH_API_URL || "http://localhost:3001";
    const chatApiUrl = process.env.CHAT_API_URL || "http://localhost:3002";

    return [
      {
        source: "/api/auth/:path*",
        destination: `${authApiUrl}/auth/:path*`,
      },
      {
        source: "/api/chat/:path*",
        destination: `${chatApiUrl}/chat/:path*`,
      },
    ];
  },
};

export default nextConfig;
