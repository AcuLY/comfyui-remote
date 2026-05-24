import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Prisma } from "@/generated/prisma";
import {
  PromptCardDraftParseError,
  buildPromptCardDraftPrompt,
  parsePromptCardDraftResponse,
  selectLatestCanonicalVersionsByView,
  type PromptCardDraftFields,
} from "@/lib/character-lora-prompt-card-draft";
import {
  createCharacterLoraPromptCardVersion as createPromptCardVersionInRepository,
  getCharacterLoraArtifact as getArtifactFromRepository,
  getCharacterLoraCanonicalVersion as getCanonicalVersionFromRepository,
  getCharacterLoraPromptCardVersion as getPromptCardVersionFromRepository,
  getCharacterLoraTrainingJob as getJobFromRepository,
  listCharacterLoraCanonicalVersions as listCanonicalVersionsFromRepository,
  listCharacterLoraPromptCardVersions as listPromptCardVersionsFromRepository,
  listCharacterLoraSourceImages as listSourceImagesFromRepository,
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

const promoteSectionInstructionSchema = z
  .object({
    sectionUserInstruction: z.string().trim().min(1),
  })
  .strict();

const promptCardDraftProviderSchema = z.enum(["codex-cli", "mock-local"]);

const generatePromptCardDraftSchema = z
  .object({
    canonicalVersionId: nullableTrimmedStringSchema(),
    provider: promptCardDraftProviderSchema.optional(),
    operatorNotes: nullableTrimmedStringSchema(),
  })
  .strict();

const PROMPT_CARD_DRAFT_OUTPUT_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["characterDescription", "identityTraits", "outfitTraits", "negativeTraits", "finalPromptDraft"],
  properties: {
    characterDescription: { type: "string" },
    identityTraits: { type: "array", items: { type: "string" } },
    outfitTraits: { type: "object" },
    negativeTraits: { type: "array", items: { type: "string" } },
    finalPromptDraft: { type: "string" },
  },
} as const;

const DEFAULT_PROMPT_CARD_DRAFT_PROVIDER = "codex-cli" satisfies z.infer<typeof promptCardDraftProviderSchema>;
const DEFAULT_PROMPT_CARD_CODEX_MODEL = "gpt-5.5";
const DEFAULT_PROMPT_CARD_CODEX_TIMEOUT_MS = 180_000;
const DEFAULT_PROMPT_CARD_CODEX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";
const DEFAULT_PROMPT_CARD_CODEX_COMMAND_ARGS = ["-y", "@openai/codex"] as const;
const MAX_PROMPT_CARD_DRAFT_IMAGES = 8;

type PromptCardDraftImageInput = {
  role: "source" | "canonical";
  id: string;
  artifactId: string;
  absolutePath: string;
};

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
    await assertCanonicalVersionCanBeUsedForPromptCard({
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

export async function generateCharacterLoraPromptCardDraft(jobId: string, input: unknown = {}) {
  const id = normalizeId(jobId, "jobId");
  const job = await getExistingJob(id);
  const parsed = parseWithSchema(generatePromptCardDraftSchema, input);
  const provider = parsed.provider ?? DEFAULT_PROMPT_CARD_DRAFT_PROVIDER;
  const images = await resolvePromptCardDraftImages(id, parsed.canonicalVersionId ?? null);
  const sourceImageCount = images.filter((image) => image.role === "source").length;
  const canonicalImageCount = images.filter((image) => image.role === "canonical").length;

  if (images.length === 0) {
    throw new CharacterLoraPromptCardServiceError(
      "At least one source or canonical image is required to draft a Prompt Card",
      409,
      { jobId: id },
    );
  }

  const prompt = buildPromptCardDraftPrompt({
    characterName: job.characterName,
    triggerToken: job.triggerToken,
    sourceImageCount,
    canonicalImageCount,
    operatorNotes: parsed.operatorNotes,
  });

  const draft = provider === "mock-local"
    ? buildMockPromptCardDraft({
        characterName: job.characterName,
        triggerToken: job.triggerToken,
        sourceImageCount,
        canonicalImageCount,
        operatorNotes: parsed.operatorNotes,
      })
    : await runCodexPromptCardDraft({ prompt, images });

  return {
    provider,
    sourceImageCount,
    canonicalImageCount,
    imageCount: images.length,
    draft,
  };
}

export async function promoteCharacterLoraSectionInstructionToPromptCardVersion(jobId: string, input: unknown) {
  const id = normalizeId(jobId, "jobId");
  const job = await getExistingJob(id);
  const parsed = parseWithSchema(promoteSectionInstructionSchema, input);

  if (!job.currentPromptCardVersionId) {
    throw new CharacterLoraPromptCardServiceError("Current Prompt Card version is required", 409, { jobId: id });
  }

  const currentPrompt = await getPromptCardVersionFromRepository(job.currentPromptCardVersionId);

  if (!currentPrompt) {
    throw new CharacterLoraPromptCardServiceError("Current Prompt Card version was not found", 409, {
      promptCardVersionId: job.currentPromptCardVersionId,
    });
  }

  if (currentPrompt.jobId !== id) {
    throw new CharacterLoraPromptCardServiceError(
      "Current Prompt Card version must belong to the character LoRA training job",
      409,
      { promptCardVersionId: currentPrompt.id, jobId: id },
    );
  }

  const canonicalVersionId = currentPrompt.canonicalVersionId ?? job.currentCanonicalVersionId ?? null;

  if (canonicalVersionId) {
    await assertCanonicalVersionCanBeUsedForPromptCard({
      jobId: id,
      canonicalVersionId,
      fromCurrentJobPointer: !currentPrompt.canonicalVersionId,
      ...(currentPrompt.canonicalVersionId ? { currentPromptCardVersionId: currentPrompt.id } : {}),
    });
  }

  return createPromptCardVersionInRepository({
    jobId: id,
    canonicalVersionId,
    triggerToken: currentPrompt.triggerToken,
    identityTraits: toInputJsonValue(currentPrompt.identityTraits),
    outfitTraits: toInputJsonValue(currentPrompt.outfitTraits),
    negativeTraits: currentPrompt.negativeTraits === null ? null : toInputJsonValue(currentPrompt.negativeTraits),
    finalPromptDraft: appendPromptCorrection(currentPrompt.finalPromptDraft, parsed.sectionUserInstruction),
    changeReason: buildPromotedSectionInstructionChangeReason(currentPrompt.changeReason, parsed.sectionUserInstruction),
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

  if (error instanceof PromptCardDraftParseError) {
    return {
      message: "Prompt-card draft response could not be parsed",
      status: 502,
      details: error.message,
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

async function assertCanonicalVersionCanBeUsedForPromptCard(input: {
  jobId: string;
  canonicalVersionId: string;
  fromCurrentJobPointer: boolean;
  currentPromptCardVersionId?: string;
}) {
  const canonicalVersion = await getCanonicalVersionFromRepository(input.canonicalVersionId);

  if (!canonicalVersion) {
    let message = "Canonical version not found";
    if (input.currentPromptCardVersionId) {
      message = "Current Prompt Card canonical version was not found";
    } else if (input.fromCurrentJobPointer) {
      message = "Current canonical version was not found";
    }

    throw new CharacterLoraPromptCardServiceError(message, input.fromCurrentJobPointer || input.currentPromptCardVersionId ? 409 : 404, {
      canonicalVersionId: input.canonicalVersionId,
    });
  }

  if (canonicalVersion.jobId !== input.jobId) {
    throw new CharacterLoraPromptCardServiceError(
      "canonicalVersionId must belong to the character LoRA training job",
      400,
      { canonicalVersionId: input.canonicalVersionId, jobId: input.jobId },
    );
  }

  if (canonicalVersion.status === "rejected") {
    let message = "Rejected canonical version cannot be used for Prompt Card canonicalVersionId";
    if (input.currentPromptCardVersionId) {
      message =
        "Current Prompt Card is bound to a rejected canonical version; create or choose a Prompt Card with a valid canonicalVersionId before promoting section instructions";
    } else if (input.fromCurrentJobPointer) {
      message = "Current canonical version is rejected and cannot be used for Prompt Card canonicalVersionId";
    }

    throw new CharacterLoraPromptCardServiceError(message, 409, {
      canonicalVersionId: input.canonicalVersionId,
      status: canonicalVersion.status,
      currentPromptCardVersionId: input.currentPromptCardVersionId,
    });
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

async function resolvePromptCardDraftImages(jobId: string, canonicalVersionId: string | null): Promise<PromptCardDraftImageInput[]> {
  const [sourceImages, canonicalVersions] = await Promise.all([
    listSourceImagesFromRepository(jobId),
    listCanonicalVersionsFromRepository(jobId),
  ]);
  const selectedCanonicalVersions = selectPromptCardDraftCanonicalVersions(canonicalVersions, canonicalVersionId);

  const canonicalInputs = await Promise.all(
    selectedCanonicalVersions
      .filter((version) => version.imageArtifactId)
      .map(async (version) => {
        const artifact = await getArtifactFromRepository(version.imageArtifactId!);
        if (!artifact) return null;
        return {
          role: "canonical" as const,
          id: version.id,
          artifactId: artifact.id,
          absolutePath: artifact.absolutePath,
        };
      }),
  );

  const sourceInputs = await Promise.all(
    sourceImages.map(async (image) => {
      const artifact = await getArtifactFromRepository(image.artifactId);
      if (!artifact) return null;
      return {
        role: "source" as const,
        id: image.id,
        artifactId: artifact.id,
        absolutePath: artifact.absolutePath,
      };
    }),
  );

  return [...sourceInputs, ...canonicalInputs]
    .filter((image): image is PromptCardDraftImageInput => Boolean(image?.absolutePath))
    .slice(0, MAX_PROMPT_CARD_DRAFT_IMAGES);
}

function selectPromptCardDraftCanonicalVersions(
  versions: Awaited<ReturnType<typeof listCanonicalVersionsFromRepository>>,
  canonicalVersionId: string | null,
) {
  if (canonicalVersionId) {
    const version = versions.find((candidate) => candidate.id === canonicalVersionId);
    if (!version) {
      throw new CharacterLoraPromptCardServiceError("Canonical version not found", 404, { canonicalVersionId });
    }
    if (version.status === "rejected") {
      throw new CharacterLoraPromptCardServiceError(
        "Rejected canonical version cannot be used for Prompt Card draft extraction",
        409,
        { canonicalVersionId, status: version.status },
      );
    }
    return [version];
  }

  return selectLatestCanonicalVersionsByView(versions);
}

function buildMockPromptCardDraft(input: {
  characterName: string;
  triggerToken: string;
  sourceImageCount: number;
  canonicalImageCount: number;
  operatorNotes?: string | null;
}): PromptCardDraftFields {
  const characterDescription = `${input.characterName} reference draft: review the source images and write a detailed visible character description before saving. ${input.sourceImageCount} source reference image(s) and ${input.canonicalImageCount} canonical reference image(s) were available.${input.operatorNotes?.trim() ? ` Operator notes: ${input.operatorNotes.trim()}.` : ""}`;

  return {
    characterDescription,
    identityTraits: JSON.stringify([
      input.characterName,
      characterDescription,
      `${input.sourceImageCount} source reference image(s) reviewed`,
      `${input.canonicalImageCount} canonical reference image(s) reviewed`,
      input.operatorNotes?.trim() ? `operator notes: ${input.operatorNotes.trim()}` : "review visible stable identity traits before saving",
    ], null, 2),
    outfitTraits: JSON.stringify({
      mainOutfit: ["review clothing, shoes, accessories, colors, and distinctive details from the references before saving"],
    }, null, 2),
    negativeTraits: JSON.stringify([
      "wrong character identity",
      "wrong outfit colors or missing distinctive accessories",
      "extra characters",
      "text, logo, watermark",
    ], null, 2),
    finalPromptDraft: `${input.triggerToken}, ${input.characterName}, full body, consistent character identity, clean details`,
  };
}

async function runCodexPromptCardDraft(input: {
  prompt: string;
  images: PromptCardDraftImageInput[];
}): Promise<PromptCardDraftFields> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "lora-prompt-card-draft-"));
  const outputPath = path.join(tempDir, "last-message.txt");
  const schemaPath = path.join(tempDir, "output-schema.json");
  const model = process.env.CHARACTER_LORA_PROMPT_CARD_CODEX_MODEL
    ?? process.env.PHASE1_REVIEWER_CODEX_MODEL
    ?? DEFAULT_PROMPT_CARD_CODEX_MODEL;
  const command = process.env.CHARACTER_LORA_PROMPT_CARD_CODEX_COMMAND ?? DEFAULT_PROMPT_CARD_CODEX_COMMAND;
  const commandArgs = [
    ...(parseCodexCommandArgsEnv(process.env.CHARACTER_LORA_PROMPT_CARD_CODEX_COMMAND_ARGS)
      ?? parseCodexCommandArgsEnv(process.env.PHASE1_REVIEWER_CODEX_COMMAND_ARGS)
      ?? defaultCodexCommandArgs(command)),
  ];
  const timeoutMs = parseOptionalPositiveIntegerEnv(
    process.env.CHARACTER_LORA_PROMPT_CARD_CODEX_TIMEOUT_MS,
    "CHARACTER_LORA_PROMPT_CARD_CODEX_TIMEOUT_MS",
  ) ?? DEFAULT_PROMPT_CARD_CODEX_TIMEOUT_MS;

  try {
    await writeFile(schemaPath, `${JSON.stringify(PROMPT_CARD_DRAFT_OUTPUT_SCHEMA)}\n`, "utf8");
    const result = await runCodexCliProcess(
      command,
      [
        ...commandArgs,
        "exec",
        "--model",
        model,
        "--skip-git-repo-check",
        "--ephemeral",
        "--sandbox",
        "read-only",
        ...input.images.flatMap((image) => ["--image", image.absolutePath]),
        "--output-schema",
        schemaPath,
        "--output-last-message",
        outputPath,
        input.prompt,
      ],
      timeoutMs,
    );
    const outputText = (await readUtf8FileIfExists(outputPath)).trim() || result.stdout.trim();
    if (!outputText) {
      throw new CharacterLoraPromptCardServiceError("Codex prompt-card draft did not produce output", 502);
    }
    return parsePromptCardDraftResponse(outputText);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runCodexCliProcess(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    let settled = false;
    let timedOut = false;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const child = spawn(command, [...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      forceKillTimer.unref();
    }, timeoutMs);
    timeoutTimer.unref();

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr?.on("data", () => {
      // Drain stderr without surfacing prompt/image details.
    });
    child.on("error", (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      reject(safeCodexCliError(error));
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);

      if (timedOut) {
        reject(new CharacterLoraPromptCardServiceError(`Codex prompt-card draft timed out after ${timeoutMs} ms`, 504));
        return;
      }

      if (code !== 0) {
        const signalText = signal ? ` signal=${signal}` : "";
        reject(new CharacterLoraPromptCardServiceError(`Codex prompt-card draft exited with code=${code ?? "unknown"}${signalText}`, 502));
        return;
      }

      resolve({ stdout: Buffer.concat(stdoutChunks).toString("utf8") });
    });
  });
}

async function readUtf8FileIfExists(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return "";
    throw error;
  }
}

function safeCodexCliError(error: unknown) {
  if (isNodeError(error) && typeof error.code === "string") {
    return new CharacterLoraPromptCardServiceError(`Codex prompt-card draft failed to start code=${error.code}`, 502);
  }
  return new CharacterLoraPromptCardServiceError("Codex prompt-card draft failed to start", 502);
}

function defaultCodexCommandArgs(command: string): readonly string[] {
  const commandName = path.basename(command).toLowerCase();
  if (commandName === "npx" || commandName === "npx.cmd" || commandName === "npx.exe") {
    return DEFAULT_PROMPT_CARD_CODEX_COMMAND_ARGS;
  }
  return [];
}

function parseCodexCommandArgsEnv(value: string | undefined): readonly string[] | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      throw new CharacterLoraPromptCardServiceError("Codex command args env must be a valid JSON string array", 500);
    }
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string" || !item)) {
      throw new CharacterLoraPromptCardServiceError("Codex command args env must contain only non-empty strings", 500);
    }
    return parsed;
  }

  return trimmed.split(/\s+/);
}

function parseOptionalPositiveIntegerEnv(value: string | undefined, envName: string): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CharacterLoraPromptCardServiceError(`${envName} must be a positive integer`, 500);
  }
  return parsed;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === "object" && "code" in error);
}

function appendPromptCorrection(finalPromptDraft: string, sectionUserInstruction: string) {
  const draft = finalPromptDraft.trim();

  if (draft.includes(sectionUserInstruction)) {
    return draft;
  }

  return `${draft}, ${sectionUserInstruction}`;
}

function buildPromotedSectionInstructionChangeReason(previousReason: string | null, sectionUserInstruction: string) {
  const correctionReason = `Promoted section userInstruction to global Prompt Card correction for future new runs only: ${sectionUserInstruction}`;

  return previousReason ? `${previousReason}\n${correctionReason}` : correctionReason;
}
