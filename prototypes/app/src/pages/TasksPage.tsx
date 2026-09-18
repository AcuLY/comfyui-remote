import { useState } from "react";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { confirmDialog } from "primereact/confirmdialog";
import { Dropdown } from "primereact/dropdown";
import { IconField } from "primereact/iconfield";
import { InputIcon } from "primereact/inputicon";
import { InputText } from "primereact/inputtext";
import { Panel } from "primereact/panel";
import { ProgressBar } from "primereact/progressbar";

import type { PrototypeModule, PrototypeTask } from "../data";
import { usePushToast } from "../feedback";
import { TaskDetailSidebar } from "../tasks/TaskDetailSidebar";
import { StatusTag, TaskActions } from "../tasks/task-parts";
import {
  ACTIVE_TASK_STATES,
  isTerminalTask,
  TASK_STATUS_LABELS,
  taskKindLabel,
  taskUnit,
} from "../tasks/useTasks";
import type { PrototypeTasksState } from "../tasks/useTasks";

function matchesTask(
  task: PrototypeTask,
  filters: { query: string; project: string; kind: string; period: string; module: PrototypeModule },
) {
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
  const pushToast = usePushToast();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");
  const [kind, setKind] = useState("");
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [order, setOrder] = useState("time");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  const filters = { query, project, kind, period, module };
  const isTraining = module === "training";

  const currentTask = state.tasks.find((task) => task.status === "running") ?? null;

  const queue = state.tasks.filter(
    (task) => matchesTask(task, filters) && ["submitted", "queued"].includes(task.status),
  );

  const historyRows = state.tasks.filter(
    (task) =>
      matchesTask(task, filters)
      && !ACTIVE_TASK_STATES.includes(task.status)
      && (!status || task.status === status),
  );
  if (order === "project") {
    historyRows.sort((a, b) => a.project.localeCompare(b.project, "zh-CN"));
  }

  const projectOptions = [
    { label: "全部项目", value: "" },
    ...[...new Set(state.tasks.filter((task) => task.module === module).map((task) => task.project))].map(
      (name) => ({ label: name, value: name }),
    ),
  ];

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
    confirmDialog({
      header: "暂停这次生成？",
      message: "当前生成将停止。恢复后会从头执行本次任务。",
      icon: "pi pi-pause",
      acceptLabel: "暂停任务",
      rejectLabel: "返回",
      accept: () => {
        state.pauseTask(task.id);
        clearSelection();
        pushToast("info", `${task.name}：${TASK_STATUS_LABELS.paused}`);
      },
    });
  }

  function confirmCancel(task: PrototypeTask) {
    confirmDialog({
      header: "取消任务？",
      message: `“${task.name}”将停止执行，已有结果仍可查看。`,
      icon: "pi pi-times",
      acceptLabel: "取消任务",
      rejectLabel: "返回",
      accept: () => {
        state.cancelTask(task.id);
        clearSelection();
        pushToast("info", `${task.name}：${TASK_STATUS_LABELS.cancelled}`);
      },
    });
  }

  function resumeOrRetry(task: PrototypeTask) {
    const error = state.resumeOrRetryTask(task);
    clearSelection();
    if (error === "training-run-blocked") {
      pushToast("warn", "已有等待中的训练运行，请先取消它再重新训练。");
      return;
    }
    pushToast("success", `${task.name}：${TASK_STATUS_LABELS.queued}`);
  }

  function requestDelete(ids: string[]) {
    const targets = ids
      .map((id) => state.tasks.find((task) => task.id === id))
      .filter((task): task is PrototypeTask => Boolean(task && task.module === "generation" && isTerminalTask(task)));
    if (targets.length !== ids.length || targets.length === 0) {
      clearSelection();
      pushToast("error", "仅可删除生产模块的终态任务，请重新选择。");
      return;
    }
    confirmDialog({
      header: `删除 ${targets.length} 项任务？`,
      message: `${targets.map((task) => task.name).join("、")}。任务记录、输入快照与其 ${targets.reduce((sum, task) => sum + task.output, 0)} 张结果图片将被永久删除，无法恢复。`,
      icon: "pi pi-trash",
      acceptLabel: "永久删除",
      rejectLabel: "返回",
      accept: () => {
        state.removeTasks(targets.map((task) => task.id));
        clearSelection();
        setDetailId(null);
        pushToast("success", `已删除 ${targets.length} 项任务`);
      },
    });
  }

  return (
    <div className="page">
      {currentTask ? (
        <Panel
          className="panel-clean"
          header={
            <div className="panel-head">
              <span>当前执行</span>
              <StatusTag task={currentTask} />
            </div>
          }
        >
          <div className="current-main">
            <div className="current-identity">
              <button type="button" className="task-link" onClick={() => setDetailId(currentTask.id)}>
                {currentTask.name}
              </button>
              <div className="task-meta">
                <span>{taskKindLabel(currentTask)}</span>
                <span>
                  {currentTask.project} / {currentTask.section}
                </span>
                <span className="mono">{currentTask.id}</span>
              </div>
            </div>
            <div className="current-actions">
              <TaskActions
                task={currentTask}
                onPause={() => confirmPause(currentTask)}
                onCancel={() => confirmCancel(currentTask)}
                onResumeOrRetry={() => resumeOrRetry(currentTask)}
              />
            </div>
          </div>
          <div className="current-footer">
            <div className="current-progress">
              <div className="progress-label">
                <span>{currentTask.stage ?? "执行中"}</span>
                <span className="mono">{currentTask.progress}%</span>
              </div>
              <ProgressBar
                value={currentTask.progress}
                showValue={false}
                aria-label="任务进度"
              />
            </div>
            <div className="execution-number">
              <span className="muted">已生成</span>
              <strong className="mono">
                {currentTask.output}
                <span className="muted"> / {currentTask.count}</span>
              </strong>
            </div>
            <div className="execution-number">
              <span className="muted">已用时</span>
              <strong className="mono">{currentTask.duration}</strong>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel className="panel-clean" header={<span>当前执行</span>}>
          <p className="empty-line">当前无任务执行，等待队列中的任务将在执行资源可用后开始。</p>
        </Panel>
      )}

      <div className="toolbar">
        <IconField iconPosition="left" className="search-field">
          <InputIcon className="pi pi-search" />
          <InputText
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              clearSelection();
            }}
            placeholder="任务名称、编号、项目或小节"
            aria-label="搜索任务名称或编号"
            className="w-full"
          />
        </IconField>
        <div className="toolbar-filters">
          <Dropdown
            value={project}
            onChange={(event) => setProject(event.value as string)}
            options={projectOptions}
            ariaLabel="项目筛选"
            className="filter-select"
          />
          {isTraining ? (
            <Dropdown
              value={kind}
              onChange={(event) => setKind(event.value as string)}
              options={[
                { label: "全部类型", value: "" },
                { label: "素材生成", value: "material" },
                { label: "LoRA 训练", value: "lora" },
              ]}
              ariaLabel="任务类型"
              className="filter-select"
            />
          ) : null}
          <Dropdown
            value={period}
            onChange={(event) => setPeriod(event.value as string)}
            options={[
              { label: "今天", value: "" },
              { label: "14:00 以后", value: "recent" },
            ]}
            ariaLabel="创建时间"
            className="filter-select"
          />
        </div>
      </div>

      <Panel className="panel-clean" header={<span>等待队列 {queue.length}</span>}>
        {queue.length ? (
          <div className="queue-list">
            {queue.map((task, index) => (
              <div className="queue-row" key={task.id}>
                <span className="queue-order mono">{String(index + 1).padStart(2, "0")}</span>
                <div className="queue-info">
                  <button type="button" className="task-link" onClick={() => setDetailId(task.id)}>
                    {task.name}
                  </button>
                  <div className="task-meta">
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
                <StatusTag task={task} />
                <div className="queue-actions">
                  <TaskActions task={task} onCancel={() => confirmCancel(task)} onResumeOrRetry={() => resumeOrRetry(task)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-line">没有等待中的任务</p>
        )}
      </Panel>

      <Panel
        className="panel-clean"
        header={
          <div className="panel-head">
            <span>任务记录 {historyRows.length}</span>
            <div className="history-filters">
              <Dropdown
                value={status}
                onChange={(event) => setStatus(event.value as string)}
                options={[
                  { label: "全部状态", value: "" },
                  ...["done", "failed", ...(isTraining ? [] : ["paused"]), "cancelled"].map((value) => ({
                    value,
                    label: TASK_STATUS_LABELS[value as keyof typeof TASK_STATUS_LABELS],
                  })),
                ]}
                ariaLabel="记录状态"
                className="filter-select"
              />
              <Dropdown
                value={order}
                onChange={(event) => setOrder(event.value as string)}
                options={[
                  { label: "时间倒序", value: "time" },
                  { label: "按项目排列", value: "project" },
                ]}
                ariaLabel="记录排序"
                className="filter-select"
              />
            </div>
          </div>
        }
      >
        {selected.size ? (
          <div className="selection-bar">
            <span>已选择 {selected.size} 项</span>
            <Button size="small" outlined onClick={clearSelection}>
              取消选择
            </Button>
            <Button size="small" severity="danger" icon="pi pi-trash" onClick={() => requestDelete([...selected])}>
              删除所选
            </Button>
          </div>
        ) : null}
        {historyRows.length ? (
          <div className="history-rows">
            <div className="history-row history-head">
              <span className="row-head">任务</span>
              <span className="row-head">状态</span>
              <span className="row-head cell-secondary">{isTraining ? "类型" : "生成结果"}</span>
              <span className="row-head cell-secondary">耗时</span>
              <span className="row-head cell-secondary">创建时间</span>
              <span className="row-head row-head-actions">操作</span>
            </div>
            {historyRows.map((task) => (
              <div className="history-row" key={task.id}>
                {!isTraining ? (
                  <Checkbox
                    checked={selected.has(task.id)}
                    disabled={!isTerminalTask(task)}
                    onChange={(event) => toggleSelect(task.id, Boolean(event.checked))}
                    aria-label={`选择 ${task.name}`}
                    className="row-check"
                  />
                ) : (
                  <span />
                )}
                <div className="row-main">
                  <button type="button" className="task-link" onClick={() => setDetailId(task.id)}>
                    {task.name}
                  </button>
                  <div className="row-sub">
                    <span>{task.project}</span>
                    <span className="mono">{task.id}</span>
                  </div>
                </div>
                <div className="row-cell">
                  <StatusTag task={task} />
                </div>
                <div className="row-cell cell-secondary">
                  {!isTraining ? (
                    <>
                      <span className="mono">
                        {task.output} / {task.count}
                      </span>{" "}
                      张
                    </>
                  ) : (
                    taskKindLabel(task)
                  )}
                </div>
                <div className="row-cell cell-secondary mono">{task.duration}</div>
                <div className="row-cell cell-secondary mono">今天 {task.time}</div>
                <div className="row-actions">
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
          <div className="empty-block">
            <p className="muted">没有匹配的任务，试试其他名称，或清除筛选条件。</p>
            <Button
              outlined
              icon="pi pi-times"
              label="清除筛选"
              onClick={() => {
                setQuery("");
                setProject("");
                setKind("");
                setPeriod("");
                setStatus("");
                clearSelection();
              }}
            />
          </div>
        )}
      </Panel>

      <TaskDetailSidebar
        task={detailTask}
        onHide={() => setDetailId(null)}
        onPause={confirmPause}
        onCancel={confirmCancel}
        onResumeOrRetry={resumeOrRetry}
        onDelete={(task) => requestDelete([task.id])}
      />
    </div>
  );
}
