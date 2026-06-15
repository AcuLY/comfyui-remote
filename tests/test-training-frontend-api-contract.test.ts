import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";

const TRAINING_ROUTE_METHODS = new Set(["GET", "POST", "PATCH", "DELETE", "PUT"]);
const TRAINING_UI_FILES = [
  "src/features/training/ui/training-project-pages.tsx",
  "src/features/training/ui/training-projects-page.tsx",
  "src/features/training/ui/training-resource-pages.tsx",
  "src/features/training/ui/training-run-detail-page.tsx",
  "src/features/training/ui/training-runs-page.tsx",
];

type RouteOperation = {
  method: string;
  path: string;
};

type FetchOperation = {
  file: string;
  method: string;
  path: string;
  raw: string;
};

async function listRouteFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) return listRouteFiles(entryPath);
    return entry.name === "route.ts" ? [entryPath] : [];
  }));
  return nested.flat();
}

function routeFileToTrainingApiPath(filePath: string) {
  const root = join(process.cwd(), "src", "app", "api", "training");
  const routeRelativePath = relative(root, filePath);
  if (routeRelativePath === "route.ts") return "/api/training";

  const routePath = routeRelativePath.replace(/\/route\.ts$/, "");
  const segments = routePath.split("/").map((segment) => {
    const dynamic = segment.match(/^\[(.+)\]$/);
    return dynamic ? `:${dynamic[1]}` : segment;
  });
  return `/api/training/${segments.join("/")}`;
}

function collectRouteExportedMethods(source: string) {
  const methods = new Set<string>();

  for (const match of source.matchAll(/^export async function (GET|POST|PATCH|DELETE|PUT)/gm)) {
    methods.add(match[1]);
  }

  for (const match of source.matchAll(/^export \{([^}]+)\} from /gm)) {
    for (const item of match[1].split(",")) {
      const exportedName = item.trim().split(/\s+as\s+/i).pop()?.trim();
      if (exportedName && TRAINING_ROUTE_METHODS.has(exportedName)) {
        methods.add(exportedName);
      }
    }
  }

  return [...methods];
}

async function listRouteOperations(): Promise<RouteOperation[]> {
  const routeFiles = await listRouteFiles(join(process.cwd(), "src", "app", "api", "training"));
  return routeFiles.flatMap((filePath) => {
    const routePath = routeFileToTrainingApiPath(filePath);
    const source = readFileSync(filePath, "utf8");
    return collectRouteExportedMethods(source).map((method) => ({ method, path: routePath }));
  });
}

function normalizeFetchPath(raw: string) {
  return raw.replace(/\$\{[^}]+}/g, ":param").split("?")[0] ?? raw;
}

function routeMatches(fetchPath: string, routePath: string) {
  const fetchSegments = fetchPath.split("/").filter(Boolean);
  const routeSegments = routePath.split("/").filter(Boolean);
  return (
    fetchSegments.length === routeSegments.length
    && routeSegments.every((segment, index) => (
      segment.startsWith(":")
      || fetchSegments[index] === ":param"
      || fetchSegments[index] === segment
    ))
  );
}

function collectTrainingFetchOperations(): FetchOperation[] {
  return TRAINING_UI_FILES.flatMap((file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    return [...source.matchAll(/fetch\(\s*([`'"])(\/api\/training[^`'"]*)\1([\s\S]*?)(?:\n\s*}\);|\);)/g)]
      .map((match) => {
        const raw = match[2];
        const method = match[3]?.match(/method:\s*"(GET|POST|PATCH|DELETE|PUT)"/)?.[1] ?? "GET";
        return {
          file,
          method,
          path: normalizeFetchPath(raw),
          raw,
        };
      });
  });
}

test("training frontend fetch calls target implemented training HTTP route operations", async () => {
  const routeOperations = await listRouteOperations();
  const fetchOperations = collectTrainingFetchOperations();
  const missingOperations = fetchOperations.filter((fetchOperation) => !routeOperations.some((routeOperation) => (
    routeOperation.method === fetchOperation.method
    && routeMatches(fetchOperation.path, routeOperation.path)
  )));

  assert.ok(
    fetchOperations.length >= 50,
    "frontend contract test should keep scanning the production training UI fetch surface",
  );
  assert.deepEqual(
    missingOperations,
    [],
    "Every /api/training fetch in the production training UI should have a matching route handler and HTTP method.",
  );
});
