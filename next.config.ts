import type { NextConfig } from "next";
import path from "node:path";

const runtimeTraceExcludes = [
  "./.next/**/*",
  "./.next.pre-prod-switch-*",
  "./.next.pre-prod-switch-*/**/*",
  "./.next.failed-build-*",
  "./.next.failed-build-*/**/*",
  "./comfyui-manager-build-backups/**/*",
  "./data/**/*",
  "./logs/**/*",
  "./.tmp/**/*",
  "./prisma/data/**/*",
  "./*.log",
  "./*.err.log",
  "./*.trace",
  "./*.heapprofile",
  "./*.heapsnapshot",
  "./debug-*",
  "./tmp-debug.js",
  "./check-template.js",
  "./next.config.ts",
];

type TraceEntryPointsPluginLike = {
  constructor?: { name?: string };
  traceIgnores?: unknown;
};

function addRuntimeTraceIgnores(config: { plugins?: unknown[] }) {
  for (const plugin of config.plugins ?? []) {
    const maybeTracePlugin = plugin as TraceEntryPointsPluginLike;
    if (!Array.isArray(maybeTracePlugin.traceIgnores)) continue;

    const existing = new Set(
      maybeTracePlugin.traceIgnores.filter(
        (pattern): pattern is string => typeof pattern === "string",
      ),
    );
    for (const pattern of runtimeTraceExcludes) {
      if (!existing.has(pattern)) {
        maybeTracePlugin.traceIgnores.push(pattern);
        existing.add(pattern);
      }
    }
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
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
  webpack(config) {
    addRuntimeTraceIgnores(config);
    return config;
  },
  outputFileTracingExcludes: {
    "/*": runtimeTraceExcludes,
    "/**/*": runtimeTraceExcludes,
  },
};

export default nextConfig;
