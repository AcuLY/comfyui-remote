import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrototypeNavLinks,
  DEFAULT_PROTOTYPE_ROUTE,
  matchPrototypeRoute,
  PROTOTYPE_ROUTES,
  prototypeHref,
} from "./routes";
import { buildPrototypeHeaderSpecs } from "./header-specs";

const routePatterns = PROTOTYPE_ROUTES.map((item) => item.pattern);

test("prototype routes declare production, training and tools namespaces with task defaults", () => {
  assert.ok(DEFAULT_PROTOTYPE_ROUTE === "/production/tasks", "first visit should land on production tasks");
  assert.ok(routePatterns.includes("/production/tasks"), "production tasks route should be declared");
  assert.ok(routePatterns.includes("/training/tasks"), "training tasks route should be declared");
  assert.ok(routePatterns.includes("/tools/monitor"), "monitor should be declared as a global tool route");
  assert.ok(
    routePatterns.every((pattern) => pattern.startsWith("/production/") || pattern.startsWith("/training/") || pattern.startsWith("/tools/")),
    "every route should live in a first-level namespace",
  );
});

test("prototype routes match exactly and fall back to not-found", () => {
  assert.deepEqual(matchPrototypeRoute("/production/tasks"), { key: "production-tasks", route: "/production/tasks" });
  assert.deepEqual(matchPrototypeRoute(""), { key: "production-tasks", route: "/production/tasks" });
  assert.equal(matchPrototypeRoute("/unknown/route").key, "not-found");
});

test("navigation links follow the shell slot contract and shared tool grouping", () => {
  for (const mode of ["generation", "lora_training"] as const) {
    const links = buildPrototypeNavLinks(mode);
    assert.equal(links.length, 6, `${mode} nav should expose exactly six entries`);
    const prefix = mode === "generation" ? "/production" : "/training";
    const moduleLinks = links.filter((link) => link.href.startsWith(prefix));
    assert.equal(moduleLinks.length, 4, `${mode} nav should own tasks, projects, presets and templates`);
    assert.ok(links.some((link) => link.href === "/tools/models"), "models should stay a shared tool");
    assert.ok(links.some((link) => link.href === "/tools/settings"), "settings should stay a shared tool");
    assert.equal(new Set(links.map((link) => link.group)).size, 3, "nav groups should separate workspace, resources and system");
  }
});

test("every prototype route and the fallback have a header spec", () => {
  const keys = new Set(buildPrototypeHeaderSpecs().map((spec) => spec.key));
  for (const item of PROTOTYPE_ROUTES) {
    assert.ok(keys.has(item.key), `${item.key} should have a header spec`);
  }
  assert.ok(keys.has("not-found"), "the fallback route should have a header spec");
});

test("prototype hrefs stay inside the /prototype namespace", () => {
  for (const pattern of routePatterns) {
    assert.ok(prototypeHref(pattern).startsWith("/prototype/"), `${pattern} should map inside /prototype`);
  }
});
