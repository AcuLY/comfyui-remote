"use client";

import { createContext, useContext } from "react";

type PageHeaderActionPortalContextValue = {
  routeHeaderActive: boolean;
  target: HTMLElement | null;
};

const defaultValue: PageHeaderActionPortalContextValue = {
  routeHeaderActive: false,
  target: null,
};

export const PageHeaderActionPortalContext = createContext<PageHeaderActionPortalContextValue>(defaultValue);

export function usePageHeaderActionPortal() {
  return useContext(PageHeaderActionPortalContext);
}
