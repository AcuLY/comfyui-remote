import { notFound } from "next/navigation";
import { getProjectTemplateDetail, getPromptLibraryV2 } from "@/lib/server-data";
import { TemplateSectionDetailClient } from "./section-detail-client";

export default async function TemplateSectionPage({
  params,
}: {
  params: Promise<{ templateId: string; sectionIndex: string }>;
}) {
  const { templateId, sectionIndex } = await params;
  const index = parseInt(sectionIndex, 10);
  if (isNaN(index) || index < 0) notFound();

  const [template, library] = await Promise.all([
    getProjectTemplateDetail(templateId),
    getPromptLibraryV2(),
  ]);
  if (!template) notFound();
  if (index >= template.sections.length) notFound();

  return (
    <TemplateSectionDetailClient
      templateId={templateId}
      sectionIndex={index}
      totalSections={template.sections.length}
      section={template.sections[index]}
      allSections={template.sections}
      library={library}
    />
  );
}
