import fs from "node:fs";
import path from "node:path";

import { toImageUrl } from "@/lib/image-url";

import type { DemoImage, DemoProject, DemoSection } from "./types";
import type { SqlRow, SqlValue } from "./sql-types";

const DATA_IMAGES_PREFIX = "data/images/";

function outputImageRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.env.OUTPUT_BASE_PATH ?? path.join(process.cwd(), "data/images"));
}

function stripDataImagesPrefix(value: string) {
  const normalized = value.replace(/\\/g, "/");
  return normalized.startsWith(DATA_IMAGES_PREFIX) ? normalized.slice(DATA_IMAGES_PREFIX.length) : normalized;
}

function isInsideImageRoot(root: string, resolved: string) {
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (process.platform === "win32") {
    return resolved.toLowerCase().startsWith(rootWithSeparator.toLowerCase());
  }
  return resolved.startsWith(rootWithSeparator);
}

function hasRenderableLocalImage(value: string) {
  const relativePath = stripDataImagesPrefix(value);
  if (!relativePath) return false;

  const root = outputImageRoot();
  const resolved = path.resolve(/* turbopackIgnore: true */ root, relativePath);
  if (!isInsideImageRoot(root, resolved)) return false;

  try {
    const fileStat = fs.statSync(/* turbopackIgnore: true */ resolved);
    return fileStat.isFile() && fileStat.size > 0;
  } catch {
    return false;
  }
}

export function text(value: SqlValue | undefined, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function int(value: SqlValue | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function bool(value: SqlValue | undefined) {
  return value === true || value === 1 || value === "1";
}

export function shortDate(value: SqlValue | undefined) {
  const raw = text(value);
  if (!raw) return "未记录";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 16);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  const h = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

export function parseJson<T>(value: SqlValue | undefined, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function formatSize(value: SqlValue | undefined) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "未知";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function imageFromRow(row: SqlRow, index: number): DemoImage | null {
  const thumbPath = text(row.thumbPath);
  const filePath = text(row.filePath);
  const sourcePath = hasRenderableLocalImage(thumbPath)
    ? thumbPath
    : hasRenderableLocalImage(filePath)
      ? filePath
      : "";
  const fullPath = hasRenderableLocalImage(filePath) ? filePath : sourcePath;
  const src = toImageUrl(sourcePath);
  const full = toImageUrl(fullPath);
  if (!src || !full) return null;

  const status = text(row.reviewStatus, "pending");
  return {
    id: text(row.id, `image-${index}`),
    src,
    full,
    label: String(index + 1).padStart(2, "0"),
    status: status === "kept" || status === "trashed" ? status : "pending",
    featured: bool(row.featured),
    featured2: bool(row.featured2),
    cover: bool(row.cover),
    width: row.width === null || row.width === undefined ? null : int(row.width),
    height: row.height === null || row.height === undefined ? null : int(row.height),
  };
}

export function placeholders(length: number, images: DemoImage[]) {
  return Array.from({ length }, (_, index) => images[index % Math.max(images.length, 1)]).filter(Boolean);
}

export function buildProjectImages(projects: DemoProject[], sections: DemoSection[], fallback: DemoImage[]) {
  for (const project of projects) {
    project.sections = sections.filter((section) => section.id.startsWith(`${project.id}:`));
    project.images = project.sections.flatMap((section) => section.images).slice(0, 8);
    if (project.images.length === 0) {
      project.images = placeholders(6, fallback);
    }
    project.sectionCount = project.sections.length || project.sectionCount;
  }
}
