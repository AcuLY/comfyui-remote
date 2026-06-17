"use client";

import type { ReactNode } from "react";

import { DesignDemoShell } from "@/components/design-demo-shell/app-shell";
import { PersistentBottomNav } from "@/components/persistent-bottom-nav";
import type { TrainingShellData } from "./data";
import { findTrainingHeaderSpecForRoute } from "./header-specs";
import { TRAINING_THEME_PERSISTENCE, type TrainingTheme } from "./theme";

export function TrainingShell({
  children,
  currentRoute,
  data,
  hrefForRoute,
  initialTheme,
}: {
  children: ReactNode;
  currentRoute: string;
  data: TrainingShellData;
  hrefForRoute?: (route: string) => string;
  initialTheme: TrainingTheme;
}) {
  return (
    <DesignDemoShell
      currentRoute={currentRoute}
      data={data as never}
      hrefForRoute={hrefForRoute}
      initialTheme={initialTheme}
      footerNav={<PersistentBottomNav />}
      navigationChrome="none"
      routeHeaderConfig={findTrainingHeaderSpecForRoute(data, currentRoute)}
      themePersistence={TRAINING_THEME_PERSISTENCE}
    >
      {children}
    </DesignDemoShell>
  );
}
