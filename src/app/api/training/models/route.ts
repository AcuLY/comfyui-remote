import { NextRequest } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { fail, ok } from "@/lib/api-response";
import {
  listModelAssets,
  ModelAssetError,
  getModelBaseDir,
  parseModelKind,
} from "@/server/services/model-asset-service";

export const dynamic = "force-dynamic";

type TrainingModelDiscoveryItem = {
  modelType: "checkpoint" | "lora";
  name: string;
  relativePath: string;
  size: number;
  source: "filesystem";
};

async function listTrainingModelsFromDisk(kind: "checkpoint" | "lora") {
  const baseDir = getModelBaseDir(kind);
  if (!baseDir?.trim()) {
    throw new ModelAssetError("MODEL_BASE_DIR is not configured.", 500);
  }

  const extensions = kind === "checkpoint"
    ? new Set([".safetensors"])
    : new Set([".safetensors", ".ckpt", ".pt", ".pth"]);

  const items: TrainingModelDiscoveryItem[] = [];

  async function walk(relativeDir = ""): Promise<void> {
    const absoluteDir = path.resolve(baseDir, relativeDir);
    const entries = await readdir(absoluteDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const nextRelativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(nextRelativePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!extensions.has(path.extname(entry.name).toLowerCase())) continue;

      const fileStat = await stat(path.join(absoluteDir, entry.name));
      items.push({
        modelType: kind,
        name: entry.name,
        relativePath: nextRelativePath.replace(/\\/g, "/"),
        size: Number(fileStat.size),
        source: "filesystem",
      });
    }
  }

  await walk();
  items.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return items;
}

export async function GET(request: NextRequest) {
  try {
    const kind = parseModelKind(request.nextUrl.searchParams.get("kind") ?? "checkpoint");
    let data: Awaited<ReturnType<typeof listTrainingModelsFromDisk>>;
    try {
      data = await listTrainingModelsFromDisk(kind);
    } catch {
      try {
        const catalogItems = await listModelAssets(kind);
        data = catalogItems.map((item) => ({
          modelType: kind,
          name: item.name,
          relativePath: item.relativePath,
          size: item.size === null ? 0 : Number(item.size),
          source: "filesystem" as const,
        }));
      } catch {
        data = [];
      }
    }
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to load training model assets", 500, String(error));
  }
}
