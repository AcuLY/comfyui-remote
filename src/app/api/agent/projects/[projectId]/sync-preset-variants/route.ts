import { fail, ok } from "@/lib/api-response";
import { syncPresetVariants } from "@/server/services/agent-preset-variant-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function mapSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to sync preset variants";
  const notFoundMessages = new Set([
    "SOURCE_PRESET_NOT_FOUND",
    "TARGET_PRESET_NOT_FOUND",
    "SOURCE_PROJECT_NOT_FOUND",
    "TARGET_PROJECT_NOT_FOUND",
  ]);

  return {
    message,
    status: notFoundMessages.has(message) ? 404 : 400,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const result = await syncPresetVariants(projectId, body);
    return ok(result);
  } catch (error) {
    const mapped = mapSyncError(error);
    return fail(mapped.message, mapped.status);
  }
}
