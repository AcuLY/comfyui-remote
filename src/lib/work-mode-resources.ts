import type { WorkMode } from "@/lib/work-mode";

export type WorkModeResourceKey =
  | "runs"
  | "projects"
  | "presets"
  | "templates"
  | "models"
  | "settings";

export type WorkModeResourceOwner = WorkMode | "shared";

export type WorkModeResourceTarget = {
  activePrefix?: string | string[];
  href: string;
  key: WorkModeResourceKey;
  label: string;
  owner: WorkModeResourceOwner;
};

type WorkModeResourceTargetMap = Record<WorkModeResourceKey, WorkModeResourceTarget>;
export type WorkModeModuleOwnedResourceKey = Exclude<WorkModeResourceKey, "models" | "settings">;
export type WorkModeSharedResourceKey = Extract<WorkModeResourceKey, "models" | "settings">;

export type WorkModeResourceBoundary = {
  forbiddenGenerationEntrypoints: string[];
  forbiddenGenerationUiRoutes: string[];
  forbiddenTrainingEntrypoints: string[];
  forbiddenTrainingUiRoutes: string[];
  guidance: string;
  moduleOwnedResources: Record<WorkModeModuleOwnedResourceKey, { apiEntrypoint: string; uiRoute: string }>;
  sharedResources: Record<WorkModeSharedResourceKey, { apiEntrypoints: string[]; uiRoute: string }>;
};

const SHARED_RESOURCE_TARGETS = {
  models: {
    key: "models",
    href: "/assets/models",
    label: "模型",
    owner: "shared",
    activePrefix: ["/assets/models", "/assets/loras"],
  },
  settings: {
    key: "settings",
    href: "/settings",
    label: "设置",
    owner: "shared",
    activePrefix: "/settings",
  },
} satisfies Pick<WorkModeResourceTargetMap, "models" | "settings">;

export const WORK_MODE_RESOURCE_TARGETS = {
  generation: {
    runs: {
      key: "runs",
      href: "/queue",
      label: "运行",
      owner: "generation",
    },
    projects: {
      key: "projects",
      href: "/projects",
      label: "项目",
      owner: "generation",
    },
    presets: {
      key: "presets",
      href: "/assets/presets",
      label: "预制",
      owner: "generation",
      activePrefix: ["/assets/presets", "/assets/preset-groups"],
    },
    templates: {
      key: "templates",
      href: "/assets/templates",
      label: "模板",
      owner: "generation",
    },
    ...SHARED_RESOURCE_TARGETS,
  },
  lora_training: {
    runs: {
      key: "runs",
      href: "/training/runs",
      label: "运行",
      owner: "lora_training",
      activePrefix: "/training/runs",
    },
    projects: {
      key: "projects",
      href: "/training/projects",
      label: "项目",
      owner: "lora_training",
      activePrefix: "/training/projects",
    },
    presets: {
      key: "presets",
      href: "/training/presets",
      label: "预制",
      owner: "lora_training",
      activePrefix: "/training/presets",
    },
    templates: {
      key: "templates",
      href: "/training/templates",
      label: "模板",
      owner: "lora_training",
      activePrefix: "/training/templates",
    },
    ...SHARED_RESOURCE_TARGETS,
  },
} satisfies Record<WorkMode, WorkModeResourceTargetMap>;

export const WORK_MODE_RESOURCE_ORDER: WorkModeResourceKey[] = [
  "runs",
  "projects",
  "presets",
  "templates",
  "models",
  "settings",
];

export const WORK_MODE_MODULE_OWNED_RESOURCE_KEYS = [
  "runs",
  "projects",
  "presets",
  "templates",
] as const satisfies readonly WorkModeModuleOwnedResourceKey[];

export const WORK_MODE_SHARED_RESOURCE_KEYS = [
  "models",
  "settings",
] as const satisfies readonly WorkModeSharedResourceKey[];

export const WORK_MODE_MODULE_API_ENTRYPOINTS = {
  generation: {
    runs: "/api/queue-data",
    projects: "/api/projects",
    presets: "/api/presets",
    templates: "/api/templates",
  },
  lora_training: {
    runs: "/api/training/runs",
    projects: "/api/training/projects",
    presets: "/api/training/presets",
    templates: "/api/training/templates",
  },
} satisfies Record<WorkMode, Record<WorkModeModuleOwnedResourceKey, string>>;

export const WORK_MODE_SHARED_API_ENTRYPOINTS = {
  models: [
    "/api/models?kind=checkpoint",
    "/api/models?kind=lora",
    "/api/models",
    "/api/models/browse",
    "/api/models/hash",
    "/api/models/move",
    "/api/models/notes",
    "/api/loras",
    "/api/loras/browse",
    "/api/loras/move",
    "/api/loras/notes",
  ],
  settings: [],
} satisfies Record<WorkModeSharedResourceKey, string[]>;

export const WORK_MODE_FORBIDDEN_GENERATION_ENTRYPOINTS_FOR_TRAINING = [
  "/api/agent/projects",
  "/api/agent/runs",
  "/api/image-review",
  "/api/images",
  "/api/project-create-options",
  "/api/project-folders",
  "/api/preset-library",
  "/api/projects",
  "/api/presets",
  "/api/queue",
  "/api/queue-data",
  "/api/runs",
  "/api/templates",
  "/api/worker",
] as const;

export const WORK_MODE_FORBIDDEN_TRAINING_ENTRYPOINTS_FOR_GENERATION = [
  "/api/character-lora-training",
  "/api/training",
  "/api/training/projects",
  "/api/training/runs",
  "/api/training/presets",
  "/api/training/templates",
  "/api/training/scene-description",
] as const;

export const WORK_MODE_FORBIDDEN_GENERATION_UI_ROUTES_FOR_TRAINING = [
  "/queue",
  "/projects",
  "/assets/presets",
  "/assets/preset-groups",
  "/assets/templates",
] as const;

export const WORK_MODE_FORBIDDEN_TRAINING_UI_ROUTES_FOR_GENERATION = [
  "/training",
  "/training/runs",
  "/training/projects",
  "/training/presets",
  "/training/templates",
] as const;

export function buildWorkModeResourceTargets(workMode: WorkMode): WorkModeResourceTargetMap {
  return WORK_MODE_RESOURCE_TARGETS[workMode];
}

export function buildWorkModeResourceTargetList(workMode: WorkMode): WorkModeResourceTarget[] {
  const targets = buildWorkModeResourceTargets(workMode);
  return WORK_MODE_RESOURCE_ORDER.map((key) => targets[key]);
}

export function buildWorkModeResourceBoundary(workMode: WorkMode): WorkModeResourceBoundary {
  const targets = buildWorkModeResourceTargets(workMode);
  const apiEntrypoints = WORK_MODE_MODULE_API_ENTRYPOINTS[workMode];
  const moduleOwnedResources = Object.fromEntries(
    WORK_MODE_MODULE_OWNED_RESOURCE_KEYS.map((key) => [
      key,
      {
        uiRoute: targets[key].href,
        apiEntrypoint: apiEntrypoints[key],
      },
    ]),
  ) as WorkModeResourceBoundary["moduleOwnedResources"];
  const sharedResources = Object.fromEntries(
    WORK_MODE_SHARED_RESOURCE_KEYS.map((key) => [
      key,
      {
        uiRoute: targets[key].href,
        apiEntrypoints: [...WORK_MODE_SHARED_API_ENTRYPOINTS[key]],
      },
    ]),
  ) as WorkModeResourceBoundary["sharedResources"];

  if (workMode === "lora_training") {
    return {
      moduleOwnedResources,
      sharedResources,
      forbiddenGenerationEntrypoints: [...WORK_MODE_FORBIDDEN_GENERATION_ENTRYPOINTS_FOR_TRAINING],
      forbiddenGenerationUiRoutes: [...WORK_MODE_FORBIDDEN_GENERATION_UI_ROUTES_FOR_TRAINING],
      forbiddenTrainingEntrypoints: [],
      forbiddenTrainingUiRoutes: [],
      guidance:
        "Use /api/training and /training routes for training-owned runs, projects, presets, and templates. Do not use generation resource APIs such as /api/preset-library or /api/templates, or generation UI routes such as /assets/presets, as training fallbacks. Only models and settings are shared with the generation module.",
    };
  }

  return {
    moduleOwnedResources,
    sharedResources,
    forbiddenGenerationEntrypoints: [],
    forbiddenGenerationUiRoutes: [],
    forbiddenTrainingEntrypoints: [...WORK_MODE_FORBIDDEN_TRAINING_ENTRYPOINTS_FOR_GENERATION],
    forbiddenTrainingUiRoutes: [...WORK_MODE_FORBIDDEN_TRAINING_UI_ROUTES_FOR_GENERATION],
    guidance:
      "Use generation APIs and generation UI routes for generation-owned runs, projects, presets, and templates. Do not use /api/training, legacy /api/character-lora-training APIs, or /training UI routes as generation fallbacks. Only models and settings are shared with the training module.",
  };
}
