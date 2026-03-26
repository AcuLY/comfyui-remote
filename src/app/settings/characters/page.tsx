import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { ConfigManager, type FieldDef } from "@/components/config-manager";
import { getCharacters } from "@/lib/server-data";
import { createCharacter, updateCharacter, deleteCharacter } from "@/lib/actions";
import { parseLoraBindings } from "@/lib/lora-types";

export default async function CharactersPage() {
  const characters = await getCharacters();

  const fields: FieldDef[] = [
    { key: "name", label: "名称", type: "text", placeholder: "例：Nakano Miku", required: true },
    { key: "slug", label: "Slug", type: "text", placeholder: "例：nakano-miku", required: true },
    { key: "prompt", label: "Prompt", type: "textarea", placeholder: "角色提示词…", required: true },
    { key: "negativePrompt", label: "Negative Prompt", type: "textarea", placeholder: "负面提示词…" },
    { key: "loraBindings", label: "LoRA 绑定", type: "lora-bindings" },
    { key: "notes", label: "备注", type: "textarea", placeholder: "可选备注…" },
    { key: "isActive", label: "启用", type: "boolean" },
  ];

  // Parse loraBindings from database; if not present, create from loraPath
  const items = characters.map((c) => {
    let bindings = parseLoraBindings(c.loraBindings);
    // Migrate: if no bindings but has loraPath, create one binding from it
    if (bindings.length === 0 && c.loraPath) {
      bindings = [{ path: c.loraPath, weight: 1.0, enabled: true }];
    }
    return {
      ...c,
      id: c.id,
      loraBindings: bindings,
    };
  });

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回设置
      </Link>
      <SectionCard title="角色管理" subtitle="管理角色配置。可绑定多个 LoRA，第一个启用的 LoRA 作为主要 LoRA。">
        <ConfigManager
          items={items}
          fields={fields}
          entityName="角色"
          onCreateAction={async (data) => {
            "use server";
            const { parseLoraBindings: parse, serializeLoraBindings: serialize } = await import("@/lib/lora-types");
            const bindings = Array.isArray(data.loraBindings) ? parse(data.loraBindings) : [];
            // Get primary loraPath from first enabled binding
            const primaryBinding = bindings.find((b: { enabled: boolean }) => b.enabled);
            const loraPath = primaryBinding?.path || bindings[0]?.path || "";
            
            await createCharacter({
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              loraPath,
              loraBindings: serialize(bindings),
              notes: data.notes ? String(data.notes) : null,
              isActive: data.isActive !== false,
            });
          }}
          onUpdateAction={async (id, data) => {
            "use server";
            const { parseLoraBindings: parse, serializeLoraBindings: serialize } = await import("@/lib/lora-types");
            const bindings = Array.isArray(data.loraBindings) ? parse(data.loraBindings) : [];
            // Get primary loraPath from first enabled binding
            const primaryBinding = bindings.find((b: { enabled: boolean }) => b.enabled);
            const loraPath = primaryBinding?.path || bindings[0]?.path || "";
            
            await updateCharacter(id, {
              name: String(data.name),
              slug: String(data.slug),
              prompt: String(data.prompt),
              negativePrompt: data.negativePrompt ? String(data.negativePrompt) : null,
              loraPath,
              loraBindings: serialize(bindings),
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
