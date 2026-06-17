"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type RouteHrefBuilder = (route: string) => string;

const identityHref: RouteHrefBuilder = (route) => route;
const RouteHrefContext = createContext<RouteHrefBuilder>(identityHref);

export function RouteHrefProvider({
  children,
  hrefForRoute,
}: {
  children: ReactNode;
  hrefForRoute?: RouteHrefBuilder;
}) {
  return (
    <RouteHrefContext.Provider value={hrefForRoute ?? identityHref}>
      {children}
    </RouteHrefContext.Provider>
  );
}

export function useRouteHref() {
  return useContext(RouteHrefContext);
}
