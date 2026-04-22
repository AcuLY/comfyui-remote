import { notFound } from "next/navigation";
import { getProjectTemplateDetail } from "@/lib/server-data";
import { TemplateFormClient } from "../../template-form-client";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = await getProjectTemplateDetail(templateId);
  if (!template) notFound();

  return (
    <TemplateFormClient
      templateId={template.id}
      initialName={template.name}
      initialDescription={template.description}
      initialSections={template.sections}
    />
  );
}
