import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getWorkflowTemplateOptions } from "@/lib/server-data";
import { WorkflowImportForm } from "./workflow-import-form";

export default async function WorkflowsSettingsPage() {
  const templates = await getWorkflowTemplateOptions();

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard title="Workflow 模板" subtitle="已注册的 ComfyUI Workflow 模板。">
        {templates.length === 0 ? (
          <div className="text-xs text-zinc-500">暂无已注册的 Workflow 模板。</div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {t.description}
                    </div>
                    <div className="mt-1.5 flex gap-2 text-[11px] text-zinc-500">
                      <span>ID: {t.id}</span>
                      <span>·</span>
                      <span>{t.variableCount} 变量</span>
                      <span>·</span>
                      <span>{t.nodeCount} 节点</span>
                      <span>·</span>
                      <span>v{t.version}</span>
                    </div>
                  </div>
                  {t.builtIn && (
                    <span className="shrink-0 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                      内置
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="导入 Workflow" subtitle="粘贴 ComfyUI「Save (API Format)」导出的 JSON，自动解析为模板。">
        <WorkflowImportForm />
      </SectionCard>
    </div>
  );
}
