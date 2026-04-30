import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import archiver from "archiver";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

const EXPORT_ROOT = resolve(process.cwd(), "data", "export");

export type ExportProjectImagesResult = {
  success: boolean;
  message: string;
  path?: string;
};

export async function exportProjectImages(projectId: string): Promise<ExportProjectImagesResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
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
                  featured2: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return { success: false, message: "Project not found" };
  }

  const exportName = project.title;

  const exportDir = join(EXPORT_ROOT, exportName);
  const pixivDir = join(exportDir, "pixiv");
  const previewDir = join(exportDir, "preview");
  const tempJpgDir = join(exportDir, "_temp_jpg");

  const allKept: { filePath: string; featured: boolean; featured2: boolean }[] = [];
  for (const section of project.sections) {
    for (const run of section.runs) {
      for (const image of run.images) {
        allKept.push({ filePath: image.filePath, featured: image.featured, featured2: image.featured2 });
      }
    }
  }

  if (allKept.length === 0) {
    return { success: false, message: "No kept images to export" };
  }

  await rm(exportDir, { recursive: true, force: true });
  await mkdir(tempJpgDir, { recursive: true });
  await mkdir(pixivDir, { recursive: true });
  await mkdir(previewDir, { recursive: true });

  const jpgFiles: string[] = [];
  let globalIndex = 1;
  let pixivIndex = 1;
  let previewIndex = 1;

  for (const image of allKept) {
    const sourcePath = resolve(/* turbopackIgnore: true */ process.cwd(), image.filePath);
    const jpgName = `${exportName}_${String(globalIndex).padStart(2, "0")}.jpg`;
    const jpgPath = join(tempJpgDir, jpgName);

    try {
      await sharp(sourcePath).jpeg({ quality: 90 }).toFile(jpgPath);
      jpgFiles.push(jpgPath);
    } catch (error) {
      console.error(`Failed to convert ${sourcePath}:`, error);
      globalIndex++;
      continue;
    }

    if (image.featured) {
      const pixivName = `${exportName}_${String(pixivIndex).padStart(2, "0")}.jpg`;
      const pixivPath = join(pixivDir, pixivName);
      try {
        await sharp(sourcePath).jpeg({ quality: 90 }).toFile(pixivPath);
      } catch (error) {
        console.error(`Failed to convert pixiv image ${sourcePath}:`, error);
      }
      pixivIndex++;
    }

    if (image.featured2) {
      const previewName = `${exportName}_${String(previewIndex).padStart(2, "0")}.jpg`;
      const previewPath = join(previewDir, previewName);
      try {
        await sharp(sourcePath).jpeg({ quality: 90 }).toFile(previewPath);
      } catch (error) {
        console.error(`Failed to convert preview image ${sourcePath}:`, error);
      }
      previewIndex++;
    }

    globalIndex++;
  }

  const zipPath = join(exportDir, `${exportName}.zip`);
  await createZip(tempJpgDir, zipPath);

  for (const filePath of jpgFiles) {
    await unlink(filePath).catch(() => {});
  }
  await rm(tempJpgDir, { recursive: true, force: true });

  const pixivFiles = await readdir(pixivDir).catch(() => []);
  if (pixivFiles.length === 0) {
    await rm(pixivDir, { recursive: true, force: true });
  }
  const previewFiles = await readdir(previewDir).catch(() => []);
  if (previewFiles.length === 0) {
    await rm(previewDir, { recursive: true, force: true });
  }

  return {
    success: true,
    message: `Exported ${allKept.length} kept images to ${exportName}.zip${pixivIndex > 1 ? `, ${pixivIndex - 1} featured images to pixiv/` : ""}${previewIndex > 1 ? `, and ${previewIndex - 1} featured2 images to preview/` : ""}`,
    path: exportDir,
  };
}

function createZip(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", () => resolvePromise());
    archive.on("error", (error) => reject(error));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
