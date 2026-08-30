import path from "node:path";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Monorepo env lives at repo root (.env.local); Next defaults to apps/studio only.
// forceReload: Next.js may cache an empty load from the app dir first (see next.js#92040).
loadEnvConfig(path.join(process.cwd(), "../.."), undefined, undefined, true);

const nextConfig: NextConfig = {
  // Shared packages under packages/* will be consumed here as @pureluxe/*
  transpilePackages: ["@pureluxe/auth", "@pureluxe/db", "@pureluxe/shared"],
  reactStrictMode: true,
  images: {
    localPatterns: [
      {
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
