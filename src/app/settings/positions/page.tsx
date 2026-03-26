import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { ConfigManager, type FieldDef } from "@/components/config-manager";
import { getPositionTemplates } from "@/lib/server-data";
import {
  createPositionTemplate,
  updatePositionTemplate,
  deletePositionTemplate,
} from "@/lib/actions";
import { parseLoraBindings } from "@/lib/lora-types";

export default async function PositionsPage() {
  const templates = await getPositionTemplates();

  // v0.3: LoRA 分为 lora1 和 lora2 两组
  const fields: FieldDef[] = [
    { key: "name", label: "名称", type: "text", placeholder: "例：Standing", required: true },
    { key: "slug", label: "Slug", type: "text", placeholder: "例：standing", required: true },
    { key: "prompt", label: "Prompt", type: "textarea", placeholder: "Position 提示词…", required: true },
    { key: "negativePrompt", label: "Negative Prompt", type: "textarea", placeholder: "反向提示词…" },
    { key: "lora1", label: "LoRA 1", type: "lora-bindings" },
    { key: "lora2", label: "LoRA 2", type: "lora-bindings" },
    { key: "enabled", label: "启用", type: "boolean" },
  ];

  // Parse lora1/lora2 from database JSON
  const items = templates.map((t) => ({
    ...t,
    id: t.id,
    lora1: parseLoraBindings(t.lora1),
    lora2: parseLoraBindings(t.lora2),
  }));

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard
        title="Position 模板"
        subtitle="管理 Position 提示词模板。LoRA 1 用于第一阶段采样，LoRA 2 用于高清修复。"
      >
        <ConfigManager
          items={items}
          fields={fields}
          entityName="Position 模板"
          onCreateAction={async (data) => {
            "use server";
            const { parseLoraBindings: parse, serializeLoraBindings: serialize } = await import("@/lib/lora-types");
            const lora1 = Array.isArray(data.lora1) ? serialize(parse(data.lora1)) : null;
            const lora2 = Array.isArray(data.lora2) ? serialize(parse(data.lora2)) : null;
            await createPositionTemplate({
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              lora1,
              lora2,
              enabled: data.enabled !== false,
            });
          }}
          onUpdateAction={async (id, data) => {
            "use server";
            const { parseLoraBindings: parse, serializeLoraBindings: serialize } = await import("@/lib/lora-types");
            const lora1 = Array.isArray(data.lora1) ? serialize(parse(data.lora1)) : null;
            const lora2 = Array.isArray(data.lora2) ? serialize(parse(data.lora2)) : null;
            await updatePositionTemplate(id, {
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              lora1,
              lora2,
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
