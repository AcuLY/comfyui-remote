import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  getLightboxPreloadCandidates,
  LIGHTBOX_PRELOAD_AHEAD,
  reconcileReviewImagesWithOptimisticReviews,
  type OptimisticReviewState,
} from "../src/lib/review-lightbox-state";
import type { ReviewImage } from "../src/lib/types";

function sourceSlice(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing start needle: ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `missing end needle: ${endNeedle}`);
  return source.slice(start, end);
}

function assertBefore(source: string, earlier: string, later: string, message: string) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `missing earlier source: ${earlier}`);
  assert.notEqual(laterIndex, -1, `missing later source: ${later}`);
  assert.ok(earlierIndex < laterIndex, message);
}

function image(id: string, status: ReviewImage["status"] = "pending"): ReviewImage {
  return {
    id,
    src: `/thumbs/${id}.png`,
    full: `/images/${id}.png`,
    label: id,
    status,
    featured: false,
    featured2: false,
    cover: false,
  };
}

test("queue review lightbox navigates optimistically before awaiting review actions", () => {
  const source = readFileSync("src/app/queue/[runId]/review-grid.tsx", "utf8");
  const reviewLightboxImage = sourceSlice(
    source,
    "const reviewLightboxImage = useCallback",
    "  return (",
  );

  assertBefore(
    reviewLightboxImage,
    "setLightboxIndex((idx)",
    "await keepImages([imageId],",
    "queue keep should advance the lightbox before waiting for the server action",
  );
  assert.match(
    reviewLightboxImage,
    /idx < imageCount - 1 \? idx \+ 1 : 0/,
    "queue keep should wrap from the last lightbox image to the first image",
  );
  assertBefore(
    reviewLightboxImage,
    "removeImages([imageId])",
    "await trashImages([imageId],",
    "queue trash should remove/advance the lightbox before waiting for the server action",
  );
});

test("queue review grid reconciles refreshed props with optimistic review state", () => {
  const source = readFileSync("src/app/queue/[runId]/review-grid.tsx", "utf8");
  const syncEffect = sourceSlice(
    source,
    "  useEffect(() => {",
    "  }, [images]);",
  );
  const reviewLightboxImage = sourceSlice(
    source,
    "const reviewLightboxImage = useCallback",
    "  return (",
  );

  assert.match(
    source,
    /reconcileReviewImagesWithOptimisticReviews/,
    "queue review grid should import the optimistic refresh reconciler",
  );
  assert.doesNotMatch(
    syncEffect,
    /setReviewImages\(images\)/,
    "queue review grid should not overwrite optimistic state with raw refreshed props",
  );
  assert.match(
    reviewLightboxImage,
    /optimisticReviewsRef\.current\.set\(imageId,\s*action\)/,
    "queue lightbox review should record the local optimistic review before the server action",
  );
  assert.match(
    reviewLightboxImage,
    /optimisticReviewsRef\.current\.delete\(imageId\)/,
    "queue lightbox review should remove the optimistic review when the server action fails",
  );
});

test("section results lightbox navigates optimistically before awaiting review actions", () => {
  const source = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const reviewCurrent = sourceSlice(
    source,
    "const reviewCurrent = useCallback",
    "  useEffect(() => {",
  );

  assertBefore(
    reviewCurrent,
    "goNext();",
    "await keepImages([imageId],",
    "section results keep should advance the lightbox before waiting for the server action",
  );
  assertBefore(
    reviewCurrent,
    "setAllImages((prev) => prev.filter((image) => image.id !== imageId))",
    "await trashImages([imageId],",
    "section results trash should remove/advance the lightbox before waiting for the server action",
  );
});

test("single-image lightbox review actions do not refresh the whole page", () => {
  const queueSource = readFileSync("src/app/queue/[runId]/review-grid.tsx", "utf8");
  const queueReviewLightboxImage = sourceSlice(
    queueSource,
    "const reviewLightboxImage = useCallback",
    "  return (",
  );
  const sectionSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const sectionReviewCurrent = sourceSlice(
    sectionSource,
    "const reviewCurrent = useCallback",
    "  useEffect(() => {",
  );

  assert.doesNotMatch(
    queueReviewLightboxImage,
    /router\.refresh\(\)/,
    "queue lightbox keep/trash should rely on local optimistic state instead of refreshing the page",
  );
  assert.match(
    queueReviewLightboxImage,
    /await keepImages\(\[imageId\],\s*\{\s*revalidate:\s*false\s*\}\)/,
    "queue lightbox keep should skip server-action revalidation",
  );
  assert.match(
    queueReviewLightboxImage,
    /await trashImages\(\[imageId\],\s*\{\s*revalidate:\s*false\s*\}\)/,
    "queue lightbox trash should skip server-action revalidation",
  );
  assert.doesNotMatch(
    sectionReviewCurrent,
    /router\.refresh\(\)/,
    "section results lightbox keep/trash should rely on local optimistic state instead of refreshing the page",
  );
  assert.match(
    sectionReviewCurrent,
    /await keepImages\(\[imageId\],\s*\{\s*revalidate:\s*false\s*\}\)/,
    "section results lightbox keep should skip server-action revalidation",
  );
  assert.match(
    sectionReviewCurrent,
    /await trashImages\(\[imageId\],\s*\{\s*revalidate:\s*false\s*\}\)/,
    "section results lightbox trash should skip server-action revalidation",
  );
});

test("review server actions can skip page revalidation for optimistic lightbox actions", () => {
  const source = readFileSync("src/lib/actions/image-review.ts", "utf8");
  const keepImagesSource = sourceSlice(
    source,
    "export async function keepImages",
    "// ---------------------------------------------------------------------------\n// 审核操作：删除图片",
  );
  const trashImagesSource = sourceSlice(
    source,
    "export async function trashImages",
    "export async function trashProjectImages",
  );

  assert.match(
    keepImagesSource,
    /options:\s*ReviewImageMutationOptions\s*=\s*\{\}/,
    "keepImages should accept mutation options",
  );
  assert.match(
    trashImagesSource,
    /options:\s*ReviewImageMutationOptions\s*=\s*\{\}/,
    "trashImages should accept mutation options",
  );
  assert.match(
    keepImagesSource,
    /if \(options\.revalidate !== false\)/,
    "keepImages should guard its revalidation block",
  );
  assert.match(
    trashImagesSource,
    /if \(options\.revalidate !== false\)/,
    "trashImages should guard its revalidation block",
  );
});

test("lightbox preloads only a bounded set after the current image has loaded", () => {
  const candidates = getLightboxPreloadCandidates(
    [image("image-a"), image("image-b"), image("image-c"), image("image-d")],
    2,
  );

  assert.equal(LIGHTBOX_PRELOAD_AHEAD, 2);
  assert.deepEqual(
    candidates.map((item) => item.id),
    ["image-d", "image-a"],
  );

  const queueSource = readFileSync("src/app/queue/[runId]/review-grid.tsx", "utf8");
  const queuePreloadEffect = sourceSlice(
    queueSource,
    "// Preload upcoming images when lightbox is open",
    "  // Page-level shortcuts",
  );
  const queueLightboxSource = readFileSync("src/app/queue/[runId]/image-lightbox.tsx", "utf8");
  const sectionSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const sectionPreloadEffect = sourceSlice(
    sectionSource,
    "  useEffect(() => {\n    if (!open) return;",
    "  const goPrev = useCallback",
  );

  assert.doesNotMatch(
    queuePreloadEffect,
    /reviewImages\.slice\(lightboxIndex \+ 1\)/,
    "queue lightbox should not preload every remaining image when opened",
  );
  assert.match(
    queuePreloadEffect,
    /loadedLightboxImageId !== currentLightboxImage\.id/,
    "queue lightbox should wait for the current full image before preloading neighbors",
  );
  assert.match(
    queuePreloadEffect,
    /getLightboxPreloadCandidates\(\s*reviewImages,\s*lightboxIndex/,
    "queue lightbox should use bounded preload candidates",
  );
  assert.match(
    queueLightboxSource,
    /onImageLoaded\?: \(imageId: string\) => void/,
    "queue lightbox should notify the parent when the current image has loaded",
  );
  assert.match(
    queueLightboxSource,
    /loading="eager"/,
    "queue lightbox current image should be requested eagerly",
  );
  assert.match(
    queueLightboxSource,
    /fetchPriority="high"/,
    "queue lightbox current image should use high fetch priority",
  );
  assert.doesNotMatch(
    sectionPreloadEffect,
    /allImages\.slice\(currentIndex \+ 1\)/,
    "section results lightbox should not preload every remaining image when opened",
  );
  assert.match(
    sectionPreloadEffect,
    /!imageLoaded/,
    "section results lightbox should wait for the current full image before preloading neighbors",
  );
  assert.match(
    sectionPreloadEffect,
    /getLightboxPreloadCandidates\(\s*allImages,\s*currentIndex/,
    "section results lightbox should use bounded preload candidates",
  );
  assert.match(
    sectionSource,
    /loading="eager"/,
    "section results lightbox current image should be requested eagerly",
  );
  assert.match(
    sectionSource,
    /fetchPriority="high"/,
    "section results lightbox current image should use high fetch priority",
  );
});

test("queue review lightbox keeps local optimistic review state across server refresh", () => {
  const optimisticReviews: OptimisticReviewState = new Map([
    ["image-a", "trash"],
    ["image-b", "keep"],
  ]);

  const refreshedImages = [
    image("image-a", "trashed"),
    image("image-b", "pending"),
    image("image-c", "pending"),
  ];

  const reconciled = reconcileReviewImagesWithOptimisticReviews(
    refreshedImages,
    optimisticReviews,
  );

  assert.deepEqual(
    reconciled.map((item) => [item.id, item.status]),
    [
      ["image-b", "kept"],
      ["image-c", "pending"],
    ],
  );
});
