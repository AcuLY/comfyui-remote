import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const appShellCss = readFileSync(resolve(testDir, "app-shell.module.css"), "utf8");

function cssBlockSource(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} should exist`);
  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `${marker} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${marker} body should close`);
}

test("collapsed sidebar hides scrollbar chrome without narrowing controls", () => {
  const sidebarBlock = cssBlockSource(appShellCss, ".sidebar {");
  const collapsedBlock = cssBlockSource(appShellCss, ".sidebarCollapsed {");

  assert.match(sidebarBlock, /overflow-y:\s*auto/, "Sidebar should remain the vertical scroll container");
  assert.match(sidebarBlock, /scrollbar-width:\s*thin/, "Expanded sidebar scrollbar should keep the compact native width");
  assert.doesNotMatch(
    sidebarBlock,
    /scrollbar-gutter:\s*stable both-edges/,
    "Collapsed sidebar should not use a double-sided gutter that narrows the controls",
  );
  assert.match(
    collapsedBlock,
    /scrollbar-width:\s*none/,
    "Collapsed sidebar should hide native scrollbar chrome so controls keep their full width",
  );
  assert.match(
    appShellCss,
    /\.sidebarCollapsed::-[\w-]*scrollbar\s*\{[\s\S]*?width:\s*0/,
    "Collapsed sidebar should hide WebKit scrollbar chrome while preserving scroll behavior",
  );
});

test("collapse button stays anchored to the rail during sidebar width transitions", () => {
  const collapsedBrandTopBlock = cssBlockSource(appShellCss, ".sidebarCollapsed .brandTop {");
  const collapsedButtonBlock = cssBlockSource(
    appShellCss,
    '.shell .sidebarCollapsed .sidebarCollapseButton:where([data-demo-ui-button="true"])',
  );

  assert.match(
    collapsedBrandTopBlock,
    /justify-content:\s*flex-start/,
    "Collapsed brand rows should not center the collapse button inside an animating sidebar width",
  );
  assert.equal(
    appShellCss.includes(".sidebarCollapsed.sidebar .brandTop"),
    false,
    "Breakpoint-specific collapsed brand rows should not re-center the collapse button",
  );
  assert.match(
    collapsedButtonBlock,
    /margin-left:\s*10px/,
    "Collapsed collapse button should keep the same rail center as its expanded 56px footprint",
  );
});

test("sidebar collapse button pressed state uses theme variables", () => {
  const pressedBlock = cssBlockSource(
    appShellCss,
    '.shell .sidebarCollapseButton:where([data-demo-ui-button="true"]):active::after',
  );

  assert.doesNotMatch(
    pressedBlock,
    /rgba\(15,\s*23,\s*42,/,
    "Pressed collapse button state should not use a hard-coded dark overlay in light mode",
  );
  assert.match(
    pressedBlock,
    /background:\s*var\(--demo-control-hover\)/,
    "Pressed collapse button state should match the theme-aware dark-mode control feedback",
  );
});

test("sidebar collapse button suppresses full-size root active chrome", () => {
  const rootActiveBlock = cssBlockSource(
    appShellCss,
    '.shell .sidebarCollapseButton.sidebarCollapseButton.sidebarCollapseButton:where([data-demo-ui-button="true"]):active',
  );

  assert.match(rootActiveBlock, /background:\s*transparent/, "Root active state should not paint the full button box");
  assert.match(rootActiveBlock, /box-shadow:\s*none/, "Root active state should not show the shared inset press shadow");
  assert.match(rootActiveBlock, /transform:\s*none/, "Root active state should not add the shared pressed movement");
});
