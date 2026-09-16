import type { HeaderSpec } from "@/components/design-demo-shell/header-types";

import { PROTOTYPE_ROUTES, type PrototypeRouteKey } from "./routes";

function spec(key: PrototypeRouteKey, eyebrow: string, title: string, route: string): HeaderSpec {
  return { key, route, group: eyebrow, eyebrow, title };
}

export function buildPrototypeHeaderSpecs(): HeaderSpec[] {
  const specs = PROTOTYPE_ROUTES.map((item) => spec(item.key, item.eyebrow, item.title, item.pattern));
  return [...specs, spec("not-found", "404", "未匹配页面", "/unknown-prototype-route")];
}

export function findPrototypeHeaderSpec(routeKey: PrototypeRouteKey): HeaderSpec | null {
  return buildPrototypeHeaderSpecs().find((item) => item.key === routeKey) ?? null;
}
