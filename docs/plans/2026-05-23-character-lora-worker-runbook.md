# Character LoRA 外置 Worker Runbook

日期：2026-05-23

范围：`scripts/character-lora-training/worker-common.ts`、`image-worker.ts`、`dataset-freeze-worker.ts`、`training-worker.ts`、`benchmark-worker.ts`。

## Manager 连接与认证

默认连接本机 Manager：

```powershell
$env:CHARACTER_LORA_MANAGER_URL="http://127.0.0.1:3000"
```

Worker 会用 `x-api-token` 调用 Manager API。token 来源按顺序读取：

1. 当前进程 `AUTH_TOKEN`
2. 当前进程 `CHARACTER_LORA_MANAGER_TOKEN`
3. 项目根目录 `.env` 的 `AUTH_TOKEN`
4. 项目根目录 `.env` 的 `CHARACTER_LORA_MANAGER_TOKEN`

脚本只在启动日志和 artifact summary 中记录 auth source shape，例如 `env:AUTH_TOKEN`、`hasToken=true`。不要把 token 值写入 DB、日志或 artifact。

## Worker Queue Supervisor

常驻队列入口用于一次性启动 `image_generation`、`dataset_freeze`、`training`、`benchmark` 四类 worker，避免任务只入队但长期没有进程领取。它不运行在 Next.js 内，也不负责启动/重启 Manager；需要和 Manager 服务并行常驻。

真实队列：

```powershell
cmd /c npm run character-lora:workers
```

本地 mock/debug 队列：

```powershell
cmd /c npm run character-lora:workers:mock
```

手动覆盖参数：

```powershell
cmd /c npx tsx scripts/character-lora-training/worker-queue.ts --worker-owner-prefix character-lora-queue --interval-ms 5000 --lease-seconds 300
```

常用选项：

- `--mock-image`：image worker 强制使用 `mock-local`。
- `--image-provider task-request|mock-local|openai-codex`：默认 `task-request`，即使用任务 payload 中的 provider。
- `--dry-run-training` / `--mock-complete-training`：训练 worker 本地调试路径。
- `--benchmark-skip-wait` / `--benchmark-timeout-ms <ms>`：benchmark worker 调试或长任务等待控制。
- `--skip-image` / `--skip-dataset-freeze` / `--skip-training` / `--skip-benchmark`：只启动部分 worker。

状态检测：

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/character-lora-training/worker/status" -Headers @{ "x-api-token" = $env:AUTH_TOKEN }
```

`worker/status` 会返回全局 queued/running/failed/cancelled/done 计数、每类 worker 的最近 heartbeat、未被 lease 的 queued 数量、过期 running lease 数量和推荐 supervisor 命令。Workbench 的 Report / Diagnostics 区会展示同一状态；如果出现 queued 但没有 running/heartbeat，优先启动 supervisor，而不是重复入队。

## Image Worker

默认使用 task payload 中的 `request.provider`；当前 Manager 生成任务默认写入 `openai-codex`。`--provider` 是强制 override，生产或真实验收时不要传 `--provider mock-local`；只有本地 smoke/debug 才显式传 `--provider mock-local`。

无外部 token 的本地 smoke/debug：

```powershell
cmd /c npx tsx scripts/character-lora-training/image-worker.ts --once --provider mock-local --worker-owner image-worker-local
```

真实 Codex / GPT-Image-2 provider 单次处理：

```powershell
$env:CHARACTER_LORA_CODEX_BEARER_TOKEN="<set outside logs>"
$env:CHARACTER_LORA_CODEX_BASE_URL="https://chatgpt.com/backend-api/codex/responses"
$env:CHARACTER_LORA_CODEX_HOST_MODEL="gpt-5.5"
cmd /c npx tsx scripts/character-lora-training/image-worker.ts --once --worker-owner image-worker-codex
```

真实 Codex / GPT-Image-2 provider 持续轮询：

```powershell
$env:CHARACTER_LORA_CODEX_BEARER_TOKEN="<set outside logs>"
$env:CHARACTER_LORA_CODEX_BASE_URL="https://chatgpt.com/backend-api/codex/responses"
$env:CHARACTER_LORA_CODEX_HOST_MODEL="gpt-5.5"
cmd /c npx tsx scripts/character-lora-training/image-worker.ts --poll --worker-owner image-worker-codex
```

可选项：

- `CHARACTER_LORA_CODEX_ACCOUNT_ID`：传给 `ChatGPT-Account-ID`。
- `CODEX_OAUTH_TOKEN`：备用 bearer token 来源。
- `CHARACTER_LORA_CODEX_AUTH_FILE`：专用 auth JSON 文件，支持 `access_token` / `accessToken` / `bearer_token` / `bearerToken` / `token` 字段。artifact 只记录文件来源和是否含 refresh token，不记录值。

`mock-local` 会写入 1x1 PNG、`request.redacted.json` 和 `response-summary.json`，然后 complete task。`openai-codex` 会把 `hostInstruction` 放入 Responses `instructions`，把 `renderedPrompt` 或 `visualPrompt` 放入 input text，把 job artifactRoot 下的 input image relativePath 读成 data URL，请求落盘版本会 redact 图片 bytes 和 auth。

## Dataset Freeze Worker

默认 `POST /api/character-lora-training/jobs/:jobId/dataset-revisions` 仍同步冻结数据集。请求体传入 `queue: true` 时，Manager 会先完整校验当前 selected canonical / prompt card、`keep` 图片、`targetKeepCount` 与 `force/forceReason` 规则，然后把本次 `keepImageIds`、`captionStrategy`、`repeatCount`、`sourceWeight`、`canonicalVersionId`、`promptCardVersionId`、`datasetRevisionId` 和 `version` 快照进 `workerType=dataset_freeze`、`targetType=datasetRevision` 的 worker task。

单次处理：

```powershell
cmd /c npx tsx scripts/character-lora-training/dataset-freeze-worker.ts --once --worker-owner dataset-freeze-worker-local
```

持续轮询：

```powershell
cmd /c npx tsx scripts/character-lora-training/dataset-freeze-worker.ts --poll --worker-owner dataset-freeze-worker-local
```

Dataset freeze worker 不直接读写 artifact。它 lease `dataset_freeze` task 后先 heartbeat，再调用通用 `POST /api/character-lora-training/worker/tasks/:taskId/complete`，服务端会根据 task payload 快照执行与同步 freeze 相同的 train image materialize、manifest、metadata.jsonl、caption audit 和 DB revision 创建逻辑。失败时 worker 调用 fail API，Manager 会把 task 标记为 failed，并把 job 置为 dataset 阶段失败。

重复 complete、非 running task 或 lease owner 不匹配都会由 Manager 拒绝；如果 enqueue 后已有其他 revision 占用了同一个版本号，需要重新 enqueue 以分配新的 version。

## Training Worker

真实训练命令由外部环境提供：

```powershell
$env:CHARACTER_LORA_TRAINING_COMMAND="accelerate launch train_network.py --config_file %CHARACTER_LORA_CONFIG_PATH%"
cmd /c npx tsx scripts/character-lora-training/training-worker.ts --once --worker-owner training-worker-local
```

Worker 会给子进程注入：

- `CHARACTER_LORA_JOB_ROOT`
- `CHARACTER_LORA_TRAIN_DIR`
- `CHARACTER_LORA_CONFIG_PATH`
- `CHARACTER_LORA_OUTPUT_DIR`
- `CHARACTER_LORA_BASE_CHECKPOINT`
- `CHARACTER_LORA_CANCEL_SIGNAL`

训练日志固定写入 `${outputDir}/train.log`。Worker 会周期性从日志尾部解析 `step/targetSteps/loss/ETA` 并 heartbeat。命令成功退出后，Worker 扫描 outputDir 最新 `.safetensors` 作为 final artifact，扫描 `checkpoint-step-*` 作为 checkpoints，计算 sha256，写入 `hashes.json`，然后 complete task。

只校验输入和写 dummy log：

```powershell
cmd /c npx tsx scripts/character-lora-training/training-worker.ts --once --dry-run --worker-owner training-worker-dry
```

`--dry-run` 默认不会 fake 成功，也不会生成 safetensors；它会 fail 当前 task，避免把未训练结果登记为成功。只有明确加 `--mock-complete` 才会写 dummy `.safetensors` 并 complete：

```powershell
cmd /c npx tsx scripts/character-lora-training/training-worker.ts --once --dry-run --mock-complete --worker-owner training-worker-smoke
```

## Benchmark Worker

真实训练完成并开启 post-training benchmark 时，Manager 会创建 `workerType=benchmark`、`targetType=benchmarkRun` 的 worker task。Benchmark worker 会读取 job report 中对应的 `benchmarkRunId`，解析 `testProjectId`、`checkpointMatrix` 和 `weightMatrix`，提交临时测试 project，然后默认等待这批 run 的 `latestRun` 全部进入 `done` 或 `failed`。

Benchmark 可从两个 HTTP 入口创建：

- `POST /api/character-lora-training/training-runs/:trainingRunId/benchmark-runs`：显式从某个 training run 启动。
- `POST /api/character-lora-training/jobs/:jobId/benchmark-runs`：从 job 上下文启动；body 中可选 `trainingRunId`，且该 run 必须属于当前 job。未传时 Manager 会选择该 job 最新的 `done` 且有 `finalSafetensorsArtifactId` 的 training run。两种入口最终都调用同一个 benchmark enqueue service，因此完成状态、final safetensors、ProjectTemplate、ComfyUI busy 和 GPU lock 规则不会分叉。

Benchmark enqueue 会先检查当前 ComfyUI queued/running 数量和 active LoRA `GpuTaskLock`。`queuePolicy=reject_when_busy` 时，只要 ComfyUI 忙或已有 active LoRA GPU lock，就返回 409，details 包含 `comfyQueue` 和 `gpuTaskLocks`；`queue_when_busy` / `ignore_busy` 会继续创建 benchmark，但会把 busy 状态写入 warnings 和 benchmark lock metadata。非 `dryRun` / 非 `skipQueue` 的 benchmark task 会创建 `taskType=benchmark`、`ownerType=character_lora_benchmark_run`、`ownerId=benchmarkRun.id` 的 active GPU lock；benchmark complete 或 worker fail 会释放该 lock。`dryRun` / `skipQueue` 不会创建 GPU lock。

真实 benchmark（非 `dryRun` 且非 `skipQueue`）必须复用可用 ProjectTemplate：显式 `templateId` 必须存在且至少包含 7 个 sections；未显式指定时会自动查找 `角色 lora 测试` / `角色 LoRA 测试` / `character lora`，同样要求至少 7 个 sections。缺失或 section 数不足时 benchmark enqueue 返回 409，不能静默创建 fallback project。fallback sections 或不足 7 sections 的模板只允许在 `dryRun` / `skipQueue` 调试路径使用，并且不能作为 approved promotion evidence。

本地或部署后可先幂等 bootstrap 默认模板；已有匹配模板时返回 `found`，不会重复创建，缺失时创建标准 7 变体 `角色 LoRA 测试` 模板：

```powershell
cmd /c npx tsx scripts/character-lora-training/ensure-benchmark-template.ts --checkpoint fake-base.safetensors
```

脚本只输出 JSON 摘要（`result`/`created`/`found`/`id`/`name`/`sectionCount`/`isUsable`），不会打印 token 或其它 secret。工作台的 Post-training Benchmark 和 Benchmark enqueue 区域也提供同一 ensure 入口，并会把找到的 template id 作为默认值，仍允许手工覆盖；若 status 显示 `isUsable=false`，需要补齐到至少 7 个 sections 后才能用于真实 benchmark。

单次处理：

```powershell
cmd /c npx tsx scripts/character-lora-training/benchmark-worker.ts --once --worker-owner benchmark-worker-local
```

持续轮询：

```powershell
cmd /c npx tsx scripts/character-lora-training/benchmark-worker.ts --poll --worker-owner benchmark-worker-local
```

默认最多等待 30 分钟，可按测试项目规模调整：

```powershell
cmd /c npx tsx scripts/character-lora-training/benchmark-worker.ts --once --timeout-ms 3600000 --worker-owner benchmark-worker-local
```

只提交项目运行、不等待出图完成：

```powershell
cmd /c npx tsx scripts/character-lora-training/benchmark-worker.ts --once --skip-wait --worker-owner benchmark-worker-submit-only
```

`--skip-wait` 会立即调用 benchmark complete，把当前 worker task 通过既有 benchmark-run completion 路径标记完成；此模式只适合手动跟进测试 project 结果，不能作为 approved promotion 的验收证据。approved promotion 必须使用非 dryRun/skipQueue/skipWait 且 counts 全部完成、matrixExpansion 完整、至少 7 个 section/run 证据的 benchmark。

成功完成时，worker 调用 `POST /api/character-lora-training/benchmark-runs/:benchmarkRunId/complete`，写入：

- `recommendedWeight`：`weightMatrix` 中第一个正数，缺省为 `1`。
- `resultSummary`：包含 `benchmarkRunId`、`trainingRunId`、`testProjectId`、`runIds`、section latestRun 摘要、`checkpointMatrix`、`weightMatrix`、`matrixExpansion`、完成时间和 counts。只有非 dryRun/skipQueue/skipWait 且 counts 无 failed/missing/queued/running、done 覆盖 totalRuns 的结果可用于 approved promotion。
- `diagnosticSuggestions`：包含失败 run 或 submit-only 的人工复核提示。

Benchmark worker 不调用通用 worker task complete。`completeCharacterLoraBenchmarkRunInRepository` 会把同一 `targetType=benchmarkRun`、`targetId=benchmarkRun.id` 的 queued/running worker task 标记为 `done`。

Benchmark 完成并已生成 `reportArtifactId` 后，可以清理 PRD 5.12 的临时测试 project/preset：

```powershell
Invoke-WebRequest -Method POST `
  -Uri "http://127.0.0.1:3000/api/character-lora-training/benchmark-runs/<benchmarkRunId>/cleanup" `
  -Headers @{ "x-api-token" = $env:AUTH_TOKEN } `
  -ContentType "application/json" `
  -Body '{ "dryRun": true }'
```

实际 cleanup 去掉 `dryRun` 或传 `{ "dryRun": false }`。Manager 会保留 `CharacterLoraBenchmarkRun.testProjectId` / `testPresetId` 原始值，并写入 `testProjectCleanedAt`、`testPresetCleanedAt` 和 `cleanupSummary`；training run、LoRA asset、safetensors artifact、benchmark report artifact 不会删除。如果临时 test project 下仍有 queued/running `Run`，cleanup 返回 409。重复 cleanup 是幂等操作。

## 安全注意事项

- 不要把 Manager token、Codex bearer token、refresh token、账号 ID 写入日志或提交。
- provider 请求 artifact 只能保存 redacted 版本；input image data URL 必须 redacted。
- 所有 artifact path 都通过 job artifactRoot + relativePath 解析，防止 `../` 或绝对路径逃逸。
- 外置 worker 不负责启动、停止或重启 Next 服务；上线前仍需按部署规则先检查队列和 GPU task lock。

## 基础校验

```powershell
cmd /c npx tsx scripts/character-lora-training/image-worker.ts --help
cmd /c npx tsx scripts/character-lora-training/worker-queue.ts --help
cmd /c npx tsx scripts/character-lora-training/image-worker.ts --self-test
cmd /c npx tsx scripts/character-lora-training/dataset-freeze-worker.ts --help
cmd /c npx tsx scripts/character-lora-training/training-worker.ts --help
cmd /c npx tsx scripts/character-lora-training/benchmark-worker.ts --help
cmd /c npx eslint scripts/character-lora-training/worker-common.ts scripts/character-lora-training/worker-queue.ts scripts/character-lora-training/image-worker.ts scripts/character-lora-training/dataset-freeze-worker.ts scripts/character-lora-training/training-worker.ts scripts/character-lora-training/benchmark-worker.ts
cmd /c npx tsc --noEmit --pretty false
```
