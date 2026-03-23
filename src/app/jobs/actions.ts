"use server";

import { refresh, revalidatePath } from "next/cache";

export type JobSaveState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialJobSaveState: JobSaveState = {
  status: "idle",
  message: "Update the fields and save them to the backend.",
};

type MutationApiResponse = {
  ok?: boolean;
  error?: {
    message?: string;
  };
};

function getApiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, baseUrl).toString();
}

function getRequiredId(formData: FormData, fieldName: string, label: string) {
  const value = String(formData.get(fieldName) ?? "").trim();

  if (!value) {
    return {
      error: {
        status: "error" as const,
        message: `${label} is missing.`,
      },
    };
  }

  return { value };
}

function getNullableString(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "");
  return value.trim() ? value : null;
}

function getPositiveInteger(formData: FormData, fieldName: string, label: string) {
  const rawValue = String(formData.get(fieldName) ?? "").trim();

  if (!rawValue) {
    return { value: null };
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return {
      error: {
        status: "error" as const,
        message: `${label} must be a positive integer.`,
      },
    };
  }

  return { value: parsedValue };
}

export async function saveJobEditAction(_prevState: JobSaveState, formData: FormData): Promise<JobSaveState> {
  const jobId = getRequiredId(formData, "jobId", "Job id");
  if ("error" in jobId) {
    return jobId.error;
  }

  const batchSize = getPositiveInteger(formData, "batchSize", "Batch size");
  if ("error" in batchSize) {
    return batchSize.error;
  }

  const payload = {
    characterPrompt: String(formData.get("characterPrompt") ?? ""),
    scenePrompt: getNullableString(formData, "scenePrompt"),
    stylePrompt: getNullableString(formData, "stylePrompt"),
    characterLoraPath: String(formData.get("characterLoraPath") ?? "").trim(),
    aspectRatio: getNullableString(formData, "aspectRatio"),
    batchSize: batchSize.value,
  };

  try {
    const response = await fetch(getApiUrl(`/api/jobs/${encodeURIComponent(jobId.value)}`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = (await response.json().catch(() => null)) as MutationApiResponse | null;

    if (!response.ok || !result?.ok) {
      return {
        status: "error",
        message: result?.error?.message ?? `Request failed with status ${response.status}.`,
      };
    }

    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId.value}`);
    refresh();

    return {
      status: "success",
      message: "Saved job prompts and defaults.",
    };
  } catch {
    return {
      status: "error",
      message: "The job API is unavailable right now.",
    };
  }
}

export async function saveJobPositionEditAction(
  _prevState: JobSaveState,
  formData: FormData,
): Promise<JobSaveState> {
  const jobId = getRequiredId(formData, "jobId", "Job id");
  if ("error" in jobId) {
    return jobId.error;
  }

  const positionId = getRequiredId(formData, "positionId", "Position id");
  if ("error" in positionId) {
    return positionId.error;
  }

  const batchSize = getPositiveInteger(formData, "batchSize", "Batch size");
  if ("error" in batchSize) {
    return batchSize.error;
  }

  const payload = {
    positivePrompt: getNullableString(formData, "positivePrompt"),
    negativePrompt: getNullableString(formData, "negativePrompt"),
    aspectRatio: getNullableString(formData, "aspectRatio"),
    batchSize: batchSize.value,
    seedPolicy: getNullableString(formData, "seedPolicy"),
  };

  try {
    const response = await fetch(
      getApiUrl(`/api/jobs/${encodeURIComponent(jobId.value)}/positions/${encodeURIComponent(positionId.value)}`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
    );

    const result = (await response.json().catch(() => null)) as MutationApiResponse | null;

    if (!response.ok || !result?.ok) {
      return {
        status: "error",
        message: result?.error?.message ?? `Request failed with status ${response.status}.`,
      };
    }

    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId.value}`);
    refresh();

    return {
      status: "success",
      message: "Saved position overrides.",
    };
  } catch {
    return {
      status: "error",
      message: "The position API is unavailable right now.",
    };
  }
}
