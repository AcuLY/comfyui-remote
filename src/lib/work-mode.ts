export type WorkMode = "generation" | "lora_training";

export const WORK_MODE_STORAGE_KEY = "comfyui-manager:work-mode";
export const WORK_MODE_CHANGE_EVENT = "comfyui-manager:work-mode-change";

const GENERATION_ROUTE_PREFIXES = [
  "/queue",
  "/projects",
  "/assets/presets",
  "/assets/templates",
] as const;

const LORA_TRAINING_ROUTE_PREFIXES = [
  "/training/runs",
  "/training/projects",
  "/training/presets",
  "/training/templates",
] as const;

function isRouteUnder(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isWorkModeValue(value: string | null): value is WorkMode {
  return value === "generation" || value === "lora_training";
}

export function resolveStoredWorkMode(value: string | null): WorkMode {
  return isWorkModeValue(value) ? value : "generation";
}

export function inferWorkModeFromPathname(pathname: string): WorkMode | null {
  if (LORA_TRAINING_ROUTE_PREFIXES.some((prefix) => isRouteUnder(pathname, prefix))) {
    return "lora_training";
  }

  if (GENERATION_ROUTE_PREFIXES.some((prefix) => isRouteUnder(pathname, prefix))) {
    return "generation";
  }

  return null;
}

export function resolveWorkModeForPathname(pathname: string, storedMode: WorkMode): WorkMode {
  return inferWorkModeFromPathname(pathname) ?? storedMode;
}
