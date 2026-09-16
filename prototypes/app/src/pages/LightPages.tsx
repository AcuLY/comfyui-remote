import type { ReactNode } from "react";
import { Panel } from "primereact/panel";
import { SelectButton } from "primereact/selectbutton";
import { Tag } from "primereact/tag";

import type { PrototypeModule } from "../data";
import {
  prototypeLogEntries,
  prototypeModels,
  prototypeMonitorStatus,
  prototypeProductionPresets,
  prototypeProductionProjects,
  prototypeProductionTemplates,
  prototypeTrainingPresets,
  prototypeTrainingProjects,
  prototypeTrainingTemplates,
} from "../data";
import { navigateTo } from "../router";
import { setPrototypeWorkMode, usePrototypeWorkMode } from "../workMode";
import type { PrototypeWorkMode } from "../workMode";

function DefList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="def-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RowList({
  head,
  rows,
  columns,
}: {
  head: string[];
  rows: ReactNode[][];
  columns?: string;
}) {
  return (
    <div className="row-list">
      <div className="row row-head" style={columns ? { gridTemplateColumns: columns } : undefined}>
        {head.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {rows.map((cells, index) => (
        <div className="row" key={index} style={columns ? { gridTemplateColumns: columns } : undefined}>
          {cells.map((cell, cellIndex) => (
            <span className={cellIndex === 0 ? "row-title" : undefined} key={cellIndex}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ProjectsPage({ module }: { module: PrototypeModule }) {
  if (module === "generation") {
    const rows = prototypeProductionProjects.map((item) => [
      <span key="name">
        {item.name}
        {item.archived ? <Tag severity="secondary" value="归档" rounded className="row-badge" /> : null}
      </span>,
      <span className="muted" key="updated">{item.updated}</span>,
      <span className="mono" key="active">{item.active}</span>,
      <span className="mono" key="review">{item.review}</span>,
    ]);
    return (
      <div className="page">
        <Panel className="panel-clean" header={<span>项目 {prototypeProductionProjects.length}</span>}>
          <RowList
            head={["项目", "最近更新", "活动任务", "待审图片"]}
            rows={rows}
            columns="minmax(0,1.4fr) minmax(0,1fr) auto auto"
          />
        </Panel>
      </div>
    );
  }
  const rows = prototypeTrainingProjects.map((item) => [
    <span key="name">{item.name}</span>,
    <span className="muted" key="updated">{item.updated}</span>,
    <span className="mono" key="active">{item.active}</span>,
  ]);
  return (
    <div className="page">
      <Panel className="panel-clean" header={<span>项目 {prototypeTrainingProjects.length}</span>}>
        <RowList head={["项目", "最近更新", "活动任务"]} rows={rows} columns="minmax(0,1.4fr) minmax(0,1fr) auto" />
      </Panel>
    </div>
  );
}

export function PresetsPage({ module }: { module: PrototypeModule }) {
  const list = module === "generation" ? prototypeProductionPresets : prototypeTrainingPresets;
  const rows = list.map((item) => [
    item.name,
    <span className="muted" key="group">{item.group}</span>,
    <span className="muted" key="updated">{item.updated}</span>,
  ]);
  return (
    <div className="page">
      <Panel className="panel-clean" header={<span>预制 {list.length}</span>}>
        <RowList head={["名称", "所属组", "更新时间"]} rows={rows} />
      </Panel>
    </div>
  );
}

export function TemplatesPage({ module }: { module: PrototypeModule }) {
  const list = module === "generation" ? prototypeProductionTemplates : prototypeTrainingTemplates;
  const rows = list.map((item) => [
    item.name,
    <span className="muted" key="source">{item.source}</span>,
    <span className="muted" key="updated">{item.updated}</span>,
  ]);
  return (
    <div className="page">
      <Panel className="panel-clean" header={<span>模板 {list.length}</span>}>
        <RowList head={["名称", "来源", "更新时间"]} rows={rows} />
      </Panel>
    </div>
  );
}

export function ModelsPage() {
  const rows = prototypeModels.map((item) => [
    item.name,
    <span className="muted" key="type">{item.type}</span>,
    <span className="mono" key="size">{item.size}</span>,
    <Tag
      key="status"
      severity={item.missing ? "danger" : "success"}
      value={item.missing ? "缺失" : "已登记"}
      rounded
    />,
  ]);
  return (
    <div className="page">
      <Panel className="panel-clean" header={<span>模型 {prototypeModels.length}</span>}>
        <RowList head={["名称", "类型", "大小", "状态"]} rows={rows} />
      </Panel>
    </div>
  );
}

export function MonitorPage() {
  return (
    <div className="page">
      <Panel className="panel-clean" header={<span>当前执行状态</span>}>
        <DefList
          items={[
            { label: "检查时间", value: <span className="mono">{prototypeMonitorStatus.checkedAt}</span> },
            { label: "ComfyUI", value: prototypeMonitorStatus.comfy },
            { label: "GPU 使用", value: <span className="mono">{prototypeMonitorStatus.gpu}</span> },
            { label: "运行中任务", value: <span className="mono">{prototypeMonitorStatus.running}</span> },
            { label: "已提交任务", value: <span className="mono">{prototypeMonitorStatus.submitted}</span> },
          ]}
        />
      </Panel>
      <Panel className="panel-clean" header={<span>最近日志 {prototypeLogEntries.length}</span>}>
        <RowList
          head={["时间", "级别", "事件", "目标"]}
          columns="auto auto minmax(0,1.6fr) minmax(0,1fr)"
          rows={prototypeLogEntries.map((entry) => [
            <span className="mono" key="time">{entry.time}</span>,
            <Tag
              key="level"
              severity={entry.level === "error" ? "danger" : "success"}
              value={entry.level === "error" ? "错误" : "信息"}
              rounded
            />,
            entry.message,
            <span className="muted" key="target">{entry.target}</span>,
          ])}
        />
      </Panel>
    </div>
  );
}

export function SettingsPage() {
  const workMode = usePrototypeWorkMode();

  function selectWorkMode(nextMode: PrototypeWorkMode) {
    setPrototypeWorkMode(nextMode);
    // 切换工作模式后进入对应模块的任务范围。
    navigateTo(nextMode === "generation" ? "/production/tasks" : "/training/tasks");
  }

  return (
    <div className="page">
      <Panel className="panel-clean" header={<span>工作模式</span>}>
        <SelectButton
          value={workMode}
          onChange={(event) => {
            if (event.value) selectWorkMode(event.value as PrototypeWorkMode);
          }}
          options={[
            { label: "生产", value: "generation", icon: "pi pi-image" },
            { label: "训练", value: "lora_training", icon: "pi pi-bolt" },
          ]}
          optionLabel="label"
          itemTemplate={(option) => (
            <span className="mode-option">
              <i className={option.icon} />
              <span>{option.label}</span>
            </span>
          )}
          aria-label="工作模式"
        />
      </Panel>
      <Panel className="panel-clean" header={<span>全局工具</span>}>
        <a className="tool-link" href="#/tools/monitor">
          <i className="pi pi-desktop" />
          监控与日志
        </a>
      </Panel>
      <Panel className="panel-clean" header={<span>共享</span>}>
        <DefList items={[{ label: "唯一执行目标", value: "本机" }]} />
      </Panel>
      <Panel className="panel-clean" header={<span>生产</span>}>
        <DefList
          items={[
            { label: "ComfyUI API 地址", value: <span className="mono">http://127.0.0.1:8188</span> },
            { label: "数据根", value: <span className="mono">D:\ComfyUI</span> },
            { label: "导出目录", value: <span className="mono">D:\Exports</span> },
          ]}
        />
      </Panel>
      <Panel className="panel-clean" header={<span>训练</span>}>
        <DefList
          items={[
            { label: "Python 路径", value: <span className="mono">C:\Python311\python.exe</span> },
            { label: "训练数据根", value: <span className="mono">D:\TrainingData</span> },
            { label: "计算精度", value: <span className="mono">bf16</span> },
          ]}
        />
      </Panel>
    </div>
  );
}
