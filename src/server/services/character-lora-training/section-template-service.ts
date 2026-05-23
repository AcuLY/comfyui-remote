import { Prisma } from "@/generated/prisma";
import {
  createCharacterLoraSectionTemplateCopy as createSectionTemplateCopyInRepository,
  getCharacterLoraCanonicalVersion as getCanonicalVersionFromRepository,
  getCharacterLoraPromptCardVersion as getPromptCardVersionFromRepository,
  getCharacterLoraSectionTemplate as getSectionTemplateFromRepository,
  getCharacterLoraTrainingJob as getJobFromRepository,
  instantiateCharacterLoraJobSections as instantiateJobSectionsInRepository,
  listActiveCharacterLoraSectionTemplates as listActiveSectionTemplatesFromRepository,
  listCharacterLoraJobSections as listJobSectionsFromRepository,
  updateCharacterLoraJobSectionStatus as updateJobSectionStatusInRepository,
  type CharacterLoraJobSectionStatusPatch,
  upsertCharacterLoraSectionTemplates as upsertSectionTemplatesInRepository,
  type CharacterLoraSectionTemplateCopyCreateInput,
  type CharacterLoraSectionTemplateUpsertInput,
} from "@/server/repositories/character-lora-training-repository";
import { z } from "zod";

const DEFAULT_NEGATIVE_TEMPLATE =
  "wrong identity, inconsistent face, inconsistent outfit, low quality, blurry, distorted anatomy, extra fingers";

const DEFAULT_SECTION_TEMPLATES: CharacterLoraSectionTemplateUpsertInput[] = [
  {
    key: "front_fullbody",
    name: "Front Full Body",
    description: "Neutral front-facing full-body view for core identity and outfit coverage.",
    angleTag: "front",
    promptTemplate:
      "{{finalPromptDraft}}, full body, standing, front view, centered composition, clear face, complete outfit, visible shoes",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 10,
    isActive: true,
  },
  {
    key: "turn_left_45",
    name: "Turn Left 45",
    description: "Three-quarter turn to the character's left for depth and silhouette variation.",
    angleTag: "left 45 degree turn",
    promptTemplate:
      "{{finalPromptDraft}}, full body, standing, turned 45 degrees to the character's left, clear profile transition, visible outfit details",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 20,
    isActive: true,
  },
  {
    key: "turn_right_45",
    name: "Turn Right 45",
    description: "Three-quarter turn to the character's right for balanced identity coverage.",
    angleTag: "right 45 degree turn",
    promptTemplate:
      "{{finalPromptDraft}}, full body, standing, turned 45 degrees to the character's right, clear profile transition, visible outfit details",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 30,
    isActive: true,
  },
  {
    key: "left_side",
    name: "Left Side",
    description: "Left-side profile reference with complete body proportions.",
    angleTag: "left side",
    promptTemplate:
      "{{finalPromptDraft}}, full body, standing, left side profile, complete silhouette, clear hair shape, visible outfit and shoes",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 40,
    isActive: true,
  },
  {
    key: "right_side",
    name: "Right Side",
    description: "Right-side profile reference with complete body proportions.",
    angleTag: "right side",
    promptTemplate:
      "{{finalPromptDraft}}, full body, standing, right side profile, complete silhouette, clear hair shape, visible outfit and shoes",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 50,
    isActive: true,
  },
  {
    key: "back",
    name: "Back",
    description: "Back view for hairstyle, outfit rear details, and silhouette consistency.",
    angleTag: "back",
    promptTemplate:
      "{{finalPromptDraft}}, full body, standing, back view, clear hairstyle from behind, visible back outfit details, complete shoes",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 60,
    isActive: true,
  },
  {
    key: "half_body",
    name: "Half Body",
    description: "Waist-up view emphasizing face, torso, and signature outfit details.",
    angleTag: "half body",
    promptTemplate:
      "{{finalPromptDraft}}, half body portrait, waist up, clear face, clear torso outfit details, natural posture",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 70,
    isActive: true,
  },
  {
    key: "portrait",
    name: "Portrait",
    description: "Close portrait for facial identity, hair, eye, and expression fidelity.",
    angleTag: "portrait",
    promptTemplate:
      "{{finalPromptDraft}}, close portrait, shoulders up, clear face, clear eyes, accurate hairstyle, clean lighting",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 80,
    isActive: true,
  },
  {
    key: "shoes_lower_body",
    name: "Shoes Lower Body",
    description: "Lower-body crop focused on legs, socks, footwear, and hem details.",
    angleTag: "lower body",
    promptTemplate:
      "{{finalPromptDraft}}, lower body crop, waist down, clear legs, clear socks, clear shoes, outfit hem visible",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 90,
    isActive: true,
  },
  {
    key: "simple_sitting",
    name: "Simple Sitting",
    description: "Simple seated pose to broaden pose coverage without changing identity.",
    angleTag: "sitting",
    promptTemplate:
      "{{finalPromptDraft}}, simple sitting pose, relaxed posture, clear face, outfit remains consistent, visible hands and shoes",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 100,
    isActive: true,
  },
  {
    key: "simple_action",
    name: "Simple Action",
    description: "Light action pose for motion variation while preserving outfit and facial identity.",
    angleTag: "action",
    promptTemplate:
      "{{finalPromptDraft}}, simple dynamic action pose, natural movement, clear face, outfit remains consistent, readable silhouette",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 4,
    targetKeepCount: 1,
    sortOrder: 110,
    isActive: true,
  },
  {
    key: "expression_variants",
    name: "Expression Variants",
    description: "Facial expression variants for emotion coverage with stable identity.",
    angleTag: "expressions",
    promptTemplate:
      "{{finalPromptDraft}}, portrait expression sheet variation, clear face, stable identity, natural expression, accurate hair and eyes",
    negativeTemplate: DEFAULT_NEGATIVE_TEMPLATE,
    targetCandidateCount: 6,
    targetKeepCount: 2,
    sortOrder: 120,
    isActive: true,
  },
];

const instantiateSectionsSchema = z
  .object({
    templateKeys: z.array(z.string().trim().min(1)).min(1).optional(),
  })
  .strict();

const updateSectionStatusSchema = z
  .object({
    action: z.enum(["pause", "resume"]).optional(),
    status: z.enum(["paused", "active"]).optional(),
  })
  .strict()
  .refine((input) => Boolean(input.action) !== Boolean(input.status), {
    message: "Provide exactly one of action or status",
    path: ["action"],
  });

const optionalTextSchema = z.string().trim().min(1).optional();
const optionalNullableTextSchema = z.union([z.string().trim().min(1), z.null()]).optional();

const copySectionTemplateSchema = z
  .object({
    sourceTemplateId: optionalTextSchema,
    sourceTemplateKey: optionalTextSchema,
    key: optionalTextSchema,
    name: optionalTextSchema,
    description: optionalNullableTextSchema,
    angleTag: optionalNullableTextSchema,
    promptTemplate: optionalTextSchema,
    negativeTemplate: optionalNullableTextSchema,
    targetCandidateCount: z.coerce.number().int().min(1).max(100).optional(),
    targetKeepCount: z.coerce.number().int().min(1).max(100).optional(),
    sortOrder: z.coerce.number().int().min(-10_000).max(10_000).optional(),
  })
  .strict()
  .refine((input) => Boolean(input.sourceTemplateId || input.sourceTemplateKey), {
    message: "sourceTemplateId or sourceTemplateKey is required",
    path: ["sourceTemplateId"],
  });

export class CharacterLoraSectionTemplateServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CharacterLoraSectionTemplateServiceError";
  }
}

export async function ensureDefaultCharacterLoraSectionTemplates() {
  return upsertSectionTemplatesInRepository(DEFAULT_SECTION_TEMPLATES);
}

export async function listCharacterLoraSectionTemplates() {
  await ensureDefaultCharacterLoraSectionTemplates();

  return listActiveSectionTemplatesFromRepository();
}

export async function copyCharacterLoraSectionTemplate(input: unknown) {
  const parsed = parseWithSchema(copySectionTemplateSchema, input ?? {});

  await ensureDefaultCharacterLoraSectionTemplates();

  const source = await getSectionTemplateFromRepository(
    parsed.sourceTemplateId
      ? { id: parsed.sourceTemplateId }
      : { key: parsed.sourceTemplateKey },
  );

  if (!source) {
    throw new CharacterLoraSectionTemplateServiceError(
      "Source section template not found",
      404,
      {
        sourceTemplateId: parsed.sourceTemplateId ?? null,
        sourceTemplateKey: parsed.sourceTemplateKey ?? null,
      },
    );
  }

  if (parsed.sourceTemplateKey && source.key !== parsed.sourceTemplateKey) {
    throw new CharacterLoraSectionTemplateServiceError(
      "Source section template id/key mismatch",
      400,
      {
        sourceTemplateId: parsed.sourceTemplateId ?? null,
        sourceTemplateKey: parsed.sourceTemplateKey,
        actualKey: source.key,
      },
    );
  }

  const targetCandidateCount = parsed.targetCandidateCount ?? source.targetCandidateCount;
  const targetKeepCount = parsed.targetKeepCount ?? source.targetKeepCount;

  if (targetKeepCount > targetCandidateCount) {
    throw new CharacterLoraSectionTemplateServiceError(
      "targetKeepCount cannot exceed targetCandidateCount",
      400,
      { targetCandidateCount, targetKeepCount },
    );
  }

  const createInput: CharacterLoraSectionTemplateCopyCreateInput = {
    key: normalizeTemplateKey(parsed.key ?? `${source.key}_copy`),
    name: normalizeTemplateName(parsed.name ?? `${source.name} Copy`),
    description: parsed.description !== undefined ? parsed.description : source.description,
    angleTag: parsed.angleTag !== undefined ? parsed.angleTag : source.angleTag,
    promptTemplate: parsed.promptTemplate ?? source.promptTemplate,
    negativeTemplate: parsed.negativeTemplate !== undefined ? parsed.negativeTemplate : source.negativeTemplate,
    targetCandidateCount,
    targetKeepCount,
    sortOrder: parsed.sortOrder ?? source.sortOrder,
  };

  return createSectionTemplateCopyInRepository(createInput);
}

export async function listCharacterLoraJobSections(jobId: string) {
  const id = normalizeId(jobId, "jobId");
  await getExistingJob(id);

  return listJobSectionsFromRepository(id);
}

export async function instantiateCharacterLoraJobSections(jobId: string, input: unknown = {}) {
  const id = normalizeId(jobId, "jobId");
  const job = await getExistingJob(id);
  const parsed = parseWithSchema(instantiateSectionsSchema, input ?? {});
  const templateKeys = dedupeTemplateKeys(parsed.templateKeys);

  assertJobHasCurrentVersions(job);
  await assertCurrentVersionsBelongToJob({
    jobId: id,
    canonicalVersionId: job.currentCanonicalVersionId,
    promptCardVersionId: job.currentPromptCardVersionId,
  });

  await ensureDefaultCharacterLoraSectionTemplates();

  const templates = await listActiveSectionTemplatesFromRepository(
    templateKeys.length > 0 ? templateKeys : undefined,
  );

  if (templateKeys.length > 0) {
    const foundKeys = new Set(templates.map((template) => template.key));
    const missingKeys = templateKeys.filter((key) => !foundKeys.has(key));

    if (missingKeys.length > 0) {
      throw new CharacterLoraSectionTemplateServiceError(
        "Section template not found",
        404,
        { missingKeys },
      );
    }
  }

  if (templates.length === 0) {
    throw new CharacterLoraSectionTemplateServiceError("No active character LoRA section templates found", 409);
  }

  return instantiateJobSectionsInRepository({
    jobId: id,
    canonicalVersionId: job.currentCanonicalVersionId,
    promptCardVersionId: job.currentPromptCardVersionId,
    templates,
  });
}

export async function updateCharacterLoraJobSectionStatus(sectionId: string, input: unknown) {
  const id = normalizeId(sectionId, "sectionId");
  const parsed = parseWithSchema(updateSectionStatusSchema, input ?? {});
  const status = resolveSectionStatusPatch(parsed);
  const section = await updateJobSectionStatusInRepository({ sectionId: id, status });

  if (!section) {
    throw new CharacterLoraSectionTemplateServiceError("Character LoRA section not found", 404);
  }

  return section;
}

export async function pauseCharacterLoraJobSection(sectionId: string) {
  return updateCharacterLoraJobSectionStatus(sectionId, { status: "paused" });
}

export async function resumeCharacterLoraJobSection(sectionId: string) {
  return updateCharacterLoraJobSectionStatus(sectionId, { status: "active" });
}

export function mapCharacterLoraSectionTemplateError(error: unknown) {
  if (error instanceof CharacterLoraSectionTemplateServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        message: "Character LoRA section already exists",
        status: 409,
        details: "Database uniqueness check failed",
      };
    }

    if (error.code === "P2025") {
      return {
        message: "Character LoRA section target not found",
        status: 404,
        details: "Database record was not found",
      };
    }

    return {
      message: "Character LoRA section database request failed",
      status: 500,
      details: "Database operation failed",
    };
  }

  return {
    message: "Unexpected character LoRA section error",
    status: 500,
    details: "An internal error occurred",
  };
}

async function getExistingJob(jobId: string) {
  const job = await getJobFromRepository(jobId);

  if (!job) {
    throw new CharacterLoraSectionTemplateServiceError("Character LoRA training job not found", 404);
  }

  return job;
}

function assertJobHasCurrentVersions<
  T extends {
    currentCanonicalVersionId: string | null;
    currentPromptCardVersionId: string | null;
  },
>(job: T): asserts job is T & {
  currentCanonicalVersionId: string;
  currentPromptCardVersionId: string;
} {
  if (!job.currentCanonicalVersionId) {
    throw new CharacterLoraSectionTemplateServiceError(
      "Job must have a current canonical version before instantiating sections",
      409,
    );
  }

  if (!job.currentPromptCardVersionId) {
    throw new CharacterLoraSectionTemplateServiceError(
      "Job must have a current prompt card version before instantiating sections",
      409,
    );
  }
}

async function assertCurrentVersionsBelongToJob(input: {
  jobId: string;
  canonicalVersionId: string;
  promptCardVersionId: string;
}) {
  const [canonicalVersion, promptCardVersion] = await Promise.all([
    getCanonicalVersionFromRepository(input.canonicalVersionId),
    getPromptCardVersionFromRepository(input.promptCardVersionId),
  ]);

  if (!canonicalVersion || canonicalVersion.jobId !== input.jobId) {
    throw new CharacterLoraSectionTemplateServiceError(
      "Current canonical version is not valid for this job",
      409,
      { canonicalVersionId: input.canonicalVersionId },
    );
  }

  if (!promptCardVersion || promptCardVersion.jobId !== input.jobId) {
    throw new CharacterLoraSectionTemplateServiceError(
      "Current prompt card version is not valid for this job",
      409,
      { promptCardVersionId: input.promptCardVersionId },
    );
  }
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw new CharacterLoraSectionTemplateServiceError("Invalid character LoRA section request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function normalizeId(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new CharacterLoraSectionTemplateServiceError(`${fieldName} is required`, 400);
  }

  return normalized;
}

function normalizeTemplateKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 96);

  if (!normalized) {
    throw new CharacterLoraSectionTemplateServiceError("Template key is required", 400);
  }

  return normalized;
}

function normalizeTemplateName(value: string) {
  const normalized = value.trim().slice(0, 160);

  if (!normalized) {
    throw new CharacterLoraSectionTemplateServiceError("Template name is required", 400);
  }

  return normalized;
}

function dedupeTemplateKeys(templateKeys: string[] | undefined) {
  return Array.from(new Set(templateKeys ?? []));
}

function resolveSectionStatusPatch(
  input: z.infer<typeof updateSectionStatusSchema>,
): CharacterLoraJobSectionStatusPatch {
  if (input.status) {
    return input.status;
  }

  return input.action === "pause" ? "paused" : "active";
}
