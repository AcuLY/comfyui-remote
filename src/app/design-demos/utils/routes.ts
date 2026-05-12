import {
  Archive,
  Boxes,
  ClipboardList,
  Database,
  Edit3,
  FileText,
  FolderTree,
  Grid3X3,
  History,
  Home,
  ImageIcon,
  Layers,
  ListChecks,
  Lock,
  Monitor,
  PanelTop,
  Plus,
  Rows3,
  Settings,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Wand2,
} from "lucide-react";

import type { DemoData } from "../data/types";
import { firstGroup, firstPreset, firstProject, firstRun, firstSection, firstTemplate } from "./data-selectors";
import { rawSectionId } from "./image-status";
import type { Match, NavLinkDef, RouteDef } from "./types";

export const ROUTES: RouteDef[] = [
  { key: "root", pattern: "/", title: "任务", group: "核心", icon: Home },
  { key: "queue-review", pattern: "/runs/:runId", title: "审核宫格", group: "核心", icon: Grid3X3 },
  { key: "queue", pattern: "/runs", title: "任务", group: "核心", icon: ClipboardList },
  { key: "project-new", pattern: "/projects/new", title: "新建项目", group: "项目", icon: Plus },
  { key: "project-edit", pattern: "/projects/:projectId/edit", title: "编辑项目", group: "项目", icon: Edit3 },
  { key: "project-results", pattern: "/projects/:projectId/results", title: "项目结果", group: "项目", icon: ImageIcon },
  { key: "project-batch", pattern: "/projects/:projectId/batch-create", title: "批量创建", group: "项目", icon: Rows3 },
  { key: "section-editor", pattern: "/projects/:projectId/sections/:sectionId", title: "小节编辑", group: "项目", icon: SlidersHorizontal },
  { key: "project-detail", pattern: "/projects/:projectId", title: "项目详情", group: "项目", icon: FolderTree },
  { key: "projects", pattern: "/projects", title: "项目列表", group: "项目", icon: FolderTree },
  { key: "sort-rules", pattern: "/presets/sort-rules", title: "排序规则", group: "资源", icon: Shuffle },
  { key: "preset-category-new", pattern: "/presets/categories/new", title: "新建预设分类", group: "资源", icon: Plus },
  { key: "preset-category-edit", pattern: "/presets/categories/:categoryId/edit", title: "编辑预设分类", group: "资源", icon: Edit3 },
  { key: "preset-edit", pattern: "/presets/:presetId", title: "预设详情", group: "资源", icon: Wand2 },
  { key: "preset-groups", pattern: "/preset-groups/:groupId", title: "预设组", group: "资源", icon: Boxes },
  { key: "presets", pattern: "/presets", title: "预设库", group: "资源", icon: Tags },
  { key: "models", pattern: "/models", title: "模型文件", group: "资源", icon: Database },
  { key: "loras", pattern: "/loras", title: "LoRA 文件", group: "资源", icon: Sparkles },
  { key: "template-new", pattern: "/templates/new", title: "新建模板", group: "模板", icon: Plus },
  { key: "template-section", pattern: "/templates/:templateId/sections/:sectionIndex", title: "模板小节", group: "模板", icon: ListChecks },
  { key: "template-edit", pattern: "/templates/:templateId/edit", title: "编辑模板", group: "模板", icon: Edit3 },
  { key: "templates", pattern: "/templates", title: "模板列表", group: "模板", icon: FileText },
  { key: "logs", pattern: "/settings/logs", title: "日志", group: "设置", icon: History },
  { key: "monitor", pattern: "/settings/monitor", title: "Worker 监控", group: "设置", icon: Monitor },
  { key: "settings", pattern: "/settings", title: "设置", group: "设置", icon: Settings },
  { key: "image-list-components", pattern: "/image-list-components", title: "图片列表组件", group: "临时", icon: ImageIcon },
  { key: "component-showcase", pattern: "/component-showcase", title: "组件展示总览", group: "临时", icon: Layers },
  { key: "component-showcase-atoms", pattern: "/component-showcase-atoms", title: "原子组件", group: "临时", icon: Layers },
  { key: "component-showcase-mid", pattern: "/component-showcase-mid", title: "中组件展示", group: "临时", icon: Grid3X3 },
  { key: "component-showcase-images", pattern: "/component-showcase-images", title: "图片组件展示", group: "临时", icon: ImageIcon },
  { key: "component-showcase-editor", pattern: "/component-showcase-editor", title: "编辑器组件展示", group: "临时", icon: SlidersHorizontal },
  { key: "component-showcase-icons", pattern: "/component-showcase-icons", title: "Icons 图标展示", group: "临时", icon: Tags },
  { key: "component-showcase-headers", pattern: "/component-showcase-headers", title: "Headers 设计稿", group: "临时", icon: PanelTop },
  { key: "component-showcase-projects", pattern: "/component-showcase-projects", title: "项目卡片和列表展示", group: "临时", icon: Archive },
  { key: "login", pattern: "/login", title: "登录", group: "系统", icon: Lock },
];

export const NAV_LINKS: NavLinkDef[] = [
  { href: "/runs", label: "任务", group: "核心", icon: ClipboardList, count: (data) => data.runs.length },
  { href: "/projects", label: "项目", group: "核心", icon: FolderTree, count: (data) => data.projects.length },
  { href: "/presets", label: "预设库", group: "资源", icon: Tags, count: (data) => data.metrics.presets },
  { href: "/templates", label: "模板", group: "模板", icon: FileText, count: (data) => data.templates.length },
  { href: "/models", label: "模型", group: "资源", icon: Database, count: (data) => data.models.length, activePrefix: ["/models", "/loras"] },
  { href: "/settings", label: "设置", group: "设置", icon: Settings },
  { href: "/login", label: "登录", group: "系统", icon: Lock },
];

export const MOBILE_NAV_LINKS: NavLinkDef[] = [
  { href: "/runs", label: "任务", group: "核心", icon: ClipboardList, count: (data) => data.runs.length },
  { href: "/projects", label: "项目", group: "核心", icon: FolderTree, count: (data) => data.projects.length },
];

export function demoHref(route: string) {
  const normalized = normalizeProductRoute(route);
  if (normalized === "/") return "/design-demos";
  return `/design-demos${normalized}`;
}

export function normalizeProductRoute(route: string) {
  if (route === "/queue") return "/runs";
  if (route.startsWith("/queue/")) return `/runs/${route.slice("/queue/".length)}`;
  if (route === "/assets") return "/";
  if (route.startsWith("/assets/")) return route.slice("/assets".length);
  return route;
}

export function productRouteFromPathname(pathname: string | null, initialSegments: string[]) {
  if (pathname?.startsWith("/design-demos")) {
    const stripped = pathname.slice("/design-demos".length);
    return normalizeProductRoute(stripped || "/runs");
  }
  return normalizeProductRoute(initialSegments.length ? `/${initialSegments.join("/")}` : "/");
}

export function matchPattern(pattern: string, route: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const routeParts = route.split("/").filter(Boolean);
  if (patternParts.length !== routeParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i];
    const routePart = routeParts[i];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(routePart);
    } else if (patternPart !== routePart) {
      return null;
    }
  }
  return params;
}

export function matchRoute(route: string): Match {
  const normalized = route === "" ? "/" : route;
  for (const def of ROUTES) {
    const params = matchPattern(def.pattern, normalized);
    if (params) return { key: def.key, params, route: normalized };
  }
  return { key: "not-found", params: {}, route: normalized };
}

export function isNavActive(route: string, href: string, activePrefix?: string | string[]) {
  const prefixes = Array.isArray(activePrefix) ? activePrefix : activePrefix ? [activePrefix] : [href];
  return prefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

export function sampleRouteInventory(data: DemoData) {
  const project = firstProject(data);
  const section = firstSection(project);
  const run = firstRun(data);
  const preset = firstPreset(data);
  const group = firstGroup(data);
  const template = firstTemplate(data);
  const sectionId = section ? rawSectionId(section) : "section-id";

  return ROUTES.map((route) => {
    let sample = route.pattern;
    sample = sample.replace(":runId", run?.id ?? "run-id");
    sample = sample.replace(":projectId", project?.id ?? "project-id");
    sample = sample.replace(":sectionId", sectionId);
    sample = sample.replace(":categoryId", data.categories[0]?.id ?? "category-id");
    sample = sample.replace(":presetId", preset?.id ?? "preset-id");
    sample = sample.replace(":groupId", group?.id ?? "group-id");
    sample = sample.replace(":templateId", template?.id ?? "template-id");
    sample = sample.replace(":sectionIndex", "0");
    return { ...route, sample };
  });
}
