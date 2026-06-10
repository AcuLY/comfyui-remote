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
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const start = normalizedSource.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing start needle: ${startNeedle}`);
  const end = normalizedSource.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `missing end needle: ${endNeedle}`);
  return normalizedSource.slice(start, end);
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
    "submitReviewMutation(action, [imageId])",
    "queue keep should advance the lightbox before submitting the background mutation",
  );
  assert.match(
    reviewLightboxImage,
    /idx < imageCount - 1 \? idx \+ 1 : 0/,
    "queue keep should wrap from the last lightbox image to the first image",
  );
  assertBefore(
    reviewLightboxImage,
    "removeImages([imageId])",
    "submitReviewMutation(action, [imageId])",
    "queue trash should remove/advance the lightbox before submitting the background mutation",
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
    "submitReviewMutation(action, [imageId])",
    "section results keep should advance the lightbox before submitting the background mutation",
  );
  assertBefore(
    reviewCurrent,
    "setAllImages((prev) => prev.filter((image) => image.id !== imageId))",
    "submitReviewMutation(action, [imageId])",
    "section results trash should remove/advance the lightbox before submitting the background mutation",
  );
});

test("section results thumbnail list reads the same optimistic image state as the lightbox", () => {
  const gallerySource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );
  const pageSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx",
    "utf8",
  );
  const childContext = sourceSlice(
    gallerySource,
    "children: (ctx: {",
    "  onUndo?: (helpers: ResultsGalleryUndoHelpers) => Promise<void>;",
  );
  const renderChildren = sourceSlice(
    gridSource,
    "<ResultsGalleryProvider",
    "</ResultsGalleryProvider>",
  );
  const runLoop = sourceSlice(
    gridSource,
    "{runs.map((run) => {",
    "                {/* Batch action buttons",
  );

  assert.match(
    childContext,
    /getImage: \(imageId: string\) => GalleryImage \| null/,
    "results gallery provider should expose current optimistic image state to the thumbnail list",
  );
  assert.match(
    childContext,
    /imageCount: number/,
    "results gallery provider should expose the current optimistic total count",
  );
  assert.match(
    childContext,
    /pendingImageCount: number/,
    "results gallery provider should expose the current optimistic pending count",
  );
  assert.match(
    childContext,
    /openImageLightbox: \(imageId: string\) => void/,
    "results gallery provider should open the lightbox by current image id, not stale initial index",
  );
  assert.match(
    renderChildren,
    /getImage/,
    "results grid should subscribe to the provider image lookup",
  );
  assert.match(
    renderChildren,
    /pendingImageCount/,
    "results grid should render live counts from the provider state",
  );
  assert.match(
    gridSource,
    /const allImages = useMemo\(/,
    "results grid should keep the provider initial image list stable across local UI renders",
  );
  assert.match(
    renderChildren,
    /openImageLightbox/,
    "results grid should open images through the provider id lookup",
  );
  assert.match(
    runLoop,
    /const runImages = run\.images\s*\.map\(\(image\) => getImage\(image\.id\)\)/,
    "results grid should derive run thumbnails from current provider state",
  );
  assert.doesNotMatch(
    runLoop,
    /run\.images\.map\(\(img\) => \{/,
    "results grid should not render thumbnails from stale initial run images",
  );
  assert.match(
    runLoop,
    /onClick=\{\(\) => openImageLightbox\(img\.id\)\}/,
    "thumbnail clicks should resolve the lightbox index from the current provider state",
  );
  assert.doesNotMatch(
    pageSource,
    /const totalImages = data\.runs\.reduce/,
    "section results server page should not keep stale image totals outside the optimistic provider",
  );
  assert.doesNotMatch(
    pageSource,
    /data\.totalPending/,
    "section results server page should not keep stale pending totals outside the optimistic provider",
  );
});

test("section results undo restores the optimistic thumbnail state before refreshing", () => {
  const gallerySource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );
  const undoHandler = sourceSlice(
    gridSource,
    "  // Undo function",
    "  return (",
  );
  const restoreImages = sourceSlice(
    gallerySource,
    "const restoreImages = useCallback",
    "const reviewCurrent = useCallback",
  );
  const keyboardUndo = sourceSlice(
    gallerySource,
    "      // Undo: Z",
    "      // H key: toggle censored version",
  );

  assert.match(
    gallerySource,
    /type ResultsGalleryUndoHelpers = \{\s*restoreImages: \(imageIds: string\[\]\) => void;\s*\}/,
    "results gallery provider should pass local restore helpers to undo handlers",
  );
  assert.match(
    restoreImages,
    /optimisticReviewsRef\.current\.delete\(imageId\)/,
    "undo should clear stale optimistic trash state so router.refresh can include restored images",
  );
  assert.match(
    restoreImages,
    /setAllImages\(\(prev\) => \{/,
    "undo should update the local gallery image list immediately",
  );
  assert.match(
    undoHandler,
    /restoreImages\(lastTrashedIds\)/,
    "results undo should restore thumbnails locally after the restore API succeeds",
  );
  assert.match(
    keyboardUndo,
    /onUndo\(\{ restoreImages \}\)/,
    "lightbox keyboard undo should provide the local restore helper",
  );
});

test("single-image lightbox review actions use background API mutations", () => {
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
  const clientMutationSource = readFileSync("src/lib/client-review-mutation.ts", "utf8");
  const routeSource = readFileSync("src/app/api/image-review/route.ts", "utf8");

  assert.doesNotMatch(
    queueReviewLightboxImage,
    /router\.refresh\(\)/,
    "queue lightbox keep/trash should rely on local optimistic state instead of refreshing the page",
  );
  assert.match(
    queueReviewLightboxImage,
    /submitReviewMutation\(action,\s*\[imageId\]\)/,
    "queue lightbox review should submit through the background review API",
  );
  assert.doesNotMatch(
    queueReviewLightboxImage,
    /await (?:keepImages|trashImages)\(\[imageId\]/,
    "queue lightbox review should not block on direct Server Action calls",
  );
  assert.doesNotMatch(
    sectionReviewCurrent,
    /router\.refresh\(\)/,
    "section results lightbox keep/trash should rely on local optimistic state instead of refreshing the page",
  );
  assert.match(
    sectionReviewCurrent,
    /submitReviewMutation\(action,\s*\[imageId\]\)/,
    "section results lightbox review should submit through the background review API",
  );
  assert.doesNotMatch(
    sectionReviewCurrent,
    /await (?:keepImages|trashImages)\(\[imageId\]/,
    "section results lightbox review should not block on direct Server Action calls",
  );
  assert.match(
    clientMutationSource,
    /fetch\("\/api\/image-review"/,
    "client review mutation helper should call the dedicated API route",
  );
  assert.match(
    routeSource,
    /await keepImages\(imageIds,\s*\{\s*revalidate:\s*false\s*\}\)/,
    "review API should keep images without path revalidation",
  );
  assert.match(
    routeSource,
    /await trashImages\(imageIds,\s*\{\s*revalidate:\s*false\s*\}\)/,
    "review API should trash images without path revalidation",
  );
});

test("section results batch review buttons use optimistic background mutations", () => {
  const gallerySource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );
  const childContext = sourceSlice(
    gallerySource,
    "children: (ctx: {",
    "  onUndo?: (helpers: ResultsGalleryUndoHelpers) => Promise<void>;",
  );
  const batchButtons = sourceSlice(
    gridSource,
    "                {/* Batch action buttons",
    "                        // Censor selected kept/pending images",
  );

  assert.match(
    childContext,
    /reviewImages: \(action: ReviewAction, imageIds: string\[\]\) => void/,
    "results gallery provider should expose batch optimistic review mutations",
  );
  assert.match(
    gallerySource,
    /submitReviewMutation\(action,\s*uniqueImageIds\)/,
    "provider batch review helper should use the background review API",
  );
  assert.match(
    batchButtons,
    /reviewImages\("keep", ids\)/,
    "quick keep should update provider state instead of blocking on server actions",
  );
  assert.match(
    batchButtons,
    /reviewImages\("trash", ids\)/,
    "quick trash should update provider state instead of blocking on server actions",
  );
  assert.match(
    batchButtons,
    /reviewImages\("keep", runSelectedIds\)/,
    "selected keep should update provider state instead of blocking on server actions",
  );
  assert.match(
    batchButtons,
    /reviewImages\("trash", runSelectedIds\)/,
    "selected trash should update provider state instead of blocking on server actions",
  );
  assert.doesNotMatch(
    batchButtons,
    /await (?:keepImages|trashImages)\(/,
    "section results batch review buttons should not await direct Server Actions",
  );
  assert.doesNotMatch(
    batchButtons,
    /router\.refresh\(\)/,
    "section results batch review buttons should not refresh the whole image-heavy route",
  );
});

test("single-image review controls do not use one global pending lock", () => {
  const queueSource = readFileSync("src/app/queue/[runId]/review-grid.tsx", "utf8");
  const queueBusySource = sourceSlice(
    queueSource,
    "  const lightboxBusy =",
    "  /** IDs",
  );
  const queueReviewLightboxImage = sourceSlice(
    queueSource,
    "const reviewLightboxImage = useCallback",
    "  return (",
  );
  const sectionSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const sectionBusySource = sourceSlice(
    sectionSource,
    "  const busy =",
    "  useEffect(() => {",
  );
  const sectionReviewCurrent = sourceSlice(
    sectionSource,
    "const reviewCurrent = useCallback",
    "  useEffect(() => {",
  );

  assert.doesNotMatch(
    queueBusySource,
    /isPending/,
    "queue lightbox should not disable review controls for unrelated pending mutations",
  );
  assert.match(
    queueReviewLightboxImage,
    /pendingReviewIdsRef\.current\.has\(imageId\)/,
    "queue lightbox should only guard duplicate submissions for the current image",
  );
  assert.doesNotMatch(
    sectionBusySource,
    /reviewingAction/,
    "section results lightbox should not disable review controls for unrelated review mutations",
  );
  assert.match(
    sectionReviewCurrent,
    /pendingReviewIdsRef\.current\.has\(imageId\)/,
    "section results lightbox should only guard duplicate submissions for the current image",
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

test("lightbox preloads neighbors only after the current full image has loaded", () => {
  const candidates = getLightboxPreloadCandidates(
    [image("image-a"), image("image-b"), image("image-c"), image("image-d")],
    2,
  );

  assert.equal(LIGHTBOX_PRELOAD_AHEAD, 4);
  assert.deepEqual(
    candidates.map((item) => item.id),
    ["image-d", "image-a", "image-b"],
  );

  const queueSource = readFileSync("src/app/queue/[runId]/review-grid.tsx", "utf8");
  const queuePreloadEffect = sourceSlice(
    queueSource,
    "// Preload upcoming images after the current full image has loaded.",
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
  assert.doesNotMatch(
    queuePreloadEffect,
    /loadedLightboxImageId !== currentLightboxImage\.id/,
    "queue lightbox should use the current loaded image set instead of the old single loaded id state",
  );
  assert.match(
    queuePreloadEffect,
    /!loadedLightboxImageIds\.has\(currentLightboxImage\.id\)/,
    "queue lightbox should wait for the current full image before preloading neighbors",
  );
  assert.doesNotMatch(
    queuePreloadEffect,
    /const preloadTargets = \[\s*currentLightboxImage,/,
    "queue lightbox background preloading should not request the current image alongside neighbors",
  );
  assert.match(
    queuePreloadEffect,
    /getLightboxPreloadCandidates\(\s*reviewImages,\s*lightboxIndex/,
    "queue lightbox should use bounded preload candidates",
  );
  assert.match(
    queuePreloadEffect,
    /markLightboxImageLoaded/,
    "queue lightbox should mark images loaded when background preload completes",
  );
  assert.match(
    queueLightboxSource,
    /onImageLoaded\?: \(imageId: string\) => void/,
    "queue lightbox should notify the parent when the current image has loaded",
  );
  assert.match(
    queueLightboxSource,
    /preloadedImageIds\?: ReadonlySet<string>/,
    "queue lightbox should use parent preload state to avoid skeleton flashes",
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
  assert.doesNotMatch(
    sectionPreloadEffect,
    /!imageLoaded/,
    "section results lightbox should not use the old negated imageLoaded guard spelling",
  );
  assert.match(
    sectionPreloadEffect,
    /loadedImageIds\.has\(current\.id\)/,
    "section results lightbox should wait for the current full image before preloading neighbors",
  );
  assert.doesNotMatch(
    sectionPreloadEffect,
    /const preloadTargets = \[\s*current,/,
    "section results background preloading should not request the current image alongside neighbors",
  );
  assert.match(
    sectionPreloadEffect,
    /getLightboxPreloadCandidates\(\s*allImages,\s*currentIndex/,
    "section results lightbox should use bounded preload candidates",
  );
  assert.match(
    sectionPreloadEffect,
    /markImageLoaded/,
    "section results lightbox should mark images loaded when background preload completes",
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

test("section results page prefetches neighboring result routes", () => {
  const pageSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx",
    "utf8",
  );
  const prefetcherSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-route-prefetcher.tsx",
    "utf8",
  );

  assert.match(
    pageSource,
    /<ResultsRoutePrefetcher/,
    "section results page should render the route prefetcher",
  );
  assert.match(
    pageSource,
    /data\.previousSection/,
    "section results page should include previous section result route in prefetch candidates",
  );
  assert.match(
    pageSource,
    /data\.nextSection/,
    "section results page should include next section result route in prefetch candidates",
  );
  assert.match(
    prefetcherSource,
    /router\.prefetch\(href\)/,
    "route prefetcher should warm each neighboring route with router.prefetch",
  );
});

test("local image route streams files instead of buffering full images", () => {
  const source = readFileSync("src/app/api/images/[...path]/route.ts", "utf8");

  assert.match(
    source,
    /createReadStream/,
    "image route should stream local image files to reduce first-byte latency",
  );
  assert.match(
    source,
    /Readable\.toWeb\(createReadStream\(resolved\)\)/,
    "image route should convert the Node stream to a web stream for NextResponse",
  );
  assert.match(
    source,
    /"Content-Length": String\(fileStat\.size\)/,
    "image route should include Content-Length for browser loading",
  );
  assert.doesNotMatch(
    source,
    /readFile/,
    "image route should not buffer the entire image before responding",
  );
});
