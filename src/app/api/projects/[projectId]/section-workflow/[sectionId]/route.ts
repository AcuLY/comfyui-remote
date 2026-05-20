import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { buildCurrentSectionWorkflow } from "@/server/services/section-workflow-service";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId, sectionId } = await context.params;

  try {
    const { workflow, fileStem } = await buildCurrentSectionWorkflow(projectId, sectionId);
    const asciiName = `workflow-${sectionId}.json`;
    const encodedName = encodeURIComponent(fileStem);

    return new NextResponse(JSON.stringify(workflow, null, 2), {
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
