"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";

import { Checkbox } from "@/components/design-demo-ui/primitives/checkbox";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { FloatingSelect } from "@/components/design-demo-ui/primitives/floating-select";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";

import type { PrototypeModule, PrototypeTask } from "../../data";
import { isTerminalTask, taskKindLabel, taskUnit, TASK_STATUS_LABELS } from "./use-tasks";
import type { PrototypeTasksState } from "./use-tasks";
import { statusBadgeFor, TaskActions } from "./task-parts";
import { TaskConfirmSheet, type TaskConfirm } from "./confirm-sheet";
import { TaskDetailSheet } from "./task-detail-sheet";
import s from "./tasks.module.css";

const ACTIVE_STATUSES = ["running", "submitted", "queued"];

function matchesTask(task: PrototypeTask, filters: { query: string; project: string; kind: string; period: string; module: PrototypeModule }) {
  return (
    task.module === filters.module
    && (!filters.project || task.project === filters.project)
    && (!filters.query || `${task.name} ${task.project} ${task.id} ${task.section}`.toLowerCase().includes(filters.query.toLowerCase()))
    && (!filters.kind || task.kind === filters.kind)
    && (!filters.period || Number(task.time.split(":")[0]) >= 14)
  );
}

export function TasksPage({
  module,
  state,
}: {
  module: PrototypeModule;
  state: PrototypeTasksState;
}) {
  const { pushToast } = useDemoFeedback();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");
  const [kind, setKind] = useState("");
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [order, setOrder] = useState("time");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<TaskConfirm | null>(null);

  const filters = { query, project, kind, period, module };
  const isTraining = module === "training";

  const currentTask = state.tasks.find((task) => task.status === "running") ?? null;

  const queue = state.tasks.filter(
    (task) => matchesTask(task, filters) && ["submitted", "queued"].includes(task.status),
  );

  const historyRows = state.tasks.filter(
    (task) => matchesTask(task, filters) && !ACTIVE_STATUSES.includes(task.status) && (!status || task.status === status),
  );
  if (order === "project") {
    historyRows.sort((a, b) => a.project.localeCompare(b.project, "zh-CN"));
  }

  const projectOptions = [...new Set(state.tasks.filter((task) => task.module === module).map((task) => task.project))];

  const detailTask = detailId ? state.tasks.find((task) => task.id === detailId) ?? null : null;

  function clearSelection() {
    setSelected(new Set());
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function confirmPause(task: PrototypeTask) {
    setConfirm({
      title: "暂停这次生成？",
      text: "当前生成将停止。恢复后会从头执行本次任务。",
      label: "暂停任务",
      action: () => {
        state.pauseTask(task.id);
        clearSelection();
        pushToast({ tone: "info", title: `${task.name}：${TASK_STATUS_LABELS.paused}` });
      },
    });
  }

  function confirmCancel(task: PrototypeTask) {
    setConfirm({
      title: "取消任务？",
      text: `“${task.name}”将停止执行，已有结果仍可查看。`,
      label: "取消任务",
      action: () => {
        state.cancelTask(task.id);
        clearSelection();
        pushToast({ tone: "info", title: `${task.name}：${TASK_STATUS_LABELS.cancelled}` });
      },
    });
  }

  function resumeOrRetry(task: PrototypeTask) {
    const error = state.resumeOrRetryTask(task);
    clearSelection();
    if (error === "training-run-blocked") {
      pushToast({ tone: "warning", title: "已有等待中的训练运行，请先取消它再重新训练。" });
      return;
    }
    pushToast({ tone: "success", title: `${task.name}：${TASK_STATUS_LABELS.queued}` });
  }

  function requestDelete(ids: string[]) {
    const targets = ids
      .map((id) => state.tasks.find((task) => task.id === id))
      .filter((task): task is PrototypeTask => Boolean(task && task.module === "generation" && isTerminalTask(task)));
    if (targets.length !== ids.length || targets.length === 0) {
      clearSelection();
      pushToast({ tone: "error", title: "仅可删除生产模块的终态任务，请重新选择。" });
      return;
    }
    setConfirm({
      title: `删除 ${targets.length} 项任务？`,
      text: `${targets.map((task) => task.name).join("、")}。任务记录、输入快照与其 ${targets.reduce((sum, task) => sum + task.output, 0)} 张结果图片将被永久删除，无法恢复。`,
      label: "永久删除",
      action: () => {
        state.removeTasks(targets.map((task) => task.id));
        clearSelection();
        setDetailId(null);
        pushToast({ tone: "success", title: `已删除 ${targets.length} 项任务` });
      },
    });
  }

  return (
    <div className={s.page}>
      {currentTask ? (
        <Panel title="当前执行" actions={statusBadgeFor(currentTask)}>
          <div className={s.currentMain}>
            <div className={s.currentIdentity}>
              <button type="button" className={s.taskLink} onClick={() => setDetailId(currentTask.id)}>
                {currentTask.name}
              </button>
              <div className={s.taskMeta}>
                <span>{taskKindLabel(currentTask)}</span>
                <span>
                  {currentTask.project} / {currentTask.section}
                </span>
                <span className={s.mono}>{currentTask.id}</span>
              </div>
            </div>
            <div className={s.currentActions}>
              <TaskActions
                task={currentTask}
                onPause={() => confirmPause(currentTask)}
                onCancel={() => confirmCancel(currentTask)}
                onResumeOrRetry={() => resumeOrRetry(currentTask)}
              />
            </div>
          </div>
          <div className={s.currentFooter}>
            <div className={s.currentProgress}>
              <div className={s.progressLabel}>
                <span>{currentTask.stage ?? "执行中"}</span>
                <span className={s.mono}>{currentTask.progress}%</span>
              </div>
              <div
                className={s.progressTrack}
                role="progressbar"
                aria-label="任务进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={currentTask.progress}
              >
                <div className={s.progressFill} style={{ width: `${currentTask.progress}%` }} />
              </div>
            </div>
            <div className={s.executionNumber}>
              <span className={s.muted}>已生成</span>
              <strong className={s.mono}>
                {currentTask.output}
                <span className={s.muted}> / {currentTask.count}</span>
              </strong>
            </div>
            <div className={s.executionNumber}>
              <span className={s.muted}>已用时</span>
              <strong className={s.mono}>{currentTask.duration}</strong>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel title="当前执行">
          <p className={s.emptyLine}>当前无任务执行，等待队列中的任务将在执行资源可用后开始。</p>
        </Panel>
      )}

      <div className={s.toolbar}>
        <div className={s.searchField}>
          <Field
            label="搜索任务名称或编号"
            placeholder="任务名称、编号、项目或小节"
            value={query}
            onChange={(value) => {
              setQuery(value);
              clearSelection();
            }}
          />
        </div>
        <div className={s.toolbarFilters}>
          <FloatingSelect
            ariaLabel="项目筛选"
            label="项目"
            value={project}
            onChange={setProject}
            options={[{ value: "", label: "全部项目" }, ...projectOptions.map((name) => ({ value: name, label: name }))]}
          />
          {isTraining ? (
            <FloatingSelect
              ariaLabel="任务类型"
              label="类型"
              value={kind}
              onChange={setKind}
              options={[
                { value: "", label: "全部类型" },
                { value: "material", label: "素材生成" },
                { value: "lora", label: "LoRA 训练" },
              ]}
            />
          ) : null}
          <FloatingSelect
            ariaLabel="创建时间"
            label="时间"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "", label: "今天" },
              { value: "recent", label: "14:00 以后" },
            ]}
          />
        </div>
      </div>

      <Panel title={`等待队列 ${queue.length}`}>
        {queue.length ? (
          <div className={s.queueList}>
            {queue.map((task, index) => (
              <div className={s.queueRow} key={task.id}>
                <span className={`${s.queueOrder} ${s.mono}`}>{String(index + 1).padStart(2, "0")}</span>
                <div className={s.queueInfo}>
                  <button type="button" className={s.taskLink} onClick={() => setDetailId(task.id)}>
                    {task.name}
                  </button>
                  <div className={s.taskMeta}>
                    <span>{task.project}</span>
                    <span>
                      {task.count} {taskUnit(task)}
                    </span>
                    <span>
                      {task.status === "submitted"
                        ? "已送入 ComfyUI 队列"
                        : task.kind === "lora"
                          ? "等待图片任务释放执行资源"
                          : "等待执行资源"}
                    </span>
                  </div>
                </div>
                {statusBadgeFor(task)}
                <div className={s.queueActions}>
                  <TaskActions task={task} onCancel={() => confirmCancel(task)} onResumeOrRetry={() => resumeOrRetry(task)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={s.emptyLine}>没有等待中的任务</p>
        )}
      </Panel>

      <Panel
        title={`任务记录 ${historyRows.length}`}
        actions={
          <div className={s.historyFilters}>
            <FloatingSelect
              ariaLabel="记录状态"
              label="状态"
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: "全部状态" },
                ...["done", "failed", ...(isTraining ? [] : ["paused"]), "cancelled"].map((value) => ({
                  value,
                  label: TASK_STATUS_LABELS[value as keyof typeof TASK_STATUS_LABELS],
                })),
              ]}
            />
            <FloatingSelect
              ariaLabel="记录排序"
              label="排序"
              value={order}
              onChange={setOrder}
              options={[
                { value: "time", label: "时间倒序" },
                { value: "project", label: "按项目排列" },
              ]}
            />
          </div>
        }
      >
        {selected.size ? (
          <div className={s.selectionBar}>
            <span>已选择 {selected.size} 项</span>
            <Button onClick={clearSelection} size="sm" tone="subtle">
              取消选择
            </Button>
            <Button icon={Trash2} onClick={() => requestDelete([...selected])} size="sm" tone="danger">
              删除所选
            </Button>
          </div>
        ) : null}
        {historyRows.length ? (
          <div className={s.historyRows}>
            <div className={`${s.historyRow} ${s.historyHead}`}>
              <span className={s.rowHead}>任务</span>
              <span className={s.rowHead}>状态</span>
              <span className={`${s.rowHead} ${s.secondaryCell}`}>{isTraining ? "类型" : "生成结果"}</span>
              <span className={`${s.rowHead} ${s.secondaryCell}`}>耗时</span>
              <span className={`${s.rowHead} ${s.secondaryCell}`}>创建时间</span>
              <span className={s.rowHeadActions}>操作</span>
            </div>
            {historyRows.map((task) => (
              <div className={s.historyRow} key={task.id}>
                {!isTraining ? (
                  <Checkbox
                    checked={selected.has(task.id)}
                    className={s.rowCheck}
                    disabled={!isTerminalTask(task)}
                    label={`选择 ${task.name}`}
                    onCheckedChange={(checked) => toggleSelect(task.id, checked)}
                    variant="compact"
                  />
                ) : null}
                <div className={s.rowMain}>
                  <button type="button" className={s.taskLink} onClick={() => setDetailId(task.id)}>
                    {task.name}
                  </button>
                  <div className={s.rowSub}>
                    <span>{task.project}</span>
                    <span className={s.mono}>{task.id}</span>
                  </div>
                </div>
                <div className={s.rowCell}>{statusBadgeFor(task)}</div>
                <div className={`${s.rowCell} ${s.secondaryCell}`}>
                  {!isTraining ? (
                    <>
                      <span className={s.mono}>
                        {task.output} / {task.count}
                      </span>{" "}
                      张
                    </>
                  ) : (
                    taskKindLabel(task)
                  )}
                </div>
                <div className={`${s.rowCell} ${s.secondaryCell} ${s.mono}`}>{task.duration}</div>
                <div className={`${s.rowCell} ${s.secondaryCell} ${s.mono}`}>今天 {task.time}</div>
                <div className={s.rowActions}>
                  <TaskActions
                    task={task}
                    onPause={() => confirmPause(task)}
                    onCancel={() => confirmCancel(task)}
                    onResumeOrRetry={() => resumeOrRetry(task)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={s.emptyBlock}>
            <p className={s.muted}>没有匹配的任务，试试其他名称，或清除筛选条件。</p>
            <Button
              icon={X}
              tone="subtle"
              onClick={() => {
                setQuery("");
                setProject("");
                setKind("");
                setPeriod("");
                setStatus("");
                clearSelection();
              }}
            >
              清除筛选
            </Button>
          </div>
        )}
      </Panel>

      <TaskDetailSheet
        task={detailTask}
        onClose={() => setDetailId(null)}
        onPause={confirmPause}
        onCancel={confirmCancel}
        onResumeOrRetry={resumeOrRetry}
        onDelete={(task) => requestDelete([task.id])}
      />
      <TaskConfirmSheet confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
