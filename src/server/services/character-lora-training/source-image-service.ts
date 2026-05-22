import path from "node:path";
import { rm } from "node:fs/promises";

import { Prisma } from "@/generated/prisma";
import { CharacterLoraJobStatus } from "@/generated/prisma/enums";
import { characterLoraSourceImageRoleSchema } from "@/server/character-lora-training/contracts";
import {
  createCharacterLoraSourceImage as createSourceImageInRepository,
  findCharacterLoraSourceImageDuplicate,
  getCharacterLoraTrainingJob as getJobFromRepository,
  listCharacterLoraSourceImages as listSourceImagesFromRepository,
} from "@/server/repositories/character-lora-training-repository";
import {
  computeCharacterLoraBufferSha256,
  redactCharacterLoraProviderPayload,
  writeCharacterLoraBufferArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import sharp from "sharp";

const DEFAULT_SOURCE_IMAGE_ROLE = "source";
const MAX_SOURCE_IMAGE_BYTES = 50 * 1024 * 1024;
const REDACTED_VALUE = "[redacted]";
const ALLOWED_SOURCE_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const WINDOWS_RESERVED_FILE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

type ParsedUploadInput = {
  file: File;
  role: string;
  sortOrder: number;
  provenance?: Record<string, unknown>;
};

export class CharacterLoraSourceImageServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CharacterLoraSourceImageServiceError";
  }
}

export async function listCharacterLoraSourceImages(jobId: string) {
  const id = normalizeJobId(jobId);
  await getExistingJob(id);

  return listSourceImagesFromRepository(id);
}

export async function uploadCharacterLoraSourceImage(jobId: string, input: unknown) {
  const id = normalizeJobId(jobId);
  const job = await getExistingJob(id);

  if (job.status !== CharacterLoraJobStatus.draft) {
    throw new CharacterLoraSourceImageServiceError(
      "Only draft character LoRA training jobs can accept source image uploads",
      409,
      { status: job.status },
    );
  }

  const parsed = parseUploadInput(input);
  const originalName = extractOriginalFileName(parsed.file.name);
  const safeName = sanitizeSourceImageFileName(originalName);
  const mimeType = normalizeMimeType(parsed.file.type);

  validateSourceImageFile(parsed.file, safeName);

  const uploadedAt = new Date();
  const buffer = Buffer.from(await parsed.file.arrayBuffer());

  if (buffer.byteLength === 0) {
    throw new CharacterLoraSourceImageServiceError("Source image file must not be empty", 400);
  }

  if (buffer.byteLength > MAX_SOURCE_IMAGE_BYTES) {
    throw new CharacterLoraSourceImageServiceError("Source image file exceeds the 50MB limit", 400, {
      maxBytes: MAX_SOURCE_IMAGE_BYTES,
      size: buffer.byteLength,
    });
  }

  const sha256 = computeCharacterLoraBufferSha256(buffer);
  const duplicate = await findCharacterLoraSourceImageDuplicate({
    jobId: id,
    role: parsed.role,
    sha256,
  });

  if (duplicate) {
    throw new CharacterLoraSourceImageServiceError(
      "Source image already exists for this job, role, and sha256",
      409,
      { role: parsed.role, sha256 },
    );
  }

  const dimensions = await readImageDimensions(buffer);
  const relativePath = buildSourceImageRelativePath(parsed.role, safeName, uploadedAt);
  const artifact = await writeCharacterLoraBufferArtifact(job.artifactRoot, relativePath, buffer);
  const provenance = buildSourceImageProvenance({
    originalName,
    safeName,
    mimeType,
    size: buffer.byteLength,
    uploadedAt,
    userProvenance: parsed.provenance,
  });

  try {
    return await createSourceImageInRepository({
      jobId: id,
      role: parsed.role,
      relativePath: artifact.relativePath,
      absolutePath: artifact.absolutePath,
      sha256: artifact.sha256,
      byteSize: BigInt(artifact.byteSize),
      mimeType,
      width: dimensions.width,
      height: dimensions.height,
      provenance: toInputJsonValue(provenance),
      sortOrder: parsed.sortOrder,
      artifactMetadata: toInputJsonValue({
        purpose: "source_image_upload",
        role: parsed.role,
        uploadedAt: uploadedAt.toISOString(),
        safeName,
      }),
    });
  } catch (error) {
    await deleteWrittenArtifact(artifact.absolutePath);
    throw error;
  }
}

export function mapCharacterLoraSourceImageError(error: unknown) {
  if (error instanceof CharacterLoraSourceImageServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        message: "Source image already exists for this job",
        status: 409,
        details: "Database uniqueness check failed",
      };
    }

    if (error.code === "P2025") {
      return {
        message: "Character LoRA training job not found",
        status: 404,
        details: "Database record was not found",
      };
    }

    return {
      message: "Character LoRA source image database request failed",
      status: 500,
      details: "Database operation failed",
    };
  }

  return {
    message: "Unexpected character LoRA source image error",
    status: 500,
    details: "An internal error occurred",
  };
}

async function getExistingJob(jobId: string) {
  const job = await getJobFromRepository(jobId);

  if (!job) {
    throw new CharacterLoraSourceImageServiceError("Character LoRA training job not found", 404);
  }

  return job;
}

function parseUploadInput(input: unknown): ParsedUploadInput {
  const rawInput = readRawUploadInput(input);
  const file = rawInput.file;

  if (!isFile(file)) {
    throw new CharacterLoraSourceImageServiceError("file is required", 400);
  }

  return {
    file,
    role: parseSourceImageRole(rawInput.role),
    sortOrder: parseOptionalInteger(rawInput.sortOrder, "sortOrder") ?? 0,
    provenance: parseProvenance(rawInput.provenance),
  };
}

function readRawUploadInput(input: unknown) {
  if (isFormData(input)) {
    return {
      file: input.get("file"),
      role: input.get("role"),
      sortOrder: input.get("sortOrder"),
      provenance: input.get("provenance"),
    };
  }

  if (isPlainObject(input)) {
    return input;
  }

  throw new CharacterLoraSourceImageServiceError("Invalid source image upload request", 400);
}

function parseSourceImageRole(value: unknown) {
  const rawRole = typeof value === "string" ? value.trim() : "";
  const role = rawRole || DEFAULT_SOURCE_IMAGE_ROLE;
  const result = characterLoraSourceImageRoleSchema.safeParse(role);

  if (result.success) {
    return result.data;
  }

  throw new CharacterLoraSourceImageServiceError("role must be a supported source image role", 400, {
    supportedRoles: characterLoraSourceImageRoleSchema.options,
  });
}

function parseOptionalInteger(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (isFile(value)) {
    throw new CharacterLoraSourceImageServiceError(`${fieldName} must be an integer`, 400);
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(numberValue)) {
    throw new CharacterLoraSourceImageServiceError(`${fieldName} must be an integer`, 400);
  }

  return numberValue;
}

function parseProvenance(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  let parsed = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new CharacterLoraSourceImageServiceError("provenance must be a valid JSON object", 400);
    }
  }

  if (!isPlainObject(parsed)) {
    throw new CharacterLoraSourceImageServiceError("provenance must be a JSON object", 400);
  }

  return parsed;
}

function validateSourceImageFile(file: File, safeName: string) {
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new CharacterLoraSourceImageServiceError("Source image file exceeds the 50MB limit", 400, {
      maxBytes: MAX_SOURCE_IMAGE_BYTES,
      size: file.size,
    });
  }

  const extension = path.extname(safeName).toLowerCase();

  if (!ALLOWED_SOURCE_IMAGE_EXTENSIONS.has(extension)) {
    throw new CharacterLoraSourceImageServiceError("Source image must be a .png, .jpg, .jpeg, or .webp file", 400, {
      supportedExtensions: Array.from(ALLOWED_SOURCE_IMAGE_EXTENSIONS),
    });
  }
}

function sanitizeSourceImageFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");

  const parsed = path.parse(normalized || "upload");
  const extension = parsed.ext.toLowerCase();
  const rawBaseName = (parsed.name || "upload").replace(/\.+$/g, "").trim() || "upload";
  const baseName = WINDOWS_RESERVED_FILE_NAMES.test(rawBaseName) ? `_${rawBaseName}` : rawBaseName;
  const maxBaseLength = Math.max(1, 180 - extension.length);

  return `${baseName.slice(0, maxBaseLength)}${extension}`;
}

function extractOriginalFileName(fileName: string) {
  const segments = fileName.replace(/\0/g, "").split(/[\\/]/).filter(Boolean);
  const originalName = segments.at(-1)?.trim();

  return originalName || "upload";
}

function buildSourceImageRelativePath(role: string, safeName: string, uploadedAt: Date) {
  const timestamp = uploadedAt.toISOString().replace(/[:.]/g, "-");

  return `source-images/${role}/${timestamp}-${safeName}`;
}

async function readImageDimensions(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer).metadata();

    return {
      width: isPositiveInteger(metadata.width) ? metadata.width : null,
      height: isPositiveInteger(metadata.height) ? metadata.height : null,
    };
  } catch {
    return {
      width: null,
      height: null,
    };
  }
}

function buildSourceImageProvenance(input: {
  originalName: string;
  safeName: string;
  mimeType: string | null;
  size: number;
  uploadedAt: Date;
  userProvenance?: Record<string, unknown>;
}) {
  return {
    originalName: input.originalName,
    safeName: input.safeName,
    mimeType: input.mimeType,
    size: input.size,
    uploadedAt: input.uploadedAt.toISOString(),
    ...(input.userProvenance
      ? { userProvenance: sanitizeUserProvenance(input.userProvenance) }
      : {}),
  };
}

function sanitizeUserProvenance(value: Record<string, unknown>) {
  const redacted = redactCharacterLoraProviderPayload(value);

  return redactUnsafeProvenance(redacted);
}

function redactUnsafeProvenance(value: unknown): unknown {
  if (typeof value === "string") {
    return looksLikeAbsoluteFilePath(value) ? REDACTED_VALUE : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnsafeProvenance(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, redactUnsafeProvenance(entryValue)]),
  );
}

function looksLikeAbsoluteFilePath(value: string) {
  return /^[a-z]:[\\/]/i.test(value) || value.startsWith("\\\\") || value.startsWith("/") || value.startsWith("~");
}

function normalizeMimeType(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

async function deleteWrittenArtifact(absolutePath: string) {
  try {
    await rm(absolutePath, { force: true });
  } catch {
    // Best-effort cleanup; the original database error is more useful to callers.
  }
}

function normalizeJobId(jobId: string) {
  const normalized = jobId.trim();

  if (!normalized) {
    throw new CharacterLoraSourceImageServiceError("jobId is required", 400);
  }

  return normalized;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || isFile(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
