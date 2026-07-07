"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { SegmentedControl } from "@/components/design-demo-ui/primitives/segmented-control";
import { SelectionBatchBar } from "@/components/design-demo-ui/patterns";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingImageResult } from "@/features/training/types";

import {
  PROFILE_REVISION_REASON_LABELS,
  findProject,
  formatProfileRevisionTime,
  isProductionTrainingPath,
  isTrainingTextRevisionItem,
  reviewResultToastTitle,
  toTrainingImageReviewApiStatus,
  type TrainingTextRevisionItem,
} from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { TrainingResultGrid } from "./training-result-grid";
import s from "./training-project-pages.module.css";

const RESULT_FILTER_ITEMS = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待审" },
  { value: "kept", label: "保留" },
  { value: "rejected", label: "拒绝" },
] as const;

type TrainingResultFilter = (typeof RESULT_FILTER_ITEMS)[number]["value"];

export function LoraTrainingProjectResultsPage({ data, projectId }: { data: TrainingAppData; projectId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const project = findProject(data, projectId);
  const [resultInteractionState, setResultInteractionState] = useState(() => ({
    filter: "all" as TrainingResultFilter,
    projectId: project?.id ?? null,
    selectedResultIds: new Set<string>(),
  }));
  const [resultState, setLocalResults] = useState(() => ({
    projectId: project?.id ?? null,
    results: project?.resultPool ?? [],
  }));
  const [captionRevisionResultId, setCaptionRevisionResultId] = useState<string | null>(null);
  const [captionRevisionState, setCaptionRevisionState] = useState<{
    projectId: string | null;
    resultId: string | null;
    revisions: TrainingTextRevisionItem[];
  }>(() => ({
    projectId: project?.id ?? null,
    resultId: null,
    revisions: [],
  }));
  const [isReviewingResults, setIsReviewingResults] = useState(false);
  const [isLoadingCaptionRevisions, setIsLoadingCaptionRevisions] = useState(false);
  const [restoringCaptionRevisionId, setRestoringCaptionRevisionId] = useState<string | null>(null);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  const localResults = resultState.projectId === project?.id ? resultState.results : project?.resultPool ?? [];
  if (!project) return <EmptyPage title="没有训练结果池数据" />;
  const activeProject = project;
  const resultInteraction = resultInteractionState.projectId === activeProject.id ? resultInteractionState : {
    filter: "all" as TrainingResultFilter,
    projectId: activeProject.id,
    selectedResultIds: new Set<string>(),
  };
  const filter = resultInteraction.filter;
  const selectedResultIds = resultInteraction.selectedResultIds;
  const results = filter === "all" ? localResults : localResults.filter((result) => result.reviewStatus === filter);
  const visibleResultIds = new Set(results.map((result) => result.id));
  const selectedVisibleResultIds = new Set([...selectedResultIds].filter((resultId) => visibleResultIds.has(resultId)));
  const selectedVisibleCount = selectedVisibleResultIds.size;
  const allVisibleResultsSelected = results.length > 0 && selectedVisibleCount === results.length;
  const selectedCaptionRevisionResult = captionRevisionResultId
    ? localResults.find((result) => result.id === captionRevisionResultId) ?? null
    : null;
  const visibleCaptionRevisions = captionRevisionState.projectId === activeProject.id && captionRevisionState.resultId === captionRevisionResultId
    ? captionRevisionState.revisions
    : [];

  function updateLocalResults(updater: (current: LoraTrainingImageResult[]) => LoraTrainingImageResult[]) {
    setLocalResults((current) => ({
      projectId: activeProject.id,
      results: updater(current.projectId === activeProject.id ? current.results : activeProject.resultPool),
    }));
  }

  function updateResultInteraction(updater: (current: typeof resultInteraction) => typeof resultInteraction) {
    setResultInteractionState((current) => {
      const active = current.projectId === activeProject.id ? current : {
        filter: "all" as TrainingResultFilter,
        projectId: activeProject.id,
        selectedResultIds: new Set<string>(),
      };
      return {
        ...updater(active),
        projectId: activeProject.id,
      };
    });
  }

  function updateResultSelection(updater: (current: Set<string>) => Set<string>) {
    updateResultInteraction((current) => ({
      ...current,
      selectedResultIds: updater(current.selectedResultIds),
    }));
  }

  function handleResultFilterChange(nextFilter: TrainingResultFilter) {
    updateResultInteraction((current) => ({
      ...current,
      filter: nextFilter,
    }));
  }

  function applyReviewedResults(reviewIds: Set<string>, reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    updateLocalResults((current) => current.map((result) =>
      reviewIds.has(result.id) ? { ...result, reviewStatus } : result,
    ));
    updateResultSelection((current) => new Set([...current].filter((resultId) => !reviewIds.has(resultId))));
  }

  async function persistReviewedResults(resultIds: string[], reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    if (!resultIds.length) return;

    const reviewedResults = localResults.filter((result) => resultIds.includes(result.id));
    const reviewedResultTitles = reviewedResults.map((result) => result.sourceLabel);

    if (!isProductionTrainingRoute) {
      applyReviewedResults(new Set(resultIds), reviewStatus);
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: resultIds.length === 1 ? (reviewedResultTitles[0] ?? activeProject.title) : `${resultIds.length} 张训练结果`,
      });
      return;
    }

    if (isReviewingResults) return;

    setIsReviewingResults(true);
    const completedIds = new Set<string>();
    try {
      for (const resultId of resultIds) {
        const response = await fetch(`/api/training/image-results/${resultId}/review`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reviewStatus: toTrainingImageReviewApiStatus(reviewStatus),
          }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          if (completedIds.size > 0) {
            applyReviewedResults(completedIds, reviewStatus);
          }
          pushToast({
            tone: "error",
            title: "结果审核失败",
            detail: payload?.error?.message ?? "训练结果审核请求失败",
          });
          return;
        }

        completedIds.add(resultId);
      }

      applyReviewedResults(completedIds, reviewStatus);
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: completedIds.size === 1 ? (reviewedResultTitles[0] ?? activeProject.title) : `${completedIds.size} 张训练结果`,
      });
    } catch (error) {
      if (completedIds.size > 0) {
        applyReviewedResults(completedIds, reviewStatus);
      }
      pushToast({
        tone: "error",
        title: "结果审核失败",
        detail: error instanceof Error ? error.message : "训练结果审核请求失败",
      });
    } finally {
      setIsReviewingResults(false);
    }
  }

  function handleReviewResult(resultId: string, reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    void persistReviewedResults([resultId], reviewStatus);
  }

  async function handleOpenCaptionRevisionHistory(resultId: string) {
    setCaptionRevisionResultId(resultId);

    if (!isProductionTrainingRoute) {
      setCaptionRevisionState({ projectId: activeProject.id, resultId, revisions: [] });
      pushToast({
        tone: "info",
        title: "说明文本历史",
        detail: "原型模式不会写入服务端说明文本历史。",
      });
      return;
    }

    if (isLoadingCaptionRevisions) return;

    setIsLoadingCaptionRevisions(true);
    try {
      const params = new URLSearchParams();
      params.set("entityType", "image_result");
      params.set("entityId", resultId);
      params.set("fieldName", "captionDraft");
      const response = await fetch(`/api/training/projects/${activeProject.id}/text-revisions?${params.toString()}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !Array.isArray(payload.data)) {
        pushToast({
          tone: "error",
          title: "说明文本历史加载失败",
          detail: payload?.error?.message ?? "说明文本历史请求失败",
        });
        return;
      }

      setCaptionRevisionState({
        projectId: activeProject.id,
        resultId,
        revisions: payload.data.filter(isTrainingTextRevisionItem),
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "说明文本历史加载失败",
        detail: error instanceof Error ? error.message : "说明文本历史请求失败",
      });
    } finally {
      setIsLoadingCaptionRevisions(false);
    }
  }

  async function handleRestoreCaptionRevision(revisionId: string) {
    if (!isProductionTrainingRoute || restoringCaptionRevisionId) return;

    setRestoringCaptionRevisionId(revisionId);
    try {
      const response = await fetch(`/api/training/text-revisions/${revisionId}/restore`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "恢复说明文本失败",
          detail: payload?.error?.message ?? "说明文本恢复请求失败",
        });
        return;
      }

      const restoredResultId = payload.data?.entityId;
      const restoredValue = payload.data?.textValue;
      if (typeof restoredResultId === "string" && typeof restoredValue === "string") {
        updateLocalResults((current) => current.map((result) =>
          result.id === restoredResultId ? { ...result, caption: restoredValue } : result,
        ));
      }

      pushToast({
        tone: "success",
        title: "说明文本已恢复",
        detail: selectedCaptionRevisionResult?.sourceLabel ?? activeProject.title,
      });
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "恢复说明文本失败",
        detail: error instanceof Error ? error.message : "说明文本恢复请求失败",
      });
    } finally {
      setRestoringCaptionRevisionId(null);
    }
  }

  function toggleResultSelection(resultId: string) {
    updateResultSelection((current) => {
      const next = new Set(current);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  }

  function toggleVisibleResultSelection() {
    updateResultSelection((current) => {
      if (allVisibleResultsSelected) {
        const next = new Set(current);
        results.forEach((result) => next.delete(result.id));
        return next;
      }
      return new Set([...current, ...visibleResultIds]);
    });
  }

  function handleBatchReviewResults(reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    void persistReviewedResults([...selectedVisibleResultIds], reviewStatus);
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="results"
        project={project}
        actions={<Button icon={Check} onClick={toggleVisibleResultSelection} disabled={results.length === 0}>{allVisibleResultsSelected ? "取消全选当前" : "全选当前"}</Button>}
      />
      <Panel title="结果池" subtitle="待审、已保留和已拒绝的图片都在项目级结果池审查，说明文本摘要随图片一起处理。">
        <div className={s.stack}>
          <SegmentedControl
            ariaLabel="筛选训练结果"
            role="tablist"
            items={RESULT_FILTER_ITEMS.map((item) => ({ ...item, count: item.value === "all" ? localResults.length : localResults.filter((result) => result.reviewStatus === item.value).length }))}
            value={filter}
            onChange={handleResultFilterChange}
          />
          {selectedVisibleCount > 0 ? (
            <SelectionBatchBar
              selectedCount={selectedVisibleCount}
              subject="张训练结果"
              onClear={() => updateResultSelection(() => new Set())}
              actions={(
                <>
                  <Button icon={Check} tone="primary" onClick={() => handleBatchReviewResults("kept")}>
                    批量保留
                  </Button>
                  <Button icon={Trash2} tone="danger" onClick={() => handleBatchReviewResults("rejected")}>
                    批量拒绝
                  </Button>
                </>
              )}
            />
          ) : null}
          <TrainingResultGrid
            onOpenCaptionRevisionHistory={handleOpenCaptionRevisionHistory}
            onReviewStatusChange={handleReviewResult}
            onToggleSelected={toggleResultSelection}
            results={results}
            selectedIds={selectedResultIds}
            title="结果池"
          />
        </div>
      </Panel>
      {captionRevisionResultId ? (
        <Panel
          title="说明文本历史"
          subtitle={`${selectedCaptionRevisionResult?.sourceLabel ?? "训练结果"} · 可恢复到任一 caption 版本`}
        >
          <div className={s.textRevisionPanel}>
            {isLoadingCaptionRevisions ? (
              <p className={s.bodyText}>正在读取说明文本历史...</p>
            ) : visibleCaptionRevisions.length > 0 ? (
              visibleCaptionRevisions.map((revision) => (
                <article className={s.textRevisionCard} key={revision.id}>
                  <div className={s.textRevisionMeta}>
                    <strong>{PROFILE_REVISION_REASON_LABELS[revision.reason] ?? revision.reason}</strong>
                    <span>{formatProfileRevisionTime(revision.createdAt)}</span>
                  </div>
                  <p>{revision.textValue || "空文本"}</p>
                  <Button
                    size="sm"
                    tone="subtle"
                    pending={restoringCaptionRevisionId === revision.id}
                    onClick={() => handleRestoreCaptionRevision(revision.id)}
                  >
                    恢复此版本
                  </Button>
                </article>
              ))
            ) : (
              <p className={s.bodyText}>暂无说明文本历史。批量补全、覆盖或训练流程产生快照后会显示在这里。</p>
            )}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
