import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraBenchmarkRuns,
  mapCharacterLoraBenchmarkPromotionError,
} from "@/server/services/character-lora-training/benchmark-promotion-service";

export const dynamic = "force-dynamic";

type JobBenchmarkRunsRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: JobBenchmarkRunsRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await listCharacterLoraBenchmarkRuns(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraBenchmarkPromotionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
