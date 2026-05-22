import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { getCharacterLoraTrainingJob } from "@/server/services/character-lora-training/job-service";
import { resolveCharacterLoraArtifactPath } from "@/server/services/character-lora-training/artifact-service";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
const MIME_BY_EXTENSION: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const relativePath = request.nextUrl.searchParams.get("path")?.trim();

  if (!relativePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  if (relativePath.endsWith(".tmp")) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const extension = path.posix.extname(relativePath.replace(/\\/g, "/")).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  try {
    const job = await getCharacterLoraTrainingJob(jobId);
    const resolved = resolveCharacterLoraArtifactPath(job.artifactRoot, relativePath);
    const fileStat = await stat(resolved.absolutePath);

    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 404 });
    }

    const rawData = await readFile(resolved.absolutePath);
    const width = parseWidth(request.nextUrl.searchParams.get("w"));
    const quality = parseQuality(request.nextUrl.searchParams.get("q"));

    if (width || quality) {
      const output = await sharp(rawData)
        .rotate()
        .resize(width ? { width, withoutEnlargement: true } : undefined)
        .jpeg({ quality: quality ?? 80 })
        .toBuffer();

      return new NextResponse(new Uint8Array(output), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    }

    return new NextResponse(rawData, {
      headers: {
        "Content-Type": MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

function parseWidth(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.min(2048, Math.max(1, Math.floor(parsed))) : null;
}

function parseQuality(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.floor(parsed))) : null;
}
