import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { ConfigManager, type FieldDef } from "@/components/config-manager";
import { getStylePresets, getLoraAssets } from "@/lib/server-data";
import { createStylePreset, updateStylePreset, deleteStylePreset } from "@/lib/actions";
import { parseLoraBindings } from "@/lib/lora-types";

export default async function StylesPage() {
  const [styles, loraAssets] = await Promise.all([
    getStylePresets(),
    getLoraAssets(),
  ]);

  const loraOptions = loraAssets.map((lora) => ({
    value: lora.relativePath,
    label: `${lora.name} (${lora.category})`,
  }));

  const fields: FieldDef[] = [
    { key: "name", label: "名称", type: "text", placeholder: "例：Soft daylight", required: true },
    { key: "slug", label: "Slug", type: "text", placeholder: "例：soft-daylight", required: true },
    { key: "prompt", label: "Prompt", type: "textarea", placeholder: "风格提示词…", required: true },
    { key: "negativePrompt", label: "Negative Prompt", type: "textarea", placeholder: "负面提示词…" },
    { key: "loraBindings", label: "LoRA 绑定", type: "lora-bindings", loraOptions },
    { key: "notes", label: "备注", type: "textarea", placeholder: "可选备注…" },
    { key: "isActive", label: "启用", type: "boolean" },
  ];

  // Parse loraBindings from database JSON
  const items = styles.map((s) => ({
    ...s,
    id: s.id,
    loraBindings: parseLoraBindings(s.loraBindings),
  }));

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard title="风格管理" subtitle="管理风格预设。可绑定 LoRA，导入时会自动带入。">
        <ConfigManager
          items={items}
          fields={fields}
          entityName="风格"
          onCreateAction={async (data) => {
            "use server";
            const { parseLoraBindings: parse, serializeLoraBindings: serialize } = await import("@/lib/lora-types");
            const bindings = Array.isArray(data.loraBindings) ? serialize(parse(data.loraBindings)) : null;
            await createStylePreset({
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              loraBindings: bindings,
              notes: data.notes ? String(data.notes) : null,
              isActive: data.isActive !== false,
            });
          }}
          onUpdateAction={async (id, data) => {
            "use server";
            const { parseLoraBindings: parse, serializeLoraBindings: serialize } = await import("@/lib/lora-types");
            const bindings = Array.isArray(data.loraBindings) ? serialize(parse(data.loraBindings)) : null;
            await updateStylePreset(id, {
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              loraBindings: bindings,
              notes: data.notes ? String(data.notes) : null,
              isActive: data.isActive !== false,
            });
          }}
          onDeleteAction={async (id) => {
            "use server";
            await deleteStylePreset(id);
          }}
        />
      </SectionCard>
    </div>
  );
}
