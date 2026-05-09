"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, ArrowRight, ClipboardList, Gauge, History, Home, Lock, Monitor, Play, Search, X } from "lucide-react";

import type { DemoData } from "./design-demo-data";
import s from "./design-demo-styles";
import { Button, ButtonLink, DemoTabs, Field, OperationStateStrip, PageHeader, Panel, RouteTable, StatusBadge } from "./design-demo-ui";
import { cx, demoHref } from "./design-demo-utils";
import type { LogDemoSource } from "./design-demo-utils";
export function SettingsPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="设置"
        title="设置"
        subtitle="系统配置入口；预设管理在预设库，项目模板在模板页。"
      />
      <div className={s.settingsLinkList}>
        {[
          { title: "ComfyUI 监控", href: "/settings/monitor", icon: Monitor, meta: "进程状态、健康检查、启停控制" },
          { title: "后端日志", href: "/settings/logs", icon: History, meta: `${data.auditLogs.length} 条记录 · 项目执行与错误信息` },
        ].map((item) => (
          <Link className={s.settingsLinkRow} href={demoHref(item.href)} key={item.href}>
            <div className={s.settingsLinkMain}>
              <item.icon className="size-4" />
              <div className={s.settingsLinkText}>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
            </div>
            <div className={s.settingsLinkArrow}>
              <ArrowRight className="size-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

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
    const inferredLevel = row.action.toLowerCase().includes("error") || row.action.toLowerCase().includes("failed")
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
        <section className={s.logFilterBar}>
          <DemoTabs
            tabs={[
              { key: "app", label: "应用日志", count: auditRows.length },
              { key: "console", label: "控制台输出", count: consoleRows.length },
            ]}
            value={source}
            onChange={(next) => {
              setSource(next);
              setModuleFilter("all");
            }}
          />
          <DemoTabs
            tabs={[
              { key: "all", label: "全部" },
              { key: "info", label: "INFO" },
              { key: "warn", label: "WARN" },
              { key: "error", label: "ERROR" },
            ]}
            value={level}
            onChange={setLevel}
          />
          <div className={s.logModuleChips}>
            {modules.map((moduleName) => (
              <button
                className={cx(s.logModuleChip, moduleFilter === moduleName && s.logModuleChipActive)}
                key={moduleName}
                type="button"
                onClick={() => setModuleFilter(moduleName)}
              >
                {moduleName === "all" ? "全部模块" : moduleName}
              </button>
            ))}
          </div>
        </section>
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
              <div className={cx(s.logLine, log.level === "warn" && s.logLineWarn, log.level === "error" && s.logLineError)} key={log.id}>
                <span>{log.time}</span>
                <em>{log.level}</em>
                <strong>{log.module}</strong>
                <code>{log.message}</code>
              </div>
            )) : (
              <div className={s.logEmpty}>当前筛选没有日志</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

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
              <div className={s.segmented}>
                <button className={cx(s.segment, mode === "managed" && s.segmentActive)} type="button" onClick={() => setMode("managed")}>托管</button>
                <button className={cx(s.segment, mode === "external" && s.segmentActive)} type="button" onClick={() => setMode("external")}>外部</button>
              </div>
            </div>
            <div className={s.monitorStatusGrid}>
              <div className={s.monitorStatusRow}>
                <Gauge className={s.icon} />
                <div>
                  <strong>Worker</strong>
                  <span>心跳正常，轮询窗口稳定。</span>
                </div>
                <StatusBadge status="ready" label="正常" />
              </div>
              <div className={s.monitorStatusRow}>
                <Monitor className={s.icon} />
                <div>
                  <strong>ComfyUI API</strong>
                  <span>{data.source.comfyApiLabel || "未配置 endpoint"}</span>
                </div>
                <StatusBadge status={mode === "managed" ? "running" : "monitor"} label={mode === "managed" ? "运行中" : "外部"} />
              </div>
              <div className={s.monitorStatusRow}>
                <ClipboardList className={s.icon} />
                <div>
                  <strong>任务积压</strong>
                  <span>{running} 个待处理 / 运行中，{data.metrics.pendingImages} 张待审。</span>
                </div>
                <StatusBadge status={running ? "pending" : "ready"} label={running ? "忙碌" : "空闲"} />
              </div>
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

export function LoginPage() {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="登录"
        title="登录"
        subtitle="使用本地访问令牌进入工作台。"
      />
      <Panel title="访问令牌">
        <div className={s.grid}>
          <Field label="Token" value="本地访问令牌" />
          <div className={s.toolbar}>
            <Button tone="primary" icon={Lock} feedback={{ title: "登录验证已通过" }}>登录</Button>
            <Button icon={X} feedback={{ title: "输入已清除" }}>清除</Button>
          </div>
          <OperationStateStrip
            items={[
              { label: "验证", value: "待输入", tone: "info" },
              { label: "返回", value: "任务工作台", tone: "success" },
              { label: "错误", value: "0", tone: "success" },
            ]}
          />
        </div>
      </Panel>
    </div>
  );
}

export function NotFoundPage({ route }: { route: string }) {
  return (
    <div className={s.page}>
      <PageHeader eyebrow="404" title="未匹配页面" subtitle={route} actions={<ButtonLink href="/runs" icon={Home}>返回任务</ButtonLink>} />
      <RouteTable data={fallbackRouteData} />
    </div>
  );
}

const fallbackRouteData: DemoData = {
  source: {
    loadedFromSqlite: false,
    databaseLabel: "",
    imageSourceLabel: "",
    modelBaseLabel: "",
    comfyApiLabel: "",
    warning: null,
  },
  metrics: { projects: 0, sections: 0, runs: 0, pendingImages: 0, presets: 0, templates: 0, loras: 0 },
  projectFolders: [],
  projects: [],
  runs: [],
  categories: [],
  templates: [],
  loras: [],
  models: [],
  auditLogs: [],
  images: [],
};
