import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared packages under packages/* will be consumed here as @pureluxe/*
  transpilePackages: ["@pureluxe/db", "@pureluxe/shared"],
  reactStrictMode: true,
};

export default nextConfig;
