import { fail, ok } from "@/lib/api-response";
import {
  enqueueCharacterLoraSectionGenerationRun,
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

type SectionRunsRouteContext = {
  params: Promise<{ sectionId: string }>;
};

export async function POST(request: Request, context: SectionRunsRouteContext) {
  const { sectionId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await enqueueCharacterLoraSectionGenerationRun(sectionId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
