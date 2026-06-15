import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { buildGenerationProjectWhere } from "@/server/repositories/legacy-training-resource-boundary";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = await prisma.run.findFirst({
    where: {
      id: runId,
      project: buildGenerationProjectWhere(),
    },
    select: { submittedPrompt: true, projectSection: { select: { name: true } } },
  });
  if (!run?.submittedPrompt) {
    return fail("No workflow data", 404);
  }
  const rawName = run.projectSection?.name ?? runId;
  // RFC 5987: filename* for UTF-8 names; filename must be ASCII-only
  const asciiName = `workflow-${runId}.json`;
  const encodedName = encodeURIComponent(rawName);
  return new NextResponse(JSON.stringify(run.submittedPrompt, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}.json`,
    },
  });
}
