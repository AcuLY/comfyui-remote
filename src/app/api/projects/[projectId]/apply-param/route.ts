import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { applyParamToAllSections, type ApplyParamName } from "@/lib/actions/project";
import { readJsonBody } from "@/server/http/request-json";

const VALID_PARAMS: ApplyParamName[] = [
  "aspectRatio",
  "shortSidePx",
  "batchSize",
  "upscaleFactor",
  "seedPolicy",
  "ksampler1",
  "ksampler2",
  "checkpointName",
  "presets",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      return failFromError(error);
    }

    const { param, value } = body as { param: string; value: unknown };

    if (!param || !VALID_PARAMS.includes(param as ApplyParamName)) {
      return fail(`无效参数名: ${param}`, 400);
    }

    const result = await applyParamToAllSections(projectId, param as ApplyParamName, value);

    if (!result.ok) {
      return fail(result.error ?? "Apply failed", 400);
    }

    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 500);
  }
}
