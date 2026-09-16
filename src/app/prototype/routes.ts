import {
  ClipboardList,
  Database,
  FileText,
  FolderTree,
  Settings,
  Tags,
} from "lucide-react";

import type { NavLinkDef, RouteIcon } from "@/app/design-demos/routing";

export type PrototypeWorkMode = "generation" | "lora_training";

export type PrototypeRouteKey =
  | "production-tasks"
  | "production-projects"
  | "production-presets"
  | "production-templates"
  | "training-tasks"
  | "training-projects"
  | "training-presets"
  | "training-templates"
  | "tools-models"
  | "tools-monitor"
  | "tools-settings"
  | "not-found";

export type PrototypeMatch = {
  key: PrototypeRouteKey;
  route: string;
};

export const DEFAULT_PROTOTYPE_ROUTE = "/production/tasks";

export const PROTOTYPE_ROUTES: Array<{ key: Exclude<PrototypeRouteKey, "not-found">; pattern: string; eyebrow: string; title: string }> = [
  { key: "production-tasks", pattern: "/production/tasks", eyebrow: "生产", title: "任务" },
  { key: "production-projects", pattern: "/production/projects", eyebrow: "生产", title: "项目" },
  { key: "production-presets", pattern: "/production/presets", eyebrow: "生产", title: "预制" },
  { key: "production-templates", pattern: "/production/templates", eyebrow: "生产", title: "模板" },
  { key: "training-tasks", pattern: "/training/tasks", eyebrow: "训练", title: "任务" },
  { key: "training-projects", pattern: "/training/projects", eyebrow: "训练", title: "项目" },
  { key: "training-presets", pattern: "/training/presets", eyebrow: "训练", title: "预制" },
  { key: "training-templates", pattern: "/training/templates", eyebrow: "训练", title: "模板" },
  { key: "tools-models", pattern: "/tools/models", eyebrow: "系统", title: "模型" },
  { key: "tools-monitor", pattern: "/tools/monitor", eyebrow: "系统", title: "监控与日志" },
  { key: "tools-settings", pattern: "/tools/settings", eyebrow: "系统", title: "设置" },
];

export function matchPrototypeRoute(route: string): PrototypeMatch {
  const normalized = route === "" ? DEFAULT_PROTOTYPE_ROUTE : route;
  const found = PROTOTYPE_ROUTES.find((item) => item.pattern === normalized);
  if (found) return { key: found.key, route: normalized };
  return { key: "not-found", route: normalized };
}

export function prototypeHref(route: string) {
  return `/prototype${route}`;
}

const MODULE_ICONS: Record<"tasks" | "projects" | "presets" | "templates", RouteIcon> = {
  tasks: ClipboardList,
  projects: FolderTree,
  presets: Tags,
  templates: FileText,
};

const TOOL_ICONS: Record<"models" | "settings", RouteIcon> = {
  models: Database,
  settings: Settings,
};

/**
 * 当前工作模式的导航：工作区（任务/项目/预制/模板）+ 资源（模型）+ 系统（设置）。
 * 数量遵循组件外壳的移动端槽位契约（6 项 + 模式指示）。
 * 监控与日志是全局工具页，入口在设置页内（与组件实验室一致的导航契约）。
 */
export function buildPrototypeNavLinks(workMode: PrototypeWorkMode): NavLinkDef[] {
  const prefix = workMode === "generation" ? "/production" : "/training";
  const links: NavLinkDef[] = [
    { href: `${prefix}/tasks`, label: "任务", group: "工作区", icon: MODULE_ICONS.tasks, activePrefix: `${prefix}/tasks` },
    { href: `${prefix}/projects`, label: "项目", group: "工作区", icon: MODULE_ICONS.projects, activePrefix: `${prefix}/projects` },
    { href: `${prefix}/presets`, label: "预制", group: "工作区", icon: MODULE_ICONS.presets, activePrefix: `${prefix}/presets` },
    { href: `${prefix}/templates`, label: "模板", group: "工作区", icon: MODULE_ICONS.templates, activePrefix: `${prefix}/templates` },
    { href: "/tools/models", label: "模型", group: "资源", icon: TOOL_ICONS.models, activePrefix: "/tools/models" },
    { href: "/tools/settings", label: "设置", group: "系统", icon: TOOL_ICONS.settings, activePrefix: "/tools/settings" },
  ];
  return links;
}
