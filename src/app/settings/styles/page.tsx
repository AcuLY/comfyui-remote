import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { ConfigManager, type FieldDef } from "@/components/config-manager";
import { getStylePresets } from "@/lib/server-data";
import { createStylePreset, updateStylePreset, deleteStylePreset } from "@/lib/actions";

export default async function StylesPage() {
  const styles = await getStylePresets();

  const fields: FieldDef[] = [
    { key: "name", label: "名称", type: "text", placeholder: "例：Soft daylight", required: true },
    { key: "slug", label: "Slug", type: "text", placeholder: "例：soft-daylight", required: true },
    { key: "prompt", label: "Prompt", type: "textarea", placeholder: "风格提示词…", required: true },
    { key: "negativePrompt", label: "Negative Prompt", type: "textarea", placeholder: "负面提示词…" },
    // v0.3: loraBindings removed from StylePreset, now managed at position level via lora1/lora2
    { key: "notes", label: "备注", type: "textarea", placeholder: "可选备注…" },
    { key: "isActive", label: "启用", type: "boolean" },
  ];

  const items = styles.map((s) => ({
    ...s,
    id: s.id,
  }));

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard title="风格管理" subtitle="管理风格预设。风格提示词会自动合入任务。">
        <ConfigManager
          items={items}
          fields={fields}
          entityName="风格"
          onCreateAction={async (data) => {
            "use server";
            await createStylePreset({
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              notes: data.notes ? String(data.notes) : null,
              isActive: data.isActive !== false,
            });
          }}
          onUpdateAction={async (id, data) => {
            "use server";
            await updateStylePreset(id, {
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
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
