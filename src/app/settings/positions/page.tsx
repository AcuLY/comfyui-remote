import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { ConfigManager, type FieldDef } from "@/components/config-manager";
import { getPositionTemplates, getLoraAssets } from "@/lib/server-data";
import {
  createPositionTemplate,
  updatePositionTemplate,
  deletePositionTemplate,
} from "@/lib/actions";
import { parseLoraBindings } from "@/lib/lora-types";

export default async function PositionsPage() {
  const [templates, loraAssets] = await Promise.all([
    getPositionTemplates(),
    getLoraAssets(),
  ]);

  const loraOptions = loraAssets.map((lora) => ({
    value: lora.relativePath,
    label: `${lora.name} (${lora.category})`,
  }));

  const fields: FieldDef[] = [
    { key: "name", label: "名称", type: "text", placeholder: "例：Standing", required: true },
    { key: "slug", label: "Slug", type: "text", placeholder: "例：standing", required: true },
    { key: "prompt", label: "Prompt", type: "textarea", placeholder: "Position 提示词…", required: true },
    { key: "negativePrompt", label: "Negative Prompt", type: "textarea", placeholder: "反向提示词…" },
    { key: "loraBindings", label: "LoRA 绑定", type: "lora-bindings", loraOptions },
    { key: "enabled", label: "启用", type: "boolean" },
  ];

  // Parse loraBindings from database JSON
  const items = templates.map((t) => ({
    ...t,
    id: t.id,
    loraBindings: parseLoraBindings(t.loraBindings),
  }));

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard
        title="Position 模板"
        subtitle="管理 Position 提示词模板。可绑定 LoRA，导入时会自动带入。"
      >
        <ConfigManager
          items={items}
          fields={fields}
          entityName="Position 模板"
          onCreateAction={async (data) => {
            "use server";
            const { parseLoraBindings: parse, serializeLoraBindings: serialize } = await import("@/lib/lora-types");
            const bindings = Array.isArray(data.loraBindings) ? serialize(parse(data.loraBindings)) : null;
            await createPositionTemplate({
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              loraBindings: bindings,
              enabled: data.enabled !== false,
            });
          }}
          onUpdateAction={async (id, data) => {
            "use server";
            const { parseLoraBindings: parse, serializeLoraBindings: serialize } = await import("@/lib/lora-types");
            const bindings = Array.isArray(data.loraBindings) ? serialize(parse(data.loraBindings)) : null;
            await updatePositionTemplate(id, {
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              loraBindings: bindings,
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
