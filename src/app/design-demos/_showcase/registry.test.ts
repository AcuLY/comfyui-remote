import assert from "node:assert/strict";

import {
  SHOWCASE_COMPONENTS,
  SHOWCASE_FAMILIES,
  SHOWCASE_FAMILY_ROUTES,
} from "./registry";

const expectedFamilyIds = [
  "controls",
  "surfaces",
  "unit-items",
  "folders",
  "batch-actions",
  "generation-params",
  "preset-prompt-lora",
  "taxonomy-history",
  "images",
  "runs",
  "system",
  "headers",
  "icons",
] as const;

const oldRouteFragments = [
  "atoms",
  "mid",
  "editor",
  "projects",
  "image-list-components",
];

assert.deepEqual(
  SHOWCASE_FAMILIES.map((family) => family.id),
  expectedFamilyIds,
  "showcase family order must match the approved functional taxonomy",
);

assert.equal(
  new Set(SHOWCASE_FAMILIES.map((family) => family.route)).size,
  SHOWCASE_FAMILIES.length,
  "showcase family routes must be unique",
);

for (const family of SHOWCASE_FAMILIES) {
  assert.match(family.title, /[\u3400-\u9fff]/, `${family.id} needs a Chinese review title`);
  assert.match(family.summary, /[\u3400-\u9fff]/, `${family.id} needs a Chinese summary`);
  assert.ok(family.route.startsWith("/component-showcase"), `${family.id} route should live under component-showcase`);
  assert.ok(!oldRouteFragments.some((fragment) => family.route.includes(fragment)), `${family.id} must not use old showcase route naming`);
  assert.equal(SHOWCASE_FAMILY_ROUTES[family.id], family.route, `${family.id} route map should match family registry`);

  const components = SHOWCASE_COMPONENTS.filter((component) => component.familyId === family.id);
  assert.ok(components.length > 0, `${family.id} must document at least one review item`);
}

for (const component of SHOWCASE_COMPONENTS) {
  assert.match(component.reviewName, /[\u3400-\u9fff]/, `${component.componentName} needs a Chinese review name`);
  assert.match(component.description, /[\u3400-\u9fff]/, `${component.componentName} needs a Chinese description`);
  assert.ok(component.componentName.length > 0, `${component.reviewName} needs an English component name`);
  assert.ok(component.familyId in SHOWCASE_FAMILY_ROUTES, `${component.componentName} has an unknown family id`);
  assert.ok(component.paths.length > 0, `${component.componentName} must list source paths or planned paths`);
  assert.ok(component.usedBy.length > 0, `${component.componentName} must list covered pages or usage contexts`);
}
