import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SectionEditForm } from "./section-edit-form";
import type { ProjectDetailSection } from "@/lib/server-data";

export default async function SectionEditPage({ params }: { params: Promise<{ projectId: string; sectionId: string }> }) {
  const { projectId, sectionId } = await params;

  const pos = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    include: { project: true },
  });

  if (!pos || pos.projectId !== projectId) {
    notFound();
  }

  const section: ProjectDetailSection = {
    id: pos.id,
    name: pos.name || `小节 ${pos.sortOrder}`,
    batchSize: pos.batchSize,
    aspectRatio: pos.aspectRatio,
    // v0.3: dual seedPolicy
    seedPolicy1: pos.seedPolicy1,
    seedPolicy2: pos.seedPolicy2,
    promptOverview: {
      positivePrompt: pos.positivePrompt ?? null,
      negativePrompt: pos.negativePrompt ?? null,
    },
  };

  const positivePrompt =
    section.promptOverview.positivePrompt ?? "";

  return <SectionEditForm projectId={projectId} section={section} positivePrompt={positivePrompt} />;
}
