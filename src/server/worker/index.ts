import { assertEnv } from "@/lib/env";
import { buildComfyPromptDraft, normalizeResolvedConfigSnapshot } from "@/server/worker/payload-builder";
import { listQueuedWorkerRuns } from "@/server/worker/repository";
import { WorkerPassReport } from "@/server/worker/types";

export async function runWorkerPass(limit = 10): Promise<WorkerPassReport> {
  assertEnv();

  const queuedRuns = await listQueuedWorkerRuns(limit);

  return {
    scannedAt: new Date().toISOString(),
    queuedRunCount: queuedRuns.length,
    drafts: queuedRuns.map((run) => ({
      runId: run.runId,
      status: run.status,
      comfyApiUrl: run.comfyApiUrl,
      outputDir: run.outputDir,
      resolvedConfig: normalizeResolvedConfigSnapshot(run.resolvedConfigSnapshot),
      promptDraft: buildComfyPromptDraft(run),
    })),
  };
}
