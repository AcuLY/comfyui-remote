import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { Workflow, HeartPulse, ScrollText } from "lucide-react";

const settingsGroups = [
  {
    href: "/settings/workflows",
    label: "Workflow 模板",
    description: "查看和导入 ComfyUI Workflow 模板",
    icon: Workflow,
  },
  {
    href: "/settings/monitor",
    label: "ComfyUI 监控",
    description: "ComfyUI 进程状态、健康检查、启停控制",
    icon: HeartPulse,
  },
  {
    href: "/settings/logs",
    label: "后端日志",
    description: "查看运行日志：项目执行、错误信息",
    icon: ScrollText,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <SectionCard title="设置" subtitle="系统配置。预制管理已移至底部导航「预制」页面。">
        <div className="grid grid-cols-1 gap-2 justify-items-center md:grid-cols-2">
          {settingsGroups.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06] md:max-w-[500px]"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                <Icon className="size-4 text-sky-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-200">{label}</div>
                <div className="text-xs text-zinc-500">{description}</div>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
