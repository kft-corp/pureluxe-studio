import path from "node:path";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Monorepo env lives at repo root (.env.local); Next defaults to apps/studio only.
// forceReload: Next.js may cache an empty load from the app dir first (see next.js#92040).
loadEnvConfig(path.join(process.cwd(), "../.."), undefined, undefined, true);

const nextConfig: NextConfig = {
  // PDFKit reads its font metrics from disk. Bundling it breaks that in production.
  serverExternalPackages: ["pdfkit"],
  // pnpm keeps pdfkit under the repo root node_modules/.pnpm. The default
  // trace root is apps/studio, so those metric files are left out of the deploy.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  outputFileTracingIncludes: {
    "/api/trip-builder/trips/[id]/options/generate": [
      "./assets/fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*",
    ],
  },
  // Turbopack's on-disk dev cache can keep serving a route tree that omits
  // existing route handlers. Those requests come back as an HTML 404, which
  // the Studio client then fails to parse as JSON. Compile from source on
  // each `next dev` start instead.
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  // Shared packages under packages/* will be consumed here as @pureluxe/*
  transpilePackages: [
    "@pureluxe/ai",
    "@pureluxe/auth",
    "@pureluxe/db",
    "@pureluxe/rates",
    "@pureluxe/shared",
  ],
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
