import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const buildScanIgnores = [
  // Default ignores of eslint-config-next:
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",

  // Manager runtime/build artifacts that should never be lint-scanned.
  "data/**",
  "logs/**",
  ".tmp/**",
  ".next/cache/**",
  ".next/precache/**",
  ".next.pre-prod-switch-*/**",
  ".next.failed-build-*/**",
  "comfyui-manager-build-backups/**",
  "prisma/data/**",
  "*.log",
  "*.err.log",
  "*.trace",
  "*.heapprofile",
  "*.heapsnapshot",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores(buildScanIgnores),
]);

export default eslintConfig;
