import { fail, ok } from "@/lib/api-response";
import {
  mapCharacterLoraBenchmarkPromotionError,
  promoteCharacterLoraPreset,
} from "@/server/services/character-lora-training/benchmark-promotion-service";

export const dynamic = "force-dynamic";

type PromotionDecisionPromoteRouteContext = {
  params: Promise<{ decisionId: string }>;
};

export async function POST(request: Request, context: PromotionDecisionPromoteRouteContext) {
  const { decisionId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await promoteCharacterLoraPreset(decisionId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraBenchmarkPromotionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
