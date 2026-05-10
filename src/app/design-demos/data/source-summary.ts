import path from "node:path";

export function sourceSummary(loadedFromSqlite: boolean, databaseLabel: string, warning: string | null) {
  const modelBase = process.env.MODEL_BASE_DIR ? path.basename(process.env.MODEL_BASE_DIR) : "未配置 MODEL_BASE_DIR";
  let comfyApiLabel = "未配置 COMFY_API_URL";
  try {
    const raw = process.env.COMFY_API_URL;
    comfyApiLabel = raw ? new URL(raw).host : comfyApiLabel;
  } catch {
    comfyApiLabel = "COMFY_API_URL 格式异常";
  }

  return {
    loadedFromSqlite,
    databaseLabel,
    imageSourceLabel: "ImageResult.filePath / data/images",
    modelBaseLabel: modelBase,
    comfyApiLabel,
    warning,
  };
}
