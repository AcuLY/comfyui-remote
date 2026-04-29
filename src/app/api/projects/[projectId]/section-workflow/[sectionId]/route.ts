import { NextResponse } from "next/server";
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
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to build workflow" }, { status: 500 });
  }
}
