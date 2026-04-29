import { fail, ok } from "@/lib/api-response";
import {
  parseSwitchVariantUpdates,
  switchProjectVariants,
} from "@/server/services/agent-preset-variant-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  let updates;
  try {
    updates = parseSwitchVariantUpdates(body);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid updates", 400);
  }

  try {
    const result = await switchProjectVariants(projectId, updates);
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to switch variants", 500);
  }
}
