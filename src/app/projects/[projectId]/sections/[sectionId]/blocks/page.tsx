import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/section-card";
import { SectionEditor } from "@/components/section-editor";
import { SectionParamsForm } from "./section-params-form";
import { SectionNameEditor } from "./section-name-editor";
import { SectionRunButton } from "@/app/projects/[projectId]/project-detail-actions";
import type { PromptBlockData } from "@/lib/actions";
import { getPromptLibraryV2 } from "@/lib/server-data";
import { parseSectionLoraConfig, serializeSectionLoraConfig, generateLoraEntryId, parseLoraBindings } from "@/lib/lora-types";
import type { LoraEntry } from "@/lib/lora-types";
import { revalidatePath } from "next/cache";

export default async function SectionEditPage({
  params,
}: {
  params: Promise<{ projectId: string; sectionId: string }>;
}) {
  const { projectId, sectionId } = await params;

  const [pos, libraryV2] = await Promise.all([
    prisma.projectSection.findUnique({
      where: { id: sectionId },
      include: {
        project: {
          select: {
            presetBindings: true,
          },
        },
        promptBlocks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            type: true,
            sourceId: true,
            variantId: true,
            categoryId: true,
            bindingId: true,
            groupBindingId: true,
            label: true,
            positive: true,
            negative: true,
            sortOrder: true,
          },
        },
      },
    }),
    getPromptLibraryV2(),
  ]);

  if (!pos || pos.projectId !== projectId) {
    notFound();
  }

  const sectionName =
    pos.name || `小节 ${pos.sortOrder}`;

  const initialBlocks: PromptBlockData[] = pos.promptBlocks.map((b) => ({
    id: b.id,
    type: b.type,
    sourceId: b.sourceId,
    variantId: b.variantId,
    categoryId: b.categoryId,
    bindingId: b.bindingId,
    groupBindingId: b.groupBindingId,
    label: b.label,
    positive: b.positive,
    negative: b.negative,
    sortOrder: b.sortOrder,
  }));

  const sectionParams = {
    batchSize: pos.batchSize ?? null,
    aspectRatio: pos.aspectRatio ?? null,
    shortSidePx: pos.shortSidePx ?? null,
    // v0.3: dual seedPolicy
    seedPolicy1: pos.seedPolicy1 ?? null,
    seedPolicy2: pos.seedPolicy2 ?? null,
    // v0.3: ksampler params
    ksampler1: pos.ksampler1 ?? null,
    ksampler2: pos.ksampler2 ?? null,
    upscaleFactor: pos.upscaleFactor ?? null,
  };

  // Parse existing LoRA config ({ lora1, lora2 })
  const loraConfig = parseSectionLoraConfig(pos.loraConfig);

  // Unified: ALL presets' lora1 → section.lora1, lora2 → section.lora2
  if (pos.project) {
    let loraChanged = false;

    type PresetBindingJson = Array<{ categoryId: string; presetId: string }>;
    const bindings = pos.project.presetBindings as PresetBindingJson | null;
    if (bindings && bindings.length > 0) {
      const presetIds = bindings.map((b) => b.presetId);
      const variants = await prisma.presetVariant.findMany({
        where: { presetId: { in: presetIds } },
        select: {
          id: true, name: true, presetId: true, lora1: true, lora2: true,
          preset: {
            select: {
              name: true,
              category: { select: { name: true, color: true } },
            },
          },
        },
      });

      // Build a lookup: presetId → bindingId from the section's prompt blocks
      const blockBindingMap = new Map<string, string>();
      for (const block of pos.promptBlocks) {
        if (block.sourceId && block.bindingId) {
          blockBindingMap.set(block.sourceId, block.bindingId);
        }
      }

      // Build a lookup: presetId → { categoryName, presetName, lora paths }
      // so we can backfill bindingId on existing entries that lack one
      const presetLoraPathMap = new Map<string, Set<string>>();
      for (const variant of variants) {
        const paths = presetLoraPathMap.get(variant.presetId) ?? new Set<string>();
        if (variant.lora1) {
          for (const b of parseLoraBindings(variant.lora1)) {
            if (b.path) paths.add(b.path);
          }
        }
        if (variant.lora2) {
          for (const b of parseLoraBindings(variant.lora2)) {
            if (b.path) paths.add(b.path);
          }
        }
        presetLoraPathMap.set(variant.presetId, paths);
      }

      for (const variant of variants) {
        const categoryName = variant.preset.category.name;
        const categoryColor = variant.preset.category.color;
        const presetName = variant.preset.name;
        const bindingId = blockBindingMap.get(variant.presetId);
        if (variant.lora1) {
          const lora1Bindings = parseLoraBindings(variant.lora1);
          for (const binding of lora1Bindings) {
            if (!binding.path) continue;
            const exists = loraConfig.lora1.some((e) => e.path === binding.path);
            if (!exists) {
              loraConfig.lora1.push({
                id: generateLoraEntryId(),
                path: binding.path,
                weight: binding.weight,
                enabled: binding.enabled,
                source: "preset",
                sourceLabel: categoryName,
                sourceColor: categoryColor ?? undefined,
                sourceName: presetName,
                bindingId,
              });
              loraChanged = true;
            }
          }
        }
        if (variant.lora2) {
          const lora2Bindings = parseLoraBindings(variant.lora2);
          for (const binding of lora2Bindings) {
            if (!binding.path) continue;
            const exists = loraConfig.lora2.some((e) => e.path === binding.path);
            if (!exists) {
              loraConfig.lora2.push({
                id: generateLoraEntryId(),
                path: binding.path,
                weight: binding.weight,
                enabled: binding.enabled,
                source: "preset",
                sourceLabel: categoryName,
                sourceColor: categoryColor ?? undefined,
                sourceName: presetName,
                bindingId,
              });
              loraChanged = true;
            }
          }
        }
      }

      // Backfill: add bindingId to existing entries that are missing one
      // by matching their path + sourceName against known presets
      for (const [presetId, paths] of presetLoraPathMap) {
        const bindingId = blockBindingMap.get(presetId);
        if (!bindingId) continue;
        for (const entry of loraConfig.lora1) {
          if (!entry.bindingId && entry.source === "preset" && paths.has(entry.path)) {
            entry.bindingId = bindingId;
            loraChanged = true;
          }
        }
        for (const entry of loraConfig.lora2) {
          if (!entry.bindingId && entry.source === "preset" && paths.has(entry.path)) {
            entry.bindingId = bindingId;
            loraChanged = true;
          }
        }
      }
    }

    if (loraChanged) {
      await prisma.projectSection.update({
        where: { id: sectionId },
        data: {
          loraConfig: serializeSectionLoraConfig(loraConfig),
        },
      });
    }
  }

  // Server action to save LoRA config (2-partition: lora1, lora2)
  async function handleLoraChange(config: { lora1: LoraEntry[]; lora2: LoraEntry[] }) {
    "use server";
    const { prisma } = await import("@/lib/prisma");
    const { serializeSectionLoraConfig } = await import("@/lib/lora-types");

    await prisma.projectSection.update({
      where: { id: sectionId },
      data: {
        loraConfig: serializeSectionLoraConfig(config),
      },
    });

    revalidatePath(`/projects/${projectId}/sections/${sectionId}/blocks`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/projects/${projectId}#section-${sectionId}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-300"
        >
          <ArrowLeft className="size-4" /> 返回项目详情
        </Link>
        <div className="flex items-center gap-2 text-zinc-400">
          <Layers className="size-4" />
          <span className="text-xs">{initialBlocks.length} 个提示词块</span>
        </div>
      </div>

      <SectionCard
        title={
          <div className="flex items-center gap-3">
            <span>编辑小节 —</span>
            <SectionNameEditor sectionId={sectionId} initialName={sectionName} />
          </div>
        }
        subtitle="管理此小节的运行参数、提示词块和 LoRA 列表。导入预制库时会自动添加关联的 LoRA。"
        actions={<SectionRunButton sectionId={sectionId} defaultBatchSize={sectionParams.batchSize} />}
      >
        <div className="space-y-6">
          <SectionParamsForm
            projectId={projectId}
            sectionId={sectionId}
            initialParams={sectionParams}
          />
          <div className="border-t border-white/5 pt-4">
            <div className="mb-3 text-xs font-medium text-zinc-400">提示词块 & LoRA</div>
            <SectionEditor
              sectionId={sectionId}
              initialBlocks={initialBlocks}
              initialLoraConfig={loraConfig}
              libraryV2={libraryV2}
              onLoraChange={handleLoraChange}
              onRename={async (name: string) => {
                "use server";
                const { renameSection } = await import("@/lib/actions");
                await renameSection(sectionId, name);
              }}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
