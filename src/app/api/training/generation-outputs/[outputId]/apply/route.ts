import { fail, ok } from "@/lib/api-response";
import {
  applyTrainingGenerationOutput,
  mapTrainingGenerationOutputError,
} from "@/server/services/training/generation-output-service";

type RouteContext = {
  params: Promise<{ outputId: string }>;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { outputId } = await context.params;
    const data = await applyTrainingGenerationOutput(outputId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingGenerationOutputError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
