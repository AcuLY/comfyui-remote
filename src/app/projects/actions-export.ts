"use server";

import { resolve, join } from "node:path";
import { mkdir, rm, readdir, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import sharp from "sharp";
import archiver from "archiver";
import { prisma } from "@/lib/prisma";

const EXPORT_ROOT = resolve(process.cwd(), "data", "export");

type ExportResult = {
  success: boolean;
  message: string;
  path?: string;
};

/**
 * Export all kept images from a project as JPG into a zip,
 * and all featured images into a pixiv/ folder.
 */
export async function exportProjectImages(projectId: string): Promise<ExportResult> {
  // 1. Fetch project with sections (sorted) and kept images
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      presetBindings: true,
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          runs: {
            orderBy: { createdAt: "desc" },
            include: {
              images: {
                where: { reviewStatus: "kept" },
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  filePath: true,
                  featured: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return { success: false, message: "项目不存在" };
  }

  // Resolve export name from presetBindings for directory naming
  type PresetBindingJson = Array<{ categoryId: string; presetId: string }>;
  const bindings = project.presetBindings as PresetBindingJson | null;
  let exportName = project.title; // fallback to project title
  if (bindings && bindings.length > 0) {
    const presetIds = bindings.map((b) => b.presetId);
    const presets = await prisma.promptPreset.findMany({
      where: { id: { in: presetIds } },
      select: { id: true, name: true },
    });
    if (presets.length > 0) {
      exportName = presets[0].name;
    }
  }
  const exportDir = join(EXPORT_ROOT, exportName);
  const pixivDir = join(exportDir, "pixiv");
  const tempJpgDir = join(exportDir, "_temp_jpg");

  // 2. Collect images in section sort order
  const allKept: { filePath: string; featured: boolean }[] = [];
  for (const section of project.sections) {
    for (const run of section.runs) {
      for (const img of run.images) {
        allKept.push({ filePath: img.filePath, featured: img.featured });
      }
    }
  }

  if (allKept.length === 0) {
    return { success: false, message: "没有已保存的图片可导出" };
  }

  // 3. Clean up and create directories
  await rm(exportDir, { recursive: true, force: true });
  await mkdir(tempJpgDir, { recursive: true });
  await mkdir(pixivDir, { recursive: true });

  // 4. Convert all kept images to JPG for zip
  const jpgFiles: string[] = [];
  let globalIndex = 1;
  let pixivIndex = 1;

  for (const img of allKept) {
    const sourcePath = resolve(process.cwd(), img.filePath);
    const jpgName = `${exportName}_${String(globalIndex).padStart(2, "0")}.jpg`;
    const jpgPath = join(tempJpgDir, jpgName);

    try {
      await sharp(sourcePath).jpeg({ quality: 90 }).toFile(jpgPath);
      jpgFiles.push(jpgPath);
    } catch (err) {
      console.error(`Failed to convert ${sourcePath}:`, err);
      globalIndex++;
      continue;
    }

    // 5. If featured, also write to pixiv/
    if (img.featured) {
      const pixivName = `${exportName}_${String(pixivIndex).padStart(2, "0")}.jpg`;
      const pixivPath = join(pixivDir, pixivName);
      try {
        await sharp(sourcePath).jpeg({ quality: 90 }).toFile(pixivPath);
      } catch (err) {
        console.error(`Failed to convert pixiv image ${sourcePath}:`, err);
      }
      pixivIndex++;
    }

    globalIndex++;
  }

  // 6. Create zip from temp JPGs
  const zipPath = join(exportDir, `${exportName}.zip`);
  await createZip(tempJpgDir, zipPath);

  // 7. Clean up temp JPG directory
  for (const f of jpgFiles) {
    await unlink(f).catch(() => {});
  }
  await rm(tempJpgDir, { recursive: true, force: true });

  // 8. Check if pixiv dir is empty and remove if so
  const pixivFiles = await readdir(pixivDir).catch(() => []);
  if (pixivFiles.length === 0) {
    await rm(pixivDir, { recursive: true, force: true });
  }

  return {
    success: true,
    message: `导出完成：${allKept.length} 张图片 → ${exportName}.zip${pixivIndex > 1 ? `，${pixivIndex - 1} 张精选 → pixiv/` : ""}`,
    path: exportDir,
  };
}

function createZip(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
