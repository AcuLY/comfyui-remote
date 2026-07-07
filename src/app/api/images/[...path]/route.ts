/**
 * GET /api/images/[...path]
 *
 * Serves local image files from the data/images directory.
 * This allows the frontend to display worker-generated images
 * using paths like /api/images/job-slug/run-id/raw/001.png
 */

import { type NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "path";
import { Readable } from "node:stream";
import { flatFail } from "@/lib/api-response";

const OUTPUT_BASE =
  process.env.OUTPUT_BASE_PATH ??
  path.join(/* turbopackIgnore: true */ process.cwd(), "data/images");
const RESOLVED_OUTPUT_BASE = path.resolve(OUTPUT_BASE);

// Allowed extensions to prevent arbitrary file access
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function isSafePathSegment(segment: string) {
  return (
    segment !== "" &&
    segment !== "." &&
    segment !== ".." &&
    !/^\.+$/.test(segment) &&
    !segment.includes("/") &&
    !segment.includes("\\") &&
    !segment.includes(":") &&
    !segment.includes("\0") &&
    !/[．／＼]/.test(segment) &&
    !/[\s.]+$/.test(segment)
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  if (!segments || segments.length === 0) {
    return flatFail("No path specified", 400);
  }

  // Sanitize: reject path traversal and encoded path separators.
  if (!segments.every(isSafePathSegment)) {
    return flatFail("Invalid path", 400);
  }
  const joined = segments.join("/");

  // Reject temp files (used during atomic writes)
  const lastSegment = segments[segments.length - 1];
  if (lastSegment.endsWith(".tmp")) {
    return flatFail("File not found", 404);
  }

  const ext = path.extname(joined).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return flatFail("Unsupported file type", 400);
  }

  const resolved = path.resolve(RESOLVED_OUTPUT_BASE, ...segments);
  const normalizedResolved = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const normalizedBase = process.platform === "win32"
    ? (RESOLVED_OUTPUT_BASE + path.sep).toLowerCase()
    : RESOLVED_OUTPUT_BASE + path.sep;
  if (!normalizedResolved.startsWith(normalizedBase)) {
    return flatFail("Access denied", 403);
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return flatFail("Not a file", 404);
    }

    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };

    const stream = Readable.toWeb(createReadStream(resolved)) as ReadableStream<Uint8Array>;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": mimeMap[ext] ?? "application/octet-stream",
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return flatFail("File not found", 404);
  }
}
