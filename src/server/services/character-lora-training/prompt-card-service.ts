import { Prisma } from "@/generated/prisma";
import {
  createCharacterLoraPromptCardVersion as createPromptCardVersionInRepository,
  getCharacterLoraCanonicalVersion as getCanonicalVersionFromRepository,
  getCharacterLoraTrainingJob as getJobFromRepository,
  listCharacterLoraPromptCardVersions as listPromptCardVersionsFromRepository,
} from "@/server/repositories/character-lora-training-repository";
import { z } from "zod";

const jsonObjectSchema = z.custom<Record<string, unknown>>(isPlainObject, {
  message: "must be an object",
});

const createPromptCardSchema = z
  .object({
    canonicalVersionId: nullableTrimmedStringSchema(),
    triggerToken: z.string().trim().min(1).optional(),
    identityTraits: jsonObjectSchema,
    outfitTraits: jsonObjectSchema,
    negativeTraits: jsonObjectSchema.nullable().optional(),
    finalPromptDraft: z.string().trim().min(1),
    changeReason: nullableTrimmedStringSchema(),
  })
  .strict();

export class CharacterLoraPromptCardServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CharacterLoraPromptCardServiceError";
  }
}

export async function listCharacterLoraPromptCardVersions(jobId: string) {
  const id = normalizeId(jobId, "jobId");
  await getExistingJob(id);

  return listPromptCardVersionsFromRepository(id);
}

export async function createCharacterLoraPromptCardVersion(jobId: string, input: unknown) {
  const id = normalizeId(jobId, "jobId");
  const job = await getExistingJob(id);
  const parsed = parseWithSchema(createPromptCardSchema, input);
  const canonicalVersionId = parsed.canonicalVersionId ?? job.currentCanonicalVersionId ?? null;

  if (canonicalVersionId) {
    await assertCanonicalVersionBelongsToJob({
      jobId: id,
      canonicalVersionId,
      fromCurrentJobPointer: !parsed.canonicalVersionId,
    });
  }

  return createPromptCardVersionInRepository({
    jobId: id,
    canonicalVersionId,
    triggerToken: parsed.triggerToken ?? job.triggerToken,
    identityTraits: toInputJsonValue(parsed.identityTraits),
    outfitTraits: toInputJsonValue(parsed.outfitTraits),
    negativeTraits:
      parsed.negativeTraits === undefined || parsed.negativeTraits === null
        ? null
        : toInputJsonValue(parsed.negativeTraits),
    finalPromptDraft: parsed.finalPromptDraft,
    changeReason: parsed.changeReason,
  });
}

export function mapCharacterLoraPromptCardError(error: unknown) {
  if (error instanceof CharacterLoraPromptCardServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        message: "Character LoRA prompt card version already exists",
        status: 409,
        details: "Database uniqueness check failed",
      };
    }

    if (error.code === "P2025") {
      return {
        message: "Character LoRA prompt card target not found",
        status: 404,
        details: "Database record was not found",
      };
    }

    return {
      message: "Character LoRA prompt card database request failed",
      status: 500,
      details: "Database operation failed",
    };
  }

  return {
    message: "Unexpected character LoRA prompt card error",
    status: 500,
    details: "An internal error occurred",
  };
}

async function getExistingJob(jobId: string) {
  const job = await getJobFromRepository(jobId);

  if (!job) {
    throw new CharacterLoraPromptCardServiceError("Character LoRA training job not found", 404);
  }

  return job;
}

async function assertCanonicalVersionBelongsToJob(input: {
  jobId: string;
  canonicalVersionId: string;
  fromCurrentJobPointer: boolean;
}) {
  const canonicalVersion = await getCanonicalVersionFromRepository(input.canonicalVersionId);

  if (!canonicalVersion) {
    throw new CharacterLoraPromptCardServiceError(
      input.fromCurrentJobPointer
        ? "Current canonical version was not found"
        : "Canonical version not found",
      input.fromCurrentJobPointer ? 409 : 404,
      { canonicalVersionId: input.canonicalVersionId },
    );
  }

  if (canonicalVersion.jobId !== input.jobId) {
    throw new CharacterLoraPromptCardServiceError(
      "canonicalVersionId must belong to the character LoRA training job",
      400,
      { canonicalVersionId: input.canonicalVersionId, jobId: input.jobId },
    );
  }
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw new CharacterLoraPromptCardServiceError("Invalid character LoRA prompt card request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function nullableTrimmedStringSchema() {
  return z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional();
}

function normalizeId(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new CharacterLoraPromptCardServiceError(`${fieldName} is required`, 400);
  }

  return normalized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
