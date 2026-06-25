import { fail, ok } from "@/lib/api-response";
import { syncPresetVariantFlow } from "@/server/services/agent-preset-variant-flow-service";

function mapFlowError(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to sync preset variants by project title";
  const notFoundMessages = new Set([
    "PROJECT_TITLE_NOT_FOUND",
    "SOURCE_PRESET_NOT_FOUND",
    "TARGET_PRESET_NOT_FOUND",
    "SOURCE_PROJECT_NOT_FOUND",
    "TARGET_PROJECT_NOT_FOUND",
  ]);
  const ambiguousMessages = new Set([
    "SOURCE_PRESET_AMBIGUOUS",
    "TARGET_PRESET_AMBIGUOUS",
    "SOURCE_PROJECT_TITLE_MISMATCH",
    "TARGET_PROJECT_TITLE_MISMATCH",
  ]);

  return {
    message,
    status: notFoundMessages.has(message) ? 404 : ambiguousMessages.has(message) ? 409 : 400,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const result = await syncPresetVariantFlow(body);
    return ok(result);
  } catch (error) {
    const mapped = mapFlowError(error);
    return fail(mapped.message, mapped.status);
  }
}
