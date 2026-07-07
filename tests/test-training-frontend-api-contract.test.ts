import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";

const TRAINING_ROUTE_METHODS = new Set(["GET", "POST", "PATCH", "DELETE", "PUT"]);
const TRAINING_UI_FILES = [
  "src/features/training/ui/training-generation-compose-page.tsx",
  "src/features/training/ui/training-project-pages.tsx",
  "src/features/training/ui/training-project-results-page.tsx",
  "src/features/training/ui/training-project-section-detail-page.tsx",
  "src/features/training/ui/training-projects-page.tsx",
  "src/features/training/ui/training-resource-pages.tsx",
  "src/features/training/ui/training-run-detail-page.tsx",
  "src/features/training/ui/training-runs-page.tsx",
];
const retiredTrainingApiSlug = ["character", "lora", "training"].join("-");
const retiredTrainingPascalPrefix = ["Character", "Lora"].join("");
const retiredTrainingCamelPrefix = ["character", "Lora"].join("");
const retiredProviderPrefix = ["Legacy", "Training"].join("");
const retiredFrontendTokens = [
  retiredTrainingApiSlug,
  retiredTrainingPascalPrefix,
  retiredTrainingCamelPrefix,
  retiredProviderPrefix,
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

type ApiPathReference = {
  file: string;
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

function normalizeApiPath(raw: string) {
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

function collectManifestOperations(value: unknown, operations = new Set<RouteOperation>()) {
  if (!value || typeof value !== "object") return operations;
  if (
    "method" in value
    && typeof value.method === "string"
    && "path" in value
    && typeof value.path === "string"
  ) {
    operations.add({
      method: value.method,
      path: value.path.split("?")[0] ?? value.path,
    });
  }

  for (const child of Object.values(value)) {
    collectManifestOperations(child, operations);
  }

  return operations;
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

function collectTrainingApiPathReferences(): ApiPathReference[] {
  return TRAINING_UI_FILES.flatMap((file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    return [...source.matchAll(/([`'"])(\/api\/training[^`'"]*)\1/g)]
      .map((match) => ({
        file,
        path: normalizeApiPath(match[2]),
        raw: match[2],
      }));
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

test("training manifest advertises every production training UI HTTP operation to agents", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const manifestOperations = [...collectManifestOperations(payload.data)];
  const fetchOperations = collectTrainingFetchOperations();
  const missingOperations = fetchOperations.filter((fetchOperation) => !manifestOperations.some((manifestOperation) => (
    manifestOperation.method === fetchOperation.method
    && routeMatches(fetchOperation.path, manifestOperation.path)
  )));

  assert.ok(
    manifestOperations.length >= fetchOperations.length,
    "agent manifest should enumerate at least the production UI's training HTTP surface",
  );
  assert.deepEqual(
    missingOperations,
    [],
    "Every production training UI HTTP operation should be advertised by GET /api/training for agent orchestration.",
  );
});

test("training manifest advertises every implemented production training route operation to agents", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const manifestOperations = [...collectManifestOperations(payload.data)];
  const routeOperations = await listRouteOperations();
  const missingOperations = routeOperations.filter((routeOperation) => !manifestOperations.some((manifestOperation) => (
    manifestOperation.method === routeOperation.method
    && routeMatches(routeOperation.path, manifestOperation.path)
  )));

  assert.deepEqual(
    missingOperations,
    [],
    "Every implemented /api/training route operation should be advertised by GET /api/training so agents can discover the full HTTP surface.",
  );
});

test("training manifest advertises every production training UI API path reference", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const manifestPaths = [...collectManifestOperations(payload.data)].map((operation) => operation.path);
  const apiPathReferences = collectTrainingApiPathReferences();
  const missingPaths = apiPathReferences.filter((apiPathReference) => !manifestPaths.some((manifestPath) =>
    routeMatches(apiPathReference.path, manifestPath)
  ));

  assert.ok(
    apiPathReferences.length > collectTrainingFetchOperations().length,
    "path reference scan should catch ternary and variable API targets beyond direct fetch literals",
  );
  assert.deepEqual(
    missingPaths,
    [],
    "Every production training UI API path reference should be advertised by GET /api/training for agent discovery.",
  );
});

test("training frontend API contract does not reference retired training API or DTO names", () => {
  const hits = TRAINING_UI_FILES.flatMap((file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    return retiredFrontendTokens
      .filter((token) => source.includes(token))
      .map((token) => ({ file, token }));
  });

  assert.deepEqual(
    hits,
    [],
    "Production training UI should call the Training v2 HTTP surface directly, without retired API paths or DTO names.",
  );
});
