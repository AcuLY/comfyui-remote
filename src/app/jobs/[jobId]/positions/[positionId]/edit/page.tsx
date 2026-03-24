import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JobPositionEditForm } from "./job-position-edit-form";
import type { JobDetailPosition } from "@/lib/server-data";

export default async function JobPositionEditPage({ params }: { params: Promise<{ jobId: string; positionId: string }> }) {
  const { jobId, positionId } = await params;

  const pos = await prisma.completeJobPosition.findUnique({
    where: { id: positionId },
    include: { positionTemplate: true, completeJob: true },
  });

  if (!pos || pos.completeJobId !== jobId) {
    notFound();
  }

  const position: JobDetailPosition = {
    id: pos.id,
    name: pos.positionTemplate.name,
    batchSize: pos.batchSize ?? pos.positionTemplate.defaultBatchSize,
    aspectRatio: pos.aspectRatio ?? pos.positionTemplate.defaultAspectRatio,
    seedPolicy: pos.seedPolicy ?? pos.positionTemplate.defaultSeedPolicy,
    promptOverview: {
      positivePrompt: pos.positivePrompt ?? null,
      negativePrompt: pos.negativePrompt ?? pos.positionTemplate.negativePrompt ?? null,
    },
  };

  const positivePrompt =
    position.promptOverview.positivePrompt ??
    pos.positionTemplate.prompt ??
    "";

  return <JobPositionEditForm jobId={jobId} position={position} positivePrompt={positivePrompt} />;
}
