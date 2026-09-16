import type { PrototypeWorkMode } from "./workMode";

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

export type NavGroup = "工作区" | "资源" | "系统";

export type NavLink = {
  href: string;
  label: string;
  group: NavGroup;
  icon: string;
};

export const ROUTE_META: Array<{
  key: Exclude<PrototypeRouteKey, "not-found">;
  pattern: string;
  eyebrow: string;
  title: string;
}> = [
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

export type PrototypeMatch = { key: PrototypeRouteKey; route: string };

export function matchRoute(route: string): PrototypeMatch {
  const normalized = route === "" ? "/production/tasks" : route;
  const found = ROUTE_META.find((item) => item.pattern === normalized);
  if (found) return { key: found.key, route: normalized };
  return { key: "not-found", route: normalized };
}

export function headerFor(key: PrototypeRouteKey): { eyebrow: string; title: string } {
  if (key === "not-found") return { eyebrow: "404", title: "未匹配页面" };
  const found = ROUTE_META.find((item) => item.key === key);
  return found ? { eyebrow: found.eyebrow, title: found.title } : { eyebrow: "生产", title: "任务" };
}

const MODULE_ICONS = {
  tasks: "pi pi-clipboard",
  projects: "pi pi-folder",
  presets: "pi pi-tags",
  templates: "pi pi-file-edit",
};

const TOOL_ICONS = {
  models: "pi pi-database",
  settings: "pi pi-cog",
  monitor: "pi pi-desktop",
};

/**
 * 当前工作模式的导航：工作区（任务/项目/预制/模板）+ 资源（模型）+ 系统（设置）。
 * 固定 6 项，满足移动端底部导航的槽位契约；监控与日志入口在设置页内。
 */
export function buildNavLinks(workMode: PrototypeWorkMode): NavLink[] {
  const prefix = workMode === "generation" ? "/production" : "/training";
  return [
    { href: `${prefix}/tasks`, label: "任务", group: "工作区", icon: MODULE_ICONS.tasks },
    { href: `${prefix}/projects`, label: "项目", group: "工作区", icon: MODULE_ICONS.projects },
    { href: `${prefix}/presets`, label: "预制", group: "工作区", icon: MODULE_ICONS.presets },
    { href: `${prefix}/templates`, label: "模板", group: "工作区", icon: MODULE_ICONS.templates },
    { href: "/tools/models", label: "模型", group: "资源", icon: TOOL_ICONS.models },
    { href: "/tools/settings", label: "设置", group: "系统", icon: TOOL_ICONS.settings },
  ];
}

export function isNavActive(currentRoute: string, href: string) {
  return currentRoute === href;
}

export function monitorIcon() {
  return TOOL_ICONS.monitor;
}
