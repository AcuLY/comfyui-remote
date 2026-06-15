import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

function listFiles(root: string, includeFile: (name: string) => boolean): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      return listFiles(path, includeFile);
    }

    return entry.isFile() && includeFile(entry.name) ? [path] : [];
  });
}

test("training API route handlers do not directly depend on legacy character-lora-training modules", () => {
  const routeFiles = listFiles(join(process.cwd(), "src/app/api/training"), (name) => name === "route.ts");
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

test("training services isolate legacy character-lora-training dependencies in one adapter", () => {
  const serviceFiles = listFiles(join(process.cwd(), "src/server/services/training"), (name) => name.endsWith(".ts"));
  const directLegacyImports = serviceFiles
    .filter((path) => !path.endsWith("legacy-compat-service.ts"))
    .map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ source }) => source.includes("character-lora-training"))
    .map(({ path }) => relative(process.cwd(), path));

  assert.deepEqual(
    directLegacyImports,
    [],
    "Training services should use legacy-compat-service while the remaining old implementation is migrated.",
  );
});
