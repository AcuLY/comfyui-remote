# Character LoRA 外置 Worker Runbook

日期：2026-05-23

范围：`scripts/character-lora-training/worker-common.ts`、`image-worker.ts`、`training-worker.ts`、`benchmark-worker.ts`。

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

## Image Worker

无外部 token 的本地 smoke：

```powershell
cmd /c npx tsx scripts/character-lora-training/image-worker.ts --once --provider mock-local --worker-owner image-worker-local
```

持续轮询：

```powershell
cmd /c npx tsx scripts/character-lora-training/image-worker.ts --poll --provider mock-local --worker-owner image-worker-local
```

真实 Codex / GPT-Image-2 provider：

```powershell
$env:CHARACTER_LORA_CODEX_BEARER_TOKEN="<set outside logs>"
$env:CHARACTER_LORA_CODEX_BASE_URL="https://chatgpt.com/backend-api/codex/responses"
$env:CHARACTER_LORA_CODEX_HOST_MODEL="gpt-5.5"
cmd /c npx tsx scripts/character-lora-training/image-worker.ts --once --provider openai-codex --worker-owner image-worker-codex
```

可选项：

- `CHARACTER_LORA_CODEX_ACCOUNT_ID`：传给 `ChatGPT-Account-ID`。
- `CODEX_OAUTH_TOKEN`：备用 bearer token 来源。
- `CHARACTER_LORA_CODEX_AUTH_FILE`：专用 auth JSON 文件，支持 `access_token` / `accessToken` / `bearer_token` / `bearerToken` / `token` 字段。artifact 只记录文件来源和是否含 refresh token，不记录值。

`mock-local` 会写入 1x1 PNG、`request.redacted.json` 和 `response-summary.json`，然后 complete task。`openai-codex` 会把 `hostInstruction` 放入 Responses `instructions`，把 `renderedPrompt` 或 `visualPrompt` 放入 input text，把 job artifactRoot 下的 input image relativePath 读成 data URL，请求落盘版本会 redact 图片 bytes 和 auth。

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

`--skip-wait` 会立即调用 benchmark complete，把当前 worker task 通过既有 benchmark-run completion 路径标记完成；此模式只适合手动跟进测试 project 结果，不应作为 promotion 前的默认路径。

成功完成时，worker 调用 `POST /api/character-lora-training/benchmark-runs/:benchmarkRunId/complete`，写入：

- `recommendedWeight`：`weightMatrix` 中第一个正数，缺省为 `1`。
- `resultSummary`：包含 `benchmarkRunId`、`trainingRunId`、`testProjectId`、`runIds`、section latestRun 摘要、`checkpointMatrix`、`weightMatrix`、完成时间和失败计数。
- `diagnosticSuggestions`：包含失败 run 或 submit-only 的人工复核提示。

Benchmark worker 不调用通用 worker task complete。`completeCharacterLoraBenchmarkRunInRepository` 会把同一 `targetType=benchmarkRun`、`targetId=benchmarkRun.id` 的 queued/running worker task 标记为 `done`。

## 安全注意事项

- 不要把 Manager token、Codex bearer token、refresh token、账号 ID 写入日志或提交。
- provider 请求 artifact 只能保存 redacted 版本；input image data URL 必须 redacted。
- 所有 artifact path 都通过 job artifactRoot + relativePath 解析，防止 `../` 或绝对路径逃逸。
- 外置 worker 不负责启动、停止或重启 Next 服务；上线前仍需按部署规则先检查队列和 GPU task lock。

## 基础校验

```powershell
cmd /c npx tsx scripts/character-lora-training/image-worker.ts --help
cmd /c npx tsx scripts/character-lora-training/training-worker.ts --help
cmd /c npx tsx scripts/character-lora-training/benchmark-worker.ts --help
cmd /c npx eslint scripts/character-lora-training/worker-common.ts scripts/character-lora-training/image-worker.ts scripts/character-lora-training/training-worker.ts scripts/character-lora-training/benchmark-worker.ts
cmd /c npx tsc --noEmit --pretty false
```
