"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, ImageIcon, Monitor } from "lucide-react";

import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { SegmentedControl } from "@/components/design-demo-ui/primitives/segmented-control";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";

import type { PrototypeModule } from "../../data";
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
} from "../../data";
import { prototypeHref } from "../../routes";
import { setPrototypeWorkMode, usePrototypeWorkMode } from "../../use-work-mode";
import s from "./light-pages.module.css";

function DefList({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className={s.defGrid}>
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
  rows: React.ReactNode[][];
  columns?: string;
}) {
  return (
    <div className={s.rowList}>
      <div className={`${s.row} ${s.rowHead}`} style={columns ? { gridTemplateColumns: columns } : undefined}>
        {head.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {rows.map((cells, index) => (
        <div className={s.row} key={index} style={columns ? { gridTemplateColumns: columns } : undefined}>
          {cells.map((cell, cellIndex) => (
            <span className={cellIndex === 0 ? s.rowTitle : undefined} key={cellIndex}>
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
        {item.archived ? <StatusBadge status="trashed" label="归档" /> : null}
      </span>,
      <span className={s.muted} key="updated">
        {item.updated}
      </span>,
      <span className={s.mono} key="active">
        {item.active}
      </span>,
      <span className={s.mono} key="review">
        {item.review}
      </span>,
    ]);
    return (
      <Panel title={`项目 ${prototypeProductionProjects.length}`}>
        <RowList head={["项目", "最近更新", "活动任务", "待审图片"]} rows={rows} columns="minmax(0,1.4fr) minmax(0,1fr) auto auto" />
      </Panel>
    );
  }
  const rows = prototypeTrainingProjects.map((item) => [
    <span key="name">{item.name}</span>,
    <span className={s.muted} key="updated">
      {item.updated}
    </span>,
    <span className={s.mono} key="active">
      {item.active}
    </span>,
  ]);
  return (
    <Panel title={`项目 ${prototypeTrainingProjects.length}`}>
      <RowList head={["项目", "最近更新", "活动任务"]} rows={rows} columns="minmax(0,1.4fr) minmax(0,1fr) auto" />
    </Panel>
  );
}

export function PresetsPage({ module }: { module: PrototypeModule }) {
  const list = module === "generation" ? prototypeProductionPresets : prototypeTrainingPresets;
  const rows = list.map((item) => [
    item.name,
    <span className={s.muted} key="group">{item.group}</span>,
    <span className={s.muted} key="updated">{item.updated}</span>,
  ]);
  return <Panel title={`预制 ${list.length}`}><RowList head={["名称", "所属组", "更新时间"]} rows={rows} /></Panel>;
}

export function TemplatesPage({ module }: { module: PrototypeModule }) {
  const list = module === "generation" ? prototypeProductionTemplates : prototypeTrainingTemplates;
  const rows = list.map((item) => [
    item.name,
    <span className={s.muted} key="source">{item.source}</span>,
    <span className={s.muted} key="updated">{item.updated}</span>,
  ]);
  return <Panel title={`模板 ${list.length}`}><RowList head={["名称", "来源", "更新时间"]} rows={rows} /></Panel>;
}

export function ModelsPage() {
  const rows = prototypeModels.map((item) => [
    item.name,
    <span className={s.muted} key="type">{item.type}</span>,
    <span className={s.mono} key="size">{item.size}</span>,
    <StatusBadge key="status" status={item.missing ? "failed" : "done"} label={item.missing ? "缺失" : "已登记"} />,
  ]);
  return <Panel title={`模型 ${prototypeModels.length}`}><RowList head={["名称", "类型", "大小", "状态"]} rows={rows} /></Panel>;
}

export function MonitorPage() {
  return (
    <div className={s.pageStack}>
      <Panel title="当前执行状态">
        <DefList
          items={[
            { label: "检查时间", value: <span className={s.mono}>{prototypeMonitorStatus.checkedAt}</span> },
            { label: "ComfyUI", value: prototypeMonitorStatus.comfy },
            { label: "GPU 使用", value: <span className={s.mono}>{prototypeMonitorStatus.gpu}</span> },
            { label: "运行中任务", value: <span className={s.mono}>{prototypeMonitorStatus.running}</span> },
            { label: "已提交任务", value: <span className={s.mono}>{prototypeMonitorStatus.submitted}</span> },
          ]}
        />
      </Panel>
      <Panel title={`最近日志 ${prototypeLogEntries.length}`}>
        <RowList
          head={["时间", "级别", "事件", "目标"]}
          columns="auto auto minmax(0,1.6fr) minmax(0,1fr)"
          rows={prototypeLogEntries.map((entry) => [
            <span className={s.mono} key="time">{entry.time}</span>,
            <StatusBadge key="level" status={entry.level === "error" ? "failed" : "done"} label={entry.level === "error" ? "错误" : "信息"} />,
            entry.message,
            <span className={s.muted} key="target">{entry.target}</span>,
          ])}
        />
      </Panel>
    </div>
  );
}

export function SettingsPage() {
  const router = useRouter();
  const workMode = usePrototypeWorkMode();

  function selectWorkMode(nextMode: "generation" | "lora_training") {
    setPrototypeWorkMode(nextMode);
    // N-02：切换模块进入对应任务范围。
    router.push(prototypeHref(nextMode === "generation" ? "/production/tasks" : "/training/tasks"));
  }

  return (
    <div className={s.pageStack}>
      <Panel title="工作模式">
        <SegmentedControl
          ariaLabel="工作模式"
          items={[
            { value: "generation", label: <><ImageIcon className={s.modeIcon} />生产</> },
            { value: "lora_training", label: <><FlaskConical className={s.modeIcon} />训练</> },
          ]}
          onChange={selectWorkMode}
          role="radiogroup"
          value={workMode}
        />
      </Panel>
      <Panel title="全局工具">
        <Link className={s.toolLink} href={prototypeHref("/tools/monitor")}>
          <Monitor className={s.modeIcon} />
          监控与日志
        </Link>
      </Panel>
      <Panel title="共享">
        <DefList items={[{ label: "唯一执行目标", value: "本机" }]} />
      </Panel>
      <Panel title="生产">
        <DefList
          items={[
            { label: "ComfyUI API 地址", value: <span className={s.mono}>http://127.0.0.1:8188</span> },
            { label: "数据根", value: <span className={s.mono}>D:\ComfyUI</span> },
            { label: "导出目录", value: <span className={s.mono}>D:\Exports</span> },
          ]}
        />
      </Panel>
      <Panel title="训练">
        <DefList
          items={[
            { label: "Python 路径", value: <span className={s.mono}>C:\Python311\python.exe</span> },
            { label: "训练数据根", value: <span className={s.mono}>D:\TrainingData</span> },
            { label: "计算精度", value: <span className={s.mono}>bf16</span> },
          ]}
        />
      </Panel>
    </div>
  );
}
