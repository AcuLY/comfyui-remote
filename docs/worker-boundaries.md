# Worker Boundaries

This document records the current worker ownership split for generation and training execution. It is a boundary map, not a runtime runbook; operational deploy and queue controls still live under `agent-rules/deploy/**`.

## Generation Worker

`src/server/worker/payload-builder.ts` owns generation prompt draft normalization. It converts a `WorkerRunSnapshot.resolvedConfigSnapshot` into a `ComfyPromptDraft`, composes legacy prompt blocks only for older snapshots, and keeps the output free of database writes, ComfyUI submission, polling, and fallback graph construction.

`src/server/worker/repository.ts` owns generation run persistence. It lists queued runs, serializes `WorkerRunSnapshot` records, completes runs, persists submitted prompt metadata, updates image output records through service orchestration, and keeps generation resource filters applied around run reads and writes.

`src/server/services/run-executor.ts` is the orchestrator between those modules. It imports `buildComfyPromptDraft` from the payload builder and run lookup/completion helpers from the repository, then hands the draft to `src/server/services/comfyui-service.ts` for validation, submission, polling, and metadata extraction.

Do not let repositories import payload builders. Do not let payload builders import repositories, `@/lib/db`, ComfyUI service modules, or fallback prompt construction.

## Fallback Prompt Builder

`src/server/worker/fallback-prompt-builder.ts` is last resort only. It exists so the ComfyUI validation boundary can still build a minimal SDXL txt2img graph if the default workflow template is unavailable.

The default standard workflow is `docs/workflow.api.json`, loaded by `src/server/services/comfyui-service.ts` and mapped through `src/server/services/workflow-prompt-builder.ts`.

Current prompt selection order:

1. explicit `comfyPrompt`, `workflowApiPrompt`, or `apiPrompt` from `extraParams`;
2. `docs/workflow.api.json` as the default standard workflow;
3. built-in SDXL txt2img fallback from `src/server/worker/fallback-prompt-builder.ts`.

Do not call the fallback prompt builder from run-executor, repositories, route handlers, or UI modules. If fallback usage becomes visible to users, add logging or audit at the ComfyUI validation boundary instead of broadening the fallback builder.

## Training Worker Task API

`src/server/worker/training/task-id.ts` owns training worker task ID parsing. It maps the generation, dataset freeze, and training run task prefixes to target IDs, target types, and worker types, and it builds the serialized worker task IDs returned by `src/server/worker/training/task-api.ts`.

`src/server/worker/training/target-discovery.ts` owns training worker target discovery. It maps database rows into `WorkerTarget` values, counts queued/running work by worker type, finds queued or running targets, and resolves a serialized worker task ID back to its backing generation task, dataset revision, or training run.

`src/server/worker/training/task-api.ts` remains the compatibility boundary for existing route handlers while the larger split continues. It may compose target discovery, leasing, heartbeat, completion, failure, and scheduler helpers, but it should not own pure task ID prefix parsing.

Do not reintroduce worker task ID prefix parsing into task-api, route handlers, or CLI worker scripts. Do not reintroduce target discovery queries into task-api; leasing may call discovery helpers, but discovery should stay isolated from state transitions. New worker task kinds should first extend the task ID and discovery boundaries, then add route/service tests for lease, heartbeat, complete, and fail behavior.

## Verification

```bash
node --import tsx --test tests/test-worker-boundary-governance.test.ts tests/test-run-submission-deferral.test.ts tests/test-run-recovery-poller-cap.test.ts tests/test-repo-inventory.test.ts
```

Run `npm run lint` and `npm test` for implementation batches that change worker code.
