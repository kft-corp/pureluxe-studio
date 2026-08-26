import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared packages under packages/* will be consumed here as @pureluxe/*
  transpilePackages: [],
  reactStrictMode: true,
};

export default nextConfig;
