import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/section-card";
import { PromptBlockEditor } from "@/components/prompt-block-editor";
import type { PromptBlockData } from "@/lib/actions";

export default async function PositionBlocksPage({
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

  const positionName = pos.positionTemplate?.name ?? "未命名 Position";

  const initialBlocks: PromptBlockData[] = pos.promptBlocks.map((b) => ({
    id: b.id,
    type: b.type,
    sourceId: b.sourceId,
    label: b.label,
    positive: b.positive,
    negative: b.negative,
    sortOrder: b.sortOrder,
  }));

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
        title={`${positionName} — 提示词块`}
        subtitle="管理此小节的提示词块，调整顺序后自动合成完整 prompt。"
      >
        <PromptBlockEditor positionId={positionId} initialBlocks={initialBlocks} />
      </SectionCard>
    </div>
  );
}
