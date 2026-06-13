import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import {
  appendWorkflowVariantSuffix,
  buildWorkflowDownloadPayload,
  getWorkflowDownloadVariant,
} from "@/server/services/workflow-debug-download";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const variant = getWorkflowDownloadVariant(request.url);
  const run = await prisma.run.findUnique({
    where: { id: runId },
    select: { submittedPrompt: true, projectSection: { select: { name: true } } },
  });
  if (!run?.submittedPrompt) {
    return fail("No workflow data", 404);
  }
  const rawName = run.projectSection?.name ?? runId;
  // RFC 5987: filename* for UTF-8 names; filename must be ASCII-only
  const asciiName = `workflow-${runId}${variant === "debug" ? "-debug" : ""}.json`;
  const encodedName = encodeURIComponent(appendWorkflowVariantSuffix(rawName, variant));
  const payload = buildWorkflowDownloadPayload(run.submittedPrompt as Record<string, unknown>, variant);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}.json`,
    },
  });
}
