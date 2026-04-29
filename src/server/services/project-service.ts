import { Prisma } from "@/generated/prisma";
import { ActorType } from "@/lib/db-enums";
import { createLogger } from "@/lib/logger";
import {
  createProject as createProjectInRepository,
  copyProject as copyProjectInRepository,
  enqueueProjectSectionRun as enqueueProjectSectionRunInRepository,
  enqueueProjectRuns as enqueueProjectRunsInRepository,
  listProjects as listProjectsInRepository,
  updateProject as updateProjectInRepository,
  updateProjectSection as updateProjectSectionInRepository,
} from "@/server/repositories/project-repository";
import { audit } from "@/server/services/audit-service";
import { submitRunToComfyUI, pollRunCompletion } from "@/server/services/run-executor";
import { getWorkerRun } from "@/server/worker/repository";
import { prisma } from "@/lib/prisma";
import { recordSectionChange } from "@/server/services/section-change-history-service";

// Project service logger
const log = createLogger({ module: "project-service" });

type CreateProjectRequestBody = {
  title?: unknown;
  notes?: unknown;
};

type UpdateProjectRequestBody = {
  aspectRatio?: unknown;
  batchSize?: unknown;
};

type ListProjectsQuery = {
  search?: unknown;
  status?: unknown;
  enabledOnly?: unknown;
  hasPending?: unknown;
};

type UpdateProjectSectionRequestBody = {
  name?: unknown;
  positivePrompt?: unknown;
  negativePrompt?: unknown;
  aspectRatio?: unknown;
  shortSidePx?: unknown;
  batchSize?: unknown;
  seedPolicy1?: unknown;
  seedPolicy2?: unknown;
  ksampler1?: unknown;
  ksampler2?: unknown;
  upscaleFactor?: unknown;
  loraConfig?: unknown;
};

const PROJECT_CREATE_FIELDS = [
  "title",
  "notes",
] as const;

const PROJECT_UPDATE_FIELDS = [
  "aspectRatio",
  "batchSize",
] as const;

const PROJECT_SECTION_UPDATE_FIELDS = [
  "name",
  "positivePrompt",
  "negativePrompt",
  "aspectRatio",
  "shortSidePx",
  "batchSize",
  "seedPolicy1",
  "seedPolicy2",
  "ksampler1",
  "ksampler2",
  "upscaleFactor",
  "loraConfig",
] as const;

const SECTION_RUN_PARAM_FIELDS = [
  "aspectRatio",
  "shortSidePx",
  "batchSize",
  "seedPolicy1",
  "seedPolicy2",
  "ksampler1",
  "ksampler2",
  "upscaleFactor",
  "loraConfig",
] as const;

const SECTION_RUN_PARAM_SELECT = {
  aspectRatio: true,
  shortSidePx: true,
  batchSize: true,
  seedPolicy1: true,
  seedPolicy2: true,
  ksampler1: true,
  ksampler2: true,
  upscaleFactor: true,
  loraConfig: true,
} as const;

class ProjectServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProjectServiceError";
  }
}

function parsePatchRequestBody<T extends Record<string, unknown>>(body: unknown): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProjectServiceError("Request body must be an object", 400);
  }

  return body as T;
}

function normalizeRequiredStringField(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new ProjectServiceError(`${fieldName} is required`, 400);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new ProjectServiceError(`${fieldName} is required`, 400);
  }

  return normalizedValue;
}

function normalizeRequiredId(value: string, fieldName: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new ProjectServiceError(`${fieldName} is required`, 400);
  }

  return normalizedValue;
}

function ensureSupportedFields(
  body: Record<string, unknown>,
  supportedFields: readonly string[],
) {
  const unsupportedFields = Object.keys(body).filter((field) => !supportedFields.includes(field));

  if (unsupportedFields.length > 0) {
    throw new ProjectServiceError("Unsupported fields in request body", 400, {
      unsupportedFields,
      supportedFields,
    });
  }
}

function normalizeStringField(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ProjectServiceError(`${fieldName} must be a string`, 400);
  }

  return value;
}

function normalizeNullableStringField(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ProjectServiceError(`${fieldName} must be a string or null`, 400);
  }

  return value;
}

function normalizeNullableObjectField(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectServiceError(`${fieldName} must be an object or null`, 400);
  }

  return value as Record<string, unknown>;
}

function normalizeNullableIdField(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ProjectServiceError(`${fieldName} must be a string or null`, 400);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new ProjectServiceError(`${fieldName} must not be empty`, 400);
  }

  return normalizedValue;
}

function normalizeNullableNotesField(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return value ?? null;
  }

  if (typeof value !== "string") {
    throw new ProjectServiceError(`${fieldName} must be a string or null`, 400);
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function normalizeOptionalSearch(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ProjectServiceError("search must be a string", 400);
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
}

const SUPPORTED_PROJECT_STATUSES = ["draft", "queued", "running", "partial_done", "done", "failed"] as const;

function normalizeOptionalProjectStatus(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ProjectServiceError("status must be a string", 400);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return undefined;
  }

  if (!SUPPORTED_PROJECT_STATUSES.includes(normalizedValue as (typeof SUPPORTED_PROJECT_STATUSES)[number])) {
    throw new ProjectServiceError("status must be a valid project status", 400, {
      supportedStatuses: SUPPORTED_PROJECT_STATUSES,
    });
  }

  return normalizedValue as (typeof SUPPORTED_PROJECT_STATUSES)[number];
}

function normalizeOptionalBoolean(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue) {
      return undefined;
    }

    if (normalizedValue === "true" || normalizedValue === "1") {
      return true;
    }

    if (normalizedValue === "false" || normalizedValue === "0") {
      return false;
    }
  }

  throw new ProjectServiceError(`${fieldName} must be a boolean`, 400);
}

function normalizeBatchSize(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ProjectServiceError(`${fieldName} must be a positive integer or null`, 400);
  }

  return value;
}

function ensureAtLeastOneField(
  fields: Record<string, unknown>,
  message: string,
  supportedFields: readonly string[],
) {
  const hasAtLeastOneField = Object.values(fields).some((value) => value !== undefined);

  if (!hasAtLeastOneField) {
    throw new ProjectServiceError(message, 400, { supportedFields });
  }
}

export async function listProjects(query: ListProjectsQuery = {}) {
  return listProjectsInRepository({
    search: normalizeOptionalSearch(query.search),
    status: normalizeOptionalProjectStatus(query.status),
    enabledOnly: normalizeOptionalBoolean(query.enabledOnly, "enabledOnly"),
    hasPending: normalizeOptionalBoolean(query.hasPending, "hasPending"),
  });
}

export async function createProject(body: unknown, actorType: ActorType = ActorType.user) {
  const parsedBody = parsePatchRequestBody<CreateProjectRequestBody>(body);
  ensureSupportedFields(parsedBody, PROJECT_CREATE_FIELDS);

  const input = {
    title: normalizeRequiredStringField(parsedBody.title, "title"),
    notes: normalizeNullableNotesField(parsedBody.notes, "notes"),
  };

  log.info("Creating project", { title: input.title });

  const result = await createProjectInRepository(input);

  log.info("Project created", { projectId: result.id, title: input.title });
  audit("Project", result.id, "create", { title: input.title }, actorType);
  return result;
}

export async function updateProject(projectId: string, body: unknown, actorType: ActorType = ActorType.user) {
  const parsedBody = parsePatchRequestBody<UpdateProjectRequestBody>(body);
  ensureSupportedFields(parsedBody, PROJECT_UPDATE_FIELDS);

  const input = {
    aspectRatio: normalizeNullableStringField(parsedBody.aspectRatio, "aspectRatio"),
    batchSize: normalizeBatchSize(parsedBody.batchSize, "batchSize"),
  };

  ensureAtLeastOneField(
    input,
    "At least one editable project field is required",
    PROJECT_UPDATE_FIELDS,
  );

  const normalizedId = normalizeRequiredId(projectId, "projectId");

  const result = await updateProjectInRepository(normalizedId, input);

  // Strip undefined values for clean audit payload
  const changedFields = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
  audit("Project", normalizedId, "update", changedFields, actorType);

  return result;
}

export async function updateProjectSection(
  projectId: string,
  sectionId: string,
  body: unknown,
  actorType: ActorType = ActorType.user,
) {
  const parsedBody = parsePatchRequestBody<UpdateProjectSectionRequestBody>(body);
  ensureSupportedFields(parsedBody, PROJECT_SECTION_UPDATE_FIELDS);

  const input = {
    name: normalizeNullableStringField(parsedBody.name, "name"),
    positivePrompt: normalizeNullableStringField(parsedBody.positivePrompt, "positivePrompt"),
    negativePrompt: normalizeNullableStringField(parsedBody.negativePrompt, "negativePrompt"),
    aspectRatio: normalizeNullableStringField(parsedBody.aspectRatio, "aspectRatio"),
    shortSidePx: normalizeBatchSize(parsedBody.shortSidePx, "shortSidePx"),
    batchSize: normalizeBatchSize(parsedBody.batchSize, "batchSize"),
    seedPolicy1: normalizeNullableStringField(parsedBody.seedPolicy1, "seedPolicy1"),
    seedPolicy2: normalizeNullableStringField(parsedBody.seedPolicy2, "seedPolicy2"),
    ksampler1: parsedBody.ksampler1 !== undefined
      ? (parsedBody.ksampler1 as Record<string, unknown> | null)
      : undefined,
    ksampler2: parsedBody.ksampler2 !== undefined
      ? (parsedBody.ksampler2 as Record<string, unknown> | null)
      : undefined,
    upscaleFactor: parsedBody.upscaleFactor !== undefined
      ? (typeof parsedBody.upscaleFactor === "number" && Number.isFinite(parsedBody.upscaleFactor) ? parsedBody.upscaleFactor : null)
      : undefined,
    loraConfig: normalizeNullableObjectField(parsedBody.loraConfig, "loraConfig"),
  };

  ensureAtLeastOneField(
    input,
    "At least one editable position field is required",
    PROJECT_SECTION_UPDATE_FIELDS,
  );

  const normalizedProjectId = normalizeRequiredId(projectId, "projectId");
  const normalizedSectionId = normalizeRequiredId(sectionId, "sectionId");
  const shouldRecordRunParams = SECTION_RUN_PARAM_FIELDS.some((field) => input[field] !== undefined);
  const beforeRunParams = shouldRecordRunParams
    ? await prisma.projectSection.findFirst({
        where: { id: normalizedSectionId, projectId: normalizedProjectId },
        select: SECTION_RUN_PARAM_SELECT,
      })
    : null;

  const result = await updateProjectSectionInRepository(
    normalizedProjectId,
    normalizedSectionId,
    input,
  );

  const changedFields = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
  audit("ProjectSection", normalizedSectionId, "update", changedFields, actorType);

  if (beforeRunParams) {
    const afterRunParams = await prisma.projectSection.findUnique({
      where: { id: normalizedSectionId },
      select: SECTION_RUN_PARAM_SELECT,
    });
    await recordSectionChange({
      sectionId: normalizedSectionId,
      dimension: "runParams",
      title: "更新运行参数",
      before: beforeRunParams,
      after: afterRunParams,
    });
  }

  return result;
}

export async function enqueueProjectRuns(projectId: string, overrideBatchSize?: number, actorType: ActorType = ActorType.user) {
  const normalizedId = normalizeRequiredId(projectId, "projectId");

  log.info("Enqueueing project runs", { projectId: normalizedId, overrideBatchSize });

  const result = await enqueueProjectRunsInRepository(normalizedId, overrideBatchSize);

  log.info("Project runs enqueued", { projectId: normalizedId, queuedRunCount: result.queuedRunCount });
  audit("Project", normalizedId, "enqueue", { queuedRunCount: result.queuedRunCount }, actorType);

  // Submit each run to ComfyUI synchronously
  let allFailed = true;
  const { prisma } = await import("@/lib/prisma");

  for (const enqueuedRun of result.runs) {
    const run = await getWorkerRun(enqueuedRun.runId);
    if (!run) continue;

    try {
      const { comfyPromptId } = await submitRunToComfyUI(run);
      await prisma.run.update({
        where: { id: run.runId },
        data: { comfyPromptId },
      });
      pollRunCompletion(run.runId).catch(() => {});
      allFailed = false;
    } catch (error) {
      log.error(`Failed to submit run ${run.runId} to ComfyUI`, error);
      await prisma.run.delete({ where: { id: run.runId } }).catch(() => {});
    }
  }

  if (allFailed && result.runs.length > 0) {
    throw new Error("无法连接到 ComfyUI，请检查服务是否运行");
  }

  return result;
}

export async function copyProject(projectId: string, actorType: ActorType = ActorType.user) {
  const normalizedId = normalizeRequiredId(projectId, "projectId");

  log.info("Copying project", { sourceProjectId: normalizedId });

  const result = await copyProjectInRepository(normalizedId);

  log.info("Project copied", { sourceProjectId: normalizedId, newProjectId: result.id });
  audit("Project", result.id, "copy", { sourceProjectId: normalizedId }, actorType);
  return result;
}

export async function enqueueProjectSectionRun(
  projectId: string,
  sectionId: string,
  overrideBatchSize?: number,
  actorType: ActorType = ActorType.user,
) {
  const normalizedSectionId = normalizeRequiredId(sectionId, "sectionId");
  const normalizedProjectId = normalizeRequiredId(projectId, "projectId");
  const result = await enqueueProjectSectionRunInRepository(
    normalizedProjectId,
    normalizedSectionId,
    overrideBatchSize,
  );
  audit("ProjectSection", normalizedSectionId, "enqueue", { projectId: normalizedProjectId }, actorType);

  // Submit to ComfyUI synchronously
  const { prisma } = await import("@/lib/prisma");

  for (const enqueuedRun of result.runs) {
    const run = await getWorkerRun(enqueuedRun.runId);
    if (!run) continue;

    try {
      const { comfyPromptId } = await submitRunToComfyUI(run);
      await prisma.run.update({
        where: { id: run.runId },
        data: { comfyPromptId },
      });
      pollRunCompletion(run.runId).catch(() => {});
    } catch (error) {
      log.error(`Failed to submit run ${run.runId} to ComfyUI`, error);
      await prisma.run.delete({ where: { id: run.runId } }).catch(() => {});
      throw new Error("无法连接到 ComfyUI，请检查服务是否运行");
    }
  }

  return result;
}

export function mapProjectError(error: unknown) {
  if (error instanceof ProjectServiceError) {
    log.warn("Project service error", { message: error.message, status: error.status });
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (!(error instanceof Error)) {
    log.error("Unexpected project error (non-Error)", error);
    return {
      message: "Unexpected project error",
      status: 500,
      details: String(error),
    };
  }

  switch (error.message) {
    case "JOB_NOT_FOUND":
      return { message: "Project not found", status: 404 };
    case "JOB_POSITION_NOT_FOUND":
      return { message: "Section not found", status: 404 };
    case "JOB_HAS_NO_ENABLED_POSITIONS":
      return { message: "Project has no enabled sections to queue", status: 409 };
    case "JOB_POSITION_DISABLED":
      return { message: "Section is disabled", status: 409 };
    case "JOB_SLUG_EXHAUSTED":
    case "JOB_COPY_IDENTITY_EXHAUSTED":
      return { message: "Unable to generate a unique project identity", status: 409 };
    default:
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        log.error("Prisma error", error, { code: error.code });
        if (error.code === "P2002") {
          return {
            message: "Database uniqueness check failed",
            status: 409,
            details: error.meta?.target ?? error.message,
          };
        }

        return {
          message: "Database request failed",
          status: 500,
          details: error.message,
        };
      }

      log.error("Unexpected project error", error);
      return {
        message: "Unexpected project error",
        status: 500,
        details: error.message,
      };
  }
}
