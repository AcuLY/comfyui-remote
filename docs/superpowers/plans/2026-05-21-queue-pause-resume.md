# Queue Pause/Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-task pause and resume to the run queue — pausing cancels in ComfyUI and preserves the workflow; resuming re-submits it.

**Architecture:** New `paused` enum value in RunStatus. `pauseRun` interrupts/deletes from ComfyUI then sets status to paused. `resumeRun` re-submits the stored `submittedPrompt` to ComfyUI and resumes polling. Frontend adds pause/resume buttons in the Running tab.

**Tech Stack:** Prisma (PostgreSQL), Next.js server actions, React client components, ComfyUI REST API.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `paused` to RunStatus enum |
| Modify | `src/lib/db-enums.ts` | Add `paused` constant |
| Modify | `src/lib/types.ts` | Extend RunningRun status type |
| Modify | `src/lib/actions/run.ts` | Add pauseRun, resumeRun, pauseAllRuns, resumeAllRuns |
| Modify | `src/server/repositories/queue-data-repository.ts` | Include paused runs in getRunningRuns query |
| Modify | `src/server/worker/repository.ts` | Treat paused as active in updateProjectStatus |
| Modify | `src/app/queue/queue-page-client.tsx` | Add pause/resume UI buttons |

---

### Task 1: Add `paused` to RunStatus enum and types

**Files:**
- Modify: `prisma/schema.prisma:18-24`
- Modify: `src/lib/db-enums.ts:33-39`
- Modify: `src/lib/types.ts:26-43`

- [ ] **Step 1: Add `paused` to Prisma schema**

In `prisma/schema.prisma`, add `paused` after `cancelled` in the RunStatus enum:

```prisma
enum RunStatus {
  queued
  running
  done
  failed
  cancelled
  paused
}
```

- [ ] **Step 2: Add `paused` to db-enums.ts**

In `src/lib/db-enums.ts`, update the RunStatus object:

```typescript
export const RunStatus = {
  queued: "queued",
  running: "running",
  done: "done",
  failed: "failed",
  cancelled: "cancelled",
  paused: "paused",
} as const;
```

- [ ] **Step 3: Extend RunningRun type**

In `src/lib/types.ts`, change line with `status`:

```typescript
export type RunningRun = {
  id: string;
  presetNames: string[];
  projectTitle: string;
  sectionName: string;
  startedAt: string;
  status: "queued" | "running" | "paused";
  progress: {
    percent: number;
    currentStep: number;
    totalSteps: number;
    elapsed: string | null;
    remaining: string | null;
    rate: string | null;
    stage: number;
    updatedAt: string | null;
  } | null;
};
```

- [ ] **Step 4: Run prisma generate**

Run: `npx prisma generate`

Expected: Prisma client regenerated with new `paused` enum value.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/db-enums.ts src/lib/types.ts src/generated/
git commit -m "feat(queue): add paused RunStatus enum value and type"
```

---

### Task 2: Update worker repository to treat paused as active

**Files:**
- Modify: `src/server/worker/repository.ts:70-78`

- [ ] **Step 1: Add paused to active status filter in updateProjectStatus**

In `src/server/worker/repository.ts`, the `updateProjectStatus` function queries active runs. Update the `where` clause on line ~74:

```typescript
async function updateProjectStatus(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const activeRuns = await tx.run.groupBy({
    by: ["status"],
    where: {
      projectId: projectId,
      status: { in: [RunStatus.queued, RunStatus.running, RunStatus.paused] },
    },
    _count: {
      _all: true,
    },
  });

  const activeRunCountByStatus = new Map(
    activeRuns.map((entry) => [entry.status, entry._count._all]),
  );

  let nextStatus: JobStatus = JobStatus.draft;

  if ((activeRunCountByStatus.get(RunStatus.running) ?? 0) > 0) {
    nextStatus = JobStatus.running;
  } else if ((activeRunCountByStatus.get(RunStatus.queued) ?? 0) > 0) {
    nextStatus = JobStatus.queued;
  } else if ((activeRunCountByStatus.get(RunStatus.paused) ?? 0) > 0) {
    nextStatus = JobStatus.queued;
  } else {
    // existing logic for done/failed/cancelled...
```

The `else if` for paused sets project status to `queued` (indicating it has work pending but nothing actively running).

- [ ] **Step 2: Commit**

```bash
git add src/server/worker/repository.ts
git commit -m "feat(queue): treat paused runs as active in project status"
```

---

### Task 3: Update queue-data-repository to include paused runs

**Files:**
- Modify: `src/server/repositories/queue-data-repository.ts:322-368`

- [ ] **Step 1: Update getRunningRuns query to include paused**

In `src/server/repositories/queue-data-repository.ts`, modify the `getRunningRuns` function:

```typescript
export async function getRunningRuns(): Promise<RunningRun[]> {
  const runs = await prisma.run.findMany({
    where: { status: { in: ["queued", "running", "paused"] } },
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: { id: true, title: true, coverImageId: true, presetBindings: true },
      },
      projectSection: true,
    },
  });

  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.project.presetBindings)),
  );
  const activeRunningRun = runs.find((run) => run.status === "running");
  const activeProgress = activeRunningRun
    ? getLatestComfyLogProgress(activeRunningRun.startedAt ?? activeRunningRun.createdAt)
    : null;

  return runs.map((run) => {
    const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);
    return {
      id: run.id,
      presetNames,
      projectTitle: run.project.title,
      sectionName:
        run.projectSection.name ??
        `section_${run.projectSection.sortOrder + 1}`,
      startedAt: formatDate(run.startedAt ?? run.createdAt),
      status: run.status as RunningRun["status"],
      progress:
        run.id === activeRunningRun?.id && activeProgress
          ? {
              percent: activeProgress.percent,
              currentStep: activeProgress.currentStep,
              totalSteps: activeProgress.totalSteps,
              elapsed: activeProgress.elapsed,
              remaining: activeProgress.remaining,
              rate: activeProgress.rate,
              stage: activeProgress.stage,
              updatedAt: activeProgress.updatedAt,
            }
          : null,
    };
  });
}
```

The only change is in the `where` clause: `{ in: ["queued", "running", "paused"] }`.

- [ ] **Step 2: Commit**

```bash
git add src/server/repositories/queue-data-repository.ts
git commit -m "feat(queue): include paused runs in running tab data"
```

---

### Task 4: Implement pauseRun and resumeRun server actions

**Files:**
- Modify: `src/lib/actions/run.ts`

- [ ] **Step 1: Add pauseRun function**

Add the following after the existing `cancelRun` function in `src/lib/actions/run.ts`:

```typescript
// ---------------------------------------------------------------------------
// 暂停任务（Run）
// ---------------------------------------------------------------------------

export async function pauseRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    select: { id: true, status: true, projectId: true, comfyPromptId: true, outputDir: true },
  });
  if (!run) return { ok: false, error: "任务不存在" };
  if (run.status !== "queued" && run.status !== "running") {
    return { ok: false, error: `任务状态为「${run.status}」，无法暂停` };
  }

  // Reject pause during finalization
  if (run.outputDir?.startsWith("__finalizing__:")) {
    return { ok: false, error: "任务即将完成，无法暂停" };
  }

  // Cancel in ComfyUI (best-effort)
  if (run.comfyPromptId) {
    try {
      const position = await getComfyQueuePosition(env.comfyApiUrl, run.comfyPromptId);
      if (position === "running") {
        await interruptComfyPrompt(env.comfyApiUrl);
      } else if (position === "pending") {
        await deleteComfyQueueItems(env.comfyApiUrl, [run.comfyPromptId]);
      }
    } catch (e) {
      console.warn("Failed to cancel in ComfyUI during pause:", e);
    }
  }

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: "paused",
      comfyPromptId: null,
    },
  });

  // Recalculate project status
  const activeRuns = await prisma.run.count({
    where: { projectId: run.projectId, status: { in: ["queued", "running"] } },
  });
  if (activeRuns === 0) {
    const pausedRuns = await prisma.run.count({
      where: { projectId: run.projectId, status: "paused" },
    });
    await prisma.project.update({
      where: { id: run.projectId },
      data: { status: pausedRuns > 0 ? "queued" : "draft" },
    });
  }

  revalidatePath("/queue");
  return { ok: true };
}
```

- [ ] **Step 2: Add resumeRun function**

Add immediately after `pauseRun`:

```typescript
// ---------------------------------------------------------------------------
// 恢复任务（Run）
// ---------------------------------------------------------------------------

export async function resumeRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    select: { id: true, status: true, projectId: true, submittedPrompt: true },
  });
  if (!run) return { ok: false, error: "任务不存在" };
  if (run.status !== "paused") {
    return { ok: false, error: `任务状态为「${run.status}」，无法恢复` };
  }
  if (!run.submittedPrompt) {
    return { ok: false, error: "缺少工作流快照，无法恢复" };
  }

  // Re-submit to ComfyUI
  let newComfyPromptId: string;
  try {
    const apiUrl = env.comfyApiUrl.trim().replace(/\/+$/, "");
    const res = await fetch(`${apiUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: run.submittedPrompt }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "unknown error");
      throw new Error(`ComfyUI returned ${res.status}: ${text}`);
    }
    const data = await res.json();
    newComfyPromptId = data.prompt_id;
    if (!newComfyPromptId) {
      throw new Error("ComfyUI did not return prompt_id");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `无法连接到 ComfyUI: ${msg}` };
  }

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: "queued",
      comfyPromptId: newComfyPromptId,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
    },
  });

  // Update project status to queued/running
  await prisma.project.update({
    where: { id: run.projectId },
    data: { status: "queued" },
  });

  // Fire-and-forget: poll for completion
  pollRunCompletion(runId).catch((err) => {
    logger.error("pollRunCompletion failed after resume", err instanceof Error ? err : new Error(String(err)), { runId });
  });

  revalidatePath("/queue");
  return { ok: true };
}
```

- [ ] **Step 3: Add pauseAllRuns function**

```typescript
// ---------------------------------------------------------------------------
// 一键暂停所有运行中的任务
// ---------------------------------------------------------------------------

export async function pauseAllRuns(): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const activeRuns = await prisma.run.findMany({
      where: { status: { in: ["queued", "running"] } },
      select: { id: true },
    });

    let count = 0;
    for (const run of activeRuns) {
      const result = await pauseRun(run.id);
      if (result.ok) count++;
    }

    revalidatePath("/queue");
    return { ok: true, count };
  } catch (e) {
    console.error("Failed to pause all runs:", e);
    return { ok: false, count: 0, error: "批量暂停失败" };
  }
}
```

- [ ] **Step 4: Add resumeAllRuns function**

```typescript
// ---------------------------------------------------------------------------
// 一键恢复所有暂停的任务
// ---------------------------------------------------------------------------

export async function resumeAllRuns(): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const pausedRuns = await prisma.run.findMany({
      where: { status: "paused" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    let count = 0;
    for (const run of pausedRuns) {
      const result = await resumeRun(run.id);
      if (result.ok) count++;
    }

    revalidatePath("/queue");
    return { ok: true, count };
  } catch (e) {
    console.error("Failed to resume all runs:", e);
    return { ok: false, count: 0, error: "批量恢复失败" };
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/run.ts
git commit -m "feat(queue): implement pauseRun, resumeRun, pauseAllRuns, resumeAllRuns"
```

---

### Task 5: Add pause/resume UI to queue page

**Files:**
- Modify: `src/app/queue/queue-page-client.tsx`

- [ ] **Step 1: Add imports for new actions and icons**

At the top of `src/app/queue/queue-page-client.tsx`, update the imports:

```typescript
import { cancelRun, runSection, clearRuns, clearActiveRuns, clearTrash, restoreImage, pauseRun, resumeRun, pauseAllRuns, resumeAllRuns } from "@/lib/actions";
```

Add `Pause, Play` to the lucide-react import:

```typescript
import { RotateCw, ChevronLeft, ChevronRight, Clock3, Loader2, RefreshCw, AlertTriangle, XCircle, ImageIcon, Trash2, RotateCcw, Pause, Play } from "lucide-react";
```

- [ ] **Step 2: Add batch pause/resume buttons to Running tab header**

Replace the existing Running tab section (starting at `{activeTab === "running" && (`) with:

```tsx
{/* Running tab */}
{activeTab === "running" && (
  <SectionCard title="运行中" subtitle="自动每 5 秒刷新。">
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
      {runningRuns.some((r) => r.status === "queued" || r.status === "running") && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const result = await pauseAllRuns();
              if (result.ok) {
                toast.success(`已暂停 ${result.count} 个任务`);
                refresh();
              } else {
                toast.error(result.error ?? "批量暂停失败");
              }
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-40"
        >
          <Pause className="size-3.5" /> 全部暂停
        </button>
      )}
      {runningRuns.some((r) => r.status === "paused") && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const result = await resumeAllRuns();
              if (result.ok) {
                toast.success(`已恢复 ${result.count} 个任务`);
                refresh();
              } else {
                toast.error(result.error ?? "批量恢复失败");
              }
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40"
        >
          <Play className="size-3.5" /> 全部恢复
        </button>
      )}
      <button
        type="button"
        disabled={isPending || runningRuns.length === 0}
        onClick={handleClearActiveRuns}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
      >
        <Trash2 className="size-3.5" /> 清空运行中队列
      </button>
    </div>
    <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
      {runningRuns.length === 0 && (
        <div className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center text-sm text-zinc-500 md:col-span-2">
          暂无运行中的项目
        </div>
      )}
      {runningRuns.map((run) => (
        <div
          key={run.id}
          id={`run-${run.id}`}
          className={`w-full rounded-xl border p-3 md:max-w-[500px] ${
            run.status === "paused"
              ? "border-amber-500/20 bg-amber-500/[0.03]"
              : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">{run.projectTitle}</div>
              <div className="mt-1 text-xs text-zinc-400">{run.projectTitle}：{run.sectionName}</div>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[11px] ${
              run.status === "paused"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                : run.status === "running"
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                  : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
            }`}>
              {run.status === "paused" ? (
                <>
                  <Pause className="mr-1 inline size-3" />
                  已暂停
                </>
              ) : (
                <>
                  <Loader2 className={`mr-1 inline size-3 ${run.status === "running" ? "animate-spin" : ""}`} />
                  {run.status === "running" ? "运行中" : "排队中"}
                </>
              )}
            </span>
          </div>
          {run.status !== "paused" && <RunProgressView run={run} />}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-3 text-xs text-zinc-400">
              <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                <Clock3 className="mb-1 size-3.5" />
                {run.startedAt}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {run.status === "paused" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await resumeRun(run.id);
                      if (result.ok) {
                        toast.success("任务已恢复");
                        refresh();
                      } else {
                        toast.error(result.error ?? "恢复失败");
                      }
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Play className="size-3" /> 恢复
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await pauseRun(run.id);
                      if (result.ok) {
                        toast.success("任务已暂停");
                        refresh();
                      } else {
                        toast.error(result.error ?? "暂停失败");
                      }
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                >
                  <Pause className="size-3" /> 暂停
                </button>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await cancelRun(run.id);
                    if (result.ok) {
                      toast.success("任务已取消");
                      setRunningRuns((prev) => prev.filter((r) => r.id !== run.id));
                    } else {
                      toast.error(result.error ?? "取消失败");
                    }
                  });
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                <XCircle className="size-3" /> 取消
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </SectionCard>
)}
```

- [ ] **Step 3: Update cancelRun to also handle paused runs**

In `src/lib/actions/run.ts`, update the `cancelRun` function's status check to also allow cancelling paused runs:

```typescript
if (run.status !== "queued" && run.status !== "running" && run.status !== "paused") {
  return { ok: false, error: `任务状态为「${run.status}」，无法取消` };
}
```

And skip ComfyUI cancellation for paused runs (they have no active prompt):

```typescript
if (run.comfyPromptId && run.status !== "paused") {
  // existing ComfyUI cancel logic...
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/queue/queue-page-client.tsx src/lib/actions/run.ts
git commit -m "feat(queue): add pause/resume UI and allow cancelling paused runs"
```

---

### Task 6: Database migration and final verification

**Files:**
- Create: `prisma/migrations/<timestamp>_add_run_status_paused/migration.sql` (auto-generated)

- [ ] **Step 1: Generate and apply database migration**

Run: `npx prisma migrate dev --name add_run_status_paused`

This generates a migration SQL like:
```sql
ALTER TYPE "RunStatus" ADD VALUE 'paused';
```

Expected: Migration applied successfully.

- [ ] **Step 2: Verify build passes**

Run: `npx next build`

Expected: Build completes without type errors.

- [ ] **Step 3: Commit migration**

```bash
git add prisma/migrations/
git commit -m "chore(db): add paused value to RunStatus enum migration"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start dev server and verify the Running tab loads**

Run: `npm run dev`

Navigate to `/queue`, switch to "运行中" tab. Verify it loads without errors.

- [ ] **Step 2: Submit a run and test pause**

1. Submit a project run from the project page
2. In the Running tab, click "暂停" on the running/queued task
3. Verify the task shows "已暂停" badge with amber styling
4. Verify ComfyUI no longer shows this prompt in its queue

- [ ] **Step 3: Test resume**

1. Click "恢复" on the paused task
2. Verify it returns to "排队中" or "运行中"
3. Verify ComfyUI receives the new prompt

- [ ] **Step 4: Test batch operations**

1. Submit multiple section runs
2. Click "全部暂停" — verify all tasks become paused
3. Click "全部恢复" — verify all tasks resume

- [ ] **Step 5: Test cancel on paused run**

1. Pause a run
2. Click "取消" on the paused run
3. Verify it disappears from the Running tab
