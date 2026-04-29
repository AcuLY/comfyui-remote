import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: "Encountered unexpected file in NFT list",
      },
    ],
  },
  outputFileTracingExcludes: {
    "/*": [
      "./.next/**/*",
      "./data/**/*",
      "./logs/**/*",
      "./prisma/data/**/*",
      "./*.log",
      "./server*.log",
      "./debug-*",
      "./tmp-debug.js",
      "./check-template.js",
      "./next.config.ts",
    ],
  },
};

export default nextConfig;
