"use client";

import { Check, ImagePlus, Trash2 } from "lucide-react";

import { ImagePreviewLarge } from "@/components/design-demo-ui/media/image-preview-large";
import { ImageThumbMedium } from "@/components/design-demo-ui/media/image-thumb-medium";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import type { LoraTrainingImageResult, LoraTrainingReviewStatus } from "@/features/training/types";
import s from "./training-run-detail-page.module.css";

function reviewStatusLabel(status: LoraTrainingReviewStatus) {
  if (status === "kept") return "已保留";
  if (status === "rejected") return "已拒绝";
  return "待审核";
}

function reviewStatusTone(status: LoraTrainingReviewStatus) {
  if (status === "kept") return "ready";
  if (status === "rejected") return "failed";
  return "pending";
}

export function GenerationOutputGrid({
  activeResultId,
  appliedResultIds,
  onActiveResultChange,
  onApplyReference,
  onReviewStatusChange,
  pendingApplyResultIds,
  results,
}: {
  activeResultId: string | null;
  appliedResultIds: Set<string>;
  onActiveResultChange: (resultId: string | null) => void;
  onApplyReference: (resultId: string) => void;
  onReviewStatusChange: (resultId: string, status: LoraTrainingReviewStatus) => void;
  pendingApplyResultIds: Set<string>;
  results: LoraTrainingImageResult[];
}) {
  const activeResult = activeResultId ? results.find((result) => result.id === activeResultId) ?? null : null;
  const activeResultIndex = activeResult ? results.findIndex((result) => result.id === activeResult.id) : -1;

  function moveActiveResult(offset: number) {
    if (!results.length) return;
    const nextIndex = ((activeResultIndex >= 0 ? activeResultIndex : 0) + offset + results.length) % results.length;
    onActiveResultChange(results[nextIndex]?.id ?? null);
  }

  if (!results.length) return <div className={s.empty}>当前任务尚无图片输出</div>;

  return (
    <>
      <div className={s.generationOutputGrid}>
        {results.map((result) => (
          <article className={s.generationOutputCard} data-review-status={result.reviewStatus} key={result.id}>
            <ImageThumbMedium
              image={result.image}
              onOpen={() => onActiveResultChange(result.id)}
              showStatus={false}
            />
            <span className={s.generationOutputMeta}>
              <strong>{result.sourceLabel}</strong>
              <StatusBadge status={reviewStatusTone(result.reviewStatus)} label={reviewStatusLabel(result.reviewStatus)} />
              {appliedResultIds.has(result.id) ? <StatusBadge status="ready" label="已加入资料图" /> : null}
            </span>
            <p className={s.generationOutputCaption}>{result.caption}</p>
          </article>
        ))}
      </div>
      {activeResult ? (
        <ImagePreviewLarge
          image={activeResult.image}
          title={`生成输出 / ${activeResult.sectionTitle}`}
          meta={activeResult.caption}
          onClose={() => onActiveResultChange(null)}
          onNext={activeResultIndex >= 0 ? () => moveActiveResult(1) : undefined}
          onPrevious={activeResultIndex >= 0 ? () => moveActiveResult(-1) : undefined}
          actions={(
            <>
              <Button
                icon={ImagePlus}
                pending={pendingApplyResultIds.has(activeResult.id)}
                disabled={appliedResultIds.has(activeResult.id)}
                ariaLabel={`加入资料图：${activeResult.sourceLabel}`}
                onClick={() => onApplyReference(activeResult.id)}
              >
                {appliedResultIds.has(activeResult.id) ? "已加入资料图" : "加入资料图"}
              </Button>
              <Button icon={Check} ariaLabel={`保留生成输出：${activeResult.sourceLabel}`} onClick={() => onReviewStatusChange(activeResult.id, "kept")}>
                保留
              </Button>
              <Button tone="danger" icon={Trash2} ariaLabel={`拒绝生成输出：${activeResult.sourceLabel}`} onClick={() => onReviewStatusChange(activeResult.id, "rejected")}>
                拒绝
              </Button>
            </>
          )}
        />
      ) : null}
    </>
  );
}
