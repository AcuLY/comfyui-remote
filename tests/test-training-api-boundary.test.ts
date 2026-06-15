import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

function listRouteFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      return listRouteFiles(path);
    }

    return entry.isFile() && entry.name === "route.ts" ? [path] : [];
  });
}

test("training API route handlers do not directly depend on legacy character-lora-training modules", () => {
  const routeFiles = listRouteFiles(join(process.cwd(), "src/app/api/training"));
  const directLegacyImports = routeFiles
    .map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ source }) => source.includes("character-lora-training"))
    .map(({ path }) => relative(process.cwd(), path));

  assert.deepEqual(
    directLegacyImports,
    [],
    "Route handlers should call Training* services/repositories instead of importing legacy character-lora-training modules directly.",
  );
});
