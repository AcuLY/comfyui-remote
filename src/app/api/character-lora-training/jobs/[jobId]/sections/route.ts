import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraJobSections,
  mapCharacterLoraSectionTemplateError,
} from "@/server/services/character-lora-training/section-template-service";

type JobSectionsRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: JobSectionsRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await listCharacterLoraJobSections(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
