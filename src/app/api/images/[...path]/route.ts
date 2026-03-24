/**
 * GET /api/images/[...path]
 *
 * Serves local image files from the data/images directory.
 * This allows the frontend to display worker-generated images
 * using paths like /api/images/job-slug/run-id/raw/001.png
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const OUTPUT_BASE =
  process.env.OUTPUT_BASE_PATH ??
  path.join(/* turbopackIgnore: true */ process.cwd(), "data/images");

// Allowed extensions to prevent arbitrary file access
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "No path specified" }, { status: 400 });
  }

  // Sanitize: reject path traversal
  const joined = segments.join("/");
  if (joined.includes("..") || joined.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const ext = path.extname(joined).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const filePath = path.join(OUTPUT_BASE, joined);

  // Ensure the resolved path is still inside OUTPUT_BASE
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(OUTPUT_BASE))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 404 });
    }

    const data = await readFile(resolved);

    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };

    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeMap[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
