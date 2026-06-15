"use client";

import type { ReactNode } from "react";
import { ClipboardList, Database, FileText, FolderTree, Settings, Tags } from "lucide-react";

import { DesignDemoShell, type DesignDemoShellNavLink } from "@/components/design-demo-shell/app-shell";
import {
  buildWorkModeResourceTargetList,
  type WorkModeResourceKey,
  type WorkModeResourceTarget,
} from "@/lib/work-mode-resources";
import type { TrainingShellData } from "./data";
import type { TrainingTheme } from "./theme";

const TRAINING_NAV_ICONS: Record<WorkModeResourceKey, DesignDemoShellNavLink["icon"]> = {
  runs: ClipboardList,
  projects: FolderTree,
  presets: Tags,
  templates: FileText,
  models: Database,
  settings: Settings,
};

function trainingNavigationGroup(target: WorkModeResourceTarget) {
  if (target.key === "settings") return "系统";
  if (target.owner === "shared") return "资源";
  return "工作区";
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
    case "models":
      return () => data.models.length;
    case "settings":
      return undefined;
  }
}

function buildTrainingNavigationLinks(data: TrainingShellData): DesignDemoShellNavLink[] {
  return buildWorkModeResourceTargetList("lora_training").map((target) => {
    const count = countForTrainingResource(target.key, data);

    return {
      href: target.href,
      label: target.label,
      group: trainingNavigationGroup(target),
      icon: TRAINING_NAV_ICONS[target.key],
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
    >
      {children}
    </DesignDemoShell>
  );
}
