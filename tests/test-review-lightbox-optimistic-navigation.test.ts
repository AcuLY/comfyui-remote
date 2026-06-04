import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strict as assert } from "node:assert";

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
    "await keepImages([imageId])",
    "queue keep should advance the lightbox before waiting for the server action",
  );
  assertBefore(
    reviewLightboxImage,
    "removeImages([imageId])",
    "await trashImages([imageId])",
    "queue trash should remove/advance the lightbox before waiting for the server action",
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
    "await keepImages([imageId])",
    "section results keep should advance the lightbox before waiting for the server action",
  );
  assertBefore(
    reviewCurrent,
    "setAllImages((prev) => prev.filter((image) => image.id !== imageId))",
    "await trashImages([imageId])",
    "section results trash should remove/advance the lightbox before waiting for the server action",
  );
});
