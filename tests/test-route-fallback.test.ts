import test from "node:test";
import assert from "node:assert/strict";

import { resolveRouteFallback } from "../src/lib/route-fallback";

test("missing preset group falls back to the preset manager", () => {
  assert.equal(resolveRouteFallback("/assets/preset-groups/missing-group"), "/assets/presets");
  assert.equal(resolveRouteFallback("/assets/preset-groups"), "/assets/presets");
});

test("missing dynamic detail pages fall back to the nearest useful parent", () => {
  assert.equal(resolveRouteFallback("/assets/presets/missing-preset"), "/assets/presets");
  assert.equal(resolveRouteFallback("/queue/missing-run"), "/queue");
  assert.equal(resolveRouteFallback("/projects/missing-project"), "/projects");
  assert.equal(resolveRouteFallback("/projects/project-1/sections/missing-section"), "/projects/project-1");
  assert.equal(
    resolveRouteFallback("/projects/project-1/sections/section-1/results"),
    "/projects/project-1/sections/section-1",
  );
});

test("template section routes prefer the template editor before the template list", () => {
  assert.equal(
    resolveRouteFallback("/assets/templates/template-1/sections/99"),
    "/assets/templates/template-1/edit",
  );
  assert.equal(resolveRouteFallback("/assets/templates/missing-template/edit"), "/assets/templates");
});

test("unknown child routes fall back by walking route parents", () => {
  assert.equal(resolveRouteFallback("/settings/monitor/details"), "/settings/monitor");
  assert.equal(resolveRouteFallback("/assets/presets/sort-rules/extra"), "/assets/presets/sort-rules");
  assert.equal(resolveRouteFallback("/unknown-feature/child"), "/queue");
});

test("fallback skips API and static asset paths", () => {
  assert.equal(resolveRouteFallback("/api/missing"), null);
  assert.equal(resolveRouteFallback("/_next/static/missing.js"), null);
  assert.equal(resolveRouteFallback("/missing.png"), null);
});

test("fallback leaves design demo routes to the demo router", () => {
  assert.equal(resolveRouteFallback("/design-demos"), null);
  assert.equal(resolveRouteFallback("/design-demos/settings"), null);
  assert.equal(resolveRouteFallback("/design-demos/training/models"), null);
});

test("unknown top-level pages fall back to the app home route", () => {
  assert.equal(resolveRouteFallback("/does-not-exist"), "/queue");
  assert.equal(resolveRouteFallback("/"), null);
});
