import type { ComponentType } from "react";

import type { DemoData, DemoTemplate } from "../data/types";

export type RouteIcon = ComponentType<{ className?: string }>;

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
  | "fonts"
  | "logs"
  | "monitor"
  | "component-showcase"
  | "component-showcase-controls"
  | "component-showcase-surfaces"
  | "component-showcase-unit-items"
  | "component-showcase-folders"
  | "component-showcase-batch-actions"
  | "component-showcase-generation-params"
  | "component-showcase-preset-prompt-lora"
  | "component-showcase-taxonomy-history"
  | "component-showcase-images"
  | "component-showcase-runs"
  | "component-showcase-system"
  | "component-showcase-icons"
  | "component-showcase-headers"
  | "not-found";

export type Match = {
  key: RouteKey;
  params: Record<string, string>;
  route: string;
};

export type DemoTheme = "dark" | "light";
export type QueueDemoTab = "pending" | "running" | "failed";
export type ModelKind = "lora" | "checkpoint";
export type ModelBrowserState = "ready" | "loading" | "error" | "empty";
export type ResultDemoFilter = "all" | "pending" | "kept" | "pstation" | "preview" | "cover";
export type ProjectCardView = "sections" | "results";
export type LogDemoSource = "app" | "console";
export type SectionNavMode = "detail" | "project-results" | "editor";
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
  icon: RouteIcon;
};

export type NavLinkDef = {
  href: string;
  label: string;
  group: string;
  icon: RouteDef["icon"];
  count?: (data: DemoData) => number;
  activePrefix?: string | string[];
};
