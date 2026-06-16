import { createWriteStream } from "node:fs";
import { access, mkdir, readdir, rm, unlink } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import archiver from "archiver";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";

const EXPORT_ROOT = resolve(process.cwd(), "data", "export");

export type ExportProjectImagesResult = {
  success: boolean;
  message: string;
  path?: string;
};

type ExportFeatureKey = "featured" | "featured2";
type CensoredFeatureImage = {
  featured: boolean;
  featured2: boolean;
  censoredFilePath: string | null;
};

export function getExportImageIndexWidth(totalImages: number): number {
  return String(Math.max(1, Math.trunc(totalImages))).length;
}

export function formatExportImageFileName(exportName: string, index: number, totalImages: number): string {
  const width = getExportImageIndexWidth(totalImages);
  return `${exportName}_${String(index).padStart(width, "0")}.jpg`;
}

export function selectCensoredFeatureImages<T extends CensoredFeatureImage>(images: T[], feature: ExportFeatureKey): T[] {
  return images.filter((image) => image[feature] && image.censoredFilePath);
}

export async function exportProjectImages(projectId: string): Promise<ExportProjectImagesResult> {
  const project = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
    select: {
      id: true,
      title: true,
      coverImageId: true,
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
                  censoredFilePath: true,
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

  if (!project.coverImageId) {
    return { success: false, message: "请先选择封面后再做图片整合" };
  }

  const coverImage = await prisma.imageResult.findFirst({
    where: {
      id: project.coverImageId,
      reviewStatus: { not: "trashed" },
      run: {
        projectId: project.id,
        project: buildGenerationProjectWhere({ id: project.id }),
      },
    },
    select: { filePath: true, censoredFilePath: true },
  });

  if (!coverImage) {
    return { success: false, message: "封面图片不存在或已被删除，请重新选择封面" };
  }

  const coverSourcePath = resolve(/* turbopackIgnore: true */ process.cwd(), coverImage.filePath);
  try {
    await access(coverSourcePath);
  } catch {
    return { success: false, message: "封面图片文件不存在，请重新选择封面" };
  }

  const exportDir = join(EXPORT_ROOT, exportName);

  // Path containment check to prevent traversal via project title
  if (!resolve(exportDir).startsWith(resolve(EXPORT_ROOT) + sep)) {
    return { success: false, message: "Invalid project title for export path" };
  }

  const pixivDir = join(exportDir, "pixiv");
  const previewDir = join(exportDir, "preview");
  const tempJpgDir = join(exportDir, "_temp_jpg");
  const tempCensoredJpgDir = join(exportDir, "_temp_censored_jpg");

  const allKept: { filePath: string; featured: boolean; featured2: boolean; censoredFilePath: string | null }[] = [];
  for (const section of project.sections) {
    for (const run of section.runs) {
      for (const image of run.images) {
        allKept.push({ filePath: image.filePath, featured: image.featured, featured2: image.featured2, censoredFilePath: image.censoredFilePath });
      }
    }
  }

  if (allKept.length === 0) {
    return { success: false, message: "No kept images to export" };
  }

  const totalImageCount = allKept.length;
  const pixivImageCount = selectCensoredFeatureImages(allKept, "featured").length;
  const previewImageCount = selectCensoredFeatureImages(allKept, "featured2").length;

  await rm(exportDir, { recursive: true, force: true });
  await mkdir(tempJpgDir, { recursive: true });
  await mkdir(pixivDir, { recursive: true });
  await mkdir(previewDir, { recursive: true });

  const hasCensored = allKept.some((img) => img.censoredFilePath);
  if (hasCensored) {
    await mkdir(tempCensoredJpgDir, { recursive: true });
  }

  try {
    await sharp(coverSourcePath).jpeg({ quality: 90 }).toFile(join(exportDir, "cover.jpg"));
  } catch (error) {
    console.error(`Failed to convert cover image ${coverSourcePath}:`, error);
    await rm(exportDir, { recursive: true, force: true });
    return { success: false, message: "封面图片转换失败，请检查封面图片文件" };
  }

  if (coverImage.censoredFilePath) {
    const censoredCoverSource = resolve(process.cwd(), coverImage.censoredFilePath);
    try {
      await access(censoredCoverSource);
      await sharp(censoredCoverSource).jpeg({ quality: 90 }).toFile(join(exportDir, "cover_censored.jpg"));
    } catch (error) {
      console.error(`Failed to convert censored cover image:`, error);
      // Non-fatal: censored cover is optional
    }
  }

  const jpgFiles: string[] = [];
  const censoredJpgFiles: string[] = [];
  let globalIndex = 1;
  let pixivIndex = 1;
  let previewIndex = 1;
  let censoredCount = 0;

  for (const image of allKept) {
    const sourcePath = resolve(/* turbopackIgnore: true */ process.cwd(), image.filePath);
    const jpgName = formatExportImageFileName(exportName, globalIndex, totalImageCount);
    const jpgPath = join(tempJpgDir, jpgName);

    try {
      await sharp(sourcePath).jpeg({ quality: 90 }).toFile(jpgPath);
      jpgFiles.push(jpgPath);
    } catch (error) {
      console.error(`Failed to convert ${sourcePath}:`, error);
      globalIndex++;
      continue;
    }

    // Censored versions
    if (image.censoredFilePath) {
      const censoredSourcePath = resolve(process.cwd(), image.censoredFilePath);
      try {
        await access(censoredSourcePath);
        const censoredJpgName = formatExportImageFileName(exportName, globalIndex, totalImageCount);
        const censoredJpgPath = join(tempCensoredJpgDir, censoredJpgName);
        await sharp(censoredSourcePath).jpeg({ quality: 90 }).toFile(censoredJpgPath);
        censoredJpgFiles.push(censoredJpgPath);
        censoredCount++;

        if (image.featured) {
          const pixivName = formatExportImageFileName(exportName, pixivIndex, pixivImageCount);
          const pixivPath = join(pixivDir, pixivName);
          try {
            await sharp(censoredSourcePath).jpeg({ quality: 90 }).toFile(pixivPath);
          } catch (error) {
            console.error(`Failed to convert censored pixiv image:`, error);
          }
          pixivIndex++;
        }

        if (image.featured2) {
          const previewName = formatExportImageFileName(exportName, previewIndex, previewImageCount);
          const previewPath = join(previewDir, previewName);
          try {
            await sharp(censoredSourcePath).jpeg({ quality: 90 }).toFile(previewPath);
          } catch (error) {
            console.error(`Failed to convert censored preview image:`, error);
          }
          previewIndex++;
        }
      } catch (error) {
        console.error(`Failed to process censored image ${image.censoredFilePath}:`, error);
      }
    }

    globalIndex++;
  }

  const zipPath = join(exportDir, `${exportName}.zip`);
  await createZip(tempJpgDir, zipPath);

  for (const filePath of jpgFiles) {
    await unlink(filePath).catch(() => {});
  }
  await rm(tempJpgDir, { recursive: true, force: true });

  // Create censored zip if there are censored images
  if (censoredCount > 0) {
    const censoredZipPath = join(exportDir, `${exportName}_censored.zip`);
    await createZip(tempCensoredJpgDir, censoredZipPath);
  }

  for (const filePath of censoredJpgFiles) {
    await unlink(filePath).catch(() => {});
  }
  await rm(tempCensoredJpgDir, { recursive: true, force: true });

  const pixivFiles = await readdir(pixivDir).catch(() => []);
  if (pixivFiles.length === 0) {
    await rm(pixivDir, { recursive: true, force: true });
  }
  const previewFiles = await readdir(previewDir).catch(() => []);
  if (previewFiles.length === 0) {
    await rm(previewDir, { recursive: true, force: true });
  }

  // Mark project as published
  await prisma.project.updateMany({
    where: buildGenerationProjectWhere({ id: projectId }),
    data: { publishedAt: new Date() },
  });

  return {
    success: true,
    message: `图片整合完成：${allKept.length} 张保留图打包为 ${exportName}.zip，封面已输出 cover.jpg${pixivIndex > 1 ? `，${pixivIndex - 1} 张 p站打码图输出到 pixiv/` : ""}${previewIndex > 1 ? `，${previewIndex - 1} 张预览打码图输出到 preview/` : ""}${censoredCount > 0 ? `，${censoredCount} 张和谐版打包为 ${exportName}_censored.zip` : ""}`,
    path: exportDir,
  };
}

function createZip(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", () => resolvePromise());
    output.on("error", (err) => reject(err));
    archive.on("error", (error) => reject(error));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
