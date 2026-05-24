import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraJobSection,
  mapCharacterLoraSectionTemplateError,
  updateCharacterLoraJobSectionStatus,
} from "@/server/services/character-lora-training/section-template-service";

export const dynamic = "force-dynamic";

type SectionRouteContext = {
  params: Promise<{ sectionId: string }>;
};

export async function GET(_request: Request, context: SectionRouteContext) {
  const { sectionId } = await context.params;

  try {
    const data = await getCharacterLoraJobSection(sectionId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(request: Request, context: SectionRouteContext) {
  const { sectionId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await updateCharacterLoraJobSectionStatus(sectionId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
