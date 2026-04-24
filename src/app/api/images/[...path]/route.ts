/**
 * GET /api/images/[...path]
 *
 * Serves local image files from the data/images directory.
 * This allows the frontend to display worker-generated images
 * using paths like /api/images/job-slug/run-id/raw/001.png
 *
 * Optional query params:
 *   ?q=<1-100>  — compress to JPEG at the given quality (default: raw)
 *   ?w=<pixels> — resize to fit within this width (height scales proportionally)
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import sharp from "sharp";

const OUTPUT_BASE =
  process.env.OUTPUT_BASE_PATH ??
  path.join(/* turbopackIgnore: true */ process.cwd(), "data/images");

// Allowed extensions to prevent arbitrary file access
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export async function GET(
  request: NextRequest,
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

  // Reject temp files (used during atomic writes)
  const lastSegment = segments[segments.length - 1];
  if (lastSegment.endsWith(".tmp")) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
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

    const rawData = await readFile(resolved);

    // Check for compression / resize query params
    const qParam = request.nextUrl.searchParams.get("q");
    const wParam = request.nextUrl.searchParams.get("w");
    const quality = qParam ? Math.min(100, Math.max(1, Number(qParam) || 80)) : null;
    const width = wParam ? Math.max(1, Number(wParam) || 0) : null;

    if (quality !== null || width !== null) {
      // Use sharp to compress / resize
      let pipeline = sharp(rawData).rotate(); // auto-rotate based on EXIF
      if (width) {
        pipeline = pipeline.resize({ width, withoutEnlargement: true });
      }
      const outputBuffer = await pipeline
        .jpeg({ quality: quality ?? 80, mozjpeg: true })
        .toBuffer();

      return new NextResponse(new Uint8Array(outputBuffer), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    }

    // Serve raw file as-is
    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };

    return new NextResponse(rawData, {
      headers: {
        "Content-Type": mimeMap[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
