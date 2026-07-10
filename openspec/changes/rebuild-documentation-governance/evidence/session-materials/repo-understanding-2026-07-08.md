# ComfyUI Remote 当前项目理解快照

生成日期：2026-07-08

本文是一次仓库级探索后的临时工作底稿，原位置在 `.tmp/`。现为跨设备续作而归档为 OpenSpec 非规范性 evidence；它不是新的正式文档，也不应该被当成长期 source of truth。它的作用是先把“代码实际在做什么”和“现有文档哪里漂移”沉淀下来，供下一步清理 `README.md`、`docs/**`、`DESIGN.md` 和归档历史文档时使用。

## 0. 总体判断

这个仓库现在不是一个单纯的 ComfyUI Web 面板，也不是一个只面向人工操作的 Next.js 项目。它更准确地说是一个围绕 ComfyUI 的本地/私有生产控制台，包含四条主线：

1. 生图项目管理：Project、Section、Template、Preset、Preset Group、LoRA 绑定、Prompt Block、运行参数、Run、Image Result、Review。
2. 队列和 ComfyUI 执行：将项目配置解析成稳定的 prompt draft，填充 `docs/workflow.api.json`，提交到 ComfyUI，轮询结果，落盘图片和缩略图。
3. 训练工作流：`/training/**` 作为独立但共享资产体系的训练控制台，管理训练项目、角色资料、场景描述、生成任务、数据集修订、训练运行和 worker 队列。
4. Agent / MCP / API 自动化：HTTP API 与 MCP 工具都不是附属示例，而是仓库的一等控制面，目标是让 agent 可以读取上下文、修改项目、运行 section、审图、操作 prompt blocks。

因此，正式文档不应该再把项目描述成“7 个 Agent API 端点的小工具”或“简单图片管理器”。当前代码的事实已经明显大于早期 README 和若干旧 docs 的描述。

## 1. 本次探索依据

已读取或统计的关键入口：

- `AGENTS.md`
- `agent-rules/git.md`
- `agent-rules/deploy/index.md`
- `README.md`
- `package.json`
- `next.config.ts`
- `prisma.config.ts`
- `docker-compose.yml`
- `.gitignore`
- `prisma/schema.prisma`
- `prisma/schema.sqlite.prisma`
- `src/app/**/page.tsx`
- `src/app/api/**/route.ts`
- `src/lib/env.ts`
- `src/lib/prisma.ts`
- `src/server/services/**`
- `src/server/repositories/**`
- `src/server/worker/**`
- `src/server/mcp/server.ts`
- `src/features/training/**`
- `scripts/training/**`
- `tests/**`
- `docs/index.md`
- `docs/documentation-map.md`
- `docs/agent-api.md`
- `docs/worker-boundaries.md`
- `docs/prisma-provider-matrix.md`
- `docs/prisma-schema-compatibility.md`
- `docs/local-verification.md`
- `docs/runbooks/config-runtime-assets.md`

本次没有把每个 React 组件、每个 route handler 和每篇历史文档逐字读完，但已经完成了仓库结构、路由、API、数据模型、服务层、训练层、MCP 层、核心 docs 的横向覆盖，并对关键路径源码做了抽样确认。后续正式文档清理应继续以这份底稿为索引逐块落地，而不是直接凭旧 README 改写。

## 2. 仓库事实快照

包和运行时：

- 项目名：`comfyui-manager`
- Next.js：`16.2.1`
- React：`19.2.4`
- Prisma：`7.5.0`
- 数据库支持：PostgreSQL 与 SQLite 双 provider。
- 默认 provider：`DB_PROVIDER` 未设置时偏向 PostgreSQL。
- 本地 PostgreSQL 由 `docker-compose.yml` 提供，服务为 `postgres:16-alpine`，数据库名 `comfyui_manager`，端口 `5432`。

常用脚本：

- `npm run dev`
- `npm run build`，实际命令是 `next build --webpack`
- `npm run start`
- `npm run lint`
- `npm run test`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:db-push`
- `npm run prisma:seed`
- `npm run bootstrap`
- `npm run training:workers`
- `npm run training:workers:mock`

代码规模统计：

- `src/app/**/page.tsx` 生成的页面路由约 28 个。
- `src/app/api/**/route.ts` 有 194 个 route 文件。
- API route handler 导出的 HTTP method entrypoint 约 261 个。
- Prisma 主 schema 有 54 个 model、5 个 enum。
- SQLite schema 对应 54 个 model，但 enum 以字符串兼容方式保存。
- `tests/` 下约 159 个文件，覆盖了 API、服务、治理规则、训练、队列、schema 兼容等内容。

需要注意：API 数字是按代码文件和 method export 统计，不等同于产品文案里应该出现的“接口数”。正式 README 不建议写精确数量；如果必须写，应由脚本生成并明确统计口径。

## 3. 当前路由面

主要页面面向以下产品区域：

- 首页与项目列表：`/`、`/projects`
- 项目创建和复制：`/projects/new`、`/projects/new/from-existing`、`/projects/:projectId/batch-create`
- 项目详情与编辑：`/projects/:projectId`、`/projects/:projectId/edit`
- Section 编辑和结果：`/projects/:projectId/sections/:sectionId`、`/projects/:projectId/sections/:sectionId/results`
- 项目结果总览：`/projects/:projectId/results`
- 队列与审图：`/queue`、`/queue/:runId`
- 资产和预设库：`/assets/presets`、`/assets/presets/:presetId`、`/assets/preset-groups/:groupId`、`/assets/presets/sort-rules`
- 模板：`/assets/templates`、`/assets/templates/new`、`/assets/templates/:templateId/edit`、`/assets/templates/:templateId/sections/:sectionIndex`
- LoRA 和模型资产：`/assets/loras`、`/assets/models`
- 训练控制台：`/training/**`
- 设置和监控：`/settings`、`/settings/logs`、`/settings/monitor`
- 登录：`/login`
- 旧设计 demo 入口：`/design-demos/**`

`/training/**` 是 catch-all 路由，由 `src/features/training/routes.ts` 中的 route registry 驱动。当前 registry 覆盖 runs、generation run detail、training run detail、projects、project detail、profile、sections、section detail、generation compose、generation results、dataset、dataset revision、training runs、generation tasks、presets、preset detail、preset sort/new、templates、template edit/new/section 等约 24 个训练子页面。

## 4. API 和自动化控制面

API 已远超旧 README 所说的 7 个 Agent 端点。

按 prefix 粗略分组，当前 API 涵盖：

- `/api/agent/**`
- `/api/auth/**`
- `/api/comfy/**`
- `/api/health`
- `/api/images/**`
- `/api/logs`
- `/api/loras/**`
- `/api/mcp/**`
- `/api/models/**`
- `/api/path-maps`
- `/api/preset-library/**`
- `/api/presets`
- `/api/project-*`
- `/api/projects/**`
- `/api/queue/**`
- `/api/queue-data`
- `/api/runs/**`
- `/api/sections`
- `/api/templates/**`
- `/api/training/**`
- `/api/worker/**`

当前 Agent HTTP 端点至少包括：

- `GET /api/agent/projects`
- `GET /api/agent/projects/:projectId/context`
- `POST /api/agent/projects/:projectId/update`
- `POST /api/agent/projects/:projectId/run-all`
- `POST /api/agent/projects/:projectId/switch-variants`
- `POST /api/agent/projects/:projectId/sync-preset-variants`
- `POST /api/agent/projects/sync-preset-variant-flow`
- `POST /api/agent/sections/:sectionId/run`
- `GET /api/agent/runs/:runId/context`
- `POST /api/agent/runs/:runId/review`

MCP 不是过时实验。`src/server/mcp/server.ts` 当前暴露的工具包括：

- `list_projects`
- `update_project`
- `update_project_section`
- `run_all_sections`
- `run_section`
- `review_images`
- `list_prompt_blocks`
- `add_prompt_block`
- `update_prompt_block`
- `remove_prompt_block`
- `reorder_prompt_blocks`

MCP resources 包括：

- `comfyui://projects/{projectId}/context`
- `comfyui://runs/{runId}/context`
- `comfyui://sections/{sectionId}/blocks`

`docs/agent-api.md` 是目前比 README 更接近事实的 API 文档，但仍需要和代码生成的 route 清单做一次交叉校验，避免遗漏新训练接口、项目模板接口、preset-library 接口和 MCP 工具变化。

## 5. 数据模型理解

Prisma 数据模型大致可以分成以下域：

- Preset Library：`PresetCategory`、`Preset`、`PresetVariant`、`PresetVariantLink`、`PresetGroup`、`PresetGroupMember`、`PresetCategorySlot`、`PresetFolder`、变更日志等。
- Generation Template：`ProjectTemplate`、`ProjectTemplateSection`、`ProjectTemplatePresetBinding`、`TemplateSectionPresetBinding`、`TemplateSectionPromptBlock`、`TemplateSectionManualLoraEntry`、模板 folder。
- Generation Project：`Project`、`ProjectSection`、`ProjectPresetBinding`、`SectionPresetBinding`、`SectionPromptBlock`、`SectionManualLoraEntry`、项目 folder、section folder、section change log。
- Run / Image / Review：`Run`、`ImageResult`、`TrashRecord`、`CensoringTask`。
- Training：`TrainingProject`、`TrainingCharacterProfile`、`TrainingCharacterImage`、`TrainingArtifact`、`TrainingSection`、`TrainingSceneDescriptionBlock`、`TrainingSectionRun`、`TrainingImageResult`、`TrainingGenerationTask`、`TrainingGenerationInputReference`、`TrainingGenerationTaskOutput`、`TrainingDatasetRevision`、`TrainingDatasetRevisionItem`、`TrainingRun`、`TrainingTextRevision`。
- Training Preset / Template：`TrainingSceneDescriptionPresetCategory`、`TrainingSceneDescriptionPresetFolder`、`TrainingSceneDescriptionPreset`、`TrainingTemplate`、`TrainingTemplateSection`、`TrainingTemplateSectionSceneDescriptionBlock`。
- Asset / Ops：`LoraAsset`、`AuditLog`、`GpuTaskLock`。

PostgreSQL schema 使用 Prisma enum，包括 `JobStatus`、`RunStatus`、`ReviewStatus`、`ActorType`、`PromptBlockType`。SQLite schema 为兼容本地环境，将这些 enum 字段保存为 string。正式文档应继续保留 `docs/prisma-provider-matrix.md` 和 `docs/prisma-schema-compatibility.md`，它们属于高价值维护文档。

## 6. 核心架构路径

普通生图路径：

1. UI 页面或 Agent API 创建/更新 Project、Section、Prompt Blocks、Preset Bindings、运行参数。
2. `src/server/services/project-service.ts` 做输入校验和服务编排。
3. `src/server/repositories/project-repository/**` 负责数据库读写、project detail、agent context、enqueue 等。
4. queue 提交时创建 `Run`，保存 resolved config snapshot。
5. `src/server/worker/payload-builder.ts` 将 snapshot 规范化为 `ComfyPromptDraft`。
6. `src/server/services/workflow-prompt-builder.ts` 用 `docs/workflow.api.json` 填充 ComfyUI workflow。
7. `src/server/services/comfyui-service.ts` 提交 `/prompt`，轮询 history，解析输出。
8. `src/server/services/image-result-service.ts` 下载图片、转 JPEG、生成缩略图、写入 `data/images/**` 并创建 `ImageResult`。
9. 审图由 `src/server/services/review-service.ts` 处理 keep/trash/restore/cover/feature 等状态变更。

训练路径：

1. `/training/**` 统一进入 catch-all route。
2. `src/features/training/routes.ts` 根据 path 匹配训练子页面和数据加载器。
3. route loader 通过 snapshot/read service 组装 UI 所需数据。
4. 训练相关写操作和 task 创建经由 `/api/training/**`。
5. `scripts/training/worker-queue.ts` 启动 image generation、dataset freeze、training worker。
6. worker 通过训练 task schema 进行 lease、heartbeat、complete、fail 等生命周期管理。

控制面路径：

1. 人工 UI、HTTP API、Agent API、MCP 工具共享同一批服务层和 repository。
2. 鉴权集中在 token/cookie 机制：`AUTH_TOKEN` 可通过 Bearer、`x-api-token` 或 `auth_token` cookie 使用。
3. Comfy 进程启停类接口存在更严格的本地访问边界，不能简单当作公网 API。

## 7. 配置和运行资产

`src/lib/env.ts` 当前确认的关键配置：

- `DB_PROVIDER`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `COMFY_API_URL`
- `COMFY_REQUEST_TIMEOUT_MS`
- `COMFY_QUEUE_SNAPSHOT_CACHE_MS`
- `COMFY_HISTORY_POLL_INTERVAL_MS`
- `COMFY_HISTORY_MAX_ATTEMPTS`
- `MODEL_BASE_DIR`
- `LORA_ASSETS_DIR`
- `CHECKPOINTS_DIR`
- `AUTO_CENSOR_PYTHON_CMD`
- Comfy launch/autostart/restart/GPU/logging/checkpoint/auth 相关变量

`.gitignore` 已明确排除：

- `.tmp/`
- `/tmp/`
- `/data/`
- `/logs/`
- `.deploy.lock/`
- `.next/`
- 生成的 Prisma client
- SQLite DB 文件
- runtime logs 和 generated caches

`docs/runbooks/config-runtime-assets.md` 是当前比较有价值的运行资产边界文档。正式文档整理时应保留它，但需要把 README 中重复、易漂移的环境变量默认值表降级为指向该 runbook 和 `.env.example`。

## 8. UI 与设计文档状态

根目录 `DESIGN.md` 当前从文档组织角度是“可解释但需要重新定位”的文件：

- 它确实被 `docs/index.md` 当成 UI/设计入口之一引用。
- 但根目录放 `DESIGN.md` 会和 `README.md`、`AGENTS.md`、`docs/ui/**`、旧设计系统文档形成并列，读者不容易判断谁是 current truth。
- 用户提到的 `docs/DESIGN_SYSTEM_SUMMARY.md`、`docs/design-system-migration.md`、`docs/shadcn-design-guide.md` 与 `DESIGN.md` / `docs/ui/**` 有重叠，这个判断基本成立。

建议的目标状态不是简单删除 `DESIGN.md`，而是先确认它的当前事实含量：

- 如果它仍是 UI 当前规范，应把它保留为唯一设计入口，并让 `docs/ui/**` 只承载细分主题。
- 如果它已经过时，应将仍有效内容合并进 `docs/ui/README.md` 或 `docs/ui/frontend-guide.md`，再把 `DESIGN.md` 降级为跳转或移入 archive。
- 不应该继续让多个设计系统总结文件同时位于 current docs 入口层。

## 9. 现有文档健康判断

高价值且应保留的 current truth 层：

- `AGENTS.md`
- `agent-rules/**`
- `docs/index.md`
- `docs/documentation-map.md`
- `docs/repo-inventory.md`
- `docs/agent-api.md`
- `docs/workflow.api.json`
- `docs/local-verification.md`
- `docs/worker-boundaries.md`
- `docs/prisma-provider-matrix.md`
- `docs/prisma-schema-compatibility.md`
- `docs/runbooks/config-runtime-assets.md`
- `docs/ui/**` 中仍由当前 UI 使用的规范
- API、Prisma、runbook、worker boundary、UI governance 类文档

需要警惕的 current tree 漂移：

- `README.md` 仍包含容易漂移的精确数字和实现细节，例如 Agent API 数量、training API 计数、完整路由面或功能枚举。
- `docs/local-verification.md` 仍有早期文案痕迹，例如 Character / Scene / Style 这类旧流程命名，需要结合当前 Project / Section / Preset / Training 页面重写。
- `docs/agent-api.md` 比 README 新，但它需要从代码重新生成或校对 endpoint 覆盖面。
- `docs/index.md` 当前仍引用 `docs/prototypes/README.md` 作为训练产品设计入口，这会让 prototype 与 current truth 的边界不清。
- `docs/documentation-map.md` 已经写出了“旧 plans/PRDs 应进 archive”的治理原则，但仓库实际文件分布还没有完全执行。

明确更像历史或归档资料的文档：

- `docs/plans/**`
- `docs/prd/**`
- `docs/prototypes/**`
- `docs/superpowers/plans/**`
- `docs/plans/auto-review-analysis/**`
- `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`
- `docs/WORKFLOW_QUICK_REFERENCE.md`
- `docs/WORKFLOW_SYSTEM_ANALYSIS.md`
- `docs/analysis_comprehensive.md`
- `docs/quick-reference.md`
- `docs/design-v0.1.md`
- `docs/design-v0.3-workflow-integration.md`
- `design-demos/*.html`

这类文件不是完全没有价值，但不应该继续和 current docs 平铺在 `docs/` 顶层，也不应该被新 agent 当成当前行为依据。正式清理时应分三种处理：

1. 仍有历史追溯价值：移动到 `docs/archive/**` 并加 archive banner。
2. 内容已被 current docs 吸收：删除或移到 archive 后在索引里注明替代文档。
3. 仍有事实未被吸收：先把事实合并到新的干净文档，再归档原文件。

## 10. README 的正确角色

用户说“原本的 readme 内容没有问题，不要逃避维护”是对的。README 不应该被缩成纯跳转页，也不应该用维护说明替代项目说明。

当前更合适的 README 角色：

- 用简短但具体的语言说明这个项目是什么。
- 说明本地启动、数据库、ComfyUI 连接、登录 token 的最小路径。
- 说明主要产品面：项目生图、队列审图、preset/template、training、agent/MCP。
- 链接到 owner docs，但不要复制大量 volatile 表格。
- 对 API 可以写“Agent API、MCP、training API、preset-library API 等”，并链接 `docs/agent-api.md` 和 route docs，而不是写死“7 个端点”。
- 对环境变量可以写“以 `.env.example` 和运行资产 runbook 为准”，但仍保留足够的新手启动信息。

不适合直接出现在 README 的内容：

- “不要添加精确 page inventories、API endpoint counts、MCP tool counts、环境变量默认值表”的维护规则。这些属于 `docs/documentation-map.md` 或文档治理说明，不适合作为读者入口文案。
- 大型目录树。
- 自动生成的完整 API 表。
- 过细的训练内部 task schema。

## 11. 下一步正式文档清理建议

第一批应该做的是“用当前代码重建核心文档”，而不是只移动旧文件：

1. 重写 `README.md`：保留项目说明和启动价值，移除错误数量和过旧功能描述，补上 training、MCP、preset-library、队列审图、双数据库现实。
2. 重写或校正 `docs/agent-api.md`：从 route files 和 MCP server 反推当前 Agent/API 控制面，并明确哪些是 Agent 稳定接口、哪些是普通内部 API。
3. 重写 `docs/local-verification.md`：按当前 Next 16、Prisma provider、auth token、ComfyUI、training worker、queue/review 页面重新组织。
4. 整理 UI/design：决定 `DESIGN.md` 是否仍是根入口；合并 `docs/DESIGN_SYSTEM_SUMMARY.md`、`docs/design-system-migration.md`、`docs/shadcn-design-guide.md` 中仍有效内容。
5. 执行 archive：把历史 plan、PRD、prototype、superpowers plan、旧 workflow quick reference、旧 design v0.x 等移入 `docs/archive/**`，并在 `docs/index.md` 只保留 current truth 入口。
6. 更新 `docs/documentation-map.md`：让它描述清楚 current docs、archive docs、generated docs、runtime runbooks 的边界。
7. 重新生成 `docs/repo-inventory.md`：只要发生文件移动、删除、重命名，就运行 `npx tsx scripts/docs/generate-repo-inventory.ts`。

这次清理的验收标准应该是：

- 新读者从 README 能在 5 分钟内知道项目是什么、怎么启动、看哪些主文档。
- Agent 从 `AGENTS.md`、`docs/index.md`、`docs/documentation-map.md` 能判断 current truth，而不会误读旧 plan。
- 所有 `docs/` 顶层文件都有明确身份：入口、架构、API、runbook、UI、testing、archive 索引，不能再混入任务笔记和历史快照。
- 被归档文档不再被 current docs 当作当前行为依据引用。

## 12. 尚需二次核验的问题

以下内容本次已经发现风险，但还需要正式改文档前逐项核验：

- README 中 `/api/training/**` 数量与代码统计口径存在差异。本次按 prefix 包含 `/api/training` root route 时统计为 117；README 中见到的数字是 116。需要决定 README 是否继续保留数字。如果不保留，则把精确数量移到生成清单。
- `docs/local-verification.md` 的页面验证流程是否还匹配当前 UI。
- `DESIGN.md` 的设计规范是否仍被当前组件遵守。
- `design-demos/*.html` 是否还有任何仍作为当前设计验收的文件；如果只是历史 demo，应全部归档或删除断链引用。
- `docs/prototypes/**` 中是否仍有训练产品事实没有被 `docs/training/**` 或新的 current training docs 吸收。
- `docs/plans/**` 中是否有仍未合并到 current docs 的架构决策。

这份底稿的结论是：仓库当前最大问题不是“缺一个索引”，而是 current truth 与历史计划、原型、迁移笔记混在一起。下一步应以代码为准重写核心入口文档，然后再物理归档旧文档。
