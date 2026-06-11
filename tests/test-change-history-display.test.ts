import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangeDiffView } from "../src/components/change-diff-view";
import { SectionChangeHistory } from "../src/app/projects/[projectId]/sections/[sectionId]/section-change-history";

function renderChangeDiff(before: unknown, after: unknown) {
  return renderToStaticMarkup(createElement(ChangeDiffView, { before, after }));
}

test("change diff view renders complete long text values in expanded history", () => {
  const beforePrompt = `before ${"old prompt segment ".repeat(16)}before-tail`;
  const afterPrompt = `after ${"new prompt segment ".repeat(16)}after-tail`;

  const markup = renderChangeDiff(
    { positive: beforePrompt },
    { positive: afterPrompt },
  );

  assert.match(markup, /before-tail/);
  assert.match(markup, /after-tail/);
});

test("change diff view renders complete added member snapshots", () => {
  const markup = renderChangeDiff([], [
    {
      id: "member-1",
      presetId: "preset-alpha",
      variantId: "variant-alpha",
      subGroupId: null,
      slotCategoryId: "slot-alpha",
      sortOrder: 0,
    },
    {
      id: "member-2",
      presetId: "preset-beta",
      variantId: "variant-beta",
      subGroupId: null,
      slotCategoryId: "slot-beta",
      sortOrder: 1,
    },
  ]);

  for (const expected of [
    "member-1",
    "preset-alpha",
    "variant-alpha",
    "slot-alpha",
    "member-2",
    "preset-beta",
    "variant-beta",
    "slot-beta",
    "sortOrder",
  ]) {
    assert.match(markup, new RegExp(expected));
  }
});

test("section change history summary does not mark default entries as truncated", () => {
  const checkpointName = `checkpoint ${"very long segment ".repeat(12)}checkpoint-summary-tail`;
  const markup = renderToStaticMarkup(
    createElement(SectionChangeHistory, {
      history: {
        runParams: [
          {
            id: "history-1",
            dimension: "runParams",
            title: "更新运行参数",
            before: { checkpointName: "old-checkpoint" },
            after: { checkpointName },
            createdAt: "2026-06-11T00:00:00.000Z",
          },
        ],
        prompt: [],
        lora: [],
      },
    }),
  );

  assert.match(markup, /checkpoint-summary-tail/);
  assert.doesNotMatch(markup, /truncate/);
});

test("change history source files do not use single-line clipping for history text", () => {
  const files = [
    "src/app/assets/presets/change-history-panel.tsx",
    "src/app/projects/[projectId]/sections/[sectionId]/section-change-history.tsx",
    "src/app/design-demos/features/projects/editor/history-panel.editor.module.css",
    "src/app/design-demos/features/projects/editor/editor-lora-history.module.css",
    "src/app/design-demos/features/presets/preset-edit-page.library.module.css",
    "src/app/design-demos/features/presets/group-page.library.module.css",
    "src/app/design-demos/features/templates/template-section-page.library.module.css",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /historySummary\(entry\)[^]*?className="[^"]*truncate/);
    assert.doesNotMatch(source, /beforeText\.slice\(0,\s*80\)/);
    assert.doesNotMatch(source, /afterText\.slice\(0,\s*80\)/);
    assert.doesNotMatch(source, /\.historyDiffRow\s+(?:strong|span)\s*\{[^}]*white-space:\s*nowrap/);
    assert.doesNotMatch(source, /\.historyDiffRow\s+(?:strong|span)\s*\{[^}]*text-overflow:\s*ellipsis/);
    assert.doesNotMatch(source, /\.historyDiffRow\s+(?:strong|span)\s*\{[^}]*overflow:\s*hidden/);
    assert.doesNotMatch(source, /\.sectionTabBody\s*\{[^}]*overflow:\s*clip/);
    assert.doesNotMatch(source, /\.diffLine\s*\{[^}]*flex-wrap:\s*nowrap/);
  }
});
