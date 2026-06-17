import { prisma } from "@/lib/prisma";
import {
  getTrainingCandidateImage,
  updateTrainingCandidateImageCaption,
} from "@/server/repositories/training/image-results";
import {
  createTrainingPromptCardVersion,
  getTrainingProductionProject,
  listTrainingPromptCardVersions,
} from "@/server/repositories/training/profile-text";
import { z } from "zod";

const TRAINING_TEXT_REVISION_REASONS = [
  "ai_generation",
  "before_overwrite",
  "idle_checkpoint",
  "run_snapshot",
  "dataset_freeze",
  "start_training",
] as const;

const textRevisionInputSchema = z.object({
  entityType: z.enum(["profile", "image_result"]),
  entityId: z.string().trim().min(1),
  fieldName: z.string().trim().min(1),
  textValue: z.string(),
  reason: z.enum(TRAINING_TEXT_REVISION_REASONS),
  sourceTaskId: z.string().trim().min(1).optional().nullable(),
  sourceRunId: z.string().trim().min(1).optional().nullable(),
}).strict();

const textRevisionListQuerySchema = z.object({
  entityType: z.enum(["profile", "image_result"]).optional(),
  entityId: z.string().trim().min(1).optional(),
  fieldName: z.string().trim().min(1).optional(),
}).strict();

export type TrainingTextRevision = {
  id: string;
  trainingProjectId: string;
  entityType: "profile" | "image_result";
  entityId: string;
  fieldName: string;
  textValue: string;
  reason: string;
  sourceTaskId: string | null;
  sourceRunId: string | null;
  createdAt: string;
};

export class TrainingTextRevisionServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingTextRevisionServiceError";
    this.status = status;
    this.details = details;
  }
}

function parseTextRevisionInput(input: unknown) {
  const result = textRevisionInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingTextRevisionServiceError("Invalid training text revision request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function parseTextRevisionListQuery(input: unknown) {
  const result = textRevisionListQuerySchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingTextRevisionServiceError("Invalid training text revision query", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

async function assertTrainingProjectExists(projectId: string) {
  await getTrainingProductionProject(projectId);
}

async function assertSupportedTextTarget(projectId: string, input: {
  entityType: "profile" | "image_result";
  entityId: string;
  fieldName: string;
}) {
  await assertTrainingProjectExists(projectId);

  if (input.entityType === "profile") {
    if (input.entityId !== projectId) {
      throw new TrainingTextRevisionServiceError("Profile entityId must equal the training project id", 400, {
        entityId: input.entityId,
        projectId,
      });
    }

    if (!["loraUsagePrompt", "characterDetailPrompt"].includes(input.fieldName)) {
      throw new TrainingTextRevisionServiceError("Unsupported production profile revision field", 400, {
        fieldName: input.fieldName,
        supportedFields: ["loraUsagePrompt", "characterDetailPrompt"],
      });
    }
    return;
  }

  if (input.entityType === "image_result") {
    if (input.fieldName !== "captionDraft") {
      throw new TrainingTextRevisionServiceError("Unsupported image-result revision field", 400, {
        fieldName: input.fieldName,
        supportedFields: ["captionDraft"],
      });
    }

    const productionResult = await getTrainingCandidateImage(input.entityId);
    if (!productionResult || productionResult.jobId !== projectId) {
      throw new TrainingTextRevisionServiceError("Training image result not found", 404, {
        imageResultId: input.entityId,
        projectId,
      });
    }
    return;
  }

  throw new TrainingTextRevisionServiceError("Unsupported training text revision entity type", 400, {
    entityType: input.entityType,
  });
}

async function readCurrentProfileTextValue(projectId: string, fieldName: string) {
  const [job, promptCardVersions] = await Promise.all([
    getTrainingProductionProject(projectId),
    listTrainingPromptCardVersions(projectId),
  ]);
  const currentPromptCard = promptCardVersions.find((version) => version.id === job.currentPromptCardVersionId) ?? promptCardVersions.at(-1) ?? null;

  if (fieldName === "loraUsagePrompt") {
    return currentPromptCard?.finalPromptDraft ?? job.triggerToken;
  }
  if (fieldName === "characterDetailPrompt") {
    return JSON.stringify(
      {
        identityTraits: currentPromptCard?.identityTraits ?? {},
        outfitTraits: currentPromptCard?.outfitTraits ?? {},
        negativeTraits: currentPromptCard?.negativeTraits ?? null,
      },
      null,
      2,
    );
  }

  throw new TrainingTextRevisionServiceError("Unsupported production profile revision field", 400, {
    fieldName,
    supportedFields: ["loraUsagePrompt", "characterDetailPrompt"],
  });
}

async function readCurrentImageResultTextValue(projectId: string, imageResultId: string) {
  const productionResult = await getTrainingCandidateImage(imageResultId);
  if (!productionResult || productionResult.jobId !== projectId) {
    throw new TrainingTextRevisionServiceError("Training image result not found", 404, {
      imageResultId,
      projectId,
    });
  }
  return productionResult.captionDraft ?? "";
}

async function applyProfileRevision(projectId: string, fieldName: string, textValue: string) {
  const [job, promptCardVersions] = await Promise.all([
    getTrainingProductionProject(projectId),
    listTrainingPromptCardVersions(projectId),
  ]);
  const currentPromptCard = promptCardVersions.find((version) => version.id === job.currentPromptCardVersionId) ?? promptCardVersions.at(-1) ?? null;

  if (fieldName === "loraUsagePrompt") {
    return createTrainingPromptCardVersion(projectId, {
      canonicalVersionId: currentPromptCard?.canonicalVersionId ?? job.currentCanonicalVersionId ?? null,
      triggerToken: job.triggerToken,
      identityTraits: currentPromptCard?.identityTraits ?? {},
      outfitTraits: currentPromptCard?.outfitTraits ?? {},
      negativeTraits: currentPromptCard?.negativeTraits ?? null,
      finalPromptDraft: textValue,
      changeReason: "Restored via training text revision API",
    });
  }

  if (fieldName === "characterDetailPrompt") {
    let parsed: {
      identityTraits?: Record<string, unknown>;
      outfitTraits?: Record<string, unknown>;
      negativeTraits?: unknown[] | null;
    };
    try {
      parsed = JSON.parse(textValue);
    } catch {
      throw new TrainingTextRevisionServiceError("characterDetailPrompt revision must be a JSON object string", 400);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TrainingTextRevisionServiceError("characterDetailPrompt revision must be a JSON object string", 400);
    }
    return createTrainingPromptCardVersion(projectId, {
      canonicalVersionId: currentPromptCard?.canonicalVersionId ?? job.currentCanonicalVersionId ?? null,
      triggerToken: job.triggerToken,
      identityTraits: parsed.identityTraits ?? currentPromptCard?.identityTraits ?? {},
      outfitTraits: parsed.outfitTraits ?? currentPromptCard?.outfitTraits ?? {},
      negativeTraits: parsed.negativeTraits ?? currentPromptCard?.negativeTraits ?? null,
      finalPromptDraft: currentPromptCard?.finalPromptDraft ?? job.triggerToken,
      changeReason: "Restored via training text revision API",
    });
  }

  throw new TrainingTextRevisionServiceError("Unsupported production profile revision field", 400, {
    fieldName,
  });
}

async function applyImageResultRevision(projectId: string, imageResultId: string, textValue: string) {
  return updateTrainingCandidateImageCaption(imageResultId, {
    captionDraft: textValue,
  });
}

function mapTrainingTextRevisionRow(row: {
  id: string;
  trainingProjectId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  textValue: string;
  reason: string;
  sourceTaskId: string | null;
  sourceRunId: string | null;
  createdAt: Date;
}): TrainingTextRevision {
  return {
    id: row.id,
    trainingProjectId: row.trainingProjectId,
    entityType: row.entityType as TrainingTextRevision["entityType"],
    entityId: row.entityId,
    fieldName: row.fieldName,
    textValue: row.textValue,
    reason: row.reason,
    sourceTaskId: row.sourceTaskId,
    sourceRunId: row.sourceRunId,
    createdAt: row.createdAt.toISOString(),
  };
}

function isTrainingTextRevisionDatabaseUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Database .* does not exist|Can't reach database server|ECONNREFUSED|P1001|P1003|P2021|Table .* does not exist/i.test(message);
}

export async function listTrainingTextRevisions(projectId: string, query: unknown) {
  await assertTrainingProjectExists(projectId);
  const parsed = parseTextRevisionListQuery(query);
  const revisions = await prisma.trainingTextRevision.findMany({
    where: {
      trainingProjectId: projectId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      fieldName: parsed.fieldName,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
  return revisions.map(mapTrainingTextRevisionRow);
}

export async function createTrainingTextRevision(projectId: string, input: unknown) {
  const parsed = parseTextRevisionInput(input);
  await assertSupportedTextTarget(projectId, parsed);

  const revision = await prisma.trainingTextRevision.create({
    data: {
      trainingProjectId: projectId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      fieldName: parsed.fieldName,
      textValue: parsed.textValue,
      reason: parsed.reason,
      sourceTaskId: parsed.sourceTaskId?.trim() || null,
      sourceRunId: parsed.sourceRunId?.trim() || null,
    },
  });

  return mapTrainingTextRevisionRow(revision);
}

export async function restoreTrainingTextRevision(revisionId: string) {
  const revisionRow = await prisma.trainingTextRevision.findUnique({
    where: { id: revisionId },
  });
  const revision = revisionRow ? mapTrainingTextRevisionRow(revisionRow) : null;
  if (!revision) {
    throw new TrainingTextRevisionServiceError("Training text revision not found", 404, { revisionId });
  }

  const currentValue = revision.entityType === "profile"
    ? await readCurrentProfileTextValue(revision.trainingProjectId, revision.fieldName)
    : await readCurrentImageResultTextValue(revision.trainingProjectId, revision.entityId);
  const beforeOverwriteEntityId = revision.entityType === "profile"
    ? revision.trainingProjectId
    : revision.entityId;

  const beforeOverwriteRevision = await createTrainingTextRevision(revision.trainingProjectId, {
    entityType: revision.entityType,
    entityId: beforeOverwriteEntityId,
    fieldName: revision.fieldName,
    textValue: currentValue,
    reason: "before_overwrite",
    sourceTaskId: revision.sourceTaskId,
    sourceRunId: revision.sourceRunId,
  });

  const target = revision.entityType === "profile"
    ? await applyProfileRevision(revision.trainingProjectId, revision.fieldName, revision.textValue)
    : await applyImageResultRevision(revision.trainingProjectId, revision.entityId, revision.textValue);

  return {
    revisionId,
    trainingProjectId: revision.trainingProjectId,
    entityType: revision.entityType,
    entityId: revision.entityId,
    fieldName: revision.fieldName,
    restored: true,
    textValue: revision.textValue,
    beforeOverwriteRevisionId: beforeOverwriteRevision.id,
    target,
  };
}

export function mapTrainingTextRevisionError(error: unknown) {
  if (error instanceof TrainingTextRevisionServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }
  if (isTrainingTextRevisionDatabaseUnavailable(error)) {
    return {
      message: "Training text revision database is unavailable",
      status: 500,
      details: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    message: "Unexpected training text revision error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
