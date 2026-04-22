import { getPromptLibraryV2 } from "@/lib/server-data";
import { TemplateFormClient } from "../template-form-client";

export default async function NewTemplatePage() {
  const library = await getPromptLibraryV2();
  return <TemplateFormClient library={library} />;
}
