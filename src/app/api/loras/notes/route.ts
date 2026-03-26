import { NextRequest } from "next/server";
import path from "node:path";
import { ok, fail } from "@/lib/api-response";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

/**
 * GET /api/loras/notes?paths=rel/a.safetensors,rel/b.safetensors
 *
 * Returns a map of relativePath → notes for the given file paths.
 * Paths are relative to LORA_BASE_DIR.
 */
export async function GET(request: NextRequest) {
  if (!env.loraBaseDir) {
    return fail("LORA_BASE_DIR is not configured.", 500);
  }

  const rawPaths = request.nextUrl.searchParams.get("paths") ?? "";
  if (!rawPaths.trim()) {
    return ok({});
  }

  const relativePaths = rawPaths.split(",").filter(Boolean);
  const absolutePaths = relativePaths.map((rp) =>
    path.resolve(env.loraBaseDir, rp)
  );

  const assets = await db.loraAsset.findMany({
    where: { absolutePath: { in: absolutePaths } },
    select: { absolutePath: true, notes: true },
  });

  // Build map: relativePath → notes
  const result: Record<string, string> = {};
  for (const asset of assets) {
    if (asset.notes) {
      const rp = path
        .relative(env.loraBaseDir, asset.absolutePath)
        .replace(/\\/g, "/");
      result[rp] = asset.notes;
    }
  }

  return ok(result);
}

/**
 * PUT /api/loras/notes
 * Body: { path: "relative/path.safetensors", notes: "some text" }
 *
 * Upserts a LoraAsset record keyed by absolutePath.
 * If the record doesn't exist yet (e.g. file was placed manually),
 * creates one with minimal info derived from the path.
 */
export async function PUT(request: NextRequest) {
  if (!env.loraBaseDir) {
    return fail("LORA_BASE_DIR is not configured.", 500);
  }

  let body: { path?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const relativePath = body.path;
  const notes = body.notes ?? "";

  if (typeof relativePath !== "string" || !relativePath.trim()) {
    return fail("path is required", 400);
  }

  const absolutePath = path.resolve(env.loraBaseDir, relativePath);
  // Security: ensure within base
  if (
    !absolutePath.startsWith(path.resolve(env.loraBaseDir) + path.sep) &&
    absolutePath !== path.resolve(env.loraBaseDir)
  ) {
    return fail("Invalid path", 400);
  }

  const fileName = path.basename(relativePath);
  const name = path.parse(fileName).name;
  const category =
    path.dirname(relativePath).replace(/\\/g, "/") || ".";

  // Upsert: update if exists, create if not
  const asset = await db.loraAsset.upsert({
    where: { absolutePath },
    update: { notes },
    create: {
      name,
      category,
      fileName,
      absolutePath,
      relativePath: relativePath.replace(/\\/g, "/"),
      notes,
    },
  });

  return ok({ id: asset.id, notes: asset.notes });
}
