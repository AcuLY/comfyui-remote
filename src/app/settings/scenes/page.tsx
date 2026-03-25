import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { ConfigManager, type FieldDef } from "@/components/config-manager";
import { getScenePresets, getLoraAssets } from "@/lib/server-data";
import { createScenePreset, updateScenePreset, deleteScenePreset } from "@/lib/actions";
import { parseLoraBindings, serializeLoraBindings } from "@/lib/lora-types";

export default async function ScenesPage() {
  const [scenes, loraAssets] = await Promise.all([
    getScenePresets(),
    getLoraAssets(),
  ]);

  const loraOptions = loraAssets.map((lora) => ({
    value: lora.relativePath,
    label: `${lora.name} (${lora.category})`,
  }));

  const fields: FieldDef[] = [
    { key: "name", label: "名称", type: "text", placeholder: "例：Park bench", required: true },
    { key: "slug", label: "Slug", type: "text", placeholder: "例：park-bench", required: true },
    { key: "prompt", label: "Prompt", type: "textarea", placeholder: "场景提示词…", required: true },
    { key: "negativePrompt", label: "Negative Prompt", type: "textarea", placeholder: "负面提示词…" },
    { key: "loraBindings", label: "LoRA 绑定", type: "lora-bindings", loraOptions },
    { key: "notes", label: "备注", type: "textarea", placeholder: "可选备注…" },
    { key: "isActive", label: "启用", type: "boolean" },
  ];

  // Parse loraBindings from database JSON
  const items = scenes.map((s) => ({
    ...s,
    id: s.id,
    loraBindings: parseLoraBindings(s.loraBindings),
  }));

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard title="场景管理" subtitle="管理场景预设。可绑定 LoRA，导入时会自动带入。">
        <ConfigManager
          items={items}
          fields={fields}
          entityName="场景"
          onCreateAction={async (data) => {
            "use server";
            const { parseLoraBindings: parse, serializeLoraBindings: serialize } = await import("@/lib/lora-types");
            const bindings = Array.isArray(data.loraBindings) ? serialize(parse(data.loraBindings)) : null;
            await createScenePreset({
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
            await updateScenePreset(id, {
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
            await deleteScenePreset(id);
          }}
        />
      </SectionCard>
    </div>
  );
}
