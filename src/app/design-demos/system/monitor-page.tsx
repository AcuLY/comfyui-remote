"use client";

import { useState } from "react";
import { Activity, ClipboardList, Gauge, Monitor, Play, Search, X, type LucideIcon } from "lucide-react";
import type * as React from "react";

import type { DemoData } from "../design-demo-data";
import s from "./monitor-page.shell.module.css";
import { Button } from "../ui/button";
import { PageHeader } from "../ui/page-header";
import { SegmentedControl } from "../ui/segmented-control";
import { StatusBadge } from "../ui/status-badge";

export function MonitorPage({ data }: { data: DemoData }) {
  const [mode, setMode] = useState<"managed" | "external">("managed");
  const running = data.runs.filter((run) => ["queued", "running"].includes(run.status)).length;
  const processLines = [
    "worker 心跳正常",
    `ComfyUI API ${data.source.comfyApiLabel || "http://127.0.0.1:8188"} 可访问`,
    `本地任务池中有 ${running} 个处理中任务`,
    "探测延迟 42ms",
  ];
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="监控"
        title="ComfyUI 监控"
        subtitle="管理内置进程或外部连接，覆盖启动、停止、重启、探测和进程日志。"
        actions={<Button tone="primary" icon={Activity} feedback={{ title: "连接探测已完成", detail: "42ms" }}>探测连接</Button>}
      />
      <div className={s.monitorWorkbench}>
        <main className={s.monitorMain}>
          <section className={s.monitorControlPanel}>
            <div className={s.monitorHeader}>
              <div>
                <strong>{mode === "managed" ? "托管进程" : "外部 ComfyUI"}</strong>
                <span>{mode === "managed" ? "由本应用启动和重启 ComfyUI" : "连接已由用户维护的外部服务"}</span>
              </div>
              <SegmentedControl
                ariaLabel="ComfyUI 连接模式"
                items={[
                  { value: "managed", label: "托管" },
                  { value: "external", label: "外部" },
                ]}
                onChange={setMode}
                role="tablist"
                value={mode}
              />
            </div>
            <div className={s.monitorStatusGrid}>
              <MonitorStatusRow icon={Gauge} title="Worker" description="心跳正常，轮询窗口稳定。" status="ready" label="正常" />
              <MonitorStatusRow
                icon={Monitor}
                title="ComfyUI API"
                description={data.source.comfyApiLabel || "未配置 endpoint"}
                status={mode === "managed" ? "running" : "monitor"}
                label={mode === "managed" ? "运行中" : "外部"}
              />
              <MonitorStatusRow
                icon={ClipboardList}
                title="任务积压"
                description={`${running} 个待处理 / 运行中，${data.metrics.pendingImages} 张待审。`}
                status={running ? "pending" : "ready"}
                label={running ? "忙碌" : "空闲"}
              />
            </div>
            <div className={s.monitorActions}>
              <Button icon={Play} feedback={{ title: "启动命令已发送" }}>启动</Button>
              <Button tone="danger" icon={X} feedback={{ tone: "warning", title: "停止命令需要确认" }}>停止</Button>
              <Button icon={Activity} feedback={{ title: "重启命令已发送" }}>重启</Button>
              <Button icon={Search} feedback={{ title: "探测已完成", detail: "HTTP 200" }}>探测</Button>
            </div>
          </section>

          <section className={s.monitorLogPanel}>
            <div className={s.logViewerHeader}>
              <div>
                <strong>进程日志</strong>
                <span>{mode === "managed" ? "stdout / stderr" : "probe result"}</span>
              </div>
              <StatusBadge status="ready" label="跟随" />
            </div>
            <div className={s.logViewer}>
              {processLines.map((line, index) => (
                <div className={s.logLine} key={line}>
                  <span>+{String(index * 12).padStart(3, "0")}s</span>
                  <em>info</em>
                  <strong>{mode}</strong>
                  <code>{line}</code>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className={s.monitorAside}>
          <div className={s.monitorProbeBox}>
            <strong>探测结果</strong>
            <span>HTTP 200 · runs endpoint 正常 · history endpoint 正常</span>
            <StatusBadge status="ready" label="42ms" />
          </div>
          <div className={s.monitorProbeBox}>
            <strong>数据库</strong>
            <span>{data.source.databaseLabel || "本地 SQLite"}</span>
            <StatusBadge status="monitor" label="已连接" />
          </div>
          <div className={s.monitorProbeBox}>
            <strong>文件日志</strong>
            <span>{data.source.warning ?? "LOG_ENABLE_FILE 启用时写入本地日志。"}</span>
            <StatusBadge status="draft" label="配置" />
          </div>
        </aside>
      </div>
    </div>
  );
}

export function MonitorStatusRow({
  description,
  icon: Icon,
  label,
  status,
  title,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  status: React.ComponentProps<typeof StatusBadge>["status"];
  title: string;
}) {
  return (
    <div className={s.monitorStatusRow}>
      <Icon className={s.icon} />
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <StatusBadge status={status} label={label} />
    </div>
  );
}
