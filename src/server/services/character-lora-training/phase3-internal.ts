/**
 * Shared internals for phase3 sub-modules (dataset-freeze-service, generation-run-service).
 *
 * Extracted to avoid circular dependencies between phase3-service.ts and its sub-modules.
 */
import { z } from "zod";

import { CharacterLoraServiceError } from "@/server/services/character-lora-training/shared/service-error";
import { normalizeId as sharedNormalizeId } from "@/server/services/character-lora-training/shared/service-utils";
import {
  getCharacterLoraCandidateImage,
  getCharacterLoraJobSection,
  getCharacterLoraTrainingJob,
  type CharacterLoraCandidateImageSummary,
} from "@/server/repositories/character-lora-training-repository";

export class CharacterLoraPhase3ServiceError extends CharacterLoraServiceError {
  constructor(
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message, status, details);
    this.name = "CharacterLoraPhase3ServiceError";
  }
}

export function normalizeId(value: string, fieldName: string) {
  return sharedNormalizeId(value, fieldName, CharacterLoraPhase3ServiceError);
}

export function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw new CharacterLoraPhase3ServiceError("Invalid character LoRA Phase 3 request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export async function getExistingJob(jobId: string) {
  const job = await getCharacterLoraTrainingJob(jobId);
  if (!job) {
    throw new CharacterLoraPhase3ServiceError("Character LoRA training job not found", 404);
  }
  return job;
}

export async function getExistingSection(sectionId: string) {
  const section = await getCharacterLoraJobSection(sectionId);
  if (!section) {
    throw new CharacterLoraPhase3ServiceError("Character LoRA section not found", 404);
  }
  return section;
}

export async function getExistingCandidateImage(imageId: string) {
  const image = await getCharacterLoraCandidateImage(imageId);
  if (!image) {
    throw new CharacterLoraPhase3ServiceError("Character LoRA candidate image not found", 404);
  }
  return image;
}

export function assertUniqueIds(ids: string[], fieldName: string) {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.push(id);
      continue;
    }
    seen.add(id);
  }

  if (duplicates.length > 0) {
    throw new CharacterLoraPhase3ServiceError(`${fieldName} must not contain duplicates`, 400, {
      duplicates,
    });
  }
}

export function normalizeCaptionTrigger(triggerToken: string, caption: string) {
  const trigger = triggerToken.trim();
  const parts = caption
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== trigger);

  return [trigger, ...parts].join(", ");
}
