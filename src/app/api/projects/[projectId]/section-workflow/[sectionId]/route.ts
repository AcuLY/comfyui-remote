import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { buildCurrentSectionWorkflow } from "@/server/services/section-workflow-service";
import {
  appendWorkflowVariantSuffix,
  buildWorkflowDownloadPayload,
  getWorkflowDownloadVariant,
} from "@/server/services/workflow-debug-download";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { projectId, sectionId } = await context.params;

  try {
    const variant = getWorkflowDownloadVariant(request.url);
    const { workflow, fileStem } = await buildCurrentSectionWorkflow(projectId, sectionId);
    const payload = buildWorkflowDownloadPayload(workflow, variant);
    const fileStemWithVariant = appendWorkflowVariantSuffix(fileStem, variant);
    const asciiName = `workflow-${sectionId}${variant === "debug" ? "-debug" : ""}.json`;
    const encodedName = encodeURIComponent(fileStemWithVariant);

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}.json`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "JOB_NOT_FOUND" || error.message === "JOB_POSITION_NOT_FOUND") {
        return fail("Section not found", 404);
      }

      return fail(error.message, 400);
    }

    return fail("Failed to build workflow", 500);
  }
}
