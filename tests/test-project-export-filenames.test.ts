import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.DB_PROVIDER ??= "sqlite";
process.env.DATABASE_URL ??= "file:./data/test-project-export-filenames.db";

test("project export image names pad indexes to the digit count of the image total", async () => {
  const projectExport = (await import("../src/server/services/project-export-service")) as unknown as {
    formatExportImageFileName?: (exportName: string, index: number, totalImages: number) => string;
  };

  assert.equal(
    typeof projectExport.formatExportImageFileName,
    "function",
    "project export service should expose the image filename formatter",
  );

  const format = projectExport.formatExportImageFileName;
  assert.ok(format, "project export service should expose the image filename formatter");
  assert.equal(format("Exported Project", 1, 9), "Exported Project_1.jpg");
  assert.equal(format("Exported Project", 1, 10), "Exported Project_01.jpg");
  assert.equal(format("Exported Project", 9, 100), "Exported Project_009.jpg");
  assert.equal(format("Exported Project", 100, 100), "Exported Project_100.jpg");
});

test("project export service does not hard-code two-digit image numbering", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/services/project-export-service.ts"), "utf8");

  assert.doesNotMatch(source, /padStart\(2,\s*["']0["']\)/);
});

test("project export pixiv and preview selections include only censored images", async () => {
  const projectExport = (await import("../src/server/services/project-export-service")) as unknown as {
    selectCensoredFeatureImages?: (
      images: Array<{ featured: boolean; featured2: boolean; censoredFilePath: string | null }>,
      feature: "featured" | "featured2",
    ) => Array<{ censoredFilePath: string | null }>;
  };

  assert.equal(
    typeof projectExport.selectCensoredFeatureImages,
    "function",
    "project export service should expose censored feature selection",
  );

  const images = [
    { featured: true, featured2: false, censoredFilePath: "images/a-censored.png" },
    { featured: true, featured2: true, censoredFilePath: null },
    { featured: false, featured2: true, censoredFilePath: "images/c-censored.png" },
  ];

  const selectCensoredFeatureImages = projectExport.selectCensoredFeatureImages;
  assert.ok(selectCensoredFeatureImages, "project export service should expose censored feature selection");

  assert.deepEqual(selectCensoredFeatureImages(images, "featured").map((image) => image.censoredFilePath), [
    "images/a-censored.png",
  ]);
  assert.deepEqual(selectCensoredFeatureImages(images, "featured2").map((image) => image.censoredFilePath), [
    "images/c-censored.png",
  ]);
});

test("project export no longer creates duplicate censored pixiv and preview folders", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/services/project-export-service.ts"), "utf8");

  assert.doesNotMatch(source, /pixivCensoredDir|previewCensoredDir/);
  assert.doesNotMatch(source, /pixiv_censored|preview_censored/);
});

test("project export no longer creates a whole-project censored zip", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/services/project-export-service.ts"), "utf8");

  assert.doesNotMatch(source, /_censored\.zip/);
  assert.doesNotMatch(source, /tempCensoredJpgDir|censoredZipPath|censoredJpgFiles/);
});
