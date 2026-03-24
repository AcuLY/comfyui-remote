"use server";

import { refresh } from "next/cache";

export type ReviewMutationState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialReviewMutationState: ReviewMutationState = {
  status: "idle",
  message: "选择图片后即可提交到真实审图 API。",
};

type ReviewApiResponse = {
  ok?: boolean;
  error?: {
    message?: string;
  };
};

function getApiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, baseUrl).toString();
}

export async function submitReviewSelectionAction(
  runId: string,
  _prevState: ReviewMutationState,
  formData: FormData,
): Promise<ReviewMutationState> {
  const action = String(formData.get("action") ?? "").trim();
  const rawImageIds = String(formData.get("imageIds") ?? "");
  const imageIds = [...new Set(rawImageIds.split(",").map((value) => value.trim()).filter(Boolean))];

  if (!runId.trim()) {
    return {
      status: "error",
      message: "Run id is missing.",
    };
  }

  if (action !== "keep" && action !== "trash") {
    return {
      status: "error",
      message: "Choose a valid review action.",
    };
  }

  if (imageIds.length === 0) {
    return {
      status: "error",
      message: "Select at least one image first.",
    };
  }

  try {
    const response = await fetch(getApiUrl(`/api/runs/${encodeURIComponent(runId)}/review/${action}`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageIds }),
      cache: "no-store",
    });

    const result = (await response.json().catch(() => null)) as ReviewApiResponse | null;

    if (!response.ok || !result?.ok) {
      return {
        status: "error",
        message: result?.error?.message ?? `Review request failed with status ${response.status}.`,
      };
    }

    refresh();

    return {
      status: "success",
      message: action === "keep"
        ? `已提交 ${imageIds.length} 张图片的保留操作。`
        : `已提交 ${imageIds.length} 张图片的删除操作。`,
    };
  } catch {
    return {
      status: "error",
      message: "Review API is unavailable right now.",
    };
  }
}
