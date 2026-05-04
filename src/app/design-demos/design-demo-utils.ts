import type { ComponentType } from "react";
import {
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
  ListChecks,
  Lock,
  Monitor,
  Plus,
  Rows3,
  Settings,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Wand2,
} from "lucide-react";

import type {
  DemoAsset,
  DemoCategory,
  DemoData,
  DemoImage,
  DemoPreset,
  DemoPresetFolder,
  DemoPresetGroup,
  DemoProject,
  DemoSection,
  DemoTemplate,
} from "./design-demo-data";

export type RouteIcon = ComponentType<{ className?: string }>;

export const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

export type RouteKey =
  | "root"
  | "login"
  | "queue"
  | "queue-review"
  | "projects"
  | "project-new"
  | "project-detail"
  | "project-edit"
  | "project-results"
  | "project-batch"
  | "section-editor"
  | "section-results"
  | "models"
  | "loras"
  | "presets"
  | "preset-category-new"
  | "preset-category-edit"
  | "preset-edit"
  | "preset-groups"
  | "sort-rules"
  | "templates"
  | "template-new"
  | "template-edit"
  | "template-section"
  | "settings"
  | "logs"
  | "monitor"
  | "not-found";

export type Match = {
  key: RouteKey;
  params: Record<string, string>;
  route: string;
};

export type DemoTheme = "dark" | "light";
export type QueueDemoTab = "pending" | "running" | "failed" | "trash";
export type ModelKind = "lora" | "checkpoint";
export type ModelBrowserState = "ready" | "loading" | "error" | "empty";
export type ResultDemoFilter = "all" | "pending" | "kept" | "pstation" | "preview" | "cover";
export type ProjectCardView = "sections" | "results";
export type LogDemoSource = "app" | "console";
export type SectionNavMode = "detail" | "project-results" | "editor" | "section-results";
export type TemplateSectionMode = "template-edit" | "template-section";
export type DemoToastTone = "success" | "info" | "warning" | "error";
export type DemoTemplateSection = DemoTemplate["sections"][number];
export type SortRuleDimensionKey = "positive" | "negative" | "lora1" | "lora2";
export type PresetLibraryItemKind = "preset" | "group";
export type PresetLibraryItem = {
  id: string;
  kind: PresetLibraryItemKind;
  name: string;
  slug: string;
  folderId: string | null;
  href: string;
  meta: string;
  description: string;
};
export type BatchImportItem = {
  key: string;
  kind: PresetLibraryItemKind;
  id: string;
  name: string;
  categoryId: string;
  folderId: string | null;
  variantId: string | null;
  variants: Array<{ id: string; name: string }>;
  sourceLabel: string;
  meta: string;
};

export type DemoToast = {
  id: string;
  tone: DemoToastTone;
  title: string;
  detail?: string;
};

export type DemoButtonFeedback = string | {
  title: string;
  detail?: string;
  tone?: DemoToastTone;
};

export type RouteDef = {
  key: RouteKey;
  pattern: string;
  title: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavLinkDef = {
  href: string;
  label: string;
  group: string;
  icon: RouteDef["icon"];
  count?: (data: DemoData) => number;
  activePrefix?: string | string[];
};

export const ROUTES: RouteDef[] = [
  { key: "root", pattern: "/", title: "任务", group: "核心", icon: Home },
  { key: "queue-review", pattern: "/runs/:runId", title: "审核宫格", group: "核心", icon: Grid3X3 },
  { key: "queue", pattern: "/runs", title: "任务", group: "核心", icon: ClipboardList },
  { key: "project-new", pattern: "/projects/new", title: "新建项目", group: "项目", icon: Plus },
  { key: "project-edit", pattern: "/projects/:projectId/edit", title: "编辑项目", group: "项目", icon: Edit3 },
  { key: "project-results", pattern: "/projects/:projectId/results", title: "项目结果", group: "项目", icon: ImageIcon },
  { key: "project-batch", pattern: "/projects/:projectId/batch-create", title: "批量创建", group: "项目", icon: Rows3 },
  { key: "section-results", pattern: "/projects/:projectId/sections/:sectionId/results", title: "小节结果", group: "项目", icon: ImageIcon },
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


export const DESIGN_DEMO_THEME_STORAGE_KEY = "comfyui-manager:design-demo-theme-glass";
export const DESIGN_DEMO_SFW_STORAGE_KEY = "comfyui-manager:sfw-mode";
export const DESIGN_DEMO_SFW_ATTRIBUTE = "data-sfw-mode";
export const DESIGN_DEMO_SFW_EVENT = "comfyui-manager:sfw-mode-change";

export function isSfwEnabledValue(value: string | null) {
  return value === "on";
}

export function applyDesignDemoSfwMode(enabled: boolean) {
  document.documentElement.setAttribute(DESIGN_DEMO_SFW_ATTRIBUTE, enabled ? "on" : "off");
  window.localStorage.setItem(DESIGN_DEMO_SFW_STORAGE_KEY, enabled ? "on" : "off");
  window.dispatchEvent(new Event(DESIGN_DEMO_SFW_EVENT));
}


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

export function rawSectionId(section: DemoSection) {
  return section.id.includes(":") ? section.id.split(":").slice(1).join(":") : section.id;
}

export function sectionAnchorId(section: DemoSection) {
  return `section-${rawSectionId(section)}`;
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

export function firstProject(data: DemoData) {
  return data.projects[0];
}

export function firstSection(project: DemoProject | undefined) {
  return project?.sections[0];
}

export function firstRun(data: DemoData) {
  return data.runs[0];
}

export function firstPreset(data: DemoData) {
  return data.categories.flatMap((category) => category.presets)[0];
}

export function firstCategory(data: DemoData) {
  return data.categories[0];
}

export function firstGroup(data: DemoData) {
  return data.categories.flatMap((category) => category.groups)[0];
}

export function firstTemplate(data: DemoData) {
  return data.templates[0];
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

export function findProject(data: DemoData, projectId?: string) {
  return data.projects.find((project) => project.id === projectId) ?? firstProject(data);
}

export function findSection(project: DemoProject | undefined, sectionId?: string) {
  return project?.sections.find((section) => rawSectionId(section) === sectionId || section.id === sectionId) ?? firstSection(project);
}

export function findRun(data: DemoData, runId?: string) {
  return data.runs.find((run) => run.id === runId) ?? firstRun(data);
}

export function findPreset(data: DemoData, presetId?: string) {
  return data.categories.flatMap((category) => category.presets).find((preset) => preset.id === presetId) ?? firstPreset(data);
}

export function findCategory(data: DemoData, categoryId?: string) {
  return data.categories.find((category) => category.id === categoryId) ?? firstCategory(data);
}

export function findGroup(data: DemoData, groupId?: string) {
  return data.categories.flatMap((category) => category.groups).find((group) => group.id === groupId) ?? firstGroup(data);
}

export function findTemplate(data: DemoData, templateId?: string) {
  return data.templates.find((template) => template.id === templateId) ?? firstTemplate(data);
}


export function filterImages(images: DemoImage[], filter: ResultDemoFilter) {
  if (filter === "pending") return images.filter((image) => image.status === "pending");
  if (filter === "kept") return images.filter((image) => image.status === "kept");
  if (filter === "pstation") return images.filter((image) => image.featured);
  if (filter === "preview") return images.filter((image) => image.featured2);
  if (filter === "cover") return images.filter((image) => image.cover);
  return images;
}

export function projectPresetSummary(project: DemoProject) {
  return [...new Set(project.presetNames.filter((name) => name && name !== project.title))]
    .slice(0, 4)
    .join(" / ") || "无预设绑定";
}

export function compactFileName(value: string) {
  return value.split(/[\\/]/).pop() ?? value;
}

export function sectionRunStatus(section: DemoSection, index: number) {
  if (!section.enabled) return { status: "draft", label: "停用" };
  if (section.images.some((image) => image.status === "pending")) return { status: "pending", label: "待审" };
  if (index % 7 === 0) return { status: "running", label: "运行中" };
  if (index % 11 === 0) return { status: "failed", label: "失败" };
  return { status: "done", label: "完成" };
}

export function selectionToggleLabel(selectedCount: number, totalCount: number) {
  if (selectedCount === 0) return "选择";
  if (selectedCount === totalCount) return "取消全选";
  return `已选 ${selectedCount}`;
}

export function resultRunGroups(images: DemoImage[]) {
  const groups = [
    { id: "run-latest", title: "最近运行", meta: "Run #3 · 当前筛选" },
    { id: "run-prev", title: "上一轮运行", meta: "Run #2 · 对照组" },
  ];

  return groups.map((group, groupIndex) => ({
    ...group,
    images: images.filter((_, imageIndex) => imageIndex % groups.length === groupIndex),
  })).filter((group) => group.images.length > 0);
}

export function categoryTypeLabel(category: DemoCategory | null) {
  return category?.type === "group" ? "预设组" : "预设";
}

export function categoryItemCount(category: DemoCategory) {
  return category.type === "group" ? category.groupCount : category.presetCount;
}

export function categoryColorValue(color: string | null) {
  if (!color) return "hsl(158 100% 43%)";
  if (/^\d+(\s|$)/.test(color)) return `hsl(${color})`;
  return color;
}

export function categoryHueValue(color: string | null) {
  if (!color) return 158;
  const match = color.match(/^(\d+)/);
  return match ? Number(match[1]) : 190;
}

export function categorySlotPreview(category: DemoCategory | null, categories: DemoCategory[]) {
  const presetCategories = categories.filter((item) => item.type !== "group");
  if (category?.type !== "group") return [];
  const slotCount = Math.max(2, Math.min(4, category.groupCount || 2));
  return Array.from({ length: slotCount }, (_, index) => {
    const source = presetCategories[index % Math.max(presetCategories.length, 1)];
    return {
      id: `${category.id}-slot-${index}`,
      label: index === 0 ? "主体" : index === 1 ? "风格" : index === 2 ? "光照" : "补充",
      categoryName: source?.name ?? "选择预设分类",
    };
  });
}

export function presetFolderChildren(category: DemoCategory, parentId: string | null) {
  return category.folders
    .filter((folder) => (folder.parentId ?? null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function presetFolderBreadcrumb(category: DemoCategory, folderId: string | null) {
  const path: DemoPresetFolder[] = [];
  let currentId = folderId;

  while (currentId) {
    const folder = category.folders.find((item) => item.id === currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentId;
  }

  return path;
}

export function presetLibraryItems(category: DemoCategory): PresetLibraryItem[] {
  if (category.type === "group") {
    return category.groups.map((group) => ({
      id: group.id,
      kind: "group",
      name: group.name,
      slug: group.slug,
      folderId: group.folderId,
      href: `/preset-groups/${group.id}`,
      meta: `${group.memberCount} members`,
      description: group.members.slice(0, 4).join(" / ") || "尚未添加成员",
    }));
  }

  return category.presets.map((preset) => ({
    id: preset.id,
    kind: "preset",
    name: preset.name,
    slug: preset.slug,
    folderId: preset.folderId,
    href: `/presets/${preset.id}`,
    meta: `${preset.variantCount} variants`,
    description: preset.notes || preset.variants[0]?.prompt || "没有备注",
  }));
}

export function batchItemKey(kind: PresetLibraryItemKind, id: string, variantId?: string | null) {
  return `${kind}:${id}:${variantId ?? "default"}`;
}

export function batchImportFromPreset(category: DemoCategory, preset: DemoPreset, variant = preset.variants[0]): BatchImportItem {
  return {
    key: batchItemKey("preset", preset.id, variant?.id),
    kind: "preset",
    id: preset.id,
    name: preset.name,
    categoryId: category.id,
    folderId: preset.folderId,
    variantId: variant?.id ?? null,
    variants: preset.variants.map((item) => ({ id: item.id, name: item.name })),
    sourceLabel: category.name,
    meta: variant?.name ? `${variant.name} · ${preset.variantCount} variants` : `${preset.variantCount} variants`,
  };
}

export function batchImportFromGroup(category: DemoCategory, group: DemoPresetGroup): BatchImportItem {
  return {
    key: batchItemKey("group", group.id),
    kind: "group",
    id: group.id,
    name: group.name,
    categoryId: category.id,
    folderId: group.folderId,
    variantId: null,
    variants: [],
    sourceLabel: category.name,
    meta: `${group.memberCount} members · ${group.members.slice(0, 3).join(" / ") || "待配置"}`,
  };
}

export function projectBatchBindings(project: DemoProject, categories: DemoCategory[]) {
  const presets = categories.flatMap((category) => category.presets.map((preset) => ({ category, preset })));
  const matched = project.presetNames
    .map((name) => presets.find((item) => item.preset.name === name || item.preset.slug === name))
    .filter(Boolean) as Array<{ category: DemoCategory; preset: DemoPreset }>;
  const source = matched.length > 0 ? matched : presets.slice(0, 3);

  return source.slice(0, 4).map(({ category, preset }) => ({
    id: preset.id,
    name: preset.name,
    categoryName: category.name,
    variants: preset.variants.map((variant) => ({ id: variant.id, name: variant.name })),
  }));
}

export function presetFolderItemCount(category: DemoCategory, folderId: string | null) {
  const childCount = presetFolderChildren(category, folderId).length;
  const itemCount = presetLibraryItems(category).filter((item) => (item.folderId ?? null) === folderId).length;
  return childCount + itemCount;
}

export function presetFolderOptions(category: DemoCategory) {
  const options: Array<{ id: string | null; name: string; depth: number; count: number }> = [
    { id: null, name: "根目录", depth: 0, count: presetFolderItemCount(category, null) },
  ];

  function visit(parentId: string | null, depth: number) {
    for (const folder of presetFolderChildren(category, parentId)) {
      options.push({
        id: folder.id,
        name: folder.name,
        depth,
        count: presetFolderItemCount(category, folder.id),
      });
      visit(folder.id, depth + 1);
    }
  }

  visit(null, 1);
  return options;
}

export function assetKind(asset: DemoAsset): ModelKind {
  const text = `${asset.modelType} ${asset.category} ${asset.relativePath} ${asset.fileName}`.toLowerCase();
  return text.includes("checkpoint") || text.includes("ckpt") ? "checkpoint" : "lora";
}

export function assetPath(asset: DemoAsset) {
  return (asset.relativePath || asset.fileName).replace(/\\/g, "/");
}

export function pathParts(value: string) {
  return value.split("/").filter(Boolean);
}

export function entriesForPath(assets: DemoAsset[], currentPath: string) {
  const currentParts = pathParts(currentPath);
  const folders = new Map<string, { name: string; path: string; count: number }>();
  const files: DemoAsset[] = [];

  for (const asset of assets) {
    const parts = pathParts(assetPath(asset));
    const inPath = currentParts.every((part, index) => parts[index] === part);
    if (!inPath) continue;

    const rest = parts.slice(currentParts.length);
    if (rest.length > 1) {
      const folderPath = [...currentParts, rest[0]].join("/");
      const folder = folders.get(folderPath) ?? { name: rest[0], path: folderPath, count: 0 };
      folder.count += 1;
      folders.set(folderPath, folder);
    } else if (rest.length === 1 || currentParts.length === 0) {
      if (rest.length <= 1) files.push(asset);
    }
  }

  return {
    folders: [...folders.values()].sort((a, b) => a.name.localeCompare(b.name)),
    files: files.sort((a, b) => assetPath(a).localeCompare(assetPath(b))),
  };
}

export function folderEntriesForAssets(assets: DemoAsset[]) {
  const folders = new Map<string, { name: string; path: string; count: number; depth: number }>();

  for (const asset of assets) {
    const folderParts = pathParts(assetPath(asset)).slice(0, -1);
    for (let index = 0; index < folderParts.length; index += 1) {
      const path = folderParts.slice(0, index + 1).join("/");
      const entry = folders.get(path) ?? {
        name: folderParts[index],
        path,
        count: 0,
        depth: index + 1,
      };
      entry.count += 1;
      folders.set(path, entry);
    }
  }

  return [
    { name: "根目录", path: "", count: assets.length, depth: 0 },
    ...[...folders.values()].sort((a, b) => a.path.localeCompare(b.path)),
  ];
}

export function parentPath(currentPath: string) {
  return pathParts(currentPath).slice(0, -1).join("/");
}
