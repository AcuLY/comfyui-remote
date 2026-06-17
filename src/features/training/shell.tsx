"use client";

import type { ReactNode } from "react";
import { ClipboardList, FileText, FolderTree, Tags } from "lucide-react";

import { DesignDemoShell, type DesignDemoShellNavLink } from "@/components/design-demo-shell/app-shell";
import {
  WORK_MODE_RESOURCE_TARGETS,
  buildWorkModeResourceTargetList,
  type WorkModeResourceKey,
  type WorkModeResourceTarget,
} from "@/lib/work-mode-resources";
import type { TrainingShellData } from "./data";
import { findTrainingHeaderSpecForRoute } from "./header-specs";
import { TRAINING_THEME_PERSISTENCE, type TrainingTheme } from "./theme";

type TrainingModuleNavKey = "runs" | "projects" | "presets" | "templates";

const TRAINING_NAV_ICONS: Record<TrainingModuleNavKey, DesignDemoShellNavLink["icon"]> = {
  runs: ClipboardList,
  projects: FolderTree,
  presets: Tags,
  templates: FileText,
};

const TRAINING_MODULE_NAV_KEYS = new Set<WorkModeResourceKey>([
  "runs",
  "projects",
  "presets",
  "templates",
]);

function trainingNavigationGroup(target: WorkModeResourceTarget) {
  return target.owner === "shared" ? "资源" : "工作区";
}

function isRouteUnder(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isResourceTargetActive(pathname: string, target: WorkModeResourceTarget) {
  const prefixes = Array.isArray(target.activePrefix) ? target.activePrefix : [target.activePrefix ?? target.href];
  return prefixes.some((prefix) => isRouteUnder(pathname, prefix));
}

function resolveTrainingModeSwitchHref(currentRoute: string) {
  const generationTargets = WORK_MODE_RESOURCE_TARGETS.generation;
  const trainingTargets = WORK_MODE_RESOURCE_TARGETS.lora_training;
  const pairs: Array<[WorkModeResourceTarget, WorkModeResourceTarget]> = [
    [trainingTargets.runs, generationTargets.runs],
    [trainingTargets.projects, generationTargets.projects],
    [trainingTargets.presets, generationTargets.presets],
    [trainingTargets.templates, generationTargets.templates],
    [trainingTargets.models, generationTargets.models],
    [trainingTargets.settings, generationTargets.settings],
  ];
  return pairs.find(([trainingTarget]) => isResourceTargetActive(currentRoute, trainingTarget))?.[1].href ?? generationTargets.runs.href;
}

function countForTrainingResource(
  key: WorkModeResourceKey,
  data: TrainingShellData,
): DesignDemoShellNavLink["count"] | undefined {
  switch (key) {
    case "runs":
      return () => data.metrics.runs;
    case "projects":
      return () => data.metrics.projects;
    case "presets":
      return () => data.metrics.presets;
    case "templates":
      return () => data.metrics.templates;
    default:
      return undefined;
  }
}

function buildTrainingNavigationLinks(data: TrainingShellData): DesignDemoShellNavLink[] {
  return buildWorkModeResourceTargetList("lora_training").filter((target) => TRAINING_MODULE_NAV_KEYS.has(target.key)).map((target) => {
    const count = countForTrainingResource(target.key, data);

    return {
      href: target.href,
      label: target.label,
      group: trainingNavigationGroup(target),
      icon: TRAINING_NAV_ICONS[target.key as TrainingModuleNavKey],
      ...(target.activePrefix ? { activePrefix: target.activePrefix } : {}),
      ...(count ? { count } : {}),
    };
  });
}

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
      navigationLinks={buildTrainingNavigationLinks(data)}
      routeHeaderConfig={findTrainingHeaderSpecForRoute(data, currentRoute)}
      themePersistence={TRAINING_THEME_PERSISTENCE}
      workModeSwitchHref={resolveTrainingModeSwitchHref(currentRoute)}
    >
      {children}
    </DesignDemoShell>
  );
}
