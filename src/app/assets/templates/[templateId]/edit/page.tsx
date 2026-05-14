import { notFound } from "next/navigation";
import { getProjectTemplateDetail } from "@/lib/server-data";
import { firstSearchParam } from "@/lib/folder-navigation";
import { TemplateFormClient } from "../../template-form-client";

export default async function EditTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ sectionFolder?: string | string[] | undefined }>;
}) {
  const { templateId } = await params;
  const template = await getProjectTemplateDetail(templateId);
  if (!template) notFound();
  const requestedSectionFolderId = firstSearchParam((await searchParams).sectionFolder);
  const initialSectionFolderId =
    requestedSectionFolderId && template.sectionFolders.some((folder) => folder.id === requestedSectionFolderId)
      ? requestedSectionFolderId
      : null;

  return (
    <TemplateFormClient
      key={initialSectionFolderId ?? "root"}
      templateId={template.id}
      initialName={template.name}
      initialDescription={template.description}
      initialSectionFolders={template.sectionFolders}
      initialSectionFolderId={initialSectionFolderId}
      initialSections={template.sections}
    />
  );
}
