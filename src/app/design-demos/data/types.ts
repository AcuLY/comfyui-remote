export type DemoImage = {
  id: string;
  src: string;
  full: string;
  label: string;
  status: "pending" | "kept" | "trashed";
  featured: boolean;
  featured2: boolean;
  cover: boolean;
  width: number | null;
  height: number | null;
};

export type DemoSection = {
  id: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  aspectRatio: string;
  batchSize: number;
  shortSidePx: number;
  seedPolicy1: string;
  seedPolicy2: string;
  positivePrompt: string;
  negativePrompt: string;
  checkpointName: string;
  projectCheckpointName?: string | null;
  upscaleFactor: number;
  ksampler1: {
    steps: number;
    cfg: number;
    sampler_name: string;
    scheduler: string;
  };
  ksampler2: {
    steps: number;
    cfg: number;
    sampler_name: string;
    scheduler: string;
  };
  promptBlockCount: number;
  loraCount: number;
  lora1?: unknown[];
  lora2?: unknown[];
  images: DemoImage[];
  latestRunIndex?: number;
  latestRunAt?: string;
  presetBindings?: Array<{
    id: string;
    kind: "preset" | "group";
    categoryId: string;
    categoryName: string;
    categoryColor: string | null;
    name: string;
    variantId?: string;
    variantName?: string;
    blockCount: number;
    loraCount: number;
  }>;
  changeHistory?: Array<{
    id: string;
    timestamp: string;
    dimension: string;
    title: string;
    before: string | null;
    after: string | null;
    diff?: Array<{ field: string; before: string; after: string }>;
  }>;
};

export type DemoProject = {
  id: string;
  title: string;
  slug: string;
  folderId: string | null;
  status: string;
  updatedAt: string;
  notes: string;
  checkpointName: string;
  presetNames: string[];
  sectionCount: number;
  sections: DemoSection[];
  images: DemoImage[];
};

export type DemoProjectFolder = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  projectCount: number;
  childCount: number;
};

export type DemoRun = {
  id: string;
  projectId: string;
  sectionId: string;
  projectTitle: string;
  sectionName: string;
  status: string;
  runIndex: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  imageCount: number;
  pendingCount: number;
  executionMeta: Record<string, unknown> | null;
  images: DemoImage[];
};

export type DemoPresetVariantLoraBinding = {
  path: string;
  weight: number;
  enabled: boolean;
  name?: string | null;
  source?: string | null;
  bindingId?: string | null;
  presetId?: string | null;
  variantId?: string | null;
};

export type DemoPresetLinkedVariant = {
  presetId: string;
  variantId: string;
};

export type DemoPresetVariant = {
  id: string;
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string;
  lora1: DemoPresetVariantLoraBinding[];
  lora2: DemoPresetVariantLoraBinding[];
  linkedVariants: DemoPresetLinkedVariant[];
};

export type DemoPreset = {
  id: string;
  categoryId: string;
  folderId: string | null;
  name: string;
  slug: string;
  notes: string;
  civitaiLinks: string[];
  variantCount: number;
  variants: DemoPresetVariant[];
};

export type DemoPresetGroup = {
  id: string;
  categoryId: string;
  folderId: string | null;
  name: string;
  slug: string;
  memberCount: number;
  members: string[];
};

export type DemoPresetFolder = {
  id: string;
  categoryId: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type DemoCategory = {
  id: string;
  name: string;
  slug: string;
  type: string;
  color: string | null;
  presetCount: number;
  groupCount: number;
  folders: DemoPresetFolder[];
  presets: DemoPreset[];
  groups: DemoPresetGroup[];
};

export type DemoTemplate = {
  id: string;
  name: string;
  description: string;
  sectionCount: number;
  updatedAt: string;
  sections: Array<{
    id: string;
    name: string;
    sortOrder: number;
    aspectRatio: string;
    batchSize: number;
    notes: string;
  }>;
};

export type DemoAsset = {
  id: string;
  name: string;
  modelType: string;
  category: string;
  fileName: string;
  relativePath: string;
  sizeLabel: string;
  source: string;
  notes: string;
  triggerWords: string;
};

export type DemoAuditLog = {
  id: string;
  entityType: string;
  action: string;
  actorType: string;
  createdAt: string;
};

export type DemoData = {
  source: {
    loadedFromSqlite: boolean;
    databaseLabel: string;
    imageSourceLabel: string;
    modelBaseLabel: string;
    comfyApiLabel: string;
    warning: string | null;
  };
  metrics: {
    projects: number;
    sections: number;
    runs: number;
    pendingImages: number;
    presets: number;
    templates: number;
    loras: number;
  };
  projectFolders: DemoProjectFolder[];
  projects: DemoProject[];
  runs: DemoRun[];
  categories: DemoCategory[];
  templates: DemoTemplate[];
  loras: DemoAsset[];
  models: DemoAsset[];
  auditLogs: DemoAuditLog[];
  images: DemoImage[];
};
