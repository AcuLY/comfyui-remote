"use client";

import { useState } from "react";
import { Check, FileText, Trash2 } from "lucide-react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { ImagePreviewLarge } from "@/components/design-demo-ui/media/image-preview-large";
import { ImageThumbMedium } from "@/components/design-demo-ui/media/image-thumb-medium";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { Checkbox } from "@/components/design-demo-ui/primitives/checkbox";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import type { LoraTrainingImageResult } from "@/features/training/types";

import { reviewStatusLabel, reviewStatusTone } from "./project-page-utils";
import s from "./training-project-pages.module.css";

export function TrainingResultGrid({
  onOpenCaptionRevisionHistory,
  onReviewStatusChange,
  onToggleSelected,
  results,
  selectedIds,
  title = "训练结果",
}: {
  onOpenCaptionRevisionHistory?: (resultId: string) => void;
  onReviewStatusChange?: (resultId: string, status: LoraTrainingImageResult["reviewStatus"]) => void;
  onToggleSelected?: (resultId: string) => void;
  results: LoraTrainingImageResult[];
  selectedIds?: Set<string>;
  title?: string;
}) {
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const activeResult = activeResultId ? results.find((result) => result.id === activeResultId) ?? null : null;
  const activeResultIndex = activeResult ? results.findIndex((result) => result.id === activeResult.id) : -1;

  function moveActiveResult(offset: number) {
    if (results.length === 0) return;
    setActiveResultId((current) => {
      const currentIndex = current ? results.findIndex((result) => result.id === current) : -1;
      const nextIndex = ((currentIndex >= 0 ? currentIndex : 0) + offset + results.length) % results.length;
      return results[nextIndex]?.id ?? null;
    });
  }

  if (results.length === 0) return <div className={s.emptyInline}>没有训练结果图片</div>;

  return (
    <>
      <div className={s.trainingResultGrid}>
        {results.map((result) => {
          const selected = selectedIds?.has(result.id) ?? false;

          return (
            <article
              className={cx(s.trainingResultCard, selected && s.trainingResultCardSelected)}
              data-review-status={result.reviewStatus}
              key={result.id}
            >
              {onToggleSelected ? (
                <div className={s.trainingResultCardControls}>
                  <Checkbox
                    checked={selected}
                    label={selected ? `取消选择训练结果：${result.sourceLabel}` : `选择训练结果：${result.sourceLabel}`}
                    onCheckedChange={() => onToggleSelected(result.id)}
                    stopPropagation
                    variant="compact"
                  />
                  <StatusBadge status={reviewStatusTone(result.reviewStatus)} label={reviewStatusLabel(result.reviewStatus)} />
                </div>
              ) : null}
              <ImageThumbMedium
                image={result.image}
                onOpen={() => setActiveResultId(result.id)}
                showStatus={false}
              />
              <span className={s.trainingResultMeta}>
                <strong>{result.sourceLabel}</strong>
                {onToggleSelected ? null : <StatusBadge status={reviewStatusTone(result.reviewStatus)} label={reviewStatusLabel(result.reviewStatus)} />}
              </span>
              <p className={s.trainingResultCaption}>{result.caption}</p>
              {onOpenCaptionRevisionHistory ? (
                <div className={s.trainingResultCaptionActions}>
                  <Button
                    size="sm"
                    tone="subtle"
                    icon={FileText}
                    onClick={() => onOpenCaptionRevisionHistory(result.id)}
                  >
                    查看说明文本历史
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {activeResult ? (
        <ImagePreviewLarge
          image={activeResult.image}
          title={`${title} / ${activeResult.sectionTitle}`}
          meta={activeResult.caption}
          onClose={() => setActiveResultId(null)}
          onNext={activeResultIndex >= 0 ? () => moveActiveResult(1) : undefined}
          onPrevious={activeResultIndex >= 0 ? () => moveActiveResult(-1) : undefined}
          actions={(
            <>
              <Button icon={Check} ariaLabel={`保留训练结果：${activeResult.sourceLabel}`} onClick={() => onReviewStatusChange?.(activeResult.id, "kept")}>保留</Button>
              <Button tone="danger" icon={Trash2} ariaLabel={`拒绝训练结果：${activeResult.sourceLabel}`} onClick={() => onReviewStatusChange?.(activeResult.id, "rejected")}>拒绝</Button>
            </>
          )}
        />
      ) : null}
    </>
  );
}
