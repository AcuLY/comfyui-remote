import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { ConfigManager, type FieldDef } from "@/components/config-manager";
import { getCharacters } from "@/lib/server-data";
import { createCharacter, updateCharacter, deleteCharacter } from "@/lib/actions";

const fields: FieldDef[] = [
  { key: "name", label: "名称", type: "text", placeholder: "例：Nakano Miku", required: true },
  { key: "slug", label: "Slug", type: "text", placeholder: "例：nakano-miku", required: true },
  { key: "prompt", label: "Prompt", type: "textarea", placeholder: "角色提示词…", required: true },
  { key: "negativePrompt", label: "Negative Prompt", type: "textarea", placeholder: "负面提示词…" },
  { key: "loraPath", label: "LoRA 路径", type: "text", placeholder: "例：characters/miku-v3.safetensors", required: true },
  { key: "notes", label: "备注", type: "textarea", placeholder: "可选备注…" },
  { key: "isActive", label: "启用", type: "boolean" },
];

export default async function CharactersPage() {
  const characters = await getCharacters();

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard title="角色管理" subtitle="管理角色配置。停用角色不会影响已有大任务。">
        <ConfigManager
          items={characters.map((c) => ({ ...c, id: c.id }))}
          fields={fields}
          entityName="角色"
          onCreateAction={async (data) => {
            "use server";
            await createCharacter({
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              loraPath: String(data.loraPath),
              notes: data.notes ? String(data.notes) : null,
              isActive: data.isActive !== false,
            });
          }}
          onUpdateAction={async (id, data) => {
            "use server";
            await updateCharacter(id, {
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              loraPath: String(data.loraPath),
              notes: data.notes ? String(data.notes) : null,
              isActive: data.isActive !== false,
            });
          }}
          onDeleteAction={async (id) => {
            "use server";
            await deleteCharacter(id);
          }}
        />
      </SectionCard>
    </div>
  );
}
