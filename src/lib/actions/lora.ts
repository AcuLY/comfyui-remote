"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saveUploadedLora } from "@/server/services/lora-upload-service";

// ---------------------------------------------------------------------------
// LoRA 上传 — 委托给 lora-upload-service（统一使用 LORA_BASE_DIR）
// ---------------------------------------------------------------------------

export async function uploadLora(formData: FormData) {
  const file = formData.get("file") as File | null;
  const category = formData.get("category") as string;

  if (!file || !file.name) {
    throw new Error("请选择文件");
  }

  await saveUploadedLora(file, category);

  revalidatePath("/assets/loras");
}
