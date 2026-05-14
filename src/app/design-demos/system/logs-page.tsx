"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import type { DemoData } from "../design-demo-data";
import s from "./logs-page.shell.module.css";
import { Button } from "../ui/button";
import { DemoTabs } from "../ui/demo-tabs";
import { PageHeader } from "../ui/page-header";
import { SegmentedControl } from "../ui/segmented-control";
import { StatusBadge } from "../ui/status-badge";
import { cx } from "../design-demo-utils";
import type { LogDemoSource } from "../design-demo-utils";

export type DemoLogViewerLine = {
  id: string;
  level: "info" | "warn" | "error";
  module: string;
  message: string;
  time: string;
};

export function LogsPage({ data }: { data: DemoData }) {
  const [source, setSource] = useState<LogDemoSource>("app");
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const consoleRows = [
    { id: "console-1", createdAt: "server.log", entityType: "next", action: "ready", actorType: "console" },
    { id: "console-2", createdAt: "server.log", entityType: "worker", action: "heartbeat", actorType: "console" },
    { id: "console-3", createdAt: "server.log", entityType: "comfy", action: "probe", actorType: "console" },
    { id: "console-4", createdAt: "server.log", entityType: "image", action: "warn", actorType: "console" },
  ];
  const auditRows = data.auditLogs.length ? data.auditLogs : [
    { id: "audit-1", createdAt: "刚刚", entityType: "Run", action: "created", actorType: "system" },
    { id: "audit-2", createdAt: "3 分钟前", entityType: "ImageResult", action: "reviewed", actorType: "user" },
    { id: "audit-3", createdAt: "12 分钟前", entityType: "ProjectSection", action: "updated", actorType: "user" },
  ];
  const rows = source === "console" ? consoleRows : auditRows;
  const logLines = rows.map((row, index) => {
    const entityLabel = row.entityType === "ProjectSection"
      ? "项目小节"
      : row.entityType === "ImageResult"
        ? "图片结果"
        : row.entityType === "Run"
          ? "任务"
          : row.entityType.toLowerCase();
    const actionLabel = row.action === "ready"
      ? "就绪"
      : row.action === "heartbeat"
        ? "心跳"
        : row.action === "probe"
          ? "探测"
          : row.action === "warn"
            ? "警告"
            : row.action === "created"
              ? "创建"
              : row.action === "reviewed"
                ? "审核"
                : row.action === "updated"
                  ? "更新"
                  : row.action;
    const inferredLevel: DemoLogViewerLine["level"] = row.action.toLowerCase().includes("error") || row.action.toLowerCase().includes("failed")
      ? "error"
      : row.action.toLowerCase().includes("warn")
        ? "warn"
        : "info";
    return {
      ...row,
      level: inferredLevel,
      module: entityLabel,
      message: source === "console"
        ? `${entityLabel}: ${actionLabel} · ${data.source.comfyApiLabel || data.source.databaseLabel || "local"}`
        : `${row.actorType === "system" ? "系统" : "用户"}${actionLabel}${entityLabel}`,
      time: source === "console" ? `+${String(index * 18).padStart(3, "0")}s` : row.createdAt,
    };
  });
  const modules = ["all", ...Array.from(new Set(logLines.map((line) => line.module))).slice(0, 5)];
  const visibleRows = logLines.filter((row) => (level === "all" || row.level === level) && (moduleFilter === "all" || row.module === moduleFilter));
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="日志"
        title="后端日志"
        subtitle="按来源、级别和模块筛选日志，保持自动滚动和空状态表达。"
        actions={<Button icon={Search} feedback={{ title: "日志刷新已排队" }}>刷新日志</Button>}
      />
      <div className={s.logWorkbench}>
        <LogFilterBar
          auditCount={auditRows.length}
          consoleCount={consoleRows.length}
          level={level}
          moduleFilter={moduleFilter}
          modules={modules}
          onLevelChange={setLevel}
          onModuleChange={setModuleFilter}
          onSourceChange={(next) => {
            setSource(next);
            setModuleFilter("all");
          }}
          source={source}
        />
        <section className={s.logViewerPanel}>
          <div className={s.logViewerHeader}>
            <div>
              <strong>{source === "console" ? "server.log" : "审计流"}</strong>
              <span>{visibleRows.length} 行 · 自动滚动 · 跟随尾部</span>
            </div>
            <StatusBadge status={visibleRows.length ? "ready" : "draft"} label={visibleRows.length ? "实时" : "空"} />
          </div>
          <div className={s.logViewer}>
            {visibleRows.length ? visibleRows.map((log) => (
              <LogLine key={log.id} log={log} />
            )) : (
              <div className={s.logEmpty}>当前筛选没有日志</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function LogFilterBar({
  auditCount,
  consoleCount,
  level,
  moduleFilter,
  modules,
  onLevelChange,
  onModuleChange,
  onSourceChange,
  source,
}: {
  auditCount: number;
  consoleCount: number;
  level: "all" | "info" | "warn" | "error";
  moduleFilter: string;
  modules: string[];
  onLevelChange: (value: "all" | "info" | "warn" | "error") => void;
  onModuleChange: (value: string) => void;
  onSourceChange: (value: LogDemoSource) => void;
  source: LogDemoSource;
}) {
  return (
    <section className={s.logFilterBar}>
      <DemoTabs
        tabs={[
          { key: "app", label: "应用日志", count: auditCount },
          { key: "console", label: "控制台输出", count: consoleCount },
        ]}
        value={source}
        onChange={onSourceChange}
      />
      <DemoTabs
        tabs={[
          { key: "all", label: "全部" },
          { key: "info", label: "INFO" },
          { key: "warn", label: "WARN" },
          { key: "error", label: "ERROR" },
        ]}
        value={level}
        onChange={onLevelChange}
      />
      <SegmentedControl
        ariaLabel="日志模块"
        className={s.logModuleChips}
        compact
        dense
        items={modules.map((moduleName) => ({ value: moduleName, label: moduleName === "all" ? "全部模块" : moduleName }))}
        onChange={onModuleChange}
        value={moduleFilter}
      />
    </section>
  );
}

export function LogLine({ log }: { log: DemoLogViewerLine }) {
  return (
    <div className={cx(s.logLine, log.level === "warn" && s.logLineWarn, log.level === "error" && s.logLineError)}>
      <span>{log.time}</span>
      <em>{log.level}</em>
      <strong>{log.module}</strong>
      <code>{log.message}</code>
    </div>
  );
}
