"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { CircleAlert, Copy, Play, Trash2, X } from "lucide-react";

import { useRouteHref } from "@/components/design-demo-routing";
import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { ImageListSmall } from "@/components/design-demo-ui/media/image-list-small";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import type { LoraTrainingProject, LoraTrainingRun } from "@/features/training/types";

import { projectRunStatusLabel, runPreviewImages } from "./project-page-utils";
import s from "./training-project-pages.module.css";

const PROJECT_RUN_ERROR_CLAMP_LINES = 3;

function ProjectRunFailureBlock({ message }: { message: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const measureOverflow = useCallback((node: HTMLParagraphElement | null) => {
    textRef.current = node;
    if (!node) return;
    requestAnimationFrame(() => {
      setOverflows(node.scrollHeight > node.clientHeight + 2);
    });
  }, []);

  return (
    <div className={s.projectRunFailureBlock} role="status">
      <div className={s.projectRunFailureHeader}>
        <CircleAlert aria-hidden="true" />
        <span>失败原因</span>
        {overflows && !expanded ? (
          <button
            type="button"
            className={s.projectRunFailureToggle}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(true);
            }}
          >
            展开
          </button>
        ) : null}
        {expanded ? (
          <button
            type="button"
            className={s.projectRunFailureToggle}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(false);
            }}
          >
            收起
          </button>
        ) : null}
      </div>
      <p
        ref={measureOverflow}
        className={cx(s.projectRunFailureText, !expanded && s.projectRunFailureTextClamped)}
        style={{ ["--error-clamp-lines" as string]: PROJECT_RUN_ERROR_CLAMP_LINES }}
      >
        {message}
      </p>
    </div>
  );
}

async function copyProjectRunMessage(message: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      return;
    }
  } catch {
    // Fall back to the selection API below when clipboard permissions are unavailable.
  }

  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = message;
  textarea.setAttribute("readonly", "");
  textarea.className = s.clipboardTextarea;
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function RunRows({
  cancelledRunIds = new Set<string>(),
  isCancellingRuns = false,
  onDeleteRun,
  isDeletingRuns = false,
  onCancelRun,
  onRetryRun,
  project,
  retriedRunIds = new Set<string>(),
  runs,
}: {
  cancelledRunIds?: Set<string>;
  isCancellingRuns?: boolean;
  onDeleteRun?: (runId: string) => void;
  isDeletingRuns?: boolean;
  onCancelRun?: (runId: string) => void;
  onRetryRun?: (runId: string) => void;
  project: LoraTrainingProject;
  retriedRunIds?: Set<string>;
  runs: LoraTrainingRun[];
}) {
  const hrefForRoute = useRouteHref();
  if (runs.length === 0) return <div className={s.emptyInline}>没有任务记录</div>;

  return (
    <div className={s.projectRunRowsSurface}>
      <div className={s.projectRunRows}>
        {runs.map((run) => {
          const type = run.kind === "generation" ? "generation" : "training";
          const previewImages = runPreviewImages(run, project);
          const retried = retriedRunIds.has(run.id);
          const cancelled = cancelledRunIds.has(run.id);
          const canCancel = run.status === "queued" || run.status === "running";
          const failed = (run.status === "failed" || cancelled) && !retried;
          const failureMessage = run.errorMessage ?? "任务失败，请打开详情查看日志。";
          return (
            <article className={cx(s.projectRunRow, failed && s.projectRunRowFailed)} key={run.id}>
              <Link className={s.projectRunMain} href={hrefForRoute(`/training/runs/${type}/${run.id}`)}>
                <span className={s.projectRunText}>
                  <strong>{run.title}</strong>
                  <span>{run.summary} · {cancelled ? "已取消" : run.timestamp}</span>
                  {run.outputLabel && !cancelled ? <em>{run.outputLabel}</em> : null}
                  {run.waitReason ? <em>{run.waitReason}</em> : null}
                  {retried ? <em>已排队重试</em> : null}
                </span>
              </Link>
              {previewImages.length > 0 ? (
                <ImageListSmall
                  className={s.projectRunThumbs}
                  images={previewImages}
                  limit={previewImages.length}
                  showCounts={run.kind === "generation"}
                />
              ) : null}
              <span className={s.projectRunStatus}>
                <StatusBadge
                  status={retried ? "pending" : cancelled ? "failed" : run.status === "completed" ? "done" : run.status}
                  label={retried ? "已排队重试" : cancelled ? "已取消" : projectRunStatusLabel(run.status)}
                />
              </span>
              {failed ? (
                <div className={s.projectRunSecondary}>
                  {cancelled ? (
                    <div className={s.projectRunFailureToolbar}>
                      <StatusBadge status="failed" label="已取消" />
                    </div>
                  ) : (
                    <>
                      <ProjectRunFailureBlock message={failureMessage} />
                      <div className={s.projectRunFailureToolbar}>
                        <Button size="sm" tone="subtle" icon={Copy} ariaLabel={`复制任务报错：${run.title}`} onClick={() => copyProjectRunMessage(failureMessage)} feedback={{ title: "报错已复制", detail: failureMessage }}>复制</Button>
                        <Button size="sm" tone="subtle" icon={Play} ariaLabel={`重试任务：${run.title}`} onClick={() => onRetryRun?.(run.id)}>重试</Button>
                        <Button size="sm" tone="danger" icon={Trash2} pending={isDeletingRuns} ariaLabel={`移除任务：${run.title}`} onClick={() => onDeleteRun?.(run.id)} feedback={{ tone: "warning", title: "任务已从项目列表移除", detail: run.title }}>移除</Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <span className={s.projectRunActions}>
                  {canCancel ? (
                    <Button
                      tone="danger"
                      icon={X}
                      pending={isCancellingRuns}
                      ariaLabel={`${run.kind === "generation" ? "终止生成任务" : "取消训练任务"}：${run.title}`}
                      onClick={() => onCancelRun?.(run.id)}
                    >
                      {run.kind === "generation" ? "终止" : "取消"}
                    </Button>
                  ) : (
                    <Button tone="danger" icon={Trash2} pending={isDeletingRuns} ariaLabel={`移除任务：${run.title}`} onClick={() => onDeleteRun?.(run.id)} feedback={{ tone: "warning", title: "任务已从项目列表移除", detail: run.title }}>移除</Button>
                  )}
                </span>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
