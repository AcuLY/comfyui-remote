import { Clock3 } from "lucide-react";

import type { DemoCurrentRun } from "./types";
import s from "./current-running-progress-card.runs.module.css";

export function CurrentRunningProgressCard({ runs }: { runs: DemoCurrentRun[] }) {
  if (runs.length === 0) return null;

  return (
    <section className={s.currentRunSurface} aria-label="当前运行中">
      <div className={s.currentRunHeader}>
        <div>
          <span>
            <Clock3 className={s.icon} />
            当前运行中
          </span>
          <strong>{runs.length} 个任务</strong>
        </div>
      </div>
      <div className={s.currentRunList}>
        {runs.map(({ run, progress }) => {
          const percent = Math.round(Math.max(0, Math.min(100, progress.percent)));
          const gradientSize = `${10000 / Math.max(percent, 1)}% 100%`;
          const statusText =
            progress.percent >= 100
              ? "采样完成，正在收尾"
              : `采样 ${progress.currentStep}/${progress.totalSteps}`;
          const metaItems = [
            progress.elapsed ? `已用 ${progress.elapsed}` : null,
            progress.remaining ? `剩余 ${progress.remaining}` : null,
            progress.rate,
            progress.stage > 1 ? `阶段 ${progress.stage}` : null,
          ].filter((item): item is string => Boolean(item));

          return (
            <article className={s.currentRunItem} key={run.id}>
              <div className={s.currentRunTitleBlock}>
                <strong>{run.projectTitle} · {run.sectionName}</strong>
                <span>run {run.runIndex} · 创建于 {run.createdAt}</span>
              </div>
              <div className={s.currentRunProgressBlock}>
                <div className={s.currentRunProgressTop}>
                  <span>{statusText}</span>
                  <strong>{percent}%</strong>
                </div>
                <div
                  className={s.currentRunProgressTrack}
                  role="progressbar"
                  aria-label="ComfyUI 采样进度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span
                    className={s.currentRunProgressFill}
                    style={{ width: `${percent}%`, backgroundSize: gradientSize }}
                  />
                </div>
                <div className={s.currentRunMeta}>
                  {metaItems.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
