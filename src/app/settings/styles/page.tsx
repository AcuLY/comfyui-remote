import { SectionCard } from "@/components/section-card";
import { ConfigManager, type FieldDef } from "@/components/config-manager";
import { getStylePresets } from "@/lib/server-data";
import { createStylePreset, updateStylePreset, deleteStylePreset } from "@/lib/actions";

const fields: FieldDef[] = [
  { key: "name", label: "名称", type: "text", placeholder: "例：Soft daylight", required: true },
  { key: "slug", label: "Slug", type: "text", placeholder: "例：soft-daylight", required: true },
  { key: "prompt", label: "Prompt", type: "textarea", placeholder: "风格提示词…", required: true },
  { key: "notes", label: "备注", type: "textarea", placeholder: "可选备注…" },
  { key: "isActive", label: "启用", type: "boolean" },
];

export default async function StylesPage() {
  const styles = await getStylePresets();

  return (
    <div className="space-y-4">
      <SectionCard title="风格管理" subtitle="管理风格预设。停用风格不会影响已有大任务。">
        <ConfigManager
          items={styles.map((s) => ({ ...s, id: s.id }))}
          fields={fields}
          entityName="风格"
          onCreateAction={async (data) => {
            "use server";
            await createStylePreset({
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
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
