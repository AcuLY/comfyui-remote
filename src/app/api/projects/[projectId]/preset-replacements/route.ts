import { fail, ok } from "@/lib/api-response";
import {
  parsePresetSectionReplacementRequest,
  replacePresetSectionBindings,
} from "@/server/services/preset-section-replacement-service";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const parsed = parsePresetSectionReplacementRequest(body);
    const result = await replacePresetSectionBindings({
      targetType: "project",
      targetId: projectId,
      rules: parsed.rules,
      dryRun: parsed.dryRun,
    });
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Preset replacement failed", 400);
  }
}
