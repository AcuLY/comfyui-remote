import path from "node:path";

import {
  createLegacyTrainingReferenceImage,
  findLegacyTrainingReferenceImageDuplicate,
  getLegacyTrainingCandidateImage,
  getLegacyTrainingProject,
  getLegacyTrainingReferenceImageFromRepository,
  listLegacyTrainingReferenceImages,
  TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE,
} from "@/server/services/training/legacy-compat-service";
import {
  applyManagedTrainingImageResultToReferenceImage,
  getManagedTrainingProject,
} from "@/server/services/training/project-service";
import { z } from "zod";

const generationOutputApplySchema = z.object({
  targetEntityType: z.string().trim().min(1),
  targetEntityId: z.string().trim().min(1).optional().nullable(),
  targetField: z.string().trim().min(1).optional().nullable(),
  label: z.string().trim().max(160).optional().nullable(),
  note: z.string().trim().max(20_000).optional().nullable(),
  kind: z.enum(["original", "generated", "auxiliary"]).optional().nullable(),
}).strict();

type GenerationOutputApplyInput = z.infer<typeof generationOutputApplySchema>;

type GenerationOutputApplyTarget = "reference_image" | "result_pool";

export class TrainingGenerationOutputServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingGenerationOutputServiceError";
    this.status = status;
    this.details = details;
  }
}

function parseGenerationOutputApplyInput(input: unknown) {
  const result = generationOutputApplySchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingGenerationOutputServiceError("Invalid training generation output apply request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function normalizeApplyTarget(value: string): GenerationOutputApplyTarget {
  if (value === "reference_image" || value === "training_character_image") {
    return "reference_image";
  }
  if (value === "result_pool" || value === "training_image_result") {
    return "result_pool";
  }
  throw new TrainingGenerationOutputServiceError("Unsupported training generation output target", 409, {
    supportedTargets: ["reference_image", "training_character_image", "result_pool", "training_image_result"],
    targetEntityType: value,
  });
}

function normalizeNullableString(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function applyManagedGenerationOutput(
  outputId: string,
  input: GenerationOutputApplyInput,
  target: GenerationOutputApplyTarget,
) {
  const project = await getManagedTrainingProject(normalizeNullableString(input.targetEntityId) ?? "");
  const ownerProject = project
    ?? (await findManagedGenerationOutputOwner(outputId));
  if (!ownerProject) return null;

  if (input.targetEntityId && input.targetEntityId !== ownerProject.id) {
    throw new TrainingGenerationOutputServiceError("Managed generation output does not belong to the target project", 409, {
      outputId,
      targetEntityId: input.targetEntityId,
      projectId: ownerProject.id,
    });
  }

  const output = ownerProject.resultPool.find((result) => result.id === outputId);
  if (!output) return null;

  if (target === "result_pool") {
    return {
      outputId,
      targetEntityType: input.targetEntityType,
      targetEntityId: ownerProject.id,
      targetField: normalizeNullableString(input.targetField),
      appliedAt: new Date().toISOString(),
      created: false,
      result: output,
    };
  }
  const applied = await applyManagedTrainingImageResultToReferenceImage(outputId, {
    kind: input.kind,
    label: input.label,
    note: input.note,
    targetProjectId: ownerProject.id,
  });
  if (!applied) return null;
  return {
    outputId,
    targetEntityType: input.targetEntityType,
    targetEntityId: ownerProject.id,
    targetField: normalizeNullableString(input.targetField),
    appliedAt: new Date().toISOString(),
    created: applied.created,
    result: applied.reference,
  };
}

async function findManagedGenerationOutputOwner(outputId: string) {
  const managedProjects = await import("@/server/services/training/project-service");
  const projects = await managedProjects.listManagedTrainingProjects();
  return projects.find((project) => project.resultPool.some((result) => result.id === outputId)) ?? null;
}

async function applyProductionGenerationOutput(
  outputId: string,
  input: GenerationOutputApplyInput,
  target: GenerationOutputApplyTarget,
) {
  const output = await getLegacyTrainingCandidateImage(outputId);
  if (!output) return null;
  const job = await getLegacyTrainingProject(output.jobId);
  if (!job) {
    throw new TrainingGenerationOutputServiceError("Training project not found", 404, { outputId, projectId: output.jobId });
  }

  if (input.targetEntityId && input.targetEntityId !== job.id) {
    throw new TrainingGenerationOutputServiceError("Generation output does not belong to the target project", 409, {
      outputId,
      targetEntityId: input.targetEntityId,
      projectId: job.id,
    });
  }

  if (target === "result_pool") {
    return {
      outputId,
      targetEntityType: input.targetEntityType,
      targetEntityId: job.id,
      targetField: normalizeNullableString(input.targetField),
      appliedAt: new Date().toISOString(),
      created: false,
      result: output,
    };
  }

  if (job.status === "archived" || job.status === "promoted") {
    throw new TrainingGenerationOutputServiceError(
      "Archived training projects cannot accept generated reference images",
      409,
      { status: job.status },
    );
  }

  const duplicate = await findLegacyTrainingReferenceImageDuplicate({
    jobId: job.id,
    role: TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE,
    sha256: output.sha256,
  });
  if (duplicate) {
    const existing = await getLegacyTrainingReferenceImageFromRepository(duplicate.id);
    if (!existing) {
      throw new TrainingGenerationOutputServiceError("Training reference image not found", 404, {
        outputId,
        sourceImageId: duplicate.id,
      });
    }
    return {
      outputId,
      targetEntityType: input.targetEntityType,
      targetEntityId: job.id,
      targetField: normalizeNullableString(input.targetField),
      appliedAt: new Date().toISOString(),
      created: false,
      result: existing,
    };
  }

  const sourceImages = await listLegacyTrainingReferenceImages(job.id);
  const byteSize = typeof output.fileSize === "string" && output.fileSize.trim() ? BigInt(output.fileSize) : null;
  const created = await createLegacyTrainingReferenceImage({
    jobId: job.id,
    role: TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE,
    relativePath: output.relativePath,
    absolutePath: path.join(job.artifactRoot, output.relativePath),
    sha256: output.sha256,
    byteSize,
    mimeType: null,
    width: output.width,
    height: output.height,
    provenance: {
      mode: "training_generation_output_apply",
      sourceGenerationOutputId: output.id,
      sourceGenerationRunId: output.generationRunId,
      sourceCandidateImageId: output.id,
      label: normalizeNullableString(input.label),
      note: normalizeNullableString(input.note),
    },
    sortOrder: sourceImages.length,
    artifactMetadata: {
      purpose: "training_generation_output_apply",
      sourceGenerationOutputId: output.id,
      sourceGenerationRunId: output.generationRunId,
    },
  });

  return {
    outputId,
    targetEntityType: input.targetEntityType,
    targetEntityId: job.id,
    targetField: normalizeNullableString(input.targetField),
    appliedAt: new Date().toISOString(),
    created: true,
    result: created,
  };
}

export async function applyTrainingGenerationOutput(outputId: string, input: unknown) {
  const parsed = parseGenerationOutputApplyInput(input);
  const target = normalizeApplyTarget(parsed.targetEntityType);

  const managed = await applyManagedGenerationOutput(outputId, parsed, target);
  if (managed) return managed;

  const production = await applyProductionGenerationOutput(outputId, parsed, target);
  if (production) return production;

  throw new TrainingGenerationOutputServiceError("Training generation output not found", 404, { outputId });
}

export function mapTrainingGenerationOutputError(error: unknown) {
  if (error instanceof TrainingGenerationOutputServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training generation output error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
