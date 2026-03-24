"use server";

import { refresh } from "next/cache";
import type { LoraUploadState } from "./lora-upload";

type UploadApiResponse = {
  ok?: boolean;
  data?: {
    name?: string;
  };
  error?: {
    message?: string;
    details?: unknown;
  };
};

function getApiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, baseUrl).toString();
}

export async function uploadLoraAction(_prevState: LoraUploadState, formData: FormData): Promise<LoraUploadState> {
  const category = String(formData.get("category") ?? "").trim();
  const file = formData.get("file");

  if (!category) {
    return {
      status: "error",
      message: "Choose a category before uploading.",
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Choose a file before uploading.",
    };
  }

  const payload = new FormData();
  payload.set("category", category);
  payload.set("file", file);

  try {
    const response = await fetch(getApiUrl("/api/loras"), {
      method: "POST",
      body: payload,
    });

    const result = (await response.json().catch(() => null)) as UploadApiResponse | null;

    if (!response.ok || !result?.ok) {
      return {
        status: "error",
        message: result?.error?.message ?? `Upload failed with status ${response.status}.`,
      };
    }

    refresh();

    return {
      status: "success",
      message: `Uploaded ${result.data?.name ?? file.name}.`,
    };
  } catch {
    return {
      status: "error",
      message: "Upload failed because the LoRA API is unavailable.",
    };
  }
}
