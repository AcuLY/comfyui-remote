"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DesignDemoShell } from "@/components/design-demo-shell/app-shell";
import type { DemoTheme } from "@/app/design-demos/routing";

import { prototypeShellData } from "./data";
import { PrototypeNotFoundPage } from "./not-found-page";
import { findPrototypeHeaderSpec } from "./header-specs";
import {
  buildPrototypeNavLinks,
  DEFAULT_PROTOTYPE_ROUTE,
  matchPrototypeRoute,
  prototypeHref,
} from "./routes";
import type { PrototypeMatch } from "./routes";
import { PROTOTYPE_THEME_PERSISTENCE } from "./theme";
import { setPrototypeWorkMode, usePrototypeWorkMode } from "./use-work-mode";
import { TasksPage } from "./features/tasks/tasks-page";
import { usePrototypeTasks } from "./features/tasks/use-tasks";
import {
  ModelsPage,
  MonitorPage,
  PresetsPage,
  ProjectsPage,
  SettingsPage,
  TemplatesPage,
} from "./features/light/light-pages";

function CurrentPage({ match, tasksState }: { match: PrototypeMatch; tasksState: ReturnType<typeof usePrototypeTasks> }) {
  switch (match.key) {
    case "production-tasks":
      return <TasksPage key={match.key} module="generation" state={tasksState} />;
    case "training-tasks":
      return <TasksPage key={match.key} module="training" state={tasksState} />;
    case "production-projects":
      return <ProjectsPage module="generation" />;
    case "training-projects":
      return <ProjectsPage module="training" />;
    case "production-presets":
      return <PresetsPage module="generation" />;
    case "training-presets":
      return <PresetsPage module="training" />;
    case "production-templates":
      return <TemplatesPage module="generation" />;
    case "training-templates":
      return <TemplatesPage module="training" />;
    case "tools-models":
      return <ModelsPage />;
    case "tools-monitor":
      return <MonitorPage />;
    case "tools-settings":
      return <SettingsPage />;
    default:
      return <PrototypeNotFoundPage />;
  }
}

export function PrototypeApp({ initialTheme }: { initialTheme: DemoTheme }) {
  const pathname = usePathname();
  const router = useRouter();
  const tasksState = usePrototypeTasks();

  const currentRoute =
    !pathname || pathname === "/prototype"
      ? DEFAULT_PROTOTYPE_ROUTE
      : pathname.slice("/prototype".length) || DEFAULT_PROTOTYPE_ROUTE;
  const match = matchPrototypeRoute(currentRoute);

  const workMode = usePrototypeWorkMode();
  const routeMode = currentRoute.startsWith("/training/")
    ? "lora_training"
    : currentRoute.startsWith("/production/")
      ? "generation"
      : null;

  // 进入模块路由即切换模块上下文；全局工具页保留已存模式。
  useEffect(() => {
    if (routeMode && routeMode !== workMode) {
      setPrototypeWorkMode(routeMode);
    }
  }, [routeMode, workMode]);

  const navLinks = buildPrototypeNavLinks(routeMode ?? workMode);

  useEffect(() => {
    if (pathname === "/prototype") {
      router.replace(prototypeHref(DEFAULT_PROTOTYPE_ROUTE));
    }
  }, [pathname, router]);

  return (
    <DesignDemoShell
      currentRoute={currentRoute}
      data={prototypeShellData}
      hrefForRoute={prototypeHref}
      initialTheme={initialTheme}
      navigationLinks={navLinks}
      routeHeaderConfig={findPrototypeHeaderSpec(match.key)}
      themePersistence={PROTOTYPE_THEME_PERSISTENCE}
    >
      <CurrentPage match={match} tasksState={tasksState} />
    </DesignDemoShell>
  );
}
