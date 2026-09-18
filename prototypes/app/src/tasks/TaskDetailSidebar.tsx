import { Button } from "primereact/button";
import { ProgressBar } from "primereact/progressbar";
import { Sidebar } from "primereact/sidebar";

import { usePushToast } from "../feedback";
import type { PrototypeTask } from "../data";
import { taskKindLabel, taskUnit } from "./useTasks";
import { StatusTag, TaskActions } from "./task-parts";

export function TaskDetailSidebar({
  task,
  onHide,
  onPause,
  onCancel,
  onResumeOrRetry,
  onDelete,
}: {
  task: PrototypeTask | null;
  onHide: () => void;
  onPause: (task: PrototypeTask) => void;
  onCancel: (task: PrototypeTask) => void;
  onResumeOrRetry: (task: PrototypeTask) => void;
  onDelete: (task: PrototypeTask) => void;
}) {
  const pushToast = usePushToast();

  function handleCopyError() {
    if (!task?.error) return;
    void navigator.clipboard
      .writeText(task.error)
      .then(() => pushToast("success", "错误信息已复制"))
      .catch(() => pushToast("error", "复制失败", "请选择错误文本手动复制"));
  }

  return (
    <Sidebar
      visible={Boolean(task)}
      position="right"
      onHide={onHide}
      blockScroll
      dismissable
      showCloseIcon
      className="detail-sidebar"
      pt={{ content: { className: "detail-content" } }}
      header={<span>任务详情</span>}
    >
      {task ? (
        <>
          <div className="detail-body">
            <div className="detail-meta">
              <span className="mono">{task.id}</span>
              <span className="muted">{taskKindLabel(task)}</span>
            </div>
            <h2 className="detail-title">{task.name}</h2>
            <p className="detail-sub muted">
              {task.project} / {task.section}
            </p>
            <div className="detail-status-row">
              <StatusTag task={task} />
              <span className="muted">今天 {task.time}</span>
            </div>

            {task.status === "running" && task.stage ? (
              <div className="detail-progress">
                <div className="progress-label">
                  <span>{task.stage}</span>
                  <span className="mono">{task.progress}%</span>
                </div>
                <ProgressBar value={task.progress} showValue={false} />
              </div>
            ) : null}

            {task.error ? (
              <div className="notice-error" role="alert">
                <strong>失败原因</strong>
                <p>{task.error}</p>
                <Button size="small" outlined icon="pi pi-copy" label="复制错误" onClick={handleCopyError} />
              </div>
            ) : null}

            {task.status === "paused" ? <div className="notice">恢复后将从头执行本次任务。</div> : null}

            <section className="detail-group">
              <h3>执行记录</h3>
              <dl className="detail-grid">
                <div>
                  <dt>执行尝试</dt>
                  <dd>第 {task.attempt ?? 1} 次</dd>
                </div>
                <div>
                  <dt>总耗时</dt>
                  <dd className="mono">{task.duration}</dd>
                </div>
              </dl>
              <ol className="timeline">
                <li>
                  <span className="mono">{task.time}</span>
                  <span>任务已创建</span>
                </li>
              </ol>
            </section>

            <section className="detail-group">
              <h3>输入配置</h3>
              <dl className="detail-grid">
                <div>
                  <dt>基础模型</dt>
                  <dd>{task.model}</dd>
                </div>
                <div>
                  <dt>输出尺寸</dt>
                  <dd className="mono">{task.size}</dd>
                </div>
                <div>
                  <dt>{task.kind === "lora" ? "训练步数" : "生成数量"}</dt>
                  <dd>
                    {task.count} {taskUnit(task)}
                  </dd>
                </div>
                <div>
                  <dt>{task.kind === "lora" ? "学习率" : "采样器"}</dt>
                  <dd className="mono">{task.kind === "lora" ? "0.0001" : "DPM++ 2M · Karras"}</dd>
                </div>
                {task.kind === "lora" ? (
                  <>
                    <div>
                      <dt>训练样本</dt>
                      <dd>24 组图片与 Caption</dd>
                    </div>
                    <div>
                      <dt>Rank / Alpha</dt>
                      <dd className="mono">32 / 16</dd>
                    </div>
                  </>
                ) : (
                  <div className="detail-grid-span">
                    <dt>提示词</dt>
                    <dd className="prompt">
                      {task.name}, soft natural light, detailed composition, cinematic colors · 采样 30 步 · CFG 7.0 · Seed 284197632
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="detail-group">
              <h3>{task.kind === "lora" ? "模型产物" : "生成结果"}</h3>
              {task.output ? (
                <ul className="result-list">
                  {Array.from({ length: task.output }, (_, index) => (
                    <li key={index}>
                      <span className="mono">
                        {task.kind === "lora"
                          ? `${task.project}-epoch-${(index + 1) * 4}.safetensors`
                          : `${task.id}-${String(index + 1).padStart(3, "0")}.png`}
                      </span>
                      <span className="muted">{task.kind === "lora" ? "218 MB" : task.size}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">尚无输出结果</p>
              )}
            </section>
          </div>

          <div className="detail-footer">
            <TaskActions
              task={task}
              onCancel={() => onCancel(task)}
              onPause={() => onPause(task)}
              onResumeOrRetry={() => onResumeOrRetry(task)}
            />
            {task.module === "generation" && ["done", "failed", "cancelled"].includes(task.status) ? (
              <Button severity="danger" icon="pi pi-trash" label="删除任务" onClick={() => onDelete(task)} />
            ) : null}
          </div>
        </>
      ) : null}
    </Sidebar>
  );
}
