import { notFound } from "next/navigation";
import { getProjectTemplateDetail, getPromptLibraryV2 } from "@/lib/server-data";
import { TemplateFormClient } from "../../template-form-client";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const [template, library] = await Promise.all([
    getProjectTemplateDetail(templateId),
    getPromptLibraryV2(),
  ]);
  if (!template) notFound();

  return (
    <TemplateFormClient
      templateId={template.id}
      initialName={template.name}
      initialDescription={template.description}
      initialSections={template.sections}
      library={library}
    />
  );
}
