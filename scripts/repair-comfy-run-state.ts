import fs from "node:fs/promises";
import { db } from "../src/lib/db";
import { pollRunCompletion } from "../src/server/services/run-executor";

type QueueItem = [number, string, Record<string, unknown>, Record<string, unknown>?, string[]?];
type ComfyHistoryEntry = {
  prompt?: QueueItem;
  status?: {
    completed?: boolean;
    status_str?: string;
  };
};

function getRunIdFromPrompt(prompt: Record<string, unknown> | undefined) {
  for (const node of Object.values(prompt ?? {})) {
    if (!node || typeof node !== "object") continue;
    const typedNode = node as { class_type?: string; inputs?: { filename_prefix?: unknown } };
    if (typedNode.class_type === "Image Save" && typeof typedNode.inputs?.filename_prefix === "string") {
      return typedNode.inputs.filename_prefix;
    }
  }
  return null;
}

async function getComfyQueue() {
  const res = await fetch("http://127.0.0.1:8188/queue");
  if (!res.ok) throw new Error(`ComfyUI queue returned ${res.status}`);
  return (await res.json()) as { queue_running?: QueueItem[]; queue_pending?: QueueItem[] };
}

async function historyIsComplete(promptId: string) {
  try {
    const res = await fetch(`http://127.0.0.1:8188/history/${encodeURIComponent(promptId)}`);
    if (!res.ok) return false;
    const payload = (await res.json()) as Record<string, { status?: { completed?: boolean; status_str?: string } }>;
    const history = payload[promptId];
    return history?.status?.completed === true || history?.status?.status_str === "success";
  } catch {
    return false;
  }
}

async function getComfyHistory(maxItems = 500) {
  const res = await fetch(`http://127.0.0.1:8188/history?max_items=${maxItems}`);
  if (!res.ok) throw new Error(`ComfyUI history returned ${res.status}`);
  return (await res.json()) as Record<string, ComfyHistoryEntry>;
}

async function repairQueuedRuns() {
  const queue = await getComfyQueue();
  const items = [
    ...(queue.queue_running ?? []).map((item) => ({ status: "running" as const, item })),
    ...(queue.queue_pending ?? []).map((item) => ({ status: "queued" as const, item })),
  ];

  const repaired: Array<{
    runId: string;
    fromStatus: string;
    fromPromptId: string | null;
    toStatus: "queued" | "running";
    toPromptId: string;
  }> = [];
  const affectedProjectIds = new Set<string>();

  for (const { status, item } of items) {
    const promptId = item[1];
    const runId = getRunIdFromPrompt(item[2]);
    if (!runId || !promptId) continue;

    const run = await db.run.findUnique({
      where: { id: runId },
      select: { id: true, status: true, comfyPromptId: true, projectId: true },
    });
    if (!run || run.status === "done") continue;

    await db.run.update({
      where: { id: runId },
      data: {
        status,
        comfyPromptId: promptId,
        finishedAt: null,
        errorMessage: null,
        ...(status === "queued" ? { startedAt: null } : { startedAt: new Date() }),
      },
    });

    affectedProjectIds.add(run.projectId);
    repaired.push({
      runId,
      fromStatus: run.status,
      fromPromptId: run.comfyPromptId,
      toStatus: status,
      toPromptId: promptId,
    });
  }

  for (const projectId of affectedProjectIds) {
    const runningCount = await db.run.count({ where: { projectId, status: "running" } });
    await db.project.update({
      where: { id: projectId },
      data: { status: runningCount > 0 ? "running" : "queued" },
    });
  }

  return repaired;
}

async function getLatestSubmittedPrompts() {
  const text = await fs.readFile("logs/app.log", "utf8").catch(() => "");
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const latestByRun = new Map<string, { t: number; promptId: string }>();

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let entry: {
      timestamp?: string;
      message?: string;
      context?: { runId?: string; comfyPromptId?: string };
    };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.message !== "Submitted to ComfyUI queue") continue;
    const t = Date.parse(entry.timestamp ?? "");
    const runId = entry.context?.runId;
    const promptId = entry.context?.comfyPromptId;
    if (!Number.isFinite(t) || t < since || !runId || !promptId) continue;

    const prev = latestByRun.get(runId);
    if (!prev || t > prev.t) {
      latestByRun.set(runId, { t, promptId });
    }
  }

  return latestByRun;
}

async function completeFinishedRuns(skipRunIds: Set<string>) {
  const latestByRun = await getLatestSubmittedPrompts();
  const completed: Array<{ runId: string; promptId: string; finalStatus: string | null }> = [];

  for (const [runId, { promptId }] of latestByRun) {
    if (skipRunIds.has(runId)) continue;

    const run = await db.run.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run || run.status === "done") continue;
    if (!(await historyIsComplete(promptId))) continue;

    await db.run.update({
      where: { id: runId },
      data: {
        status: "queued",
        comfyPromptId: promptId,
        finishedAt: null,
        errorMessage: null,
        startedAt: null,
      },
    });

    await pollRunCompletion(runId);
    const after = await db.run.findUnique({ where: { id: runId }, select: { status: true } });
    completed.push({ runId, promptId, finalStatus: after?.status ?? null });
  }

  return completed;
}

async function completeSuccessfulHistoryRuns(skipRunIds: Set<string>) {
  const history = await getComfyHistory();
  const completed: Array<{ runId: string; promptId: string; fromStatus: string; finalStatus: string | null }> = [];

  for (const [promptId, entry] of Object.entries(history)) {
    const isComplete = entry.status?.completed === true || entry.status?.status_str === "success";
    const runId = getRunIdFromPrompt(entry.prompt?.[2]);
    if (!isComplete || !runId || skipRunIds.has(runId)) continue;

    const run = await db.run.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run || run.status === "done" || run.status === "cancelled") continue;

    await db.run.update({
      where: { id: runId },
      data: {
        status: "queued",
        comfyPromptId: promptId,
        finishedAt: null,
        errorMessage: null,
        startedAt: null,
      },
    });

    await pollRunCompletion(runId);
    const after = await db.run.findUnique({ where: { id: runId }, select: { status: true } });
    completed.push({ runId, promptId, fromStatus: run.status, finalStatus: after?.status ?? null });
  }

  return completed;
}

async function main() {
  const repairedQueue = await repairQueuedRuns();
  const activeRunIds = new Set(repairedQueue.map((entry) => entry.runId));
  const completedFromLogs = await completeFinishedRuns(activeRunIds);
  const completedFromHistory = await completeSuccessfulHistoryRuns(activeRunIds);

  console.log(JSON.stringify({
    repairedQueueCount: repairedQueue.length,
    repairedQueue,
    completedFromLogsCount: completedFromLogs.length,
    completedFromLogs,
    completedFromHistoryCount: completedFromHistory.length,
    completedFromHistory,
  }, null, 2));
}

main()
  .finally(async () => {
    await db.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
