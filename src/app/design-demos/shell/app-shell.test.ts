import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const shellDir = resolve(testDir, "../../../components/design-demo-shell");
const sharedUiDir = resolve(testDir, "../../../components/design-demo-ui");
const shellSource = readFileSync(resolve(shellDir, "app-shell.tsx"), "utf8");
const cssSource = readFileSync(resolve(shellDir, "app-shell.module.css"), "utf8");
const headerSurfaceSource = readFileSync(resolve(shellDir, "header-surface.tsx"), "utf8");
const headerSurfaceCssSource = readFileSync(resolve(shellDir, "header-surface.module.css"), "utf8");
const pageHeaderSource = readFileSync(resolve(sharedUiDir, "primitives/page-header/index.tsx"), "utf8");

function sourceRegion(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist after ${startMarker}`);
  return source.slice(start, end);
}

test("mobile bottom navigation fits each work mode resource count plus the right-edge mode indicator", () => {
  const mobileNavSource = sourceRegion(shellSource, "function MobileBottomNav", "function MobileTopbar");

  assert.match(
    mobileNavSource,
    /data-work-mode=\{workMode\}/,
    "mobile bottom nav should expose the active work mode for mode-specific column counts",
  );
  assert.match(
    cssSource,
    /\.mobileBottomNav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)\s+minmax\(52px,\s*0\.9fr\)/,
    "generation mode should reserve six resource columns plus a compact right-edge mode indicator",
  );
  assert.match(
    cssSource,
    /\.mobileBottomNav\[data-work-mode="lora_training"\]\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)\s+minmax\(52px,\s*0\.9fr\)/,
    "LoRA training mode should reserve five resource columns plus the mode indicator instead of leaving an empty sixth column",
  );
});

test("mobile bottom navigation shows work mode as passive status instead of a More navigation item", () => {
  const mobileNavSource = sourceRegion(shellSource, "function MobileBottomNav", "function MobileTopbar");

  assert.match(mobileNavSource, /workMode:\s*DesignDemoWorkMode/, "mobile nav should receive the resolved work mode");
  assert.match(mobileNavSource, /mobileModeIndicator/, "mobile nav should render a dedicated mode status element");
  assert.match(mobileNavSource, /当前模式：/, "mode status should expose the confirmed accessibility label");
  assert.match(mobileNavSource, /FlaskConical/, "LoRA training mode should use the training/flask icon");
  assert.match(mobileNavSource, /ImageIcon/, "generation mode should use the image icon");
  assert.doesNotMatch(mobileNavSource, /<span>更多<\/span>/, "More should not remain a seventh bottom-nav item");
  assert.doesNotMatch(mobileNavSource, /onClick=\{onMore\}/, "mode status should not open the drawer or change modes");
});

test("mobile drawer access remains separate from the bottom navigation resources", () => {
  assert.match(shellSource, /mobileNavDrawerButton/, "mobile drawer should remain available outside resource navigation");
  assert.match(cssSource, /\.mobileNavDrawerButton\b/, "separate mobile drawer button should be styled explicitly");
});

test("desktop shell keeps the bottom navigation hidden while mobile uses an off-canvas sidebar", () => {
  const mobileShellCss = sourceRegion(cssSource, "@media (max-width: 639px) {", "@media (max-width: 520px) {");

  assert.match(
    cssSource,
    /\.mobileBottomNav\s*\{\s*display:\s*none;/,
    "desktop layouts should hide the mobile bottom navigation by default",
  );
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*639px\)\s*\{[\s\S]*?\.mobileBottomNav\s*\{[\s\S]*?display:\s*grid;/,
    "mobile layouts should explicitly enable the bottom navigation grid",
  );
  assert.match(
    mobileShellCss,
    /\.sidebar\s*\{[\s\S]*?transform:\s*translateX\(-104%\);[\s\S]*?visibility:\s*hidden;/,
    "mobile sidebar should stay off-canvas until the drawer is opened",
  );
  assert.match(
    mobileShellCss,
    /\.sidebarOpen\s*\{[\s\S]*?transform:\s*translateX\(0\);[\s\S]*?visibility:\s*visible;/,
    "opening the mobile drawer should bring the sidebar onscreen instead of relying on the desktop layout",
  );
});

test("shared shell explicitly fills the viewport width for WebKit route roots", () => {
  assert.match(
    cssSource,
    /\.shell\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/,
    "the shell root should not depend on browser shrink-to-fit behavior for route-level width",
  );
  assert.match(
    cssSource,
    /\.workspace\s*\{[\s\S]*?width:\s*100%;/,
    "the workspace grid should fill the shell instead of sizing to its content in WebKit",
  );
  assert.match(
    cssSource,
    /\.contentFrame\s*\{[\s\S]*?width:\s*100%;/,
    "the scroll frame should inherit the full shell width on no-navigation training routes",
  );
});

test("route header receives page-local actions without a standalone local action strip", () => {
  assert.match(
    pageHeaderSource,
    /data-demo-page-header-has-actions=\{actions \? "true" : undefined\}/,
    "PageHeader should mark whether it carries page-local actions",
  );
  assert.match(
    pageHeaderSource,
    /data-demo-page-header-title-block/,
    "PageHeader should expose the title block for route-header suppression",
  );
  assert.match(
    pageHeaderSource,
    /data-demo-page-header-actions/,
    "PageHeader should expose the action toolbar for route-header preservation",
  );
  assert.match(
    pageHeaderSource,
    /createPortal\(actionToolbar,\s*target\)/,
    "PageHeader should portal page-local actions into the route header target",
  );
  assert.match(
    shellSource,
    /PageHeaderActionPortalContext\.Provider/,
    "The shell should provide the PageHeader action portal context",
  );
  assert.match(
    headerSurfaceSource,
    /data-header-action-portal-slot/,
    "RouteHeaderSurface should expose a dedicated portal slot for page-local actions",
  );
  assert.match(
    headerSurfaceCssSource,
    /\.pageActionPortalSlot\s*\{/,
    "The route-header portal slot should be styled as part of the header action cluster",
  );
  assert.match(
    cssSource,
    /\[data-demo-page-header\]:first-child\)\s*\{\s*display:\s*none/,
    "Route-header pages should still suppress the first local PageHeader",
  );
  assert.doesNotMatch(
    cssSource,
    /\[data-demo-page-header\]\[data-demo-page-header-has-actions="true"\]:first-child[\s\S]*?display:\s*flex/,
    "Route-header pages should not preserve a standalone local PageHeader action strip",
  );
});
