import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(file: string) {
  return readFileSync(join(rootDir, file), "utf8");
}

test("scene description preset route declares dynamic locally instead of re-exporting it", () => {
  const source = readSource("src/app/api/training/scene-description/presets/route.ts");

  assert.match(
    source,
    /export const dynamic = "force-dynamic";/,
    "route segment config should be statically parseable by Next",
  );
  assert.doesNotMatch(
    source,
    /export \{[^}]*\bdynamic\b[^}]*\} from /,
    "route segment config must not be re-exported",
  );
});

test("root layout uses local fonts only for offline production builds", () => {
  const source = readSource("src/app/layout.tsx");

  assert.doesNotMatch(source, /next\/font\/google/, "production build should not fetch Google Fonts");
  assert.doesNotMatch(source, /\bGeist\(/, "layout should not instantiate a Google font loader");
});

test("global document sizing does not depend on browser default body margins", () => {
  const source = readSource("src/app/globals.css");

  assert.match(
    source,
    /html\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*100%;[\s\S]*?min-height:\s*100%;/,
    "html should explicitly fill the viewport so standalone surfaces stay flush in Safari",
  );
  assert.match(
    source,
    /body\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*100%;[\s\S]*?min-height:\s*100%;[\s\S]*?margin:\s*0;/,
    "body should not rely on preflight defaults for route-level shell alignment",
  );
});
