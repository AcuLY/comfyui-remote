import { notFound } from "next/navigation";
import { getProjectTemplateDetail, getPresetLibraryV2 } from "@/lib/server-data";
import { buildFolderScopedItemOrder } from "@/lib/folder-navigation";
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
    getPresetLibraryV2(),
  ]);
  if (!template) notFound();
  if (index >= template.sections.length) notFound();

  const section = template.sections[index];
  const orderedSections = buildFolderScopedItemOrder(template.sectionFolders, template.sections);
  const sectionIndexById = new Map(template.sections.map((item, itemIndex) => [item.id, itemIndex]));
  const displayIndex = orderedSections.findIndex((item) => item.id === section.id);
  const previousSection = displayIndex > 0 ? orderedSections[displayIndex - 1] : null;
  const nextSection =
    displayIndex >= 0 && displayIndex < orderedSections.length - 1
      ? orderedSections[displayIndex + 1]
      : null;
  const previousSectionIndex = previousSection ? (sectionIndexById.get(previousSection.id) ?? null) : null;
  const nextSectionIndex = nextSection ? (sectionIndexById.get(nextSection.id) ?? null) : null;

  return (
    <TemplateSectionDetailClient
      templateId={templateId}
      sectionIndex={index}
      sectionPosition={displayIndex >= 0 ? displayIndex : index}
      totalSections={orderedSections.length}
      previousSectionIndex={previousSectionIndex}
      nextSectionIndex={nextSectionIndex}
      section={section}
      library={library}
    />
  );
}
