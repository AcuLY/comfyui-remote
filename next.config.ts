import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

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

const broadPatternIssuePaths = [
  "**/src/app/design-demos/design-demo-data.ts",
  "**/src/app/design-demos/data/fallback-images.ts",
  "**/src/app/design-demos/data/local-image-files.ts",
  "**/src/lib/actions/section.ts",
  "**/src/lib/logger.ts",
  "**/src/server/repositories/training/projects.ts",
  "**/src/server/services/censoring-service.ts",
  "**/src/server/services/comfy-patch-manager.ts",
  "**/src/server/services/image-file-service.ts",
  "**/src/server/services/image-result-service.ts",
  "**/src/server/services/project-actions-service.ts",
  "**/src/server/services/project-archive-service.ts",
  "**/src/server/services/project-deletion-service.ts",
  "**/src/server/services/project-export-service.ts",
  "**/src/server/services/run-executor.ts",
  "**/src/server/services/section-cleanup-service.ts",
] as const;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: "Encountered unexpected file in NFT list",
      },
      ...broadPatternIssuePaths.map((issuePath) => ({
        path: issuePath,
        title: /The file pattern/,
        description: /Overly broad patterns/,
      })),
      {
        path: /src[\\/]app[\\/]api[\\/]images[\\/]\[\.\.\.path\][\\/]route\.ts$/,
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
