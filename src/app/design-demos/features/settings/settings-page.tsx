"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FlaskConical, History, ImageIcon, Monitor } from "lucide-react";

import type { DemoData } from "../../data";
import s from "./settings-page.shell.module.css";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import {
  WORK_MODE_CHANGE_EVENT,
  WORK_MODE_STORAGE_KEY,
  demoHref,
  isDesignDemoWorkModeValue,
} from "../../routing";
import type { DesignDemoWorkMode } from "../../routing";

const WORK_MODE_OPTIONS: Array<{
  description: string;
  icon: typeof ImageIcon;
  label: string;
  value: DesignDemoWorkMode;
}> = [
  {
    description: "运行、项目、预制和模板入口解析到生图资源。",
    icon: ImageIcon,
    label: "生图模式",
    value: "generation",
  },
  {
    description: "运行、项目、预制和模板入口解析到 LoRA 训练工作台。",
    icon: FlaskConical,
    label: "LoRA 训练",
    value: "lora_training",
  },
];

const MODE_ROUTE_ROWS: Record<DesignDemoWorkMode, Array<{ label: string; route: string }>> = {
  generation: [
    { label: "运行", route: "/runs" },
    { label: "项目", route: "/projects" },
    { label: "预制", route: "/presets" },
    { label: "模板", route: "/templates" },
  ],
  lora_training: [
    { label: "运行", route: "/training/runs" },
    { label: "项目", route: "/training/projects" },
    { label: "预制", route: "/training/presets" },
    { label: "模板", route: "/training/templates" },
  ],
};

function readInitialWorkMode(): DesignDemoWorkMode {
  if (typeof window === "undefined") return "generation";
  try {
    const stored = window.localStorage.getItem(WORK_MODE_STORAGE_KEY);
    return isDesignDemoWorkModeValue(stored) ? stored : "generation";
  } catch {
    return "generation";
  }
}

export function SettingsPage({ data }: { data: DemoData }) {
  const [workMode, setWorkMode] = useState<DesignDemoWorkMode>(readInitialWorkMode);
  const modeRouteList = MODE_ROUTE_ROWS[workMode];

  function selectWorkMode(nextMode: DesignDemoWorkMode) {
    setWorkMode(nextMode);
    try {
      window.localStorage.setItem(WORK_MODE_STORAGE_KEY, nextMode);
      window.dispatchEvent(new CustomEvent(WORK_MODE_CHANGE_EVENT, { detail: { mode: nextMode } }));
    } catch {}
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="设置"
        title="设置"
        subtitle="系统配置入口；预设管理在预设库，项目模板在模板页。"
      />
      <section className={s.workModePanel}>
        <div className={s.workModeHeader}>
          <div>
            <strong>工作模式</strong>
            <span>切换后不自动跳转，只改变资源入口的目标路由。</span>
          </div>
          <em>当前模式：{workMode === "lora_training" ? "LoRA 训练" : "生图模式"}</em>
        </div>
        <div className={s.workModeGrid}>
          {WORK_MODE_OPTIONS.map((option) => (
            <button
              aria-pressed={workMode === option.value}
              className={s.workModeCard}
              data-active={workMode === option.value ? "true" : undefined}
              key={option.value}
              type="button"
              onClick={() => selectWorkMode(option.value)}
            >
              <option.icon className={s.iconMd} aria-hidden="true" />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </button>
          ))}
        </div>
        <div className={s.modeRouteList}>
          {modeRouteList.map((item) => (
            <span key={item.label}>
              <strong>{item.label}</strong>
              <code>{item.route}</code>
            </span>
          ))}
          <span>
            <strong>设置</strong>
            <code>/settings</code>
          </span>
        </div>
      </section>
      <div className={s.settingsLinkList}>
        {[
          { title: "ComfyUI 监控", href: "/settings/monitor", icon: Monitor, meta: "进程状态、健康检查、启停控制" },
          { title: "后端日志", href: "/settings/logs", icon: History, meta: `${data.auditLogs.length} 条记录 · 项目执行与错误信息` },
        ].map((item) => (
          <Link className={s.settingsLinkRow} href={demoHref(item.href)} key={item.href}>
            <div className={s.settingsLinkMain}>
              <item.icon className={s.iconMd} aria-hidden="true" />
              <div className={s.settingsLinkText}>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
            </div>
            <div className={s.settingsLinkArrow}>
              <ArrowRight className={s.iconMd} aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
