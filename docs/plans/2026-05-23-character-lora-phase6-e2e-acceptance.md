# Character LoRA Training Manager Phase 6 验收记录

日期：2026-05-23

分支：`codex/character-lora-training-manager`

## 目标

Phase 6 的收口目标是留下可重复执行的端到端 smoke 路径，验证后端 Phases 1-5 的状态链和 artifact 链路可以在不连接当前业务库的情况下跑通。

新增脚本：

```powershell
cmd /c npx tsx scripts/character-lora-training/fake-e2e-smoke.ts
```

帮助输出：

```powershell
cmd /c npx tsx scripts/character-lora-training/fake-e2e-smoke.ts --help
```

## 隔离策略

- 默认在系统临时目录创建 SQLite DB：`file:<temp>/smoke.db`。
- 默认在系统临时目录创建 `CHARACTER_LORA_ARTIFACT_ROOT`。
- 默认创建临时 `MODEL_BASE_DIR` 和 dummy base checkpoint。
- 脚本先设置 `DB_PROVIDER=sqlite`、`DATABASE_URL`、`CHARACTER_LORA_ARTIFACT_ROOT`、`MODEL_BASE_DIR`，再动态 import app services，避免 Prisma client 早于 env 初始化。
- 脚本自动执行：

```powershell
cmd /c npx prisma db push --schema prisma/schema.sqlite.prisma
```

因此默认不会读写当前 PostgreSQL、本地业务 SQLite、现有 artifact 根目录或真实模型目录。

## 覆盖链路

`scripts/character-lora-training/fake-e2e-smoke.ts` 走真实 service/repository 状态链：

1. 创建 draft job。
2. 上传 1x1 fake PNG，写 source artifact 和 sha256。
3. 创建 canonical generation run 和 worker task。
4. mock complete canonical version 并选择 canonical。
5. 创建 Prompt Card version。
6. 实例化 `front_fullbody`、`portrait` 两个 sections。
7. 为每个 section 创建 fake image generation task。
8. lease + complete worker task，登记 fake candidate artifact。
9. keep 所有 candidate，并验证 caption 自动 trigger-first。
10. freeze dataset revision，生成 manifest、metadata jsonl、caption audit。
11. enqueue training，生成 training config、dry-run summary 和 GPU lock。
12. lease + heartbeat + complete fake training task，登记 dummy safetensors/hash/log/checkpoint。
13. dryRun + skipQueue 创建并 mock complete benchmark，并断言它不能创建 approved promotion decision、仍可创建 rejected decision 用于诊断回退。
14. 先断言缺失 ProjectTemplate 时非 dryRun/skipQueue benchmark enqueue 返回 409；随后在隔离 SQLite 中创建真实 `角色 LoRA 测试` ProjectTemplate（至少 7 个 sections）。
15. 另外创建一个非 dryRun/skipQueue benchmark，确认其 `templateId` 来自真实 ProjectTemplate，并直接通过 complete 服务写入 benchmark-worker 风格的完成证据（runIds、sections、counts done=totalRuns、matrixExpansion >= 7 base sections、skipWait=false）。
16. 使用第 15 步的真实证据形态 benchmark 创建 approved promotion decision。
17. 在隔离 SQLite 中真实执行 promotion，创建正式 preset 和 7 个 variants。

脚本不使用裸 SQL 绕过业务规则；只在最后用 Prisma read 查询 promoted variants 做断言。

## 输出与断言

成功时输出 `Character LoRA fake E2E smoke passed.` 和 JSON summary。summary 包含：

- job status/phase。
- source hash 和相对路径。
- canonical version。
- prompt card version。
- section/image ids。
- caption 是否 trigger-first。
- dataset revision 和 item count。
- training config path。
- final safetensors sha256。
- benchmark report artifact/result summary。
- promotion decision。
- preset variant count 和 resolved LoRA weights。

关键断言失败会直接抛错并以非 0 exit code 结束。

## 部署前 Queue Gate

本脚本是隔离 smoke，不替代发布前 queue gate。按 AGENTS 规则，非轻量改动部署前仍必须先检查当前队列和运行任务状态：

- 如果当前项目目录已有 `next dev` / `next start` 服务，优先在当前目录继续验证，不要 SSH。
- 清理 `.next`、构建、停止或重启服务前必须确认当前 ComfyUI queue 和 Character LoRA GPU task 没有 queued/running。
- 如果仍有 queued/running，停止后续部署动作；不要清理 `.next`、不要 build、不要 stop/restart。
- 本地真实服务启动后若 ComfyUI 队列忙、CUDA 占用或 training GPU lock 未释放，不应直接归类为 Next 发布失败；需要区分 queue/CUDA runtime 状态和 Next route/static 资源错误。

## 双 Schema Validate

Character LoRA 改动涉及 Prisma 时，部署前应同时验证 PostgreSQL 和 SQLite schema：

```powershell
cmd /c npx prisma validate --schema prisma/schema.prisma
cmd /c npx prisma validate --schema prisma/schema.sqlite.prisma
```

如果 schema 有实际变更，还需按当前部署规则执行 PostgreSQL generate/db push：

```powershell
$env:DB_PROVIDER="postgresql"; npx prisma generate
$env:DB_PROVIDER="postgresql"; npx prisma db push
```

本 Phase 6 子任务未修改 schema。

## 当前验证结果

本次已执行：

```powershell
cmd /c npx tsx scripts/character-lora-training/fake-e2e-smoke.ts --help
cmd /c npx tsx scripts/character-lora-training/fake-e2e-smoke.ts
cmd /c npx prisma validate --schema prisma/schema.prisma
cmd /c npx prisma validate --schema prisma/schema.sqlite.prisma
cmd /c npx eslint scripts/character-lora-training/fake-e2e-smoke.ts
cmd /c npx eslint src/app/character-lora-training src/components/persistent-bottom-nav.tsx
cmd /c npx tsc --noEmit --pretty false
```

结果：

- `fake-e2e-smoke.ts --help` 通过。
- `fake-e2e-smoke.ts` 完整 smoke 通过，最终 job status 为 `promoted`，phase 为 `promotion`。
- 完整 smoke 的 dataset item count 为 `2`，caption trigger-first 为 `true`。
- 完整 smoke 的 training run status 为 `done`，final sha256 为 64 位 hex。
- 完整 smoke 的 benchmark run status 为 `done`，promotion decision status 为 `promoted`，promoted preset variant count 为 `7`。
- PostgreSQL schema validate 通过。
- SQLite schema validate 通过。
- targeted ESLint 通过。
- `cmd /c npx tsc --noEmit --pretty false` 通过。

完整 smoke 成功标准：

- 最终 job status 为 `promoted`。
- 最终 job phase 为 `promotion`。
- dataset item count 等于 keep candidate 数。
- caption 第一个逗号分隔 token 等于 job trigger token。
- training run status 为 `done`，final sha256 为 64 位 hex。
- benchmark run status 为 `done`。
- promotion decision status 为 `promoted`。
- promoted preset variant count 为 `7`，每个 variant 的 resolved LoRA weight 为正数。

## 已知边界

- fake image provider 不调用外部图像模型，section candidate 由脚本写入 dummy PNG artifact 后通过真实 worker complete 入口登记。
- fake training worker 不调用 sd-scripts/kohya，只通过真实 training complete 入口登记 dummy `.safetensors`、checkpoint、hashes 和 log。
- dryRun/skipQueue benchmark 只覆盖临时 preset/project 和 benchmark report 状态链；缺失 ProjectTemplate 时允许使用 fallback sections，但该 fallback 只属于 debug 路径，不能作为 approved promotion evidence。
- smoke 会另建一个非 dryRun/skipQueue benchmark；真实 benchmark 必须复用 `角色 LoRA 测试` ProjectTemplate，不能静默 fallback，并用 benchmark-worker 风格的完成 `resultSummary` 作为 approved promotion evidence；该路径不进入真实 ComfyUI 出图队列。
- promotion 在隔离 SQLite 中真实创建 preset，不污染当前业务库。
- 缺失 breast-size slider 或半脱/裸身 linked variant seed 时，promotion service 会在报告中记录 warning；这不是 smoke 失败条件，因为 7 个角色 variants 仍会创建，且 LoRA 权重仍可验证。

## Phase 6 Report 验收补充

本阶段新增 job 级全链路 report：

- `GET /api/character-lora-training/jobs/[jobId]/report` 返回结构化 JSON。
- `GET /api/character-lora-training/jobs/[jobId]/report?format=markdown` 返回 Markdown。
- `POST /api/character-lora-training/jobs/[jobId]/report` 会在 job artifact root 下写入 `reports/job-report-<timestamp>.json` 和 `.md`，并登记为 `CharacterLoraArtifact.kind = job_report`。
- 工作台页面新增 `Report / Diagnostics` 区块，展示 recommendedReturnPoint、risk、覆盖度、最近 report artifact，并提供生成 report 与 JSON/Markdown 链接。
- fake E2E smoke 在 promotion 后持久化 report，并断言 report 覆盖 source、canonical、prompt、candidate caption、dataset items、training finalSha、benchmark、promotion，同时把 report artifact refs 写入 summary。

Report 验收要点：

- JSON report 至少包含 job/counts、sourceImages、canonicalVersions、promptCardVersions、sections、generationRuns、candidateImages、datasetRevisions/items、trainingRuns/checkpoints、benchmarkRuns、promotionDecisions、artifactRefs、diagnosticSummary。
- Markdown report 能用于人工诊断，至少包含 coverage、diagnostics、training、benchmark、promotion 摘要。
- 诊断 summary 必须给出 `recommendedReturnPoint`、`reasons`、`evidence`、`actions`、`risk`。
