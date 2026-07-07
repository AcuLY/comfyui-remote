import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  getNextPendingImageIndex,
  getNextPendingSectionId,
  getLightboxPreloadCandidates,
  LIGHTBOX_PRELOAD_AHEAD,
  reconcileReviewImagesWithOptimisticReviews,
  type OptimisticReviewState,
} from "../src/lib/review-lightbox-state";
import {
  buildTrashUndoEntry,
  restoreTrashUndoEntry,
} from "../src/lib/review-undo-state";
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

test("queue review grid imports review actions from the focused action module", () => {
  const source = readFileSync("src/app/queue/[runId]/review-grid.tsx", "utf8");

  assert.match(
    source,
    /from "@\/lib\/actions\/image-review";/,
    "queue review grid should import keep/trash review actions from the focused image-review action module.",
  );
  assert.doesNotMatch(
    source,
    /from "@\/lib\/actions";|import\("@\/lib\/actions"\)/,
    "queue review grid should not import the full server-action barrel.",
  );
});

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

test("section results import image review and run actions from focused modules", () => {
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );
  const gallerySource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );

  assert.match(gridSource, /from "@\/lib\/actions\/image-review";/);
  assert.match(gridSource, /from "@\/lib\/actions\/run-execution";/);
  assert.match(gallerySource, /from "@\/lib\/actions\/image-review";/);
  assert.doesNotMatch(gridSource, /from "@\/lib\/actions";/);
  assert.doesNotMatch(gallerySource, /from "@\/lib\/actions";/);
});

test("queue review page shortcuts mirror results where matching queue actions exist", () => {
  const gridSource = readFileSync("src/app/queue/[runId]/review-grid.tsx", "utf8");
  const pageSource = readFileSync("src/app/queue/[runId]/page.tsx", "utf8");
  const sectionRunButtonSource = readFileSync(
    "src/app/projects/[projectId]/project-detail-actions.tsx",
    "utf8",
  );
  const batchQuickFillSource = readFileSync("src/components/batch-size-quick-fill.tsx", "utf8");
  const pageShortcuts = sourceSlice(
    gridSource,
    "  // Page-level shortcuts (lightbox closed)",
    "  const pendingImages =",
  );

  assert.match(
    pageShortcuts,
    /event\.key === "a" \|\| event\.key === "A"/,
    "queue page should support A for the matching section editor jump",
  );
  assert.match(
    pageShortcuts,
    /document\.querySelector<HTMLAnchorElement>\('\[data-nav-editor\]'\)/,
    "queue A shortcut should use the same data-nav-editor contract as results",
  );
  assert.match(
    pageSource,
    /data-nav-editor/,
    "queue section jump link should expose the editor shortcut target",
  );
  assert.match(
    pageShortcuts,
    /"12345"\.includes\(event\.key\)/,
    "queue page should support 1-5 batch-size shortcuts for rerun controls",
  );
  assert.match(
    pageShortcuts,
    /data-batch-size="\$\{bs\}"/,
    "queue batch-size shortcuts should click a stable batch-size control",
  );
  assert.match(
    batchQuickFillSource,
    /data-batch-size=\{val\}/,
    "quick batch buttons should expose stable batch-size attributes",
  );
  assert.match(
    pageShortcuts,
    /event\.key === "n" \|\| event\.key === "N"/,
    "queue page should support N for the matching rerun action",
  );
  assert.match(
    pageShortcuts,
    /document\.querySelector<HTMLButtonElement>\('\[data-queue-run-section\]'\)/,
    "queue N shortcut should click the rerun button",
  );
  assert.match(
    sectionRunButtonSource,
    /data-queue-run-section/,
    "section rerun button should expose the queue shortcut target",
  );
  assert.match(
    pageShortcuts,
    /event\.key === "x" \|\| event\.key === "X"/,
    "queue page should support X for the matching current-run delete action",
  );
  assert.match(
    pageShortcuts,
    /trashCurrentRunImages\(\)/,
    "queue X shortcut should delete the current queue group's visible images",
  );
  assert.match(
    pageShortcuts,
    /key === "z" \|\| key === "Z"/,
    "queue page should support plain Z undo like results",
  );
  assert.match(
    pageShortcuts,
    /handleUndoTrash\(\)/,
    "queue Z shortcut should invoke the trash undo stack",
  );
});

test("queue trash undo stack restores batch deletes in order and supports consecutive undo", () => {
  const images = [
    image("image-a"),
    image("image-b"),
    image("image-c"),
    image("image-d"),
  ];
  const firstEntry = buildTrashUndoEntry(images, ["image-b", "image-c"]);
  const afterFirstDelete = images.filter((item) => item.id !== "image-b" && item.id !== "image-c");
  const secondEntry = buildTrashUndoEntry(afterFirstDelete, ["image-d"]);
  assert.ok(firstEntry);
  assert.ok(secondEntry);

  const afterSecondDelete = afterFirstDelete.filter((item) => item.id !== "image-d");
  const undoSecond = restoreTrashUndoEntry(afterSecondDelete, secondEntry);
  const undoFirst = restoreTrashUndoEntry(undoSecond, firstEntry);

  assert.deepEqual(
    undoSecond.map((item) => item.id),
    ["image-a", "image-d"],
  );
  assert.deepEqual(
    undoFirst.map((item) => item.id),
    ["image-a", "image-b", "image-c", "image-d"],
  );
  assert.deepEqual(
    undoFirst.map((item) => item.status),
    ["pending", "pending", "pending", "pending"],
  );
});

test("queue review grid records batch trash actions and exposes lightbox undo", () => {
  const gridSource = readFileSync("src/app/queue/[runId]/review-grid.tsx", "utf8");
  const lightboxSource = readFileSync("src/app/queue/[runId]/image-lightbox.tsx", "utf8");
  const handleTrash = sourceSlice(
    gridSource,
    "  function handleTrash()",
    "  /** Handle the remaining pending images",
  );
  const undoHandler = sourceSlice(
    gridSource,
    "  const handleUndoTrash = useCallback",
    "  function handleKeep()",
  );

  assert.match(
    gridSource,
    /const \[trashUndoStack, setTrashUndoStack\]/,
    "queue review grid should keep a stack, not a single last trashed id",
  );
  assert.match(
    handleTrash,
    /const undoEntry = buildTrashUndoEntry\(reviewImages, ids\)/,
    "batch delete should snapshot all deleted images before removing them locally",
  );
  assertBefore(
    handleTrash,
    "await trashImages(ids)",
    "setTrashUndoStack((prev) => undoEntry ? [...prev, undoEntry] : prev)",
    "batch delete should only push undo after the trash API succeeds",
  );
  assert.match(
    undoHandler,
    /trashUndoStack\[trashUndoStack\.length - 1\]/,
    "undo should restore the most recent trash entry",
  );
  assert.match(
    undoHandler,
    /setTrashUndoStack\(\(prev\) => prev\.slice\(0, -1\)\)/,
    "undo should pop only one entry so consecutive Z presses restore earlier batches",
  );
  assert.match(
    undoHandler,
    /\/api\/images\/\$\{encodeURIComponent\(id\)\}\/restore/,
    "undo should restore each deleted image through the restore API",
  );
  assert.match(
    undoHandler,
    /restoreTrashUndoEntry\(prev, undoEntry\)/,
    "undo should restore deleted images back into the local queue grid",
  );
  assert.match(
    lightboxSource,
    /onUndo\?: \(\) => void/,
    "queue lightbox should accept an undo handler",
  );
  assert.match(
    lightboxSource,
    /key === "z" \|\| key === "Z"/,
    "queue lightbox should bind plain Z undo",
  );
  assert.match(
    gridSource,
    /onUndo=\{handleUndoTrash\}/,
    "queue review grid should wire the undo stack into the lightbox",
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
    "{runsWithImages.map((run) => {",
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

test("section results can switch the lightbox to a project-wide continuous review sequence", () => {
  const repositorySource = readFileSync(
    "src/server/repositories/project-view-repository/detail-view.ts",
    "utf8",
  );
  const pageSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx",
    "utf8",
  );
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );
  const gallerySource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const sectionResultsData = sourceSlice(
    repositorySource,
    "export type SectionResultsData = {",
    "export type ProjectResultsData = {",
  );
  const providerUsage = sourceSlice(
    gridSource,
    "<ResultsGalleryProvider",
    "</ResultsGalleryProvider>",
  );

  assert.match(
    sectionResultsData,
    /continuousReviewImages:/,
    "section results data should include the project-wide continuous review image sequence",
  );
  assert.match(
    repositorySource,
    /const continuousReviewImages = orderedProjectSections\.flatMap/,
    "section results repository should build the continuous sequence in folder-scoped section order",
  );
  assert.match(
    repositorySource,
    /sectionId: section\.id,[\s\S]*sectionName: section\.name/,
    "continuous review images should carry section identity for the lightbox header",
  );
  assert.match(
    pageSource,
    /continuousReviewImages=\{data\.continuousReviewImages\}/,
    "section results page should pass the project-wide sequence to the client grid",
  );
  assert.match(
    gridSource,
    /const \[continuousReviewEnabled, setContinuousReviewEnabled\] = useState\(true\)/,
    "continuous review should default on",
  );
  assert.match(
    gridSource,
    /连续审核/,
    "results page should render a visible continuous review switch",
  );
  assert.match(
    providerUsage,
    /allImages=\{continuousReviewEnabled \? continuousReviewImages : allImages\}/,
    "provider should only use the project-wide sequence when the switch is enabled",
  );
  assert.match(
    gallerySource,
    /sectionSortOrder: number/,
    "gallery images should include section order for cross-section context",
  );
  assert.match(
    gallerySource,
    /第 \{current\.sectionSortOrder \+ 1\} 小节/,
    "lightbox header should show the section when navigating a continuous sequence",
  );
});

test("section results opens the current section first image when continuous review is enabled", () => {
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );
  const gallerySource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const providerUsage = sourceSlice(
    gridSource,
    "<ResultsGalleryProvider",
    "</ResultsGalleryProvider>",
  );
  const pageShortcuts = sourceSlice(
    gridSource,
    "  // Keyboard shortcuts: page-level navigation and actions",
    "  // Undo function",
  );
  const defaultOpenIndex = sourceSlice(
    gallerySource,
    "  const getDefaultOpenIndex = useCallback",
    "  const toggleLightbox = useCallback",
  );

  assert.match(
    providerUsage,
    /defaultOpenSectionId=\{sectionId\}/,
    "results grid should tell the provider which section owns the current page",
  );
  assert.match(
    pageShortcuts,
    /toggleLightbox\(\)/,
    "I/D should ask the provider to open its default image instead of a project-wide index",
  );
  assert.doesNotMatch(
    pageShortcuts,
    /toggleLightbox\(0\)/,
    "I/D must not open index 0 of the continuous project-wide sequence",
  );
  assert.match(
    defaultOpenIndex,
    /allImages\.findIndex\(\(image\) => image\.sectionId === defaultOpenSectionId\)/,
    "the provider default should resolve the first current-section image inside the active sequence",
  );
});

test("lightbox next pending index starts after the current image and wraps once", () => {
  const images = [
    image("image-a", "kept"),
    image("image-b", "pending"),
    image("image-c", "pending"),
    image("image-d", "kept"),
  ];

  assert.equal(getNextPendingImageIndex(images, 0), 1);
  assert.equal(getNextPendingImageIndex(images, 1), 2);
  assert.equal(getNextPendingImageIndex(images, 2), 1);
  assert.equal(getNextPendingImageIndex(images, 3), 1);
  assert.equal(getNextPendingImageIndex([image("image-a", "pending")], 0), null);
  assert.equal(getNextPendingImageIndex([image("image-a", "kept")], 0), null);
});

test("section results lightbox binds G to the next pending image in the active image sequence", () => {
  const gallerySource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const keyboardShortcuts = sourceSlice(
    gallerySource,
    "      // Next image: F / ArrowRight",
    "      // Keep + advance: J / W",
  );

  assert.match(
    gallerySource,
    /getNextPendingImageIndex/,
    "results gallery should use the shared next-pending index helper",
  );
  assert.match(
    keyboardShortcuts,
    /key === "g"[\s\S]*key === "G"[\s\S]*goNextPending\(\)/,
    "G should trigger next pending navigation while the lightbox is open",
  );
});

test("section results page-level G uses optimistic next pending section state", () => {
  const staleImages = [
    { ...image("section-a-image", "pending"), sectionId: "section-a" },
    { ...image("section-b-image", "pending"), sectionId: "section-b" },
    { ...image("section-c-image", "pending"), sectionId: "section-c" },
  ];
  const optimisticReviews: OptimisticReviewState = new Map([
    ["section-b-image", "keep"],
  ]);
  const reconciled = reconcileReviewImagesWithOptimisticReviews(
    staleImages,
    optimisticReviews,
  );

  assert.equal(
    getNextPendingSectionId(
      reconciled,
      "section-a",
      ["section-a", "section-b", "section-c"],
    ),
    "section-c",
    "page-level G should skip a section that is only pending in stale server data",
  );
});

test("section results renders the page-level G target from the provider optimistic state", () => {
  const pageSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx",
    "utf8",
  );
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );
  const gallerySource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const childContext = sourceSlice(
    gallerySource,
    "children: (ctx: {",
    "  onUndo?: (helpers: ResultsGalleryUndoHelpers) => Promise<void>;",
  );
  const providerUsage = sourceSlice(
    gridSource,
    "<ResultsGalleryProvider",
    "</ResultsGalleryProvider>",
  );
  const pageShortcuts = sourceSlice(
    gridSource,
    "  // Keyboard shortcuts: page-level navigation and actions",
    "  // Undo function",
  );

  assert.match(
    gallerySource,
    /getSharedOptimisticReviewState/,
    "section results provider should seed route-remounted pages from shared optimistic review state",
  );
  assert.match(
    childContext,
    /nextPendingSectionHref: string \| null/,
    "provider should expose the next pending section href after applying optimistic review state",
  );
  assert.match(
    providerUsage,
    /nextPendingSectionHref/,
    "results grid should render the next-pending target from provider state",
  );
  assert.match(
    gridSource,
    /const resolvedNextPendingSectionHref = nextPendingSectionHref \?\? fallbackNextPendingSectionHref[\s\S]*resolvedNextPendingSectionHref && \([\s\S]*<HardNavigationLink[\s\S]*href=\{resolvedNextPendingSectionHref\}[\s\S]*data-nav-next-pending/,
    "the visible next-pending button should use the optimistic provider href before falling back",
  );
  assert.match(
    pageShortcuts,
    /document\.querySelector<HTMLAnchorElement>\('\[data-nav-next-pending\]'\)/,
    "page-level G should click the provider-rendered next-pending target",
  );
  assert.doesNotMatch(
    pageSource,
    /data-nav-next-pending/,
    "the server page header should not keep a stale next-pending shortcut target",
  );
});

test("section results keeps page-level G available on empty current sections", () => {
  const pageSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx",
    "utf8",
  );
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );

  assert.match(
    pageSource,
    /fallbackNextPendingSectionHref=\{data\.nextPendingSection \? `\/projects\/\$\{projectId\}\/sections\/\$\{data\.nextPendingSection\.id\}\/results` : null\}/,
    "server results data should pass a fallback next-pending href for sections with no local images",
  );
  assert.match(
    gridSource,
    /fallbackNextPendingSectionHref:\s*string \| null/,
    "results grid should accept the server fallback next-pending href",
  );
  assert.match(
    gridSource,
    /const resolvedNextPendingSectionHref = nextPendingSectionHref \?\? fallbackNextPendingSectionHref/,
    "provider optimistic href should win, falling back only when the provider cannot compute a target",
  );
  assert.match(
    gridSource,
    /resolvedNextPendingSectionHref && \([\s\S]*<HardNavigationLink[\s\S]*href=\{resolvedNextPendingSectionHref\}[\s\S]*data-nav-next-pending/,
    "the G shortcut target should still render when the current section has no result images",
  );
});

test("section results lazily switches to the current image section route when closing cross-section lightbox", () => {
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );
  const gallerySource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx",
    "utf8",
  );
  const providerUsage = sourceSlice(
    gridSource,
    "<ResultsGalleryProvider",
    "</ResultsGalleryProvider>",
  );
  const closeLightbox = sourceSlice(
    gallerySource,
    "  const closeLightbox = useCallback",
    "  const openLightbox = useCallback",
  );
  const keyboardShortcuts = sourceSlice(
    gallerySource,
    "      // Close lightbox: I / D / Escape",
    "      // Prev image: S / ArrowLeft",
  );
  const lightboxShell = sourceSlice(
    gallerySource,
    "{open && current && (",
    "<div className=\"grid h-[calc(100dvh-8.5rem)]",
  );

  assert.match(
    providerUsage,
    /projectId=\{projectId\}/,
    "results grid should pass the project id so the provider can build section result routes",
  );
  assert.match(
    closeLightbox,
    /current\.sectionId !== defaultOpenSectionId/,
    "closing should only navigate when the current image belongs to a different section",
  );
  assert.match(
    closeLightbox,
    /router\.replace\(`\/projects\/\$\{projectId\}\/sections\/\$\{current\.sectionId\}\/results`\)/,
    "closing a cross-section image should navigate to that image's section results route",
  );
  assert.doesNotMatch(
    gallerySource,
    /window\.history\.(?:pushState|replaceState)/,
    "continuous review should not mutate the route while the user is still browsing the lightbox",
  );
  assert.match(
    keyboardShortcuts,
    /closeLightbox\(\)/,
    "I, D, and Escape should use the lazy route-aware close handler",
  );
  assert.match(
    lightboxShell,
    /onClick=\{closeLightbox\}/,
    "backdrop close should use the lazy route-aware close handler",
  );
});

test("section results render runs without visible images at the collapsed bottom", () => {
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );

  assert.match(
    gridSource,
    /const runsWithImages = useMemo\(\(\) => runs\.filter\(\(run\) => run\.images\.length > 0\), \[runs\]\)/,
    "results grid should split visible runs before rendering",
  );
  assert.match(
    gridSource,
    /const emptyRuns = useMemo\(\(\) => runs\.filter\(\(run\) => run\.images\.length === 0\), \[runs\]\)/,
    "results grid should collect runs that have no visible images",
  );
  assertBefore(
    gridSource,
    "{runsWithImages.map((run) => {",
    "{emptyRuns.length > 0 && (",
    "runs with images should render before the collapsed no-image run group",
  );
  assert.match(
    gridSource,
    /<details[\s\S]*data-empty-runs/,
    "no-image runs should be rendered in a collapsed details group",
  );
  assert.doesNotMatch(
    sourceSlice(
      gridSource,
      "{runsWithImages.map((run) => {",
      "{emptyRuns.length > 0 && (",
    ),
    /runImages\.length === 0 \?/,
    "normal run cards should no longer render full inline empty placeholders",
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

test("section results run-level trash targets the whole visible run when nothing is selected", () => {
  const gridSource = readFileSync(
    "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx",
    "utf8",
  );
  const quickTrash = sourceSlice(
    gridSource,
    "                          // Quick trash:",
    "                          setLastTrashedIds(runSelectedIds);",
  );

  assert.match(
    quickTrash,
    /const ids = runImages\.map\(\(img\) => img\.id\);/,
    "run-level trash should collect every visible image in the run when there is no explicit selection",
  );
  assert.doesNotMatch(
    quickTrash,
    /runPendingImages\.map/,
    "run-level trash must not silently no-op after all images have already been reviewed",
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

test("trash image review uses an explicit transaction wait budget", () => {
  const source = readFileSync("src/lib/actions/image-review.ts", "utf8");
  const trashImagesSource = sourceSlice(
    source,
    "export async function trashImages",
    "export async function trashProjectImages",
  );

  assert.match(
    source,
    /const REVIEW_IMAGE_TRANSACTION_OPTIONS = \{\s*maxWait: 15_000,\s*timeout: 30_000,\s*\}/,
    "review image transactions should define a wait budget above Prisma's 2s default",
  );
  assert.match(
    trashImagesSource,
    /prisma\.\$transaction\(async \(tx\) =>/,
    "trashImages should use an interactive transaction so Prisma can apply the wait budget",
  );
  assert.match(
    trashImagesSource,
    /\}\s*,\s*REVIEW_IMAGE_TRANSACTION_OPTIONS\s*\)/,
    "trashImages should use the review image transaction wait budget",
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
