import { readFileSync } from "node:fs";
import test from "node:test";
import { strict as assert } from "node:assert";
import { getNextImageIdAfterCurrentLeavesSequence } from "../src/lib/review-lightbox-state";

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

test("filtered lightbox advances to the next matching image when the current image leaves the sequence", () => {
  const images = [
    { id: "image-a" },
    { id: "image-b" },
    { id: "image-c" },
  ];

  assert.equal(getNextImageIdAfterCurrentLeavesSequence(images, "image-a"), "image-b");
  assert.equal(getNextImageIdAfterCurrentLeavesSequence(images, "image-b"), "image-c");
  assert.equal(getNextImageIdAfterCurrentLeavesSequence(images, "image-c"), "image-a");
  assert.equal(getNextImageIdAfterCurrentLeavesSequence([{ id: "image-a" }], "image-a"), null);
  assert.equal(getNextImageIdAfterCurrentLeavesSequence(images, "missing"), null);
});

test("project results lightbox exposes review and censor controls like section results", () => {
  const routeSource = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");
  const lightboxSource = readSource("src/app/projects/[projectId]/results/project-results-lightbox.tsx");
  const mutationSource = readSource("src/app/projects/[projectId]/results/use-project-results-mutations.ts");

  assert.match(
    lightboxSource,
    /from ["']@\/components\/quick-censor-canvas["']/,
    "project results lightbox should reuse the quick-censor canvas",
  );
  assert.match(
    mutationSource,
    /from ["']@\/lib\/client-review-mutation["']/,
    "project results lightbox should use the same background review API as section results",
  );
  assert.match(
    lightboxSource,
    /quickCensorMode/,
    "project results lightbox should track quick censor mode",
  );
  assert.match(
    mutationSource,
    /\/api\/images\/\$\{encodeURIComponent\(lightboxImage\.id\)\}\/manual-censor/,
    "finished quick censor should upload to the manual censor route",
  );
  assert.match(
    mutationSource,
    /setShowCensoredMode\(true\)/,
    "finished quick censor should switch the preview to the saved censored image",
  );
  assert.match(
    routeSource,
    /onKeep=\{\(\) => reviewLightboxImage\("keep", true\)\}/,
    "project results lightbox should expose a keep-and-advance control",
  );
  assert.match(
    routeSource,
    /onTrash=\{\(\) => reviewLightboxImage\("trash", true\)\}/,
    "project results lightbox should expose a delete-and-advance control",
  );
  assert.match(
    lightboxSource,
    /<QuickCensorCanvas[\s\S]*source=\{lightboxImage\.full\}/,
    "manual quick censor should always start from the original full image",
  );
  assert.match(
    lightboxSource,
    /current\.censoredFull|lightboxImage\.censoredFull/,
    "project results lightbox should expose a censored-version toggle",
  );
  assert.match(
    mutationSource,
    /censorImage\(imageId\)/,
    "project results lightbox should expose the automatic single-image censor action",
  );
  assert.match(
    routeSource,
    /onRunAutoCensor=\{runAutoCensorLightboxImage\}/,
    "project results route should pass automatic censor behavior into the lightbox shell",
  );
});

test("project results import image review actions from focused module", () => {
  const routeSource = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");
  const mutationSource = readSource("src/app/projects/[projectId]/results/use-project-results-mutations.ts");

  assert.match(mutationSource, /from "@\/lib\/actions\/image-review";/);
  assert.doesNotMatch(mutationSource, /from "@\/lib\/actions";/);
  assert.doesNotMatch(routeSource, /from "@\/lib\/actions\/image-review";/);
});

test("project results review actions update local image state before awaiting the API", () => {
  const source = readSource("src/app/projects/[projectId]/results/use-project-results-mutations.ts");
  const reviewLightboxImage = sourceSlice(
    source,
    "const reviewLightboxImage = useCallback",
    "  const runAutoCensorLightboxImage = useCallback",
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

test("project results marker removal keeps the filtered lightbox open and supports plain Z undo", () => {
  const routeSource = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");
  const mutationSource = readSource("src/app/projects/[projectId]/results/use-project-results-mutations.ts");
  const handleToggleFeatured = sourceSlice(
    mutationSource,
    "  const handleToggleFeatured = useCallback",
    "  const handleToggleFeatured2 = useCallback",
  );
  const handleToggleFeatured2 = sourceSlice(
    mutationSource,
    "  const handleToggleFeatured2 = useCallback",
    "  const handleUndoMarkerToggle = useCallback",
  );
  const shortcuts = sourceSlice(
    routeSource,
    "function handleKeyDown(event: KeyboardEvent) {",
    "    window.addEventListener(\"keydown\", handleKeyDown);",
  );

  assert.match(
    mutationSource,
    /getNextImageIdAfterCurrentLeavesSequence/,
    "project results should share the filtered lightbox replacement helper",
  );
  assert.match(
    handleToggleFeatured,
    /resultFilter === "featured"[\s\S]*getNextImageIdAfterCurrentLeavesSequence\(filteredImages,\s*imageId\)/,
    "removing p-site from the active filtered lightbox image should compute the next p-site image before state changes",
  );
  assert.match(
    handleToggleFeatured,
    /setLightboxImageId\(nextLightboxImageId\)/,
    "p-site removal should keep the lightbox pointed at the replacement image",
  );
  assert.match(
    handleToggleFeatured2,
    /resultFilter === "featured2"[\s\S]*getNextImageIdAfterCurrentLeavesSequence\(filteredImages,\s*imageId\)/,
    "removing preview from the active filtered lightbox image should compute the next preview image before state changes",
  );
  assert.match(
    handleToggleFeatured2,
    /setLightboxImageId\(nextLightboxImageId\)/,
    "preview removal should keep the lightbox pointed at the replacement image",
  );
  assert.match(
    mutationSource,
    /const \[markerUndoStack, setMarkerUndoStack\]/,
    "project results should keep marker toggle undo entries",
  );
  assert.match(
    mutationSource,
    /const handleUndoMarkerToggle = useCallback/,
    "project results should expose a marker undo handler",
  );
  assert.match(
    shortcuts,
    /key === "z"[\s\S]*key === "Z"[\s\S]*!event\.ctrlKey[\s\S]*!event\.metaKey[\s\S]*handleUndoMarkerToggle\(\)/,
    "project results lightbox should bind plain Z to marker undo",
  );
});

test("project results keeps filtered lightbox cursor state in a focused hook", () => {
  const source = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");
  const hookSource = readSource("src/lib/use-review-lightbox-state.ts");

  assert.match(
    hookSource,
    /export function useReviewLightboxState/,
    "shared hook should own reusable lightbox cursor state",
  );
  assert.match(
    hookSource,
    /getNextImageIdAfterCurrentLeavesSequence/,
    "shared hook should preserve filtered-sequence replacement behavior",
  );
  assert.match(
    source,
    /from "@\/lib\/use-review-lightbox-state";/,
    "project results should import the focused lightbox hook",
  );
  assert.doesNotMatch(
    source,
    /previousFilteredImagesRef|useRef<ProjectResultsImageWithRun/,
    "project results should not keep filtered lightbox history refs inline",
  );
  assert.doesNotMatch(
    source,
    /const \[lightboxImageId,\s*setLightboxImageId\] = useState/,
    "project results should not own the lightbox image id state inline",
  );
});
