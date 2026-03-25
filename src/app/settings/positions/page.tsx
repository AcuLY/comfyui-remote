import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { ConfigManager, type FieldDef } from "@/components/config-manager";
import { getPositionTemplates, getWorkflowTemplateOptions } from "@/lib/server-data";
import {
  createPositionTemplate,
  updatePositionTemplate,
  deletePositionTemplate,
} from "@/lib/actions";

export default async function PositionsPage() {
  const [templates, workflowTemplates] = await Promise.all([
    getPositionTemplates(),
    getWorkflowTemplateOptions(),
  ]);

  const workflowOptions = [
    { value: "", label: "内置 SDXL txt2img（默认）" },
    ...workflowTemplates
      .filter((wt) => !wt.builtIn)
      .map((wt) => ({
        value: wt.id,
        label: `${wt.name} (${wt.nodeCount} nodes)`,
      })),
  ];

  const fields: FieldDef[] = [
    { key: "name", label: "名称", type: "text", placeholder: "例：Standing", required: true },
    { key: "slug", label: "Slug", type: "text", placeholder: "例：standing", required: true },
    { key: "prompt", label: "Prompt", type: "textarea", placeholder: "Position 提示词…", required: true },
    { key: "negativePrompt", label: "Negative Prompt", type: "textarea", placeholder: "反向提示词…" },
    {
      key: "defaultAspectRatio",
      label: "默认画幅",
      type: "select",
      options: [
        { value: "1:1", label: "1:1 (1024×1024)" },
        { value: "3:4", label: "3:4 (896×1152)" },
        { value: "4:3", label: "4:3 (1152×896)" },
        { value: "2:3", label: "2:3 (832×1216)" },
        { value: "3:2", label: "3:2 (1216×832)" },
        { value: "9:16", label: "9:16 (768×1344)" },
        { value: "16:9", label: "16:9 (1344×768)" },
      ],
    },
    { key: "defaultBatchSize", label: "默认 Batch Size", type: "number" },
    {
      key: "defaultSeedPolicy",
      label: "默认 Seed 策略",
      type: "select",
      options: [
        { value: "random", label: "随机 (random)" },
        { value: "fixed", label: "固定 (fixed)" },
      ],
    },
    {
      key: "workflowTemplateId",
      label: "Workflow 模板",
      type: "select",
      options: workflowOptions,
    },
    { key: "enabled", label: "启用", type: "boolean" },
  ];

  // Extract workflowTemplateId from defaultParams for display
  const items = templates.map((t) => {
    const defaultParams = t.defaultParams as Record<string, unknown> | null;
    return {
      ...t,
      id: t.id,
      workflowTemplateId:
        (defaultParams && typeof defaultParams.workflowTemplateId === "string"
          ? defaultParams.workflowTemplateId
          : "") as string,
    };
  });

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard
        title="Position 模板管理"
        subtitle="管理通用 Position 模板。Workflow 模板控制 ComfyUI 节点图（留空使用内置 SDXL txt2img）。"
      >
        <ConfigManager
          items={items}
          fields={fields}
          entityName="Position 模板"
          onCreateAction={async (data) => {
            "use server";
            await createPositionTemplate({
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              defaultAspectRatio: data.defaultAspectRatio ? String(data.defaultAspectRatio) : null,
              defaultBatchSize: data.defaultBatchSize ? Number(data.defaultBatchSize) : null,
              defaultSeedPolicy: data.defaultSeedPolicy ? String(data.defaultSeedPolicy) : null,
              workflowTemplateId: data.workflowTemplateId ? String(data.workflowTemplateId) : null,
              enabled: data.enabled !== false,
            });
          }}
          onUpdateAction={async (id, data) => {
            "use server";
            await updatePositionTemplate(id, {
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              defaultAspectRatio: data.defaultAspectRatio ? String(data.defaultAspectRatio) : null,
              defaultBatchSize: data.defaultBatchSize ? Number(data.defaultBatchSize) : null,
              defaultSeedPolicy: data.defaultSeedPolicy ? String(data.defaultSeedPolicy) : null,
              workflowTemplateId: data.workflowTemplateId ? String(data.workflowTemplateId) : null,
              enabled: data.enabled !== false,
            });
          }}
          onDeleteAction={async (id) => {
            "use server";
            await deletePositionTemplate(id);
          }}
        />
      </SectionCard>
    </div>
  );
}
