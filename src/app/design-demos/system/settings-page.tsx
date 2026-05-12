import Link from "next/link";
import { ArrowRight, History, Monitor } from "lucide-react";

import type { DemoData } from "../design-demo-data";
import s from "./settings-page.shell.module.css";
import { PageHeader } from "../ui/page-header";
import { demoHref } from "../design-demo-utils";

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
              <item.icon className={s.iconMd} />
              <div className={s.settingsLinkText}>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
            </div>
            <div className={s.settingsLinkArrow}>
              <ArrowRight className={s.iconMd} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
