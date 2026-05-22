import { fail, ok } from "@/lib/api-response";
import {
  completeBenchmarkRun,
  mapCharacterLoraBenchmarkPromotionError,
  mockCompleteBenchmarkRun,
} from "@/server/services/character-lora-training/benchmark-promotion-service";

export const dynamic = "force-dynamic";

type BenchmarkRunCompleteRouteContext = {
  params: Promise<{ benchmarkRunId: string }>;
};

export async function POST(request: Request, context: BenchmarkRunCompleteRouteContext) {
  const { benchmarkRunId } = await context.params;
  let body: unknown = {};
  let hasBody = false;

  try {
    const rawBody = await request.text();
    hasBody = rawBody.trim().length > 0;
    body = hasBody ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = hasBody
      ? await completeBenchmarkRun(benchmarkRunId, body)
      : await mockCompleteBenchmarkRun(benchmarkRunId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraBenchmarkPromotionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
