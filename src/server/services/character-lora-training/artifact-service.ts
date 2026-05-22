import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";

const DEFAULT_ARTIFACT_ROOT_SEGMENTS = ["data", "character-lora-training"] as const;
const REDACTED_VALUE = "[redacted]";
const DATA_IMAGE_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,/i;
const BASE64_IMAGE_KEY_PATTERN = /(image|input|output|mask|b64|base64)/i;
const BASE64_LIKE_PATTERN = /^[a-z0-9+/=\r\n]+$/i;

export type CharacterLoraArtifactStat = {
  absolutePath: string;
  relativePath: string;
  byteSize: number;
  sha256: string;
  mtime: Date;
};

export function resolveCharacterLoraArtifactRoot() {
  const configuredRoot = env.characterLoraArtifactRoot.trim();

  return configuredRoot
    ? path.resolve(configuredRoot)
    : path.resolve(process.cwd(), ...DEFAULT_ARTIFACT_ROOT_SEGMENTS);
}

export function buildCharacterLoraJobRoot(jobSlug: string, artifactRoot = resolveCharacterLoraArtifactRoot()) {
  const safeJobSlug = normalizeSafeRelativePath(jobSlug);

  if (safeJobSlug.includes("/")) {
    throw new Error(`Character LoRA job slug must be a single path segment: "${jobSlug}"`);
  }

  return path.resolve(artifactRoot, safeJobSlug);
}

export function normalizeSafeRelativePath(relativePath: string) {
  if (relativePath.includes("\0")) {
    throw new Error("Character LoRA artifact path contains a null byte.");
  }

  const trimmedPath = relativePath.trim().replace(/\\/g, "/");

  if (!trimmedPath || path.isAbsolute(trimmedPath) || /^[a-z]:\//i.test(trimmedPath)) {
    throw new Error(`Character LoRA artifact path must be relative: "${relativePath}"`);
  }

  const normalizedPath = path.posix.normalize(trimmedPath.replace(/^\/+/, ""));

  if (
    !normalizedPath ||
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.startsWith("../") ||
    normalizedPath.includes("/../")
  ) {
    throw new Error(`Character LoRA artifact path is invalid: "${relativePath}"`);
  }

  return normalizedPath;
}

export function resolveCharacterLoraArtifactPath(jobRoot: string, relativePath: string) {
  const normalizedPath = normalizeSafeRelativePath(relativePath);
  const resolvedJobRoot = path.resolve(jobRoot);
  const absolutePath = path.resolve(resolvedJobRoot, ...normalizedPath.split("/"));
  const relativeToJobRoot = path.relative(resolvedJobRoot, absolutePath);

  if (
    relativeToJobRoot === "" ||
    relativeToJobRoot === ".." ||
    relativeToJobRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToJobRoot)
  ) {
    throw new Error(`Character LoRA artifact path escapes job root: "${relativePath}"`);
  }

  return {
    absolutePath,
    relativePath: normalizedPath,
  };
}

export async function ensureCharacterLoraDirectory(absolutePath: string) {
  await mkdir(absolutePath, { recursive: true });
  return absolutePath;
}

export async function ensureCharacterLoraJobRoot(jobSlug: string, artifactRoot = resolveCharacterLoraArtifactRoot()) {
  const jobRoot = buildCharacterLoraJobRoot(jobSlug, artifactRoot);
  await ensureCharacterLoraDirectory(jobRoot);
  return jobRoot;
}

export async function computeCharacterLoraSha256(absolutePath: string) {
  const fileBuffer = await readFile(absolutePath);
  return createHash("sha256").update(fileBuffer).digest("hex");
}

export async function statCharacterLoraArtifact(
  jobRoot: string,
  relativePath: string,
): Promise<CharacterLoraArtifactStat> {
  const resolvedPath = resolveCharacterLoraArtifactPath(jobRoot, relativePath);
  const [fileStat, sha256] = await Promise.all([
    stat(resolvedPath.absolutePath),
    computeCharacterLoraSha256(resolvedPath.absolutePath),
  ]);

  if (!fileStat.isFile()) {
    throw new Error(`Character LoRA artifact is not a file: "${resolvedPath.relativePath}"`);
  }

  return {
    absolutePath: resolvedPath.absolutePath,
    relativePath: resolvedPath.relativePath,
    byteSize: fileStat.size,
    sha256,
    mtime: fileStat.mtime,
  };
}

export async function writeCharacterLoraTextArtifact(
  jobRoot: string,
  relativePath: string,
  content: string,
) {
  const resolvedPath = resolveCharacterLoraArtifactPath(jobRoot, relativePath);
  await ensureCharacterLoraDirectory(path.dirname(resolvedPath.absolutePath));
  await writeFile(resolvedPath.absolutePath, content, "utf8");
  return statCharacterLoraArtifact(jobRoot, resolvedPath.relativePath);
}

export async function writeCharacterLoraJsonArtifact(
  jobRoot: string,
  relativePath: string,
  payload: unknown,
) {
  return writeCharacterLoraTextArtifact(
    jobRoot,
    relativePath,
    `${JSON.stringify(payload, null, 2)}\n`,
  );
}

export async function writeCharacterLoraBufferArtifact(
  jobRoot: string,
  relativePath: string,
  content: Buffer | Uint8Array,
) {
  const resolvedPath = resolveCharacterLoraArtifactPath(jobRoot, relativePath);
  await ensureCharacterLoraDirectory(path.dirname(resolvedPath.absolutePath));
  await writeFile(resolvedPath.absolutePath, content);
  return statCharacterLoraArtifact(jobRoot, resolvedPath.relativePath);
}

export function redactCharacterLoraProviderPayload<T>(payload: T): T {
  return redactProviderValue(payload, undefined) as T;
}

function redactProviderValue(value: unknown, key: string | undefined): unknown {
  if (typeof value === "string") {
    return shouldRedactStringValue(key, value) ? REDACTED_VALUE : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactProviderValue(item, key));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const redactedEntries = Object.entries(value).map(([entryKey, entryValue]) => {
    if (shouldRedactKey(entryKey)) {
      return [entryKey, REDACTED_VALUE];
    }

    return [entryKey, redactProviderValue(entryValue, entryKey)];
  });

  return Object.fromEntries(redactedEntries);
}

function shouldRedactKey(key: string) {
  const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();

  return (
    normalizedKey === "authorization" ||
    normalizedKey === "accesstoken" ||
    normalizedKey === "refreshtoken" ||
    normalizedKey === "token" ||
    normalizedKey.endsWith("token") ||
    normalizedKey === "accountid" ||
    normalizedKey.endsWith("accountid") ||
    normalizedKey.includes("secret")
  );
}

function shouldRedactStringValue(key: string | undefined, value: string) {
  if (DATA_IMAGE_URL_PATTERN.test(value)) {
    return true;
  }

  if (!key || value.length < 128 || !BASE64_IMAGE_KEY_PATTERN.test(key)) {
    return false;
  }

  return BASE64_LIKE_PATTERN.test(value);
}
