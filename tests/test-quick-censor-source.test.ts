import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toImageUrl } from "../src/lib/image-url";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("auto and quick censor share one mosaic size constant", () => {
  const runnerSource = readSource("src/server/services/auto-censor-runner.ts");
  const lightboxSource = readSource("src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx");

  assert.match(
    runnerSource,
    /from ["']@\/lib\/quick-censor-core["']/,
    "auto censor runner should import the shared mosaic size",
  );
  assert.doesNotMatch(
    runnerSource,
    /export const AUTO_CENSOR_MOSAIC_SIZE = 100/,
    "auto censor runner must not keep a separate hard-coded mosaic size",
  );
  assert.match(
    lightboxSource,
    /from ["']@\/components\/quick-censor-canvas["']/,
    "results lightbox should use the reusable quick-censor canvas",
  );
});

test("manual quick censor route accepts form data and persists a censored replacement", () => {
  const routeSource = readSource("src/app/api/images/[imageId]/manual-censor/route.ts");
  const serviceSource = readSource("src/server/services/censoring-service.ts");

  assert.match(routeSource, /request\.formData\(\)/, "manual censor route should accept uploaded canvas blobs");
  assert.match(routeSource, /persistManualCensoredImage/, "manual censor route should call the censor persistence service");
  assert.match(routeSource, /revalidatePath\("\/"\)/, "manual censor upload should invalidate result views");
  assert.match(
    serviceSource,
    /export async function persistManualCensoredImage/,
    "censoring service should expose a manual persistence path",
  );
  assert.match(
    serviceSource,
    /persistCensoredImage\([\s\S]*manualCensoredImagePath/,
    "manual persistence should reuse the existing censored path and thumbnail writer",
  );
});

test("manual quick censor returns versioned censored URLs so replaced files do not reuse the stale image cache", () => {
  const routeSource = readSource("src/app/api/images/[imageId]/manual-censor/route.ts");
  const detailViewSource = readSource("src/server/repositories/project-view-repository/detail-view.ts");

  assert.equal(
    toImageUrl("data/images/censored/project/image.jpg", "2026-06-18T00:00:00.000Z"),
    "/api/images/censored/project/image.jpg?v=2026-06-18T00%3A00%3A00.000Z",
    "image URLs should accept an optional cache-busting version",
  );
  assert.equal(
    toImageUrl("data/images/raw/project/image.jpg"),
    "/api/images/raw/project/image.jpg",
    "ordinary generated image URLs should remain unversioned by default",
  );
  assert.match(
    routeSource,
    /censoredFull:\s*toImageUrl\(result\.censoredFilePath,\s*result\.censoredAt\)/,
    "manual censor upload should return a versioned full-size censored URL",
  );
  assert.match(
    routeSource,
    /censoredSrc:\s*toImageUrl\(result\.censoredThumbPath,\s*result\.censoredAt\)/,
    "manual censor upload should return a versioned censored thumbnail URL",
  );
  assert.equal(
    detailViewSource.match(/toImageUrl\(img\.censoredFilePath,\s*img\.censoredAt\)/g)?.length,
    2,
    "section and project results should version full censored image URLs from censoredAt",
  );
  assert.equal(
    detailViewSource.match(/toImageUrl\(img\.censoredThumbPath,\s*img\.censoredAt\)/g)?.length,
    2,
    "section and project results should version censored thumbnail URLs from censoredAt",
  );
});

test("results lightbox starts quick censor from the original image and updates the censored image on finish", () => {
  const source = readSource("src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx");

  assert.match(source, /quickCensorMode/, "lightbox should track quick censor mode");
  assert.match(source, /source=\{current\.full\}/, "quick censor canvas should start from the original full image");
  assert.match(source, /\/api\/images\/\$\{encodeURIComponent\(current\.id\)\}\/manual-censor/, "finish should upload to the manual censor route");
  assert.match(source, /setShowCensored\(true\)/, "finished quick censor should switch the preview to the new censored image");
  assert.match(source, /censoredAt:\s*payload\.data\.censoredAt\s*\?\?\s*new Date\(\)\.toISOString\(\)/, "finished quick censor should update local censored state");
  assert.match(source, /setShowCensored\(false\);[\s\S]*setQuickCensorMode\(true\);/, "starting quick censor should force the original image path");
});
