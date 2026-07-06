import { fail, failFromError, ok } from "@/lib/api-response";
import { readJsonBody } from "@/server/http/request-json";
import {
  parsePresetSectionReplacementRequest,
  replacePresetSectionBindings,
} from "@/server/services/preset-section-replacement-service";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const parsed = parsePresetSectionReplacementRequest(body);
    const result = await replacePresetSectionBindings({
      targetType: "template",
      targetId: templateId,
      rules: parsed.rules,
      dryRun: parsed.dryRun,
    });
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Preset replacement failed", 400);
  }
}
