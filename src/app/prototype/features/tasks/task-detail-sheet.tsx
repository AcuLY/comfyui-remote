"use client";

import { Copy, Trash2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";

import type { PrototypeTask } from "../../data";
import { taskKindLabel, taskUnit } from "./use-tasks";
import { statusBadgeFor, TaskActions } from "./task-parts";
import s from "./tasks.module.css";

export function TaskDetailSheet({
  task,
  onClose,
  onPause,
  onCancel,
  onResumeOrRetry,
  onDelete,
}: {
  task: PrototypeTask | null;
  onClose: () => void;
  onPause: (task: PrototypeTask) => void;
  onCancel: (task: PrototypeTask) => void;
  onResumeOrRetry: (task: PrototypeTask) => void;
  onDelete: (task: PrototypeTask) => void;
}) {
  const { pushToast } = useDemoFeedback();

  if (!task) return null;

  function handleCopyError() {
    if (!task?.error) return;
    void navigator.clipboard
      .writeText(task.error)
      .then(() => pushToast({ tone: "success", title: "错误信息已复制" }))
      .catch(() => pushToast({ tone: "error", title: "复制失败", detail: "请选择错误文本手动复制" }));
  }

  return (
    <Sheet
      open={Boolean(task)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className={s.detailSheet}>
        <SheetHeader className={s.detailHeader}>
          <div className={s.detailMeta}>
            <span className={s.mono}>{task.id}</span>
            <span className={s.muted}>{taskKindLabel(task)}</span>
          </div>
          <SheetTitle>{task.name}</SheetTitle>
          <SheetDescription>
            {task.project} / {task.section}
          </SheetDescription>
        </SheetHeader>
        <div className={s.detailBody}>
          <div className={s.detailStatusRow}>
            {statusBadgeFor(task)}
            <span className={s.muted}>今天 {task.time}</span>
          </div>
          {task.status === "running" && task.stage ? (
            <div className={s.detailProgress}>
              <div className={s.progressLabel}>
                <span>{task.stage}</span>
                <span className={s.mono}>{task.progress}%</span>
              </div>
              <div
                className={s.progressTrack}
                role="progressbar"
                aria-label="任务进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={task.progress}
              >
                <div className={s.progressFill} style={{ width: `${task.progress}%` }} />
              </div>
            </div>
          ) : null}
          {task.error ? (
            <div className={s.noticeError} role="alert">
              <strong>失败原因</strong>
              <p>{task.error}</p>
              <Button icon={Copy} onClick={handleCopyError} size="sm" tone="subtle">
                复制错误
              </Button>
            </div>
          ) : null}
          {task.status === "paused" ? <div className={s.notice}>恢复后将从头执行本次任务。</div> : null}
          <section className={s.detailGroup}>
            <h3>执行记录</h3>
            <dl className={s.detailGrid}>
              <div>
                <dt>执行尝试</dt>
                <dd>第 {task.attempt ?? 1} 次</dd>
              </div>
              <div>
                <dt>总耗时</dt>
                <dd className={s.mono}>{task.duration}</dd>
              </div>
            </dl>
            <ol className={s.timeline}>
              <li>
                <span className={s.mono}>{task.time}</span>
                <span>任务已创建</span>
              </li>
            </ol>
          </section>
          <section className={s.detailGroup}>
            <h3>输入配置</h3>
            <dl className={s.detailGrid}>
              <div>
                <dt>基础模型</dt>
                <dd>{task.model}</dd>
              </div>
              <div>
                <dt>输出尺寸</dt>
                <dd className={s.mono}>{task.size}</dd>
              </div>
              <div>
                <dt>{task.kind === "lora" ? "训练步数" : "生成数量"}</dt>
                <dd>
                  {task.count} {taskUnit(task)}
                </dd>
              </div>
              <div>
                <dt>{task.kind === "lora" ? "学习率" : "采样器"}</dt>
                <dd className={s.mono}>{task.kind === "lora" ? "0.0001" : "DPM++ 2M · Karras"}</dd>
              </div>
              {task.kind === "lora" ? (
                <>
                  <div>
                    <dt>训练样本</dt>
                    <dd>24 组图片与 Caption</dd>
                  </div>
                  <div>
                    <dt>Rank / Alpha</dt>
                    <dd className={s.mono}>32 / 16</dd>
                  </div>
                </>
              ) : (
                <div className={s.detailGridSpan}>
                  <dt>提示词</dt>
                  <dd className={s.prompt}>{task.name}, soft natural light, detailed composition, cinematic colors · 采样 30 步 · CFG 7.0 · Seed 284197632</dd>
                </div>
              )}
            </dl>
          </section>
          <section className={s.detailGroup}>
            <h3>{task.kind === "lora" ? "模型产物" : "生成结果"}</h3>
            {task.output ? (
              <ul className={s.resultList}>
                {Array.from({ length: task.output }, (_, index) => (
                  <li key={index}>
                    <span className={s.mono}>
                      {task.kind === "lora"
                        ? `${task.project}-epoch-${(index + 1) * 4}.safetensors`
                        : `${task.id}-${String(index + 1).padStart(3, "0")}.png`}
                    </span>
                    <span className={s.muted}>{task.kind === "lora" ? "218 MB" : task.size}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.muted}>尚无输出结果</p>
            )}
          </section>
        </div>
        <div className={s.detailFooter}>
          <TaskActions
            task={task}
            onCancel={() => onCancel(task)}
            onPause={() => onPause(task)}
            onResumeOrRetry={() => onResumeOrRetry(task)}
          />
          {task.module === "generation" && ["done", "failed", "cancelled"].includes(task.status) ? (
            <Button icon={Trash2} tone="danger" onClick={() => onDelete(task)}>
              删除任务
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
