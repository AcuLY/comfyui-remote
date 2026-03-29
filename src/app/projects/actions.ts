"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProjectSaveState, ProjectRunState, ProjectCopyState, ProjectCreateState } from "./action-types";

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

function getNullableJsonObject(formData: FormData, fieldName: string): Record<string, unknown> | undefined {
  const raw = String(formData.get(fieldName) ?? "").trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
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

export async function saveProjectEditAction(_prevState: ProjectSaveState, formData: FormData): Promise<ProjectSaveState> {
  const projectId = getRequiredId(formData, "projectId", "Project id");
  if ("error" in projectId) {
    return projectId.error;
  }

  const batchSize = getPositiveInteger(formData, "batchSize", "Batch size");
  if ("error" in batchSize) {
    return batchSize.error;
  }

  const payload = {
    aspectRatio: getNullableString(formData, "aspectRatio"),
    batchSize: batchSize.value,
  };

  try {
    const response = await fetch(getApiUrl(`/api/projects/${encodeURIComponent(projectId.value)}`), {
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

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId.value}`);
    refresh();

    return {
      status: "success",
      message: "Saved project prompts and defaults.",
    };
  } catch {
    return {
      status: "error",
      message: "The project API is unavailable right now.",
    };
  }
}

export async function saveSectionEditAction(
  _prevState: ProjectSaveState,
  formData: FormData,
): Promise<ProjectSaveState> {
  const projectId = getRequiredId(formData, "projectId", "Project id");
  if ("error" in projectId) {
    return projectId.error;
  }

  const sectionId = getRequiredId(formData, "sectionId", "Position id");
  if ("error" in sectionId) {
    return sectionId.error;
  }

  const batchSize = getPositiveInteger(formData, "batchSize", "Batch size");
  if ("error" in batchSize) {
    return batchSize.error;
  }

  const shortSidePx = getPositiveInteger(formData, "shortSidePx", "Short side px");
  if ("error" in shortSidePx) {
    return shortSidePx.error;
  }

  const ksampler1 = getNullableJsonObject(formData, "ksampler1");
  const ksampler2 = getNullableJsonObject(formData, "ksampler2");

  // Parse upscaleFactor (float)
  const upscaleRaw = formData.get("upscaleFactor");
  const upscaleFactor = upscaleRaw ? parseFloat(String(upscaleRaw)) : null;

  // Extract seedPolicy from ksampler params (seed策略已移入 KSampler 面板)
  const seedPolicy1 = typeof ksampler1?.seedPolicy === "string" ? ksampler1.seedPolicy : getNullableString(formData, "seedPolicy1");
  const seedPolicy2 = typeof ksampler2?.seedPolicy === "string" ? ksampler2.seedPolicy : getNullableString(formData, "seedPolicy2");

  const payload: Record<string, unknown> = {
    positivePrompt: getNullableString(formData, "positivePrompt"),
    negativePrompt: getNullableString(formData, "negativePrompt"),
    aspectRatio: getNullableString(formData, "aspectRatio"),
    shortSidePx: shortSidePx.value,
    batchSize: batchSize.value,
    seedPolicy1,
    seedPolicy2,
  };

  if (ksampler1 !== undefined) {
    payload.ksampler1 = ksampler1;
  }
  if (ksampler2 !== undefined) {
    payload.ksampler2 = ksampler2;
  }
  if (upscaleFactor !== null && Number.isFinite(upscaleFactor)) {
    payload.upscaleFactor = upscaleFactor;
  }

  try {
    const response = await fetch(
      getApiUrl(`/api/projects/${encodeURIComponent(projectId.value)}/sections/${encodeURIComponent(sectionId.value)}`),
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

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId.value}`);
    refresh();

    return {
      status: "success",
      message: "Saved section overrides.",
    };
  } catch {
    return {
      status: "error",
      message: "The section API is unavailable right now.",
    };
  }
}

export async function createProjectAction(_prevState: ProjectCreateState, formData: FormData): Promise<ProjectCreateState> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return {
      status: "error",
      message: "Title is required.",
    };
  }

  // Parse presetBindings from formData (JSON string)
  let presetBindings: Array<{ categoryId: string; presetId: string }> = [];
  const bindingsRaw = String(formData.get("presetBindings") ?? "").trim();
  if (bindingsRaw) {
    try {
      presetBindings = JSON.parse(bindingsRaw);
    } catch {
      // ignore parse errors
    }
  }

  const payload = {
    title,
    presetBindings,
    notes: getNullableString(formData, "notes"),
  };
  let createdProjectId: string | undefined;

  try {
    const response = await fetch(getApiUrl("/api/projects"), {
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

    createdProjectId = typeof result?.data?.id === "string" ? result.data.id : undefined;
  } catch {
    return {
      status: "error",
      message: "The project create API is unavailable right now.",
    };
  }

  if (!createdProjectId) {
    return {
      status: "error",
      message: "The draft was created, but the API response did not include a project id.",
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${createdProjectId}`);

  redirect(`/projects/${createdProjectId}/edit`);
}

export async function copyProjectAction(_prevState: ProjectCopyState, formData: FormData): Promise<ProjectCopyState> {
  const projectId = getRequiredId(formData, "projectId", "Project id");
  if ("error" in projectId) {
    return projectId.error;
  }

  try {
    const response = await fetch(getApiUrl(`/api/projects/${encodeURIComponent(projectId.value)}/copy`), {
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

    revalidatePath("/projects");
    if (typeof result?.data?.id === "string" && result.data.id) {
      revalidatePath(`/projects/${result.data.id}`);
    }
    refresh();

    return {
      status: "success",
      message: "Duplicated this project as a new draft.",
      copiedProjectId: typeof result?.data?.id === "string" ? result.data.id : undefined,
    };
  } catch {
    return {
      status: "error",
      message: "The project copy API is unavailable right now.",
    };
  }
}

export async function runProjectAction(_prevState: ProjectRunState, formData: FormData): Promise<ProjectRunState> {
  const projectId = getRequiredId(formData, "projectId", "Project id");
  if ("error" in projectId) {
    return projectId.error;
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

    const response = await fetch(getApiUrl(`/api/projects/${encodeURIComponent(projectId.value)}/run`), {
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

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId.value}`);
    revalidatePath("/queue");
    refresh();

    return {
      status: "success",
      message: "Queued all enabled sections.",
    };
  } catch {
    return {
      status: "error",
      message: "The project run API is unavailable right now.",
    };
  }
}

export async function runSectionAction(_prevState: ProjectRunState, formData: FormData): Promise<ProjectRunState> {
  const projectId = getRequiredId(formData, "projectId", "Project id");
  if ("error" in projectId) {
    return projectId.error;
  }

  const sectionId = getRequiredId(formData, "sectionId", "Position id");
  if ("error" in sectionId) {
    return sectionId.error;
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
      getApiUrl(`/api/projects/${encodeURIComponent(projectId.value)}/sections/${encodeURIComponent(sectionId.value)}/run`),
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
        message: result?.error?.message ?? `Section run request failed with status ${response.status}.`,
      };
    }

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId.value}`);
    revalidatePath("/queue");
    refresh();

    return {
      status: "success",
      message: "Queued this section to run.",
    };
  } catch {
    return {
      status: "error",
      message: "The section run API is unavailable right now.",
    };
  }
}
