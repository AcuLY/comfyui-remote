import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/section-card";
import { SectionEditor } from "@/components/section-editor";
import { SectionParamsForm } from "./section-params-form";
import { SectionNameEditor } from "./section-name-editor";
import { PositionRunButton } from "@/app/jobs/[jobId]/job-detail-actions";
import type { PromptBlockData } from "@/lib/actions";
import { getPromptLibraryV2 } from "@/lib/server-data";
import { parsePositionLoraConfig, parseLoraBindings, generateLoraEntryId, serializePositionLoraConfig } from "@/lib/lora-types";
import type { LoraEntry, PositionLoraConfig } from "@/lib/lora-types";
import { revalidatePath } from "next/cache";

export default async function SectionEditPage({
  params,
}: {
  params: Promise<{ jobId: string; positionId: string }>;
}) {
  const { jobId, positionId } = await params;

  const [pos, libraryV2] = await Promise.all([
    prisma.completeJobPosition.findUnique({
      where: { id: positionId },
      include: {
        positionTemplate: true,
        completeJob: true,
        promptBlocks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            type: true,
            sourceId: true,
            categoryId: true,
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

  if (!pos || pos.completeJobId !== jobId) {
    notFound();
  }

  const sectionName =
    pos.name || pos.positionTemplate?.name || `小节 ${pos.sortOrder}`;

  const initialBlocks: PromptBlockData[] = pos.promptBlocks.map((b) => ({
    id: b.id,
    type: b.type,
    sourceId: b.sourceId,
    categoryId: b.categoryId,
    label: b.label,
    positive: b.positive,
    negative: b.negative,
    sortOrder: b.sortOrder,
  }));

  const sectionParams = {
    batchSize: pos.batchSize ?? pos.positionTemplate?.defaultBatchSize ?? null,
    aspectRatio: pos.aspectRatio ?? pos.positionTemplate?.defaultAspectRatio ?? null,
    shortSidePx: pos.shortSidePx ?? pos.positionTemplate?.defaultShortSidePx ?? null,
    // v0.3: dual seedPolicy
    seedPolicy1: pos.seedPolicy1 ?? pos.positionTemplate?.defaultSeedPolicy1 ?? null,
    seedPolicy2: pos.seedPolicy2 ?? pos.positionTemplate?.defaultSeedPolicy2 ?? null,
    // v0.3: ksampler params
    ksampler1: pos.ksampler1 ?? pos.positionTemplate?.defaultKsampler1 ?? null,
    ksampler2: pos.ksampler2 ?? pos.positionTemplate?.defaultKsampler2 ?? null,
    upscaleFactor: pos.upscaleFactor ?? null,
  };

  // Parse existing LoRA config (v0.3: { characterLora, lora1, lora2 })
  const loraConfig = parsePositionLoraConfig(pos.loraConfig);

  // Auto-populate characterLora from job's character if not yet present
  if (pos.completeJob) {
    const job = pos.completeJob;
    let characterLoraChanged = false;

    // Character's main loraPath
    if (job.characterLoraPath) {
      const exists = loraConfig.characterLora.some((e) => e.path === job.characterLoraPath);
      if (!exists) {
        loraConfig.characterLora.push({
          id: generateLoraEntryId(),
          path: job.characterLoraPath,
          weight: 1.0,
          enabled: true,
          source: "character",
          sourceLabel: `角色 LoRA`,
        });
        characterLoraChanged = true;
      }
    }

    // Character's loraBindings (from character preset)
    if (job.characterId) {
      const character = await prisma.character.findUnique({
        where: { id: job.characterId },
        select: { name: true, loraBindings: true },
      });
      if (character?.loraBindings) {
        const bindings = parseLoraBindings(character.loraBindings);
        for (const binding of bindings) {
          if (!binding.path) continue;
          const exists = loraConfig.characterLora.some((e) => e.path === binding.path);
          if (!exists) {
            loraConfig.characterLora.push({
              id: generateLoraEntryId(),
              path: binding.path,
              weight: binding.weight,
              enabled: binding.enabled,
              source: "character",
              sourceLabel: `角色: ${character.name}`,
            });
            characterLoraChanged = true;
          }
        }
      }
    }

    // Persist if we added new character LoRAs
    if (characterLoraChanged) {
      await prisma.completeJobPosition.update({
        where: { id: positionId },
        data: {
          loraConfig: serializePositionLoraConfig(loraConfig),
        },
      });
    }
  }

  // Server action to save LoRA config (v0.3 format)
  async function handleLoraChange(config: { characterLora: LoraEntry[]; lora1: LoraEntry[]; lora2: LoraEntry[] }) {
    "use server";
    const { prisma } = await import("@/lib/prisma");
    const { serializePositionLoraConfig } = await import("@/lib/lora-types");
    
    await prisma.completeJobPosition.update({
      where: { id: positionId },
      data: {
        loraConfig: serializePositionLoraConfig(config),
      },
    });
    
    revalidatePath(`/jobs/${jobId}/positions/${positionId}/blocks`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/jobs/${jobId}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-300"
        >
          <ArrowLeft className="size-4" /> 返回任务详情
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
            <SectionNameEditor sectionId={positionId} initialName={sectionName} />
          </div>
        }
        subtitle="管理此小节的运行参数、提示词块和 LoRA 列表。导入词库时会自动添加关联的 LoRA。"
      >
        <div className="space-y-6">
          <SectionParamsForm
            jobId={jobId}
            positionId={positionId}
            initialParams={sectionParams}
          />
          <div className="border-t border-white/5 pt-4">
            <div className="mb-3 text-xs font-medium text-zinc-400">提示词块 & LoRA</div>
            <SectionEditor
              positionId={positionId}
              initialBlocks={initialBlocks}
              initialLoraConfig={loraConfig}
              libraryV2={libraryV2}
              onLoraChange={handleLoraChange}
            />
          </div>
        </div>
      </SectionCard>

      {/* 运行按钮 */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 text-xs font-medium text-zinc-400">运行此小节</div>
        <PositionRunButton positionId={positionId} defaultBatchSize={sectionParams.batchSize} />
      </div>
    </div>
  );
}
