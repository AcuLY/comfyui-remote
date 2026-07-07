import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const projectPagesSource = readFileSync("src/features/training/ui/training-project-pages.tsx", "utf8");
const projectPagesCss = readFileSync("src/features/training/ui/training-project-pages.module.css", "utf8");
const runDetailSource = readFileSync("src/features/training/ui/training-run-detail-page.tsx", "utf8");

function sourceBetween(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing start marker ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker ${endMarker}`);
  return source.slice(start, end);
}

test("training result pool renders card thumbnails and opens the shared lightbox only on demand", () => {
  const gridSource = sourceBetween(projectPagesSource, "function TrainingResultGrid", "function ProjectRunFailureBlock");
  const gridCss = sourceBetween(projectPagesCss, ".referenceImageGrid,", ".referenceImageCard > div:last-child");

  assert.match(gridSource, /ImageThumbMedium/, "result cards should use the same thumbnail component as image grids");
  assert.match(gridSource, /onOpen=\{\(\) => setActiveResultId\(result\.id\)\}/, "result thumbnails should open the lightbox");
  assert.match(gridSource, /ImagePreviewLarge/, "full-size result images should still use the shared lightbox");
  assert.doesNotMatch(gridSource, /<ImagePreviewFrame image=\{result\.image\}/, "result cards should not embed full preview frames");
  assert.match(gridCss, /\.trainingResultGrid[\s\S]*auto-fill/, "result grids should keep lone results in thumbnail tracks");
  assert.doesNotMatch(gridCss, /\.trainingResultGrid[\s\S]*auto-fit/, "result grids should not stretch one image card across the row");
});

test("training run image outputs and frozen samples use thumbnails before lightbox preview", () => {
  const outputGridSource = sourceBetween(runDetailSource, "function GenerationOutputGrid", "export function LoraTrainingRunDetailPage");
  const detailPageSource = runDetailSource.slice(runDetailSource.indexOf("export function LoraTrainingRunDetailPage"));

  assert.match(outputGridSource, /ImageThumbMedium/, "generation output cards should render shared thumbnails");
  assert.match(outputGridSource, /onOpen=\{\(\) => onActiveResultChange\(result\.id\)\}/, "generation output thumbnails should open the lightbox");
  assert.doesNotMatch(outputGridSource, /<ImagePreviewFrame image=\{result\.image\}/, "generation output cards should not embed full preview frames");
  assert.match(detailPageSource, /ImageThumbMedium[\s\S]*image=\{sample\.image\}/, "frozen dataset samples should render shared thumbnails");
  assert.doesNotMatch(detailPageSource, /<ImagePreviewFrame image=\{sample\.image\}/, "frozen dataset sample cards should not embed full preview frames");
  assert.match(detailPageSource, /ImagePreviewLarge/, "run detail image thumbnails should retain the shared lightbox");
});
