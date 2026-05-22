import { fail, ok } from "@/lib/api-response";
import {
  freezeCharacterLoraDataset,
  listCharacterLoraDatasetRevisions,
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

type DatasetRevisionsRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: DatasetRevisionsRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await listCharacterLoraDatasetRevisions(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request, context: DatasetRevisionsRouteContext) {
  const { jobId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await freezeCharacterLoraDataset(jobId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
