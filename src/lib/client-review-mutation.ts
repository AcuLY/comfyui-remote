export type ReviewMutationAction = "keep" | "trash";

type ReviewMutationResponse = {
  ok?: boolean;
  data?: {
    action: ReviewMutationAction;
    count: number;
    imageIds: string[];
  };
  error?: {
    message?: string;
  };
};

export async function submitReviewMutation(
  action: ReviewMutationAction,
  imageIds: string[],
) {
  const response = await fetch("/api/image-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, imageIds }),
  });

  const result = (await response.json().catch(() => null)) as ReviewMutationResponse | null;

  if (!response.ok || result?.ok === false) {
    throw new Error(result?.error?.message ?? "Review action failed");
  }

  return result?.data ?? { action, count: imageIds.length, imageIds };
}
