import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getCharacterLoraCandidateImage } from "@/server/repositories/character-lora-training";
import {
  getCharacterLoraTrainingJob,
} from "@/server/services/character-lora-training/job-service";
import {
  createCharacterLoraPromptCardVersion,
  listCharacterLoraPromptCardVersions,
} from "@/server/services/character-lora-training/prompt-card-service";
import {
  updateCharacterLoraImageCaption,
} from "@/server/services/character-lora-training/phase3-service";
import {
  getManagedTrainingImageResult,
  getManagedTrainingProject,
  getManagedTrainingProjectProfile,
  updateManagedTrainingImageResult,
  updateManagedTrainingProjectProfile,
} from "@/server/services/training/project-service";
import { z } from "zod";

const TRAINING_TEXT_REVISIONS_PATH = join(process.cwd(), "data", "training-text-revisions.json");
let textRevisionWriteQueue: Promise<unknown> = Promise.resolve();

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
  reason: (typeof TRAINING_TEXT_REVISION_REASONS)[number];
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

async function readTrainingTextRevisions() {
  try {
    const raw = await readFile(TRAINING_TEXT_REVISIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as TrainingTextRevision[];
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return [] as TrainingTextRevision[];
}

async function writeTrainingTextRevisions(revisions: TrainingTextRevision[]) {
  await mkdir(dirname(TRAINING_TEXT_REVISIONS_PATH), { recursive: true });
  const tempPath = `${TRAINING_TEXT_REVISIONS_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(revisions, null, 2)}\n`, "utf8");
  await rename(tempPath, TRAINING_TEXT_REVISIONS_PATH);
}

async function withTextRevisionWriteLock<T>(fn: () => Promise<T>) {
  const next = textRevisionWriteQueue.then(fn, fn);
  textRevisionWriteQueue = next.then(() => undefined, () => undefined);
  return next;
}

function sortTrainingTextRevisions(revisions: TrainingTextRevision[]) {
  return [...revisions].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
  );
}

async function assertTrainingProjectExists(projectId: string) {
  const managed = await getManagedTrainingProject(projectId);
  if (managed) return { managed: true as const };

  await getCharacterLoraTrainingJob(projectId);
  return { managed: false as const };
}

async function assertSupportedTextTarget(projectId: string, input: {
  entityType: "profile" | "image_result";
  entityId: string;
  fieldName: string;
}) {
  const ownership = await assertTrainingProjectExists(projectId);

  if (input.entityType === "profile") {
    if (input.entityId !== projectId) {
      throw new TrainingTextRevisionServiceError("Profile entityId must equal the training project id", 400, {
        entityId: input.entityId,
        projectId,
      });
    }

    if (ownership.managed) {
      if (!["loraUsagePrompt", "characterDetailPrompt", "profileSummary"].includes(input.fieldName)) {
        throw new TrainingTextRevisionServiceError("Unsupported managed profile revision field", 400, {
          fieldName: input.fieldName,
          supportedFields: ["loraUsagePrompt", "characterDetailPrompt", "profileSummary"],
        });
      }
      return ownership;
    }

    if (!["loraUsagePrompt", "characterDetailPrompt"].includes(input.fieldName)) {
      throw new TrainingTextRevisionServiceError("Unsupported production profile revision field", 400, {
        fieldName: input.fieldName,
        supportedFields: ["loraUsagePrompt", "characterDetailPrompt"],
      });
    }
    return ownership;
  }

  if (input.entityType === "image_result") {
    if (input.fieldName !== "captionDraft") {
      throw new TrainingTextRevisionServiceError("Unsupported image-result revision field", 400, {
        fieldName: input.fieldName,
        supportedFields: ["captionDraft"],
      });
    }

    if (ownership.managed) {
      const managedResult = await getManagedTrainingImageResult(input.entityId);
      if (!managedResult) {
        throw new TrainingTextRevisionServiceError("Training image result not found", 404, {
          imageResultId: input.entityId,
          projectId,
        });
      }
      return ownership;
    }

    const productionResult = await getCharacterLoraCandidateImage(input.entityId);
    if (!productionResult || productionResult.jobId !== projectId) {
      throw new TrainingTextRevisionServiceError("Training image result not found", 404, {
        imageResultId: input.entityId,
        projectId,
      });
    }
    return ownership;
  }

  throw new TrainingTextRevisionServiceError("Unsupported training text revision entity type", 400, {
    entityType: input.entityType,
  });
}

async function readCurrentProfileTextValue(projectId: string, fieldName: string) {
  const managedProfile = await getManagedTrainingProjectProfile(projectId);
  if (managedProfile) {
    if (fieldName === "loraUsagePrompt") return managedProfile.loraUsagePrompt ?? "";
    if (fieldName === "characterDetailPrompt") return managedProfile.characterDetailPrompt ?? "";
    if (fieldName === "profileSummary") return managedProfile.profileSummary ?? "";
    throw new TrainingTextRevisionServiceError("Unsupported managed profile revision field", 400, { fieldName });
  }

  const [job, promptCardVersions] = await Promise.all([
    getCharacterLoraTrainingJob(projectId),
    listCharacterLoraPromptCardVersions(projectId),
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
  const managedResult = await getManagedTrainingImageResult(imageResultId);
  if (managedResult) return managedResult.caption ?? "";

  const productionResult = await getCharacterLoraCandidateImage(imageResultId);
  if (!productionResult || productionResult.jobId !== projectId) {
    throw new TrainingTextRevisionServiceError("Training image result not found", 404, {
      imageResultId,
      projectId,
    });
  }
  return productionResult.captionDraft ?? "";
}

async function applyProfileRevision(projectId: string, fieldName: string, textValue: string) {
  const managedProfile = await getManagedTrainingProjectProfile(projectId);
  if (managedProfile) {
    const data = await updateManagedTrainingProjectProfile(projectId, {
      loraUsagePrompt: fieldName === "loraUsagePrompt" ? textValue : undefined,
      characterDetailPrompt: fieldName === "characterDetailPrompt" ? textValue : undefined,
      profileSummary: fieldName === "profileSummary" ? textValue : undefined,
    });
    if (!data) {
      throw new TrainingTextRevisionServiceError("Training project profile not found", 404, { projectId });
    }
    return data;
  }

  const [job, promptCardVersions] = await Promise.all([
    getCharacterLoraTrainingJob(projectId),
    listCharacterLoraPromptCardVersions(projectId),
  ]);
  const currentPromptCard = promptCardVersions.find((version) => version.id === job.currentPromptCardVersionId) ?? promptCardVersions.at(-1) ?? null;

  if (fieldName === "loraUsagePrompt") {
    return createCharacterLoraPromptCardVersion(projectId, {
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
    return createCharacterLoraPromptCardVersion(projectId, {
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
  const managedResult = await getManagedTrainingImageResult(imageResultId);
  if (managedResult) {
    const data = await updateManagedTrainingImageResult(imageResultId, {
      captionDraft: textValue,
    });
    if (!data) {
      throw new TrainingTextRevisionServiceError("Training image result not found", 404, {
        imageResultId,
        projectId,
      });
    }
    return data;
  }

  return updateCharacterLoraImageCaption(imageResultId, {
    captionDraft: textValue,
  });
}

export async function listTrainingTextRevisions(projectId: string, query: unknown) {
  await assertTrainingProjectExists(projectId);
  const parsed = parseTextRevisionListQuery(query);
  const revisions = await readTrainingTextRevisions();
  return sortTrainingTextRevisions(
    revisions.filter((revision) => (
      revision.trainingProjectId === projectId
      && (!parsed.entityType || revision.entityType === parsed.entityType)
      && (!parsed.entityId || revision.entityId === parsed.entityId)
      && (!parsed.fieldName || revision.fieldName === parsed.fieldName)
    )),
  );
}

export async function createTrainingTextRevision(projectId: string, input: unknown) {
  const parsed = parseTextRevisionInput(input);
  await assertSupportedTextTarget(projectId, parsed);

  const revision: TrainingTextRevision = {
    id: `training-text-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    trainingProjectId: projectId,
    entityType: parsed.entityType,
    entityId: parsed.entityId,
    fieldName: parsed.fieldName,
    textValue: parsed.textValue,
    reason: parsed.reason,
    sourceTaskId: parsed.sourceTaskId?.trim() || null,
    sourceRunId: parsed.sourceRunId?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  await withTextRevisionWriteLock(async () => {
    const revisions = await readTrainingTextRevisions();
    await writeTrainingTextRevisions([...revisions, revision]);
  });

  return revision;
}

export async function restoreTrainingTextRevision(revisionId: string) {
  const revisions = await readTrainingTextRevisions();
  const revision = revisions.find((item) => item.id === revisionId);
  if (!revision) {
    throw new TrainingTextRevisionServiceError("Training text revision not found", 404, { revisionId });
  }

  const currentValue = revision.entityType === "profile"
    ? await readCurrentProfileTextValue(revision.trainingProjectId, revision.fieldName)
    : await readCurrentImageResultTextValue(revision.trainingProjectId, revision.entityId);

  const beforeOverwriteRevision = await createTrainingTextRevision(revision.trainingProjectId, {
    entityType: revision.entityType,
    entityId: revision.entityId,
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

  return {
    message: "Unexpected training text revision error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
