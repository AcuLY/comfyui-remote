import { readFileSync } from "node:fs";
import test from "node:test";
import { strict as assert } from "node:assert";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

function sourceSlice(source: string, startNeedle: string, endNeedle: string) {
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const start = normalizedSource.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing start needle: ${startNeedle}`);
  const end = normalizedSource.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `missing end needle: ${endNeedle}`);
  return normalizedSource.slice(start, end);
}

test("project results lightbox exposes review and censor controls like section results", () => {
  const source = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");
  const lightbox = sourceSlice(
    source,
    "{lightboxImage && (",
    "    </SidebarProvider>",
  );

  assert.match(
    source,
    /from ["']@\/components\/quick-censor-canvas["']/,
    "project results lightbox should reuse the quick-censor canvas",
  );
  assert.match(
    source,
    /from ["']@\/lib\/client-review-mutation["']/,
    "project results lightbox should use the same background review API as section results",
  );
  assert.match(
    source,
    /quickCensorMode/,
    "project results lightbox should track quick censor mode",
  );
  assert.match(
    source,
    /\/api\/images\/\$\{encodeURIComponent\(lightboxImage\.id\)\}\/manual-censor/,
    "finished quick censor should upload to the manual censor route",
  );
  assert.match(
    source,
    /setShowCensoredMode\(true\)/,
    "finished quick censor should switch the preview to the saved censored image",
  );
  assert.match(
    lightbox,
    /reviewLightboxImage\("keep", true\)/,
    "project results lightbox should expose a keep-and-advance control",
  );
  assert.match(
    lightbox,
    /reviewLightboxImage\("trash", true\)/,
    "project results lightbox should expose a delete-and-advance control",
  );
  assert.match(
    lightbox,
    /<QuickCensorCanvas[\s\S]*source=\{lightboxImage\.full\}/,
    "manual quick censor should always start from the original full image",
  );
  assert.match(
    lightbox,
    /current\.censoredFull|lightboxImage\.censoredFull/,
    "project results lightbox should expose a censored-version toggle",
  );
  assert.match(
    lightbox,
    /censorImage\(lightboxImage\.id\)/,
    "project results lightbox should expose the automatic single-image censor action",
  );
});

test("project results review actions update local image state before awaiting the API", () => {
  const source = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");
  const reviewLightboxImage = sourceSlice(
    source,
    "const reviewLightboxImage = useCallback",
    "  const handleTrashAllImages = useCallback",
  );

  assert.match(
    reviewLightboxImage,
    /submitReviewMutation\(action,\s*\[imageId\]\)/,
    "project results lightbox review should submit through the background review API",
  );
  assert.match(
    reviewLightboxImage,
    /setImageReviewStatus\(imageId,\s*"kept"\)/,
    "keep should update the local project result image state",
  );
  assert.match(
    reviewLightboxImage,
    /removeProjectResultImage\(imageId\)/,
    "trash should remove the image from local project result state",
  );
});

test("project results lightbox supports the same review shortcuts as section results", () => {
  const source = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");
  const shortcuts = sourceSlice(
    source,
    "function handleKeyDown(event: KeyboardEvent) {",
    "    window.addEventListener(\"keydown\", handleKeyDown);",
  );

  assert.match(
    shortcuts,
    /event\.target instanceof HTMLInputElement \|\| event\.target instanceof HTMLTextAreaElement/,
    "project lightbox shortcuts should not fire while typing in form controls",
  );
  assert.match(
    shortcuts,
    /key === "i"[\s\S]*key === "I"[\s\S]*key === "d"[\s\S]*key === "D"[\s\S]*closeLightbox\(\)/,
    "I and D should close the project results lightbox like section results",
  );
  assert.match(
    shortcuts,
    /key === "s"[\s\S]*key === "S"[\s\S]*key === "ArrowLeft"[\s\S]*goLightboxPrev\(\)/,
    "S and ArrowLeft should navigate to the previous image",
  );
  assert.match(
    shortcuts,
    /key === "f"[\s\S]*key === "F"[\s\S]*key === "ArrowRight"[\s\S]*goLightboxNext\(\)/,
    "F and ArrowRight should navigate to the next image",
  );
  assert.match(
    shortcuts,
    /key === "j"[\s\S]*key === "J"[\s\S]*key === "w"[\s\S]*key === "W"[\s\S]*reviewLightboxImage\("keep", true\)/,
    "J and W should keep the current image and advance",
  );
  assert.match(
    shortcuts,
    /key === "k"[\s\S]*key === "K"[\s\S]*key === "e"[\s\S]*key === "E"[\s\S]*reviewLightboxImage\("trash", true\)/,
    "K and E should delete the current image and advance",
  );
  assert.match(
    shortcuts,
    /key === "l"[\s\S]*key === "L"[\s\S]*key === "r"[\s\S]*key === "R"[\s\S]*handleToggleFeatured\(currentLightboxImage\.id,\s*!currentLightboxImage\.featured\)/,
    "L and R should toggle the p-site marker",
  );
  assert.match(
    shortcuts,
    /key === ";"[\s\S]*key === "t"[\s\S]*key === "T"[\s\S]*handleToggleFeatured2\(currentLightboxImage\.id,\s*!currentLightboxImage\.featured2\)/,
    "; and T should toggle the preview marker",
  );
  assert.match(
    shortcuts,
    /key === "'"[\s\S]*handleSetCover\(currentLightboxImage\.id\)/,
    "apostrophe should set the current image as cover",
  );
  assert.match(
    shortcuts,
    /key === "h"[\s\S]*key === "H"[\s\S]*setShowCensoredMode\(\(prev\) => !prev\)/,
    "H should toggle the censored version",
  );
});
