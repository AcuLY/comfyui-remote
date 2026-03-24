import { mkdir, rename, stat } from "node:fs/promises";
import { basename, dirname, posix, resolve } from "node:path";

export type ManagedImageMoveStatus = "missing" | "moved" | "skipped";

const MANAGED_IMAGE_ROOT = posix.join("data", "images");
const MANAGED_IMAGE_TRASH_ROOT = posix.join(MANAGED_IMAGE_ROOT, ".trash");

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isMissingPathError(error: unknown) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function normalizeManagedImagePath(relativePath: string) {
  const normalizedPath = posix.normalize(
    relativePath
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+/, ""),
  );

  if (!normalizedPath || normalizedPath === "." || normalizedPath === "..") {
    throw new Error(`Managed image path is invalid: "${relativePath}"`);
  }

  if (
    normalizedPath !== MANAGED_IMAGE_ROOT &&
    !normalizedPath.startsWith(`${MANAGED_IMAGE_ROOT}/`)
  ) {
    throw new Error(`Managed image path must stay under "${MANAGED_IMAGE_ROOT}": "${relativePath}"`);
  }

  return normalizedPath;
}

function getManagedImageSubpath(relativePath: string) {
  const normalizedPath = normalizeManagedImagePath(relativePath);

  if (normalizedPath === MANAGED_IMAGE_ROOT) {
    return "";
  }

  return normalizedPath.slice(`${MANAGED_IMAGE_ROOT}/`.length);
}

function resolveManagedImagePath(relativePath: string) {
  const managedImageSubpath = getManagedImageSubpath(relativePath);

  return managedImageSubpath
    ? resolve(process.cwd(), "data", "images", managedImageSubpath)
    : resolve(process.cwd(), "data", "images");
}

async function pathExists(absolutePath: string) {
  try {
    await stat(absolutePath);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }

    throw new Error(`Failed to inspect managed image path "${absolutePath}": ${formatError(error)}`);
  }
}

export function buildManagedTrashPath(imageId: string, sourcePath: string) {
  const normalizedSourcePath = normalizeManagedImagePath(sourcePath);
  return posix.join(MANAGED_IMAGE_TRASH_ROOT, imageId, basename(normalizedSourcePath));
}

export async function moveManagedImageFile(
  sourcePath: string,
  targetPath: string,
): Promise<ManagedImageMoveStatus> {
  const normalizedSourcePath = normalizeManagedImagePath(sourcePath);
  const normalizedTargetPath = normalizeManagedImagePath(targetPath);

  if (normalizedSourcePath === normalizedTargetPath) {
    return "skipped";
  }

  const sourceAbsolutePath = resolveManagedImagePath(normalizedSourcePath);
  const targetAbsolutePath = resolveManagedImagePath(normalizedTargetPath);

  if (!(await pathExists(sourceAbsolutePath))) {
    return (await pathExists(targetAbsolutePath)) ? "skipped" : "missing";
  }

  if (await pathExists(targetAbsolutePath)) {
    throw new Error(`Managed image target already exists: "${normalizedTargetPath}"`);
  }

  await mkdir(dirname(targetAbsolutePath), { recursive: true });

  try {
    await rename(sourceAbsolutePath, targetAbsolutePath);
    return "moved";
  } catch (error) {
    if (isMissingPathError(error)) {
      return (await pathExists(targetAbsolutePath)) ? "skipped" : "missing";
    }

    throw new Error(
      `Failed to move managed image from "${normalizedSourcePath}" to "${normalizedTargetPath}": ${formatError(error)}`,
    );
  }
}
