import { NextRequest, NextResponse } from "next/server";
import { applyParamToAllSections, type ApplyParamName } from "@/lib/actions/project";

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
  const { projectId } = await params;
  const body = await request.json();
  const { param, value } = body;

  if (!param || !VALID_PARAMS.includes(param)) {
    return NextResponse.json(
      { ok: false, error: `无效参数名: ${param}` },
      { status: 400 },
    );
  }

  const result = await applyParamToAllSections(projectId, param, value);

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
