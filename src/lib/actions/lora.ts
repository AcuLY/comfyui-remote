"use server";

import { revalidatePath } from "next/cache";
import { saveUploadedModelFile } from "@/server/services/model-asset-service";

// ---------------------------------------------------------------------------
// LoRA 上传 — 委托给模型资产服务（统一使用 MODEL_BASE_DIR/loras）
// ---------------------------------------------------------------------------

export async function uploadLora(formData: FormData) {
  const file = formData.get("file") as File | null;
  const category = formData.get("category") as string;

  if (!file || !file.name) {
    throw new Error("请选择文件");
  }

  await saveUploadedModelFile("lora", file, category);

  revalidatePath("/assets/models");
}
