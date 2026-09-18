import { useSyncExternalStore } from "react";

export const DEFAULT_ROUTE = "/production/tasks";

function readRoute(): string {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return DEFAULT_ROUTE;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, readRoute, () => DEFAULT_ROUTE);
}

export function navigateTo(route: string) {
  if (readRoute() === route) return;
  window.location.hash = route;
}
