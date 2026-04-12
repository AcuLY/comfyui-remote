import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = await prisma.run.findUnique({
    where: { id: runId },
    select: { submittedPrompt: true, projectSection: { select: { name: true } } },
  });
  if (!run?.submittedPrompt) {
    return NextResponse.json({ error: "No workflow data" }, { status: 404 });
  }
  const rawName = run.projectSection?.name ?? runId;
  const encodedName = encodeURIComponent(rawName);
  const filename = `workflow-${rawName}.json`;
  return new NextResponse(JSON.stringify(run.submittedPrompt, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedName}.json`,
    },
  });
}
