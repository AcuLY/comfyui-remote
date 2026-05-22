import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraPromotionDecisions,
  mapCharacterLoraBenchmarkPromotionError,
} from "@/server/services/character-lora-training/benchmark-promotion-service";

export const dynamic = "force-dynamic";

type JobPromotionDecisionsRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: JobPromotionDecisionsRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await listCharacterLoraPromotionDecisions(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraBenchmarkPromotionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
