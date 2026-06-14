"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import { demoHref } from "./routes";

type RouteHrefBuilder = (route: string) => string;

const RouteHrefContext = createContext<RouteHrefBuilder>(demoHref);

export function RouteHrefProvider({
  children,
  hrefForRoute,
}: {
  children: ReactNode;
  hrefForRoute?: RouteHrefBuilder;
}) {
  return (
    <RouteHrefContext.Provider value={hrefForRoute ?? demoHref}>
      {children}
    </RouteHrefContext.Provider>
  );
}

export function useRouteHref() {
  return useContext(RouteHrefContext);
}
