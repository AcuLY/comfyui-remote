"use server";

import { refresh } from "next/cache";
import { keepRunImages, trashRunImages, mapReviewError } from "@/server/services/review-service";

export type ReviewMutationState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialReviewMutationState: ReviewMutationState = {
  status: "idle",
  message: "选择图片后即可提交到真实审图 API。",
};

export async function submitReviewSelectionAction(
  runId: string,
  _prevState: ReviewMutationState,
  formData: FormData,
): Promise<ReviewMutationState> {
  const action = String(formData.get("action") ?? "").trim();
  const rawImageIds = String(formData.get("imageIds") ?? "");
  const imageIds = [...new Set(rawImageIds.split(",").map((value) => value.trim()).filter(Boolean))];

  if (!runId.trim()) {
    return { status: "error", message: "Run id is missing." };
  }
  if (action !== "keep" && action !== "trash") {
    return { status: "error", message: "Choose a valid review action." };
  }
  if (imageIds.length === 0) {
    return { status: "error", message: "Select at least one image first." };
  }

  try {
    if (action === "keep") {
      await keepRunImages(runId, { imageIds });
    } else {
      await trashRunImages(runId, { imageIds });
    }

    refresh();

    return {
      status: "success",
      message: action === "keep"
        ? `已提交 ${imageIds.length} 张图片的保留操作。`
        : `已提交 ${imageIds.length} 张图片的删除操作。`,
    };
  } catch (error) {
    const mapped = mapReviewError(error);
    return { status: "error", message: mapped.message };
  }
}
