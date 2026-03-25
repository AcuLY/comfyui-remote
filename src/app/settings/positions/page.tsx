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

const fields: FieldDef[] = [
  { key: "name", label: "名称", type: "text", placeholder: "例：Standing", required: true },
  { key: "slug", label: "Slug", type: "text", placeholder: "例：standing", required: true },
  { key: "prompt", label: "Prompt", type: "textarea", placeholder: "Position 提示词…", required: true },
  { key: "negativePrompt", label: "Negative Prompt", type: "textarea", placeholder: "反向提示词…" },
  { key: "enabled", label: "启用", type: "boolean" },
];

export default async function PositionsPage() {
  const templates = await getPositionTemplates();

  const items = templates.map((t) => ({
    ...t,
    id: t.id,
  }));

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard
        title="Position 模板"
        subtitle="管理 Position 提示词模板。结构与角色/场景/风格相同。"
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
