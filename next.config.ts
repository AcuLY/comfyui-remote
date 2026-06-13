import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, ".."),
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: "Encountered unexpected file in NFT list",
      },
      {
        path: "**/src/app/design-demos/design-demo-data.ts",
        title: /The file pattern/,
        description: /Overly broad patterns/,
      },
      {
        path: "**/src/server/services/image-result-service.ts",
        title: /The file pattern/,
        description: /Overly broad patterns/,
      },
      {
        path: "**/src/server/services/image-file-service.ts",
        title: /The file pattern/,
        description: /Overly broad patterns/,
      },
      {
        path: "**/src/server/services/comfy-patch-manager.ts",
        title: /The file pattern/,
        description: /Overly broad patterns/,
      },
      {
        path: /src[\\/]app[\\/]api[\\/]images[\\/]\[\.\.\.path\][\\/]route\.ts$/,
        title: /The file pattern/,
        description: /Overly broad patterns/,
      },
      {
        path: "**/src/lib/logger.ts",
        title: /The file pattern/,
        description: /Overly broad patterns/,
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
