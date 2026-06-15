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

export function buildWorkModeResourceTargets(workMode: WorkMode): WorkModeResourceTargetMap {
  return WORK_MODE_RESOURCE_TARGETS[workMode];
}

export function buildWorkModeResourceTargetList(workMode: WorkMode): WorkModeResourceTarget[] {
  const targets = buildWorkModeResourceTargets(workMode);
  return WORK_MODE_RESOURCE_ORDER.map((key) => targets[key]);
}
