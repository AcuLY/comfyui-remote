import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const globalsCss = readFileSync("src/app/globals.css", "utf8");
const designSystemCss = readFileSync("src/app/design-system.css", "utf8");

test("active global theme primitives follow the current design direction", () => {
  assert.match(globalsCss, /:root\[data-theme="light"\]\s*{[\s\S]*--bg:\s*#f7f9fb;/);
  assert.match(globalsCss, /:root\[data-theme="light"\]\s*{[\s\S]*--fg:\s*#16181d;/);
  assert.match(globalsCss, /:root,\s*:root\[data-theme="dark"\]\s*{[\s\S]*--bg:\s*#09090b;/);
  assert.match(globalsCss, /:root,\s*:root\[data-theme="dark"\]\s*{[\s\S]*--fg:\s*#fafafa;/);
  assert.match(globalsCss, /:root,\s*:root\[data-theme="dark"\]\s*{[\s\S]*--panel:\s*#18181b;/);
  assert.match(globalsCss, /:root,\s*:root\[data-theme="dark"\]\s*{[\s\S]*--panel-soft:\s*#27272a;/);
  assert.doesNotMatch(globalsCss, /#111217|#171923|#f4f4f5/);
});

test("legacy design-system token scaffold covers the frontend guide scale", () => {
  for (const token of [
    "--spacing-20: 80px",
    "--text-5xl: 48px",
    "--text-6xl: 56px",
    "--transition-slower: 0.4s",
    "--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)",
    "--ease-out: cubic-bezier(0, 0, 0.2, 1)",
    "--ease-in: cubic-bezier(0.4, 0, 1, 1)",
    "--breakpoint-sm: 640px",
    "--breakpoint-md: 768px",
    "--breakpoint-lg: 1024px",
    "--breakpoint-xl: 1280px",
    "--breakpoint-2xl: 1536px",
  ]) {
    assert.match(designSystemCss, new RegExp(token.replace(/[().]/g, "\\$&")), `${token} should be declared`);
  }
});
