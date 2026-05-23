import { fail, ok } from "@/lib/api-response";
import {
  cleanupBenchmarkRunTemporaryResources,
  mapCharacterLoraBenchmarkPromotionError,
} from "@/server/services/character-lora-training/benchmark-promotion-service";

export const dynamic = "force-dynamic";

type BenchmarkRunCleanupRouteContext = {
  params: Promise<{ benchmarkRunId: string }>;
};

export async function POST(request: Request, context: BenchmarkRunCleanupRouteContext) {
  const { benchmarkRunId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await cleanupBenchmarkRunTemporaryResources(benchmarkRunId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraBenchmarkPromotionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
