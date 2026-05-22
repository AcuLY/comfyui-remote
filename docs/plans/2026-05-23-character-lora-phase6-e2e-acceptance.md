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
13. dryRun + skipQueue 创建并 mock complete benchmark。
14. 创建 approved promotion decision。
15. 在隔离 SQLite 中真实执行 promotion，创建正式 preset 和 7 个 variants。

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
- benchmark 使用 `dryRun=true` + `skipQueue=true`，覆盖临时 preset/project 和 benchmark report 状态链，但不进入真实 ComfyUI 出图队列。
- promotion 在隔离 SQLite 中真实创建 preset，不污染当前业务库。
- 缺失 breast-size slider 或半脱/裸身 linked variant seed 时，promotion service 会在报告中记录 warning；这不是 smoke 失败条件，因为 7 个角色 variants 仍会创建，且 LoRA 权重仍可验证。
