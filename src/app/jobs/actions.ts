"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { JobSaveState, JobRunState, JobCopyState, JobCreateState } from "./action-types";

type MutationApiResponse = {
  ok?: boolean;
  data?: {
    id?: string;
  };
  error?: {
    message?: string;
  };
};

type MutationErrorState = {
  status: "error";
  message: string;
};

type RequiredIdResult = { value: string } | { error: MutationErrorState };
type PositiveIntegerResult = { value: number | null } | { error: MutationErrorState };

function getApiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, baseUrl).toString();
}

function getRequiredId(formData: FormData, fieldName: string, label: string): RequiredIdResult {
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

function getPositiveInteger(formData: FormData, fieldName: string, label: string): PositiveIntegerResult {
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

  const shortSidePx = getPositiveInteger(formData, "shortSidePx", "Short side px");
  if ("error" in shortSidePx) {
    return shortSidePx.error;
  }

  const payload = {
    positivePrompt: getNullableString(formData, "positivePrompt"),
    negativePrompt: getNullableString(formData, "negativePrompt"),
    aspectRatio: getNullableString(formData, "aspectRatio"),
    shortSidePx: shortSidePx.value,
    batchSize: batchSize.value,
    seedPolicy1: getNullableString(formData, "seedPolicy1"),
    seedPolicy2: getNullableString(formData, "seedPolicy2"),
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

export async function createJobAction(_prevState: JobCreateState, formData: FormData): Promise<JobCreateState> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return {
      status: "error",
      message: "Title is required.",
    };
  }

  const characterId = String(formData.get("characterId") ?? "").trim();
  if (!characterId) {
    return {
      status: "error",
      message: "Character is required.",
    };
  }

  const payload = {
    title,
    characterId,
    scenePresetId: getNullableString(formData, "scenePresetId"),
    stylePresetId: getNullableString(formData, "stylePresetId"),
    notes: getNullableString(formData, "notes"),
  };
  let createdJobId: string | undefined;

  try {
    const response = await fetch(getApiUrl("/api/jobs"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = (await response.json().catch(() => null)) as MutationApiResponse | null;

    if (!response.ok || result?.ok === false) {
      return {
        status: "error",
        message: result?.error?.message ?? `Create request failed with status ${response.status}.`,
      };
    }

    createdJobId = typeof result?.data?.id === "string" ? result.data.id : undefined;
  } catch {
    return {
      status: "error",
      message: "The job create API is unavailable right now.",
    };
  }

  if (!createdJobId) {
    return {
      status: "error",
      message: "The draft was created, but the API response did not include a job id.",
    };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${createdJobId}`);

  redirect(`/jobs/${createdJobId}/edit`);
}

export async function copyJobAction(_prevState: JobCopyState, formData: FormData): Promise<JobCopyState> {
  const jobId = getRequiredId(formData, "jobId", "Job id");
  if ("error" in jobId) {
    return jobId.error;
  }

  try {
    const response = await fetch(getApiUrl(`/api/jobs/${encodeURIComponent(jobId.value)}/copy`), {
      method: "POST",
      cache: "no-store",
    });

    const result = (await response.json().catch(() => null)) as MutationApiResponse | null;

    if (!response.ok || result?.ok === false) {
      return {
        status: "error",
        message: result?.error?.message ?? `Copy request failed with status ${response.status}.`,
      };
    }

    revalidatePath("/jobs");
    if (typeof result?.data?.id === "string" && result.data.id) {
      revalidatePath(`/jobs/${result.data.id}`);
    }
    refresh();

    return {
      status: "success",
      message: "Duplicated this job as a new draft.",
      copiedJobId: typeof result?.data?.id === "string" ? result.data.id : undefined,
    };
  } catch {
    return {
      status: "error",
      message: "The job copy API is unavailable right now.",
    };
  }
}

export async function runJobAction(_prevState: JobRunState, formData: FormData): Promise<JobRunState> {
  const jobId = getRequiredId(formData, "jobId", "Job id");
  if ("error" in jobId) {
    return jobId.error;
  }

  const batchSize = getPositiveInteger(formData, "batchSize", "Batch size");
  if ("error" in batchSize) {
    return batchSize.error;
  }

  try {
    const body: Record<string, unknown> = {};
    if (batchSize.value !== null) {
      body.batchSize = batchSize.value;
    }

    const response = await fetch(getApiUrl(`/api/jobs/${encodeURIComponent(jobId.value)}/run`), {
      method: "POST",
      headers: Object.keys(body).length > 0 ? { "Content-Type": "application/json" } : undefined,
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const result = (await response.json().catch(() => null)) as MutationApiResponse | null;

    if (!response.ok || result?.ok === false) {
      return {
        status: "error",
        message: result?.error?.message ?? `Run request failed with status ${response.status}.`,
      };
    }

    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId.value}`);
    revalidatePath("/queue");
    refresh();

    return {
      status: "success",
      message: "Queued all enabled positions.",
    };
  } catch {
    return {
      status: "error",
      message: "The job run API is unavailable right now.",
    };
  }
}

export async function runJobPositionAction(_prevState: JobRunState, formData: FormData): Promise<JobRunState> {
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

  try {
    const body: Record<string, unknown> = {};
    if (batchSize.value !== null) {
      body.batchSize = batchSize.value;
    }

    const response = await fetch(
      getApiUrl(`/api/jobs/${encodeURIComponent(jobId.value)}/positions/${encodeURIComponent(positionId.value)}/run`),
      {
        method: "POST",
        headers: Object.keys(body).length > 0 ? { "Content-Type": "application/json" } : undefined,
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        cache: "no-store",
      },
    );

    const result = (await response.json().catch(() => null)) as MutationApiResponse | null;

    if (!response.ok || result?.ok === false) {
      return {
        status: "error",
        message: result?.error?.message ?? `Position run request failed with status ${response.status}.`,
      };
    }

    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId.value}`);
    revalidatePath("/queue");
    refresh();

    return {
      status: "success",
      message: "Queued this position to run.",
    };
  } catch {
    return {
      status: "error",
      message: "The position run API is unavailable right now.",
    };
  }
}
