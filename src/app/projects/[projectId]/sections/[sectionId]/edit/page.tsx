import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SectionEditForm } from "./section-edit-form";
import type { ProjectDetailSection } from "@/lib/server-data";

export default async function SectionEditPage({ params }: { params: Promise<{ projectId: string; sectionId: string }> }) {
  const { projectId, sectionId } = await params;

  const pos = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    include: { positionTemplate: true, project: true },
  });

  if (!pos || pos.projectId !== projectId) {
    notFound();
  }

  if (!pos.positionTemplate) {
    notFound();
  }

  const section: ProjectDetailSection = {
    id: pos.id,
    name: pos.positionTemplate.name,
    batchSize: pos.batchSize ?? pos.positionTemplate.defaultBatchSize,
    aspectRatio: pos.aspectRatio ?? pos.positionTemplate.defaultAspectRatio,
    // v0.3: dual seedPolicy
    seedPolicy1: pos.seedPolicy1 ?? pos.positionTemplate.defaultSeedPolicy1,
    seedPolicy2: pos.seedPolicy2 ?? pos.positionTemplate.defaultSeedPolicy2,
    promptOverview: {
      positivePrompt: pos.positivePrompt ?? null,
      negativePrompt: pos.negativePrompt ?? pos.positionTemplate.negativePrompt ?? null,
    },
  };

  const positivePrompt =
    section.promptOverview.positivePrompt ??
    pos.positionTemplate.prompt ??
    "";

  return <SectionEditForm projectId={projectId} section={section} positivePrompt={positivePrompt} />;
}
