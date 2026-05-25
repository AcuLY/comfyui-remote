# Queue Pause/Resume Design

## Overview

Add per-task pause and resume capability to the run queue. Pausing sends a cancel signal to ComfyUI and preserves the submitted workflow; resuming re-submits the same workflow to ComfyUI. Pausing one task does not affect others.

## Data Model

Add `paused` to the `RunStatus` enum in both Prisma schemas and `src/lib/db-enums.ts`:

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

No new tables or columns required. The existing `Run.submittedPrompt` (JSON of the full ComfyUI workflow) is used to re-submit on resume.

## Server Actions

File: `src/lib/actions/run.ts`

### `pauseRun(runId: string): Promise<{ ok: boolean; error?: string }>`

1. Load Run; verify status is `queued` or `running`.
2. Determine ComfyUI queue position via `getComfyQueuePosition()`:
   - `running` → call `interruptComfyPrompt()`.
   - `pending` → call `deleteComfyQueueItems([comfyPromptId])`.
   - `not_found` → skip ComfyUI call (prompt already finished or was never submitted).
3. Update Run: `status = 'paused'`, clear `comfyPromptId` (old ID is now invalid).
4. Recalculate project status via existing `updateProjectStatus` logic (treat `paused` as active).
5. `revalidatePath("/queue")`.

### `resumeRun(runId: string): Promise<{ ok: boolean; error?: string }>`

1. Load Run; verify status is `paused` and `submittedPrompt` exists.
2. Re-submit to ComfyUI: call `submitComfyPrompt()` with the stored `submittedPrompt` as the validated prompt.
3. Update Run: `status = 'queued'`, set new `comfyPromptId`.
4. Fire `pollRunCompletion(runId)` (fire-and-forget).
5. Recalculate project status.
6. `revalidatePath("/queue")`.

### `pauseAllRuns(): Promise<{ ok: boolean; count: number }>`

Find all runs with status `queued` or `running`. For each, call the `pauseRun` logic. Return total paused count.

### `resumeAllRuns(): Promise<{ ok: boolean; count: number }>`

Find all runs with status `paused`. For each, call the `resumeRun` logic. Return total resumed count.

## Resume Submission Detail

The `submittedPrompt` stored on the Run is the exact JSON payload previously sent to ComfyUI's `/prompt` endpoint. On resume, wrap it in a `ValidatedComfyPromptDraft`-compatible shape and call `submitComfyPrompt()` directly. This bypasses the validation step (the prompt was already validated on first submit) but retains the same submission path.

Specifically:
```typescript
const apiUrl = env.comfyApiUrl;
const normalized = apiUrl.trim().replace(/\/+$/, "");
const res = await fetch(`${normalized}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: run.submittedPrompt }),
});
const { prompt_id } = await res.json();
```

This is simpler than reconstructing a `ValidatedComfyPromptDraft` — we already have the final workflow JSON.

## Type Changes

### `src/lib/db-enums.ts`

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

### `src/lib/types.ts`

Extend `RunningRun.status`:
```typescript
export type RunningRun = {
  // ...existing fields...
  status: "queued" | "running" | "paused";
};
```

## Queue Data Repository

`src/server/repositories/queue-data-repository.ts` — include `paused` in the query filter for "active/running" runs so they appear in the Running tab data.

## Worker Repository

`src/server/worker/repository.ts` — in `updateProjectStatus`, treat `paused` runs as "active" (the project should not transition to `draft` if it only has paused runs). Add `RunStatus.paused` to the active status filter.

## Run Executor

`src/server/services/run-executor.ts` — no changes needed. `recoverStaleRuns` queries `status: { in: [queued, running] }` which naturally excludes `paused`.

## Frontend UI

File: `src/app/queue/queue-page-client.tsx`

### Running Tab changes:

1. **Batch buttons** at top of Running tab:
   - "全部暂停" button (visible when there are queued/running runs)
   - "全部恢复" button (visible when there are paused runs)

2. **Per-run cards:**
   - Runs with status `queued` or `running`: show existing Cancel button + new Pause button (⏸)
   - Runs with status `paused`: different card style (muted/dimmed), show Resume button (▶) + Cancel button

3. **Status badge:**
   - `paused` → amber/yellow badge with "已暂停" text (no spinner)

### Tab badge count:

The "运行中" tab badge should include paused runs in its count (since they are displayed there).

## Edge Cases

- **ComfyUI unreachable on pause**: Still mark as `paused` in DB (best-effort). The prompt may complete in ComfyUI independently; `recoverStaleRuns` won't pick it up since status is `paused`. This is acceptable — the user can resume (which will start fresh) or cancel.
- **ComfyUI unreachable on resume**: Return error `{ ok: false, error: "无法连接到 ComfyUI" }`, keep status as `paused`.
- **Run lacks submittedPrompt**: Return error `{ ok: false, error: "缺少工作流快照，无法恢复" }`.
- **Interrupt is global**: Only call `interruptComfyPrompt` when `getComfyQueuePosition` confirms the prompt is `running` (same safeguard as existing `cancelRun`).
- **Pause during finalization**: If the run is in the `__finalizing__` phase (outputDir starts with marker), reject pause — it's about to complete anyway.

## Files Modified

1. `prisma/schema.prisma` — add `paused` to RunStatus enum
2. `src/lib/db-enums.ts` — add `paused` to RunStatus const
3. `src/lib/types.ts` — extend RunningRun.status
4. `src/lib/actions/run.ts` — add pauseRun, resumeRun, pauseAllRuns, resumeAllRuns
5. `src/lib/actions/index.ts` — export new actions
6. `src/server/repositories/queue-data-repository.ts` — include paused in active run query
7. `src/server/worker/repository.ts` — treat paused as active in updateProjectStatus
8. `src/app/queue/queue-page-client.tsx` — add pause/resume UI
