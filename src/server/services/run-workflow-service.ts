import { prisma } from "@/lib/prisma";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";
import { ServiceValidationError } from "@/server/services/validation-utils";
import {
  appendWorkflowVariantSuffix,
  buildWorkflowDownloadPayload,
  type WorkflowDownloadVariant,
} from "@/server/services/workflow-debug-download";

type RunWorkflowDownload = {
  body: string;
  headers: Record<string, string>;
};

export async function buildRunWorkflowDownload(
  runId: string,
  variant: WorkflowDownloadVariant,
): Promise<RunWorkflowDownload> {
  const run = await prisma.run.findFirst({
    where: {
      id: runId,
      project: buildGenerationProjectWhere(),
    },
    select: { submittedPrompt: true, projectSection: { select: { name: true } } },
  });

  if (!run?.submittedPrompt) {
    throw new ServiceValidationError("No workflow data", 404);
  }

  const rawName = run.projectSection?.name ?? runId;
  const asciiName = `workflow-${runId}${variant === "debug" ? "-debug" : ""}.json`;
  const encodedName = encodeURIComponent(appendWorkflowVariantSuffix(rawName, variant));
  const payload = buildWorkflowDownloadPayload(run.submittedPrompt as Record<string, unknown>, variant);

  return {
    body: JSON.stringify(payload, null, 2),
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}.json`,
    },
  };
}
