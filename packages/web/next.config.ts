import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_AGENT_URL:
      process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:3001",
  },
};

export default nextConfig;
