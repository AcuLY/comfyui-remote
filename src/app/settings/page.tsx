import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { User, MapPin, Palette, LayoutGrid, Workflow, HeartPulse, ScrollText } from "lucide-react";

const settingsGroups = [
  {
    href: "/settings/characters",
    label: "角色 (Character)",
    description: "管理角色配置：提示词、LoRA 路径",
    icon: User,
  },
  {
    href: "/settings/scenes",
    label: "场景 (Scene)",
    description: "管理场景预设：地点、氛围提示词",
    icon: MapPin,
  },
  {
    href: "/settings/styles",
    label: "风格 (Style)",
    description: "管理风格预设：画面风格提示词",
    icon: Palette,
  },
  {
    href: "/settings/positions",
    label: "Position 模板",
    description: "管理 Position 提示词模板（和角色场景风格结构相同）",
    icon: LayoutGrid,
  },
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
    description: "查看运行日志：任务执行、错误信息",
    icon: ScrollText,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <SectionCard title="设置" subtitle="管理角色、场景、风格和提示词库。">
        <div className="space-y-2">
          {settingsGroups.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                <Icon className="size-5 text-sky-400" />
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
