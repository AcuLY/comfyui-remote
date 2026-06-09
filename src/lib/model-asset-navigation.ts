import type { ModelKind } from "@/lib/model-constants";

export const MODEL_SELECTION_KIND_PARAM = "kind";
export const MODEL_SELECTION_PATH_PARAM = "path";

function normalizeModelPath(path: string) {
  return path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

export function buildModelAssetSelectionHref(kind: ModelKind, filePath: string) {
  const params = new URLSearchParams();
  params.set(MODEL_SELECTION_KIND_PARAM, kind);

  const normalizedPath = normalizeModelPath(filePath);
  if (normalizedPath) {
    params.set(MODEL_SELECTION_PATH_PARAM, normalizedPath);
  }

  return `/assets/models?${params.toString()}`;
}

export function modelSelectionDirectory(filePath: string) {
  const normalizedPath = normalizeModelPath(filePath);
  const index = normalizedPath.lastIndexOf("/");
  return index === -1 ? "" : normalizedPath.slice(0, index);
}

export function modelKindFromSearchParam(value: string | null): ModelKind {
  return value === "checkpoint" ? "checkpoint" : "lora";
}

export function modelPathFromSearchParam(value: string | null) {
  return value ? normalizeModelPath(value) : "";
}
