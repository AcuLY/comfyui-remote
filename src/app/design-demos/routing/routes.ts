import {
  Activity,
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
  Settings2,
  Rows3,
  Settings,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Wand2,
} from "lucide-react";

import type { DemoData } from "../data/types";
import { firstGroup, firstPreset, firstProject, firstRun, firstSection, firstTemplate } from "../data/selectors";
import { buildLoraTrainingDemoData } from "../data/lora-training";
import { rawSectionId } from "@/components/design-demo-ui/media/image-status";
import {
  buildWorkModeResourceTargetList,
  type WorkModeResourceKey,
  type WorkModeResourceTarget,
} from "@/lib/work-mode-resources";
import type { Match, NavLinkDef, RouteDef } from "./types";
import { SHOWCASE_ROUTE_METADATA } from "./showcase-routes";
import type { ShowcaseFamilyId } from "./showcase-routes";

const SHOWCASE_ROUTE_ICONS: Record<ShowcaseFamilyId, RouteDef["icon"]> = {
  controls: Layers,
  surfaces: PanelTop,
  "unit-items": Archive,
  folders: FolderTree,
  "batch-actions": Rows3,
  "generation-params": SlidersHorizontal,
  "preset-prompt-lora": Wand2,
  "taxonomy-history": Shuffle,
  images: ImageIcon,
  runs: ClipboardList,
  system: Settings2,
  headers: PanelTop,
  icons: Tags,
};

const SHOWCASE_ROUTE_DEFS: RouteDef[] = SHOWCASE_ROUTE_METADATA.map((family) => ({
  key: family.route.slice(1) as RouteDef["key"],
  pattern: family.route,
  title: family.title,
  group: "组件审查",
  icon: SHOWCASE_ROUTE_ICONS[family.id],
}));

export const ROUTES: RouteDef[] = [
  { key: "root", pattern: "/", title: "任务", group: "核心", icon: Home },
  { key: "queue-review", pattern: "/runs/:runId", title: "审核宫格", group: "核心", icon: Grid3X3 },
  { key: "queue", pattern: "/runs", title: "任务", group: "核心", icon: ClipboardList },
  { key: "training-generation-run-detail", pattern: "/training/runs/generation/:taskId", title: "生成任务详情", group: "LoRA 训练", icon: Wand2 },
  { key: "training-training-run-detail", pattern: "/training/runs/training/:trainingRunId", title: "训练任务详情", group: "LoRA 训练", icon: Activity },
  { key: "training-runs", pattern: "/training/runs", title: "训练运行", group: "LoRA 训练", icon: ClipboardList },
  { key: "training-project-new", pattern: "/training/projects/new", title: "新建训练项目", group: "LoRA 训练", icon: Plus },
  { key: "training-generation-compose", pattern: "/training/projects/:trainingProjectId/sections/:sectionId/generation-tasks/new", title: "新建生成任务", group: "LoRA 训练", icon: Wand2 },
  { key: "training-project-dataset-revision", pattern: "/training/projects/:trainingProjectId/dataset/revisions/:revisionId", title: "数据集版本", group: "LoRA 训练", icon: Archive },
  { key: "training-project-section-detail", pattern: "/training/projects/:trainingProjectId/sections/:sectionId", title: "训练小节详情", group: "LoRA 训练", icon: SlidersHorizontal },
  { key: "training-project-profile", pattern: "/training/projects/:trainingProjectId/profile", title: "角色资料", group: "LoRA 训练", icon: FileText },
  { key: "training-project-sections", pattern: "/training/projects/:trainingProjectId/sections", title: "训练小节", group: "LoRA 训练", icon: ListChecks },
  { key: "training-project-results", pattern: "/training/projects/:trainingProjectId/results", title: "训练结果池", group: "LoRA 训练", icon: ImageIcon },
  { key: "training-project-dataset", pattern: "/training/projects/:trainingProjectId/dataset", title: "训练数据集", group: "LoRA 训练", icon: Database },
  { key: "training-project-training-runs", pattern: "/training/projects/:trainingProjectId/training-runs", title: "项目训练任务", group: "LoRA 训练", icon: Activity },
  { key: "training-project-generation-tasks", pattern: "/training/projects/:trainingProjectId/generation-tasks", title: "项目生成任务", group: "LoRA 训练", icon: Wand2 },
  { key: "training-project-detail", pattern: "/training/projects/:trainingProjectId", title: "训练项目详情", group: "LoRA 训练", icon: FolderTree },
  { key: "training-projects", pattern: "/training/projects", title: "训练项目", group: "LoRA 训练", icon: FolderTree },
  { key: "training-preset-sort-rules", pattern: "/training/presets/sort-rules", title: "训练预制排序", group: "LoRA 训练", icon: Shuffle },
  { key: "training-preset-new", pattern: "/training/presets/new", title: "新建训练预制", group: "LoRA 训练", icon: Plus },
  { key: "training-preset-detail", pattern: "/training/presets/:presetId", title: "训练预制详情", group: "LoRA 训练", icon: Wand2 },
  { key: "training-presets", pattern: "/training/presets", title: "训练预制", group: "LoRA 训练", icon: Tags },
  { key: "training-template-new", pattern: "/training/templates/new", title: "新建训练模板", group: "LoRA 训练", icon: Plus },
  { key: "training-template-section", pattern: "/training/templates/:templateId/sections/:sectionIndex", title: "训练模板小节", group: "LoRA 训练", icon: ListChecks },
  { key: "training-template-edit", pattern: "/training/templates/:templateId/edit", title: "编辑训练模板", group: "LoRA 训练", icon: Edit3 },
  { key: "training-templates", pattern: "/training/templates", title: "训练模板", group: "LoRA 训练", icon: FileText },
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
  { key: "component-showcase", pattern: "/component-showcase", title: "组件展示总览", group: "组件审查", icon: Layers },
  ...SHOWCASE_ROUTE_DEFS,
  { key: "login", pattern: "/login", title: "登录", group: "系统", icon: Lock },
];

export type DesignDemoWorkMode = "generation" | "lora_training";

export const WORK_MODE_STORAGE_KEY = "comfyui-manager:work-mode";
export const WORK_MODE_CHANGE_EVENT = "comfyui-manager:work-mode-change";

const RESOURCE_LINK_ICONS: Record<WorkModeResourceKey, RouteDef["icon"]> = {
  runs: ClipboardList,
  projects: FolderTree,
  presets: Tags,
  templates: FileText,
  models: Database,
  settings: Settings,
};

function resourceLinkCount(key: WorkModeResourceKey, workMode: DesignDemoWorkMode): NavLinkDef["count"] | undefined {
  switch (key) {
    case "runs":
      return workMode === "generation" ? (data) => data.runs.length : (data) => buildLoraTrainingDemoData(data).runs.length;
    case "projects":
      return workMode === "generation" ? (data) => data.projects.length : (data) => buildLoraTrainingDemoData(data).projects.length;
    case "presets":
      return workMode === "generation" ? (data) => data.metrics.presets : (data) => buildLoraTrainingDemoData(data).presets.length;
    case "templates":
      return workMode === "generation" ? (data) => data.templates.length : (data) => buildLoraTrainingDemoData(data).templates.length;
    case "models":
      return (data) => data.models.length;
    case "settings":
      return undefined;
  }
}

function resourceLinkGroup(target: WorkModeResourceTarget) {
  if (target.key === "settings") return "系统";
  if (target.owner === "shared") return "资源";
  return "工作区";
}

function resourceHrefForDemoShell(target: WorkModeResourceTarget) {
  return target.owner === "generation" ? normalizeProductRoute(target.href) : target.href;
}

function resourceActivePrefixForDemoShell(target: WorkModeResourceTarget, href: string): NavLinkDef["activePrefix"] | undefined {
  const prefixes = Array.isArray(target.activePrefix) ? target.activePrefix : [target.activePrefix ?? target.href];
  const normalizedPrefixes = prefixes.map((prefix) => normalizeProductRoute(prefix));
  const combined = [...new Set([...prefixes, ...normalizedPrefixes])];
  if (target.activePrefix) return combined.length === 1 ? combined[0] : combined;
  if (combined.length === 1 && combined[0] === href) return undefined;
  return combined;
}

const GENERATION_ROUTE_PREFIXES = buildWorkModeResourceTargetList("generation")
  .filter((target) => target.owner === "generation")
  .map((target) => normalizeProductRoute(target.href));
const LORA_TRAINING_ROUTE_PREFIXES = buildWorkModeResourceTargetList("lora_training")
  .filter((target) => target.owner === "lora_training")
  .map((target) => target.href);

export function isDesignDemoWorkModeValue(value: string | null): value is DesignDemoWorkMode {
  return value === "generation" || value === "lora_training";
}

export function inferWorkModeFromRoute(route: string): DesignDemoWorkMode | null {
  if (LORA_TRAINING_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) {
    return "lora_training";
  }
  if (GENERATION_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) {
    return "generation";
  }
  return null;
}

export function resolveWorkModeForRoute(route: string, storedMode: DesignDemoWorkMode): DesignDemoWorkMode {
  return inferWorkModeFromRoute(route) ?? storedMode;
}

export function buildWorkModeNavLinks(workMode: DesignDemoWorkMode): NavLinkDef[] {
  return buildWorkModeResourceTargetList(workMode).map((target) => {
    const href = resourceHrefForDemoShell(target);
    const activePrefix = resourceActivePrefixForDemoShell(target, href);
    const count = resourceLinkCount(target.key, workMode);

    return {
      href,
      label: target.label,
      group: resourceLinkGroup(target),
      icon: RESOURCE_LINK_ICONS[target.key],
      ...(count ? { count } : {}),
      ...(activePrefix ? { activePrefix } : {}),
    };
  });
}

export const NAV_LINKS: NavLinkDef[] = buildWorkModeNavLinks("generation");

export const MOBILE_NAV_LINKS: NavLinkDef[] = NAV_LINKS;

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
  const training = buildLoraTrainingDemoData(data);
  const trainingProject = training.projects[0];
  const trainingSection = trainingProject?.sections[0];
  const trainingDatasetRevision = trainingProject?.datasetRevisions[0];
  const trainingGenerationRun = training.runs.find((item) => item.kind === "generation");
  const trainingTrainingRun = training.runs.find((item) => item.kind === "training");
  const trainingPreset = training.presets[0];
  const trainingTemplate = training.templates[0];

  return ROUTES.map((route) => {
    let sample = route.pattern;
    if (route.key.startsWith("training-")) {
      sample = sample.replace(":taskId", trainingGenerationRun?.id ?? "training-task-id");
      sample = sample.replace(":trainingRunId", trainingTrainingRun?.id ?? "training-run-id");
      sample = sample.replace(":trainingProjectId", trainingProject?.id ?? "training-project-id");
      sample = sample.replace(":revisionId", trainingDatasetRevision?.id ?? "revision-id");
      sample = sample.replace(":sectionId", trainingSection?.id ?? "section-id");
      sample = sample.replace(":presetId", trainingPreset?.id ?? "preset-id");
      sample = sample.replace(":templateId", trainingTemplate?.id ?? "template-id");
    } else {
      sample = sample.replace(":runId", run?.id ?? "run-id");
      sample = sample.replace(":projectId", project?.id ?? "project-id");
      sample = sample.replace(":sectionId", sectionId);
      sample = sample.replace(":categoryId", data.categories[0]?.id ?? "category-id");
      sample = sample.replace(":presetId", preset?.id ?? "preset-id");
      sample = sample.replace(":groupId", group?.id ?? "group-id");
      sample = sample.replace(":templateId", template?.id ?? "template-id");
    }
    sample = sample.replace(":sectionIndex", "0");
    return { ...route, sample };
  });
}
