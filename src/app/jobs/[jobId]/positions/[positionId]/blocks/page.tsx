import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/section-card";
import { PromptBlockEditor } from "@/components/prompt-block-editor";
import { SectionParamsForm } from "./section-params-form";
import type { PromptBlockData } from "@/lib/actions";

export default async function SectionEditPage({
  params,
}: {
  params: Promise<{ jobId: string; positionId: string }>;
}) {
  const { jobId, positionId } = await params;

  const pos = await prisma.completeJobPosition.findUnique({
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
          label: true,
          positive: true,
          negative: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!pos || pos.completeJobId !== jobId) {
    notFound();
  }

  const sectionName =
    pos.positivePrompt || pos.positionTemplate?.name || `小节 ${pos.sortOrder}`;

  const initialBlocks: PromptBlockData[] = pos.promptBlocks.map((b) => ({
    id: b.id,
    type: b.type,
    sourceId: b.sourceId,
    label: b.label,
    positive: b.positive,
    negative: b.negative,
    sortOrder: b.sortOrder,
  }));

  const sectionParams = {
    batchSize: pos.batchSize ?? pos.positionTemplate?.defaultBatchSize ?? null,
    aspectRatio: pos.aspectRatio ?? pos.positionTemplate?.defaultAspectRatio ?? null,
    shortSidePx: pos.shortSidePx ?? pos.positionTemplate?.defaultShortSidePx ?? null,
    seedPolicy: pos.seedPolicy ?? pos.positionTemplate?.defaultSeedPolicy ?? null,
  };

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
        title={`编辑小节 — ${sectionName}`}
        subtitle="管理此小节的运行参数和提示词块，调整顺序后自动合成完整 prompt。"
      >
        <div className="space-y-6">
          <SectionParamsForm
            jobId={jobId}
            positionId={positionId}
            initialParams={sectionParams}
          />
          <div className="border-t border-white/5 pt-4">
            <div className="mb-3 text-xs font-medium text-zinc-400">提示词块</div>
            <PromptBlockEditor positionId={positionId} initialBlocks={initialBlocks} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
