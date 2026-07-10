# ComfyUI Remote 深度项目理解底稿

生成日期：2026-07-08

原位置：`.tmp/repo-understanding-deep-2026-07-08.md`；现归档为 OpenSpec 非规范性 evidence

性质：临时工作底稿，原先位于被 `.gitignore` 忽略的 `.tmp/`。现为跨设备续作而归档，但本文仍不是正式文档，不应被长期引用。它用于在正式清理 `README.md`、`docs/**`、`DESIGN.md` 前，先把当前仓库作为一个全新的项目重新理解清楚。

## 0. 本轮阅读方式

这轮不再只做粗目录扫描，而是采用主代理加 6 个只读子代理并行阅读：

- 前端页面与 UI 组件架构。
- 后端 API、service、repository、server action。
- Prisma 数据模型、实体关系、双 provider。
- Training v2 子系统。
- ComfyUI、队列、worker、图片和运行时配置。
- 文档治理、测试治理、历史资料和 current truth 混杂问题。

主代理同时做了仓库目录、页面路由、API 路由、模块 import 边、关键源码片段和子代理风险点核验。

本轮没有修改正式文件，没有运行破坏性命令，没有提交。本文只写入 `.tmp/`。

## 1. 项目当前真实定位

这个仓库当前是一个围绕 ComfyUI 和 LoRA 训练工作流的私有生产控制台。它不是单纯的图片管理器，也不是只面向人工 UI 的 Next.js 项目。

设计目标上，项目应由两个平级工作模式和一个共享运行底座构成。Training 不是生图模块下的附属页面，而是和当前主要生图模块平级的一等模块；用户通过导航栏上的 mode toggle 在“生图模式”和“LoRA 训练”之间切换。

1. 生图域：项目、section、模板、preset library、prompt blocks、LoRA 绑定、运行参数、队列、审图、结果图库、导出。
2. Training v2 域：训练项目、角色资料、场景描述、训练场景预设、训练模板、生成任务、训练图片池、数据集修订、训练运行、训练产物。
3. 共享底座：Next.js App Router、Prisma 双 provider、ComfyUI target/SSH/tunnel、图片文件服务、model asset 管理、底部导航、认证、审计、MCP/Agent API、部署队列治理。

因此，正式 README 应该解释“这是一个移动优先的 ComfyUI 生图和 LoRA 训练工作台”，而不是继续停留在“7 个 Agent API endpoint”或“普通 ComfyUI 管理后台”的旧语义。

## 2. 仓库结构与模块边界

当前顶层目录的实际职责：

- `AGENTS.md`：agent 入口规则，要求每次读 `agent-rules/git.md` 和 `agent-rules/deploy/index.md`。
- `agent-rules/**`：git、部署、开发服务、Next.js、UI auth、subagent、mypc PowerShell 等工作规则。
- `src/app/**`：Next App Router 页面、API route handler、server action 周边 UI 页面。
- `src/components/**`：生产和部分 training 复用组件，包括 app shell、底部导航、section editor、review、preset/template 组件、shadcn 风格 primitives、design-demo primitives。
- `src/features/training/**`：Training v2 前端子应用，包含 route registry、shell、数据 DTO、页面组件、hooks。
- `src/lib/**`：环境、Prisma client、shared types、server actions、RSC data facade、图片 URL、work mode、review state、preset/section UI 工具。
- `src/server/**`：HTTP helper、MCP server、prompt config resolver、repositories、services、worker、training worker。
- `prisma/**`：PostgreSQL schema、SQLite schema、migrations、seed。
- `scripts/**`：DB、docs、quality、training worker 启动/运行脚本。
- `tests/**`：业务、治理、API、schema、UI boundary、training、worker、docs contract 测试。
- `docs/**`：当前文档、runbook、API、UI、architecture、generated inventory、archive、prototype 和历史资料。
- `config/**`：Comfy target 示例、path maps。
- `data/**`、`logs/**`、`.next/**`、`.tmp/**`：运行时或临时数据，git ignored。

模块 import 方向的实际情况：

- `src/app` 是最大编排层，大量 import `src/components`、`src/lib`、`src/server`。
- `src/features/training` 主要 import 自身和 `src/components`，少量 import `src/lib`。
- `src/lib/server-data.ts` 是 RSC/server data facade，会从 `src/server/repositories` re-export。文件自己标注为架构妥协，因为理想上 `lib/` 不应反向依赖 `server/`。
- `src/server` 主要依赖 `src/lib` 和自身，也会少量引用 `src/features/training` 类型或 DTO。
- `tests` 横跨 `src/app`、`src/lib`、`src/server`、`scripts` 和 docs，是当前治理事实的重要来源。

这说明代码处于“有明确分层目标，但仍有过渡层”的状态。正式架构文档应写真实现状，而不是把它描述成已经完全纯净的三层架构。

## 3. 运行和技术栈事实

`package.json` 当前事实：

- 项目名：`comfyui-manager`。
- Next.js：`16.2.1`。
- React：`19.2.4`。
- Prisma：`7.5.0`。
- 样式：Tailwind CSS 4。
- 图片处理：`sharp`。
- 打包导出：`archiver`。
- UI icons：`lucide-react`。
- DnD：`@dnd-kit/**`。
- MCP：`@modelcontextprotocol/sdk`。
- Prisma adapters：`@prisma/adapter-pg` 和 `@prisma/adapter-better-sqlite3`。

主要命令：

- `npm run dev`：Next dev。
- `npm run build`：`next build --webpack`。
- `npm run start`：Next production start。
- `npm run test`：Node test runner 加 tsx。
- `npm run lint`。
- `npm run prisma:generate`。
- `npm run db:bootstrap`、`npm run db:bootstrap:sqlite`。
- `npm run training:workers`、`npm run training:workers:mock`。

数据库：

- 默认 provider 是 PostgreSQL。
- `DB_PROVIDER=sqlite` 时使用 SQLite schema 和 better-sqlite3 adapter。
- `docker-compose.yml` 提供 PostgreSQL 16，数据库名 `comfyui_manager`。

认证：

- `src/proxy.ts` 是 Next 16 Proxy 入口，不是 `middleware.ts`。
- 页面认证走 `auth_token` cookie。
- `/api/**` 也接受 Bearer、`x-api-token`、`x-auth-token`。
- `/api/auth/**`、`/_next/**`、`/login`、`/favicon.ico` 是公共路径。

配置：

- `src/lib/env.ts` 读取 `DB_PROVIDER`、`DATABASE_URL`、`COMFY_API_URL`、`COMFY_HISTORY_*`、`MODEL_BASE_DIR`、`OUTPUT_BASE_PATH`、Comfy launch/target、auth、auto censor、training worker 等。
- 源码默认 `COMFY_HISTORY_MAX_ATTEMPTS=300`，`.env.example` 当前写的是 `15`，这是已核验的配置漂移。
- README 对 `OUTPUT_BASE_PATH` 的说明把外部 Comfy output 和 managed `data/images` 混在一起。代码里 worker 生成图片会下载并写入 managed `data/images/**`，图片服务根目录由 `OUTPUT_BASE_PATH` 或默认 `data/images` 决定。若生产把 `OUTPUT_BASE_PATH` 指向外部 Comfy output，需要专项核验新生成 managed 图片是否可访问。

## 4. 页面地图和真实 UI 功能

当前源码有 28 个 `page.tsx` 页面入口。页面不是一组简单 CRUD，而是多个工作台。

### 4.1 全局 shell 和导航

`src/app/layout.tsx` 判断路径：

- `/login` 不包生产 `AppShell`。
- `/design-demos/**` 不包生产 `AppShell`。
- `/training/**` 不包生产 `AppShell`，Training 使用自己的 shell。
- 其他页面包 `AppShell`。

生产 generation shell：

- `src/components/app-shell.tsx` 提供 `SfwModeProvider`、`PersistentBottomNav`、通知复制按钮、toast。
- 主内容 `max-w-5xl`，底部留出 nav 空间。
- `PersistentBottomNav` 在所有宽度固定底部显示，不是只移动端显示。
- 底部导航有 6 个资源键：运行、项目、预制、模板、模型、设置，再加一个模式切换按钮。
- 模式切换在 `generation` 和 `lora_training` 之间切换。
- 设计目标上，这个 toggle 不是“进入训练子页面”的临时入口，而是两个平级模块之间的模式切换：同一组资源键在不同模式下指向生图或训练的对应工作台；模型和设置是 shared resources。
- 导航会用 `localStorage` 保存 work mode，用 `sessionStorage` 保存每个资源最后访问路径和滚动位置。

这和 `DESIGN.md` 中“桌面左侧全局导航、移动底部导航”的描述不一致。当前生产事实是：全局导航是固定底部导航；左侧导航只在项目详情、项目结果、模板/上下文页面中出现。

### 4.2 根路由和登录

- `/`：重定向到 `/queue`。
- `/login`：独立登录页，表单调用 `POST /api/auth/verify`，成功写 cookie 后跳回 `from`。

### 4.3 Queue 和审图

`/queue`：

- 数据来自 `getQueueRunsPage`、`getRunningRuns`、`getFailedRuns`、`getTrashItems`、`getCensoringQueueData`。
- 客户端轮询 `/api/queue-data`。
- UI 包括 pending review、running、censoring、failed、trash 等区域。
- 注意 `/api/queue` 更接近“待审图 done runs”，不是 active queue source of truth。
- active queue 应看 `/api/worker/status`、`/api/queue-data` 或 deploy 用的 `pause-active/resume-paused`。

`/queue/:runId`：

- 数据来自 `getReviewGroup` 和 `getReviewGroupIds`。
- 核心 `ReviewGrid`。
- 支持批量 keep/trash、lightbox、快捷键、撤销 trash、跳到上一/下一 run、workflow 下载、复跑。
- lightbox 会先显示当前图，当前图 loaded 后低优先级 preload 后续图。

### 4.4 生图项目列表、项目详情、section 编辑

`/projects`：

- 数据来自 `listProjects`、`listProjectFolders`。
- `ProjectsClient` 支持项目文件夹、breadcrumb、项目卡片、归档显示、批量移动、列表状态。

`/projects/new`、`/projects/new/from-existing`、`/projects/:projectId/edit`、`/projects/:projectId/batch-create`：

- 创建、复制、编辑、批量创建项目。
- 页面和 server action 路径可能不同于 `/api/projects` 创建路径。后端子代理确认：API `project-service.createProject` 创建基础 project，页面 server action `lib/actions/project.createProject` 还会写项目级 preset bindings。正式文档要说明“UI 创建”和“API 创建”的能力边界。

`/projects/:projectId`：

- 数据来自 `getProjectDetail` 和 `getPresetLibraryV2`。
- `ProjectDetailClient` 是 section 管理工作台。
- 功能包括：section folder、section sidebar、scroll spy、compact/expanded 卡片切换、滚动锚点恢复、Add Section、Import Template、preset variant sync、preset replacement、进入项目结果、清空 sections、打码、批量运行。
- section card 支持最新结果缩略图、运行状态、选择/排序、进入编辑或结果。

`/projects/:projectId/sections/:sectionId`：

- 数据来自 `getProjectSectionEditPageData`。
- 页面顶部 sticky header 提供返回、上一/下一 section、运行、结果。
- 页面显示最近 run 结果缩略图和 workflow 下载。
- `SectionParamsForm` 管 batch size、aspect ratio、short side、seed policy、KSampler1/2、upscale、checkpoint 等。
- `SectionEditor` 管 prompt blocks、preset/group 导入、variant 切换、LoRA 双分区、manual LoRA、改名。
- resolved config 会把 preset/group binding 合成成可编辑视图；resolver-only blocks 会以临时 id 注入 UI。

### 4.5 结果图库

`/projects/:projectId/sections/:sectionId/results`：

- 单 section 结果页。
- 支持按 run 分组、连续审图、临时 batch size、trash/restore、标记、lightbox、快捷键。

`/projects/:projectId/results`：

- 项目级聚合图库。
- 有 section sidebar、filter state、gallery、lightbox。
- 支持 p站、预览、封面、censor、trash 等图片操作。

### 4.6 Preset Library

`/assets/presets`：

- 数据来自 preset view repository。
- 管理 category、folder、preset、variant、group。
- UI 包括 `PresetManager`、category/folder/group/preset components、DND 排序、批量移动。

`/assets/presets/:presetId`：

- 单 preset 编辑。
- `PresetEditClient` 和 `PresetForm` 管 prompt、negative prompt、LoRA、variant list、bulk edit、apply-to-all。

`/assets/preset-groups/:groupId`：

- 预设组编辑。
- 支持成员、嵌套 group、slot 模板、排序、展开/flatten、引用预览。

`/assets/presets/sort-rules`：

- 管各分类在 positive、negative、lora1、lora2 维度的顺序。

### 4.7 Project Templates

`/assets/templates`、`/assets/templates/new`、`/assets/templates/:templateId/edit`、`/assets/templates/:templateId/sections/:sectionIndex`：

- 模板列表、创建、编辑、模板 section 编辑。
- 数据来自 `template-view-repository` 和 `getPresetLibraryV2`。
- 模板有自己的 section、section folder、preset binding、prompt block、manual LoRA entry。
- 模板 section editor 与生产 section editor 逻辑类似，但数据形态不同，所以有平行实现而非完全共享。

### 4.8 Model assets

`/assets/models`：

- 统一管理 checkpoints 和 LoRA。
- 调用 `/api/models/browse`、`/api/models`、`/api/models/notes`、hash、move 等。
- 底层可走本地文件系统或 SSH remote target。

`/assets/loras`：

- 当前是兼容跳转到 `/assets/models`。
- 旧的 `LoraFileManager` / `LoraUploadForm` 仍在代码中，可能是遗留组件。

### 4.9 Settings

`/settings`：

- 小型工具页，不是完整配置中心。
- 包含 SFW toggle、monitor/logs 入口。
- work mode 切换不在这里，已经由底部导航承担。

`/settings/monitor`：

- 调用 `/api/comfy/status`、`/api/comfy/start`、`/api/comfy/stop`、`/api/comfy/health-probe`。
- 监控 ComfyUI process manager 状态。

`/settings/logs`：

- 调用 `/api/logs?lines=300`。
- 支持 source/module/level filter。

### 4.10 Design demos

`/design-demos/**`：

- 当前是路由化设计 demo 和组件实验室，在 `src/app/design-demos/**`。
- 旧根目录 `design-demos/*.html` 不存在于 tracked current root，旧静态 demo 已归档到 `docs/archive/design-demos/**`。
- 设计 demo 可以作为视觉参考，但不是生产行为 source of truth。

## 5. 后端 API 和服务架构

当前 API route handler 数量很大。它不只是 Agent API。

主要分组：

- `/api/projects/**` 和 `/api/project-*`：项目、项目文件夹、section、运行、导出、复制、归档、模板化、preset replacement、结果清理。
- `/api/preset-library/**`：category、folder、preset、variant、group、member、slot-template、sort-orders、reorder、cascade、usage、sync。
- `/api/templates/**`：模板 CRUD、导入、模板 section、preset replacement。
- `/api/runs/**`、`/api/image-review`、`/api/images/**`：run detail、workflow 下载、keep/trash、cover、featured、manual censor、restore、文件读取。
- `/api/queue/**`、`/api/queue-data`、`/api/worker/status`：队列读取、清理、暂停、恢复、worker 状态。
- `/api/comfy/**`：ComfyUI status/start/stop/restart/health-probe。
- `/api/models/**`、`/api/loras/**`、`/api/path-maps`：模型和 LoRA 文件浏览、上传、移动、hash、notes。
- `/api/auth/verify`、`/api/logs`、`/api/audit-logs`、`/api/health`。
- `/api/agent/**`：高层 Agent REST API。
- `/api/mcp`：MCP Streamable HTTP transport。
- `/api/training/**`：Training v2 专属 API，见 Training 章节。

分层真实现状：

- Route handlers 多数只做参数、JSON body、调用 service/repository、统一响应。
- `src/server/services/**` 做业务校验、字段白名单、审计、流程编排、文件操作编排、错误映射。
- `src/server/repositories/**` 做 Prisma 查询、事务、数据序列化。
- `src/lib/actions/**` 是 server actions，很多 UI 写操作走这里。
- `src/lib/server-data.ts` 是 RSC/server 页面数据 facade，会 re-export repository/service 函数。

需要注意的架构妥协：

- `src/lib/server-data.ts` 自称 tech debt，因为 `lib/` 反向依赖 `server/`。
- `prompt-block-service.ts` 和 `src/lib/actions/prompt-block.ts` 有重叠逻辑。
- `prompt-block-repository.ts` 名字像 repository，但实际更像 service wrapper。
- API project detail route catch `PROJECT_NOT_FOUND`，但 repository `getProjectDetail` 抛 `JOB_NOT_FOUND`。这已核验，可能导致 `/api/projects/:id` 不存在时返回 500 而不是 404。

## 6. 生图主流程

### 6.1 创建和组织项目

UI 创建项目：

- 页面 server action 可初始化项目级 preset bindings。
- 项目可以归入 `ProjectFolder`。
- 项目包含多个 `ProjectSection`，section 可归入 `ProjectSectionFolder`。

API 创建项目：

- `/api/projects` 走 `project-service.createProject`，更像基础 project 创建。
- 与 UI 创建入口能力并不完全一致。

### 6.2 Section 和 preset binding

新增 section：

- 读取项目级 preset binding。
- 按 category order 初始化 `SectionPresetBinding` 和 `SectionPromptBlock`。

导入 preset：

- 写 `SectionPresetBinding`。
- 写 preset prompt row。
- 解析 variant content，返回 prompt/LoRA。

编辑 preset-sourced prompt block：

- 可能触发 detach，把 preset-sourced LoRA 转成 manual LoRA，保留 detached source 字段。

Prompt / LoRA 模型是“零冗余倾向”：

- Section block 不直接复制全部 preset 数据，而是保存 custom 文本或绑定引用。
- LoRA 有 preset/group/manual 来源。
- Run 创建时解析成 resolved snapshot。

### 6.3 运行入队

运行入口：

- `runProject`、`runSections`、`runSection`。
- Repository 在事务里创建 `Run(status="queued", comfyPromptId=null, resolvedConfigSnapshot=...)`。
- 如果 section 有多个 aspect ratios，会生成多个 queued runs。
- `scheduleQueuedRunsToComfyUI()` 异步提交。

Resolved config 来源：

- section 参数。
- project overrides。
- prompt blocks。
- preset/group LoRA。
- manual LoRA。
- KSampler。
- checkpoint。
- extraParams。

Run 使用点击运行那一刻的 `resolvedConfigSnapshot`，后续编辑 section 不影响历史 run。

### 6.4 ComfyUI 提交和轮询

提交：

- `run-executor.ts` 读取 `WorkerRunSnapshot`。
- `payload-builder.ts` 生成 `ComfyPromptDraft`。
- `comfyui-service.ts` validate 并提交到 Comfy `/prompt`。
- 成功后写回 `Run.comfyPromptId`、`submittedPrompt`、`executionMeta`。

轮询：

- 先用 Comfy `/queue` 判断 prompt 是 pending/running/not_found。
- 只有进入 Comfy running 后，本地 `Run` 才从 queued 转 running。
- 再轮询 `/history/:promptId`。
- 大量排队时会扩展窗口，避免把还在 Comfy 队列里的任务误判为超时。

恢复：

- `/api/queue-data` 发现 running runs 时触发 `recoverStaleRuns()`。
- `src/instrumentation.node.ts` 启动时也触发恢复。
- 已有 `comfyPromptId` 的 queued/running 会继续 poll。
- 没有 `comfyPromptId` 的 queued 在 Comfy 可达时重新提交。

### 6.5 Workflow 填充

默认使用 `docs/workflow.api.json`。

`workflow-prompt-builder.ts` 填充关键节点：

- `1`：checkpoint。
- `511`：positive prompt。
- `513`：negative prompt。
- `407`：latent width、height、batch_size。
- `522`：一阶段 LoRA。
- `36`：二阶段 LoRA。
- `3`：KSampler1。
- `425`：LatentUpscale。
- `427`：KSampler2。
- `410`：VAE Decode。
- `515`：Image Save output path 和 filename prefix。

单阶段模式会删除 `425`、`427`、`36`，并把 `410` rewired 到 `3`。

优先级：

1. `extraParams.comfyPrompt/workflowApiPrompt/apiPrompt` 显式覆盖。
2. 标准 `docs/workflow.api.json`。
3. fallback SDXL txt2img。

### 6.6 图片落盘和审图

Comfy 生成结果不会直接引用 Comfy output。

`persistComfyOutputImages()`：

- 从 Comfy `/view` 下载。
- 转成 JPEG。
- 写到 `data/images/{projectSlug}/{sectionSlug}/run-XX-{runId}/raw/NN.jpg`。
- 生成 `thumb/NN.jpg`，最大边 400，质量 80。
- 写 `ImageResult.filePath/thumbPath`。

路径安全：

- Comfy filename 禁止 `/`、`\`、`..`。
- subfolder 规范化并拒绝 `.` / `..`。
- `/api/images/[...path]` 只允许图片扩展名，拒绝危险路径段、冒号、NUL、Unicode 斜杠、尾随空白/点和 `.tmp`。
- 用 `path.resolve` 确认最终路径仍在 serving 根目录下。

审图：

- `ImageResult.reviewStatus` 驱动 pending/kept/trashed。
- `TrashRecord` 记录 trash 补充信息。
- cover 操作会自动 keep。
- queue review 偏任务流，results gallery 偏图库流。

## 7. Training v2 子系统

Training 不是 demo，也不是普通生图项目的一个页面。设计目标上，它是和当前主要生图模块平级的一等模块，通过全局底部导航的 mode toggle 与生图模式切换；实现上，它已有独立路由、独立 API、独立实体和独立 worker 队列，但仍复用了部分 design-demo shell/primitives。

### 7.1 路由和 shell

入口：

- `src/app/training/[[...route]]/page.tsx`。
- 裸 `/training` 重定向到 `/training/runs`。
- 服务端调用 `loadTrainingRouteData(route)`。
- `TrainingApp` 用 `src/features/training/routes.ts` 匹配 route key，然后渲染对应页面。

Shell：

- Training 不走 root `AppShell`。
- `TrainingShell` 使用 `DesignDemoShell`，但 `navigationChrome="none"`。
- 仍复用全局 `PersistentBottomNav` 作为 footer nav。
- `header-specs.ts` 按 route 生成标题、计数、状态、action slot。

这说明 `docs/ui/component-boundaries.md` 中“design-demo-ui 只属于 demo primitives”的说法过窄。生产 `/training/**` 明确复用 design-demo shell/primitives，需要文档调整。

### 7.2 Training 页面地图

`/training/runs`：

- 训练/生成任务总览。
- 支持筛选、取消、删除、重试。

`/training/runs/generation/:taskId`：

- 生成任务详情。
- 展示输入、输出、review、应用结果。

`/training/runs/training/:trainingRunId`：

- 训练运行详情。
- 展示进度、dataset samples、config、log、final artifact。
- 支持取消和从完成训练创建 preset。

`/training/projects`：

- 训练项目列表。
- 支持当前/归档、排序、批量操作。
- 数据加载刻意轻量，不读完整项目详情。

`/training/projects/new`：

- 创建训练项目。
- 选模板、checkpoint、参考图、初始 sections。

`/training/projects/:id`：

- 项目概览。
- 展示 profile、训练入口、最近任务、最近结果。

`/training/projects/:id/profile`：

- 角色资料。
- 使用提示词、角色详情 JSON、参考图上传/管理、参考图加入结果池、文本修订恢复。

`/training/projects/:id/sections`：

- 训练 sections 列表。
- 新增、复制、拖拽排序、生成样图。

`/training/projects/:id/sections/:sectionId`：

- section 详情。
- 场景描述 blocks、preset block 导入、生成结果 review。

`/training/projects/:id/sections/:sectionId/generation-tasks/new`：

- 生成任务 compose。
- 拼装 profile、section 场景、参考图、补充图、补充 prompt。
- 支持预览再入队。

`/training/projects/:id/results`：

- 训练图片池。
- pending/kept/rejected review、caption、批量操作。

`/training/projects/:id/dataset`：

- 训练集准备质量门。
- kept 数、caption 缺失、冻结 revision、启动训练。

`/training/projects/:id/dataset/revisions/:revisionId`：

- 数据集 revision 详情。
- frozen samples、caption snapshot、manifest rows、相关 training runs。

`/training/projects/:id/training-runs`、`/training/projects/:id/generation-tasks`：

- 项目内 scoped runs。

`/training/presets/**`：

- 训练场景描述 preset，不是普通 `/assets/presets`。

`/training/templates/**`：

- 训练模板和模板 section scene blocks。

### 7.3 Training 实体流

核心实体链：

`TrainingProject`
→ `TrainingCharacterProfile`
→ `TrainingCharacterImage`
→ `TrainingSection`
→ `TrainingSceneDescriptionBlock`
→ `TrainingGenerationTask`
→ `TrainingSectionRun`
→ `TrainingImageResult`
→ `TrainingDatasetRevision`
→ `TrainingDatasetRevisionItem`
→ `TrainingRun`
→ `TrainingArtifact`
→ 可选 `TrainingSceneDescriptionPreset`

关键实体：

- `TrainingProject`：训练项目配置、默认训练参数、checkpoint、归档/隐藏/排序。
- `TrainingCharacterProfile`：LoRA 使用提示词、角色详情 JSON、生成任务引用。
- `TrainingCharacterImage`：参考图和 artifact 关联。
- `TrainingSection`：训练场景 section。
- `TrainingSceneDescriptionBlock`：场景描述 block，可来自 preset。
- `TrainingGenerationTask`：profile/scene/image/caption/training-set 等生成任务。
- `TrainingSectionRun`：section 级生成运行。
- `TrainingImageResult`：训练图片结果，可 review、caption、加入 dataset。
- `TrainingDatasetRevision`：冻结训练集版本。
- `TrainingDatasetRevisionItem`：冻结时的图片、caption、prompt、file snapshot。
- `TrainingRun`：训练任务。
- `TrainingArtifact`：训练域统一文件实体。

### 7.4 Training API/service/worker

API 层：

- `/api/training/projects/**`：项目、profile、sections、reference images、results、dataset revisions、training runs、generation tasks。
- `/api/training/sections/**`：section、blocks、runs、scene description。
- `/api/training/generation-tasks/**`：draft、run、preview、inputs、outputs、supplemental images、cancel。
- `/api/training/image-results/**`：review、caption、更新、删除。
- `/api/training/presets/**` 和 `/api/training/scene-description/**`：训练场景 preset/category/folder。
- `/api/training/templates/**`：训练模板。
- `/api/training/worker/**`：worker lease、heartbeat、complete、fail、status。
- `/api/training/scheduler/**`：scheduler tick/status。

Service/repository：

- `route-data-service.ts` 组装 route data。
- `snapshot-service.ts` 把 Prisma rows 映射成 training UI DTO。
- `project-actions-service.ts` 做 project/profile/dataset/training run 编排。
- `generation-task-draft-service.ts` 管生成任务 draft。
- `generation-output-service.ts` 管输出应用。
- `caption-service.ts` 当前是 deterministic/local caption 逻辑，不是真异步模型 caption。
- `run-preset-service.ts` 从训练运行创建 preset。
- `repositories/training/**` 做 DB 持久化。

Worker：

- worker 类型：`image_generation`、`dataset_freeze`、`training`。
- `leasing.ts` 做任务领取。
- `heartbeat.ts` 做续约。
- `completion.ts`、`failure.ts` 做完成/失败。
- `scheduler.ts` 做调度。
- `task-id.ts`、`target-discovery.ts`、`task-serialization.ts`、`task-json.ts` 做边界拆分。
- `scripts/training/worker-queue.ts` 和 runtime scripts 启动真实或 mock worker。

Training 与普通生图的平级关系和边界：

- 平级关系：生图和 Training 都有自己的 runs、projects、presets、templates 工作台；底部导航 mode toggle 在两套资源入口之间切换。
- 共享资源：models 和 settings 是 shared resources，不属于任一单独模式。
- 实现状态：当前 Training 已有独立 production route/API/service/entity/worker，但 UI shell 仍借用 design-demo shell/primitives；这属于实现复用，不应被解释为 Training 是 demo 或附属模块。

- Training 图片生成 provider policy 写在 `src/lib/training/provider-policy.ts`，当前训练图片生成不是普通 Comfy workflow/queue。
- Training preset 是 `TrainingSceneDescriptionPreset*`，普通生图 preset 是 `Preset*`。
- Training worker queue 独立于 `/api/queue`。
- 共享 model assets、图片文件服务、底部导航、部分 design-demo primitives。

已核验的 Training 风险：

- `TrainingDatasetRevision.status` schema 默认是 `ready`，repository freeze 和 worker completion 也写 `ready`。
- `snapshot-service.ts` 只把 `frozen` 映射为前端 `ready`，把 `freezing` 映射为 `training`，其他都变 `draft`。
- 因此当前冻结后的 `ready` revision 可能在 UI DTO 中显示成 `draft`。这应列入正式 cleanup 后续 bug/risk。
- `caption-service.ts` 当前自动生成 caption 的 fallback 是 `${triggerToken}, candidate image, autogenerated caption`，不是外部 caption 模型。
- `dataset_freeze` worker 与 API 同步 freeze 职责有重叠，当前更像占位/状态完成器。

## 8. 数据模型和实体关系

Prisma 当前有 PostgreSQL 和 SQLite 两份 schema。

PostgreSQL schema：

- 54 个 model。
- 5 个 enum：`JobStatus`、`RunStatus`、`ReviewStatus`、`ActorType`、`PromptBlockType`。

SQLite schema：

- 54 个 model。
- enum 用 string 兼容。

### 8.1 生图项目实体

核心链：

`Project`
→ `ProjectSection`
→ `Run`
→ `ImageResult`
→ `TrashRecord` / `CensoringTask`

补充：

- `ProjectFolder`：项目文件夹树。
- `ProjectSectionFolder`：section 文件夹树。
- `SectionChangeLog`：section 参数、prompt、binding 修改历史。
- `Run.resolvedConfigSnapshot`：运行时配置快照。
- `Run.submittedPrompt`：提交给 Comfy 的 prompt。
- `Run.executionMeta`：执行元信息。
- `ProjectSection.latestRunId`：最新 run 快捷引用。

### 8.2 Preset Library 实体

核心：

`PresetCategory`
→ `PresetFolder`
→ `Preset`
→ `PresetVariant`

关系：

- `PresetVariantLink` 表达 variant 间链接，替代旧 JSON 冗余字段。
- `PresetGroup` 和 `PresetGroupMember` 管预设组和嵌套。
- `PresetCategorySlot` 管 slot template。
- `PresetChangeLog`、`PresetGroupChangeLog` 记录修改。

注意：

- `PresetGroupMember` schema 没强制 preset/variant/subgroup 互斥，这需要 service 层保证。

### 8.3 Binding 和 prompt blocks

Project/template/section 三层都有 binding 语义：

- `ProjectPresetBinding`
- `ProjectTemplatePresetBinding`
- `SectionPresetBinding`
- `TemplateSectionPresetBinding`

Prompt blocks：

- `SectionPromptBlock`
- `TemplateSectionPromptBlock`

Manual LoRA：

- `SectionManualLoraEntry`
- `TemplateSectionManualLoraEntry`

重要字段：

- `bindingKey` 是父作用域内稳定键。
- `sortOrder` 控制显示/拼接顺序。
- detached source 字段保留从 preset 脱离的来源。

### 8.4 Template 实体

`ProjectTemplate`
→ `ProjectTemplateSection`
→ template section bindings / prompt blocks / manual LoRA

还有：

- `ProjectTemplateSectionFolder`
- template-level preset bindings

模板可从项目保存，也可导入到项目。导入支持 dry-run 和重复策略。

### 8.5 Training 实体

见 Training 章节。Training 完整独立，使用 `Training*` 模型，不应与普通 `Project*` 混用。

### 8.6 Asset/Ops 实体

- `LoraAsset`：LoRA 元数据，notes、trigger words、Civitai link 等。
- `AuditLog`：操作审计，actor 区分 user/system/agent。
- `GpuTaskLock`：GPU 任务锁。

### 8.7 PostgreSQL / SQLite 差异

已确认差异：

- PostgreSQL 使用 Prisma enum，SQLite 用 string。
- PostgreSQL 使用 `@db.Text` 等数据库特定标注，SQLite 无。
- 生成 client 分别是 `src/generated/prisma` 和 `src/generated/prisma-sqlite`。
- `src/lib/prisma.ts` 根据 provider 动态加载 runtime client，并把 SQLite client cast 成统一 PrismaClient 类型。

已核验的 schema 漂移风险：

- `PresetFolder` 和 `ProjectFolder` 在 PostgreSQL schema 有 `createdAt/updatedAt`。
- SQLite schema 中这两个 model 没有 `createdAt/updatedAt`。
- 当前 `docs/prisma-schema-compatibility.md` 若宣称所有 shared models 完全兼容，就需要修正或让生成脚本覆盖这个差异。

Migration/seed 风险：

- PostgreSQL migration tree 只有 20260616 之后几条。
- SQLite migration tree 保留更早 legacy migration。
- 训练测试使用 `prisma migrate diff --from-empty --to-schema prisma/schema.sqlite.prisma --script` 更信当前 schema，而不是逐条 migration tree。
- `prisma/seed.ts` 与 `src/scripts/seed.mts` 是两套 seed 入口，需要正式文档说明哪个是推荐入口。

## 9. ComfyUI、队列、Worker 和运行时治理

### 9.1 Comfy target

`getActiveComfyTarget()` 支持：

- 无配置时 local fallback。
- `COMFY_TARGET_CONFIG_PATH + COMFY_ACTIVE_TARGET` 指定 target。
- local target：apiUrl、modelBaseDir、launch command、launch cwd。
- ssh target：localApiUrl、远端 host/port/root/model root、start/stop/restart/log/hash 命令、tunnel auto start。

SSH 模式：

- HTTP 走本地 tunnel URL。
- `ensureActiveComfySshTunnel()` 按需启动 `ssh -L`。

### 9.2 Comfy process manager

`ComfyProcessManager`：

- local 模式可 spawn `COMFY_LAUNCH_CMD`。
- health check 打 `/system_stats`。
- 支持 auto-start、auto-restart、GPU-aware restart、kill-by-port。
- ssh 模式执行 target 配置的 start/stop/restart 命令，不本地 spawn。

`/api/comfy/status`：

- 返回 Comfy process manager 状态，包含 state、pid、health、restart count、target id/mode、logs、apiUrl。

`/api/worker/status`：

- 是 active queue + Comfy reachability 状态。
- 同时读 generation worker queued/running 计数和 Comfy `/system_stats`。
- 与 `/api/comfy/status` 语义不同。

### 9.3 Pause / resume

部署前 runtime-affecting 动作必须检查 active queue。

`POST /api/queue/pause-active`：

- 对没有 `comfyPromptId` 的本地 queued 可直接标记 paused。
- 对有远端 prompt 的 run，先调用 Comfy queue delete 或 interrupt，并确认远端 queue 消失。
- 在 `executionMeta.__queuePause` 写 `source/batchId/pausedAt`。

`POST /api/queue/resume-paused`：

- 默认只恢复 `source=api-pause-active` 且本 batch 标记的 runs。
- 用保存的 `submittedPrompt` 重新提交 Comfy，拿新 prompt id。
- 不应误恢复用户手动暂停的任务。

### 9.4 Node instrumentation

`src/instrumentation.node.ts`：

- 启动时清理超过 30 分钟还 running 的 orphaned runs。
- 启动时 recover stale runs。
- 默认不会自动恢复 paused runs。
- 只有 `AUTO_RESUME_PAUSED_RUNS_ON_STARTUP=true` 时才自动恢复。

风险点：

- 自动恢复和 graceful shutdown 部分使用 `env.comfyApiUrl`，可能未走 active target/tunnel。ssh target 场景需专项核验。
- 自动恢复分支和 server action `resumeRun()` 对 resumed run 的 status 语义不完全一致。

## 10. Agent API 和 MCP

Agent REST API 当前不是 7 个端点，而至少有 10 个高层方法入口：

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

MCP：

- 端点：`GET/POST/DELETE /api/mcp`。
- transport：Streamable HTTP。
- 实现：`src/server/mcp/server.ts`。

当前 MCP tools：

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

当前 MCP resources：

- `comfyui://projects/{projectId}/context`
- `comfyui://runs/{runId}/context`
- `comfyui://sections/{sectionId}/blocks`

README 中可以概述这些能力，但不应长期手写大而全的 endpoint count 表。具体契约应交给 `docs/agent-api.md`、源码、测试或生成文档。

## 11. 测试和治理系统

测试不只是功能回归，也约束仓库治理。

重要测试类别：

- 文档治理：`test-documentation-governance.test.ts`。
- repo inventory：`test-repo-inventory.test.ts`。
- scripts 文档：`test-script-maintenance-doc.test.ts`。
- API request JSON 和 response helper：`test-api-request-json.test.ts`。
- global API routes：`test-global-api-routes.test.ts`。
- Prisma provider/docs：`test-prisma-provider-matrix-doc.test.ts`、`test-prisma-schema-compatibility-doc.test.ts`。
- runtime config：`test-config-runtime-governance.test.ts`。
- worker boundary：`test-worker-boundary-governance.test.ts`。
- UI boundary：`test-ui-component-boundaries.test.ts`。
- design demo governance：`test-design-demo-governance.test.ts`。
- training prototype/governance：`test-training-prototype-governance.test.ts`、`test-training-feature-entry-boundaries.test.ts`。
- fixture governance：`test-fixture-governance.test.ts`。
- quality script governance：`test-quality-script-governance.test.ts`。

脚本：

- `scripts/docs/generate-repo-inventory.ts` 生成 `docs/repo-inventory.md`。
- `scripts/docs/generate-prisma-schema-compatibility.ts` 生成 `docs/prisma-schema-compatibility.md`。
- 当前没有 package-level `docs:inventory`、`docs:prisma-compat` 快捷脚本。正式文档维护时可以考虑补。

测试带来的约束：

- README 目前有页面/API/MCP count 测试约束，说明它不是完全无人维护，但这也让 README 负担过重。
- Inventory 覆盖强，但 owner/action 是 heuristic，分类是否最佳仍需人工。
- Archive docs 要有 current source banner。
- Design demo 和 prototype 的 production boundary 被测试约束，但 docs 仍有语义混乱。

## 12. 文档系统真实状态

### 12.1 应保留为 current truth 的层

- `AGENTS.md`
- `agent-rules/**`
- `docs/index.md`
- `docs/documentation-map.md`
- `docs/repo-inventory.md`
- `docs/agent-api.md`
- `docs/api/**`
- `docs/workflow.api.json`
- `docs/worker-boundaries.md`
- `docs/prisma-provider-matrix.md`
- `docs/prisma-schema-compatibility.md`
- `docs/local-verification.md`
- `docs/runbooks/**`
- `docs/ui/**`
- `DESIGN.md`，前提是明确它是“目标方向”还是“当前实现”。

### 12.2 Generated / inventory 层

- `docs/repo-inventory.md`
- `docs/prisma-schema-compatibility.md`
- `docs/plans/auto-review-analysis/**` 更像 generated/quality artifact，不是 active plan。

### 12.3 Prototype / historical 层

- `docs/prototypes/**`：Training prototype intent，不能作为 production behavior truth。
- `docs/archive/**`：旧 plans、旧 PRD、旧 handoff、旧静态 design demos、旧 design-system。
- `docs/superpowers/specs/**`：偏 durable spec/reference，但当前夹在 superpowers 目录中，边界不够清。
- `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`：被 inventory 标为 current，但链接到不存在的 `docs/superpowers/plans/**`，且 current 层级不清。

### 12.4 已确认的文档漂移

README：

- 已比旧版本更接近事实，但仍承担过多精确数字、环境变量表、API count 表。
- `OUTPUT_BASE_PATH` 说明需结合 managed `data/images` 重新写。
- training worker、provider policy、dataset freeze、caption placeholder 等实现细节没有进入 current docs。

DESIGN.md：

- 写了桌面左侧全局导航，但当前生产 generation shell 全宽度固定底部导航。
- 主色方向写绿色/rose，但当前生产 generation 大量使用 sky/blue active。
- 更像目标设计方向，不是完整当前实现。

`docs/ui/component-boundaries.md`：

- 把 `design-demo-ui` 定位为 demo primitives，但 production training 复用它。

`docs/local-verification.md`：

- 仍有旧操作文案，例如旧项目/任务/Run All/回收站 tab 等表达。
- 测试只约束 auth/service/Comfy/protected pages，不保证 UI 操作步骤贴合当前页面。

`docs/design-demos-frontend-parity.md`：

- 时间较早，大量非 Training “静态对齐/完成”说法需要重新核验。

`docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`：

- current/历史边界不清，且链接到不存在的 `./plans/2026-05-21-queue-pause-resume.md`。

`docs/prototypes/**`：

- README 说是 prototype intent source，但 inventory 对 HTML/CSS/JS prototype action 多为 archive。需要明确“保留意图”与“未来归档动作”的语义。

## 13. 当前高价值风险清单

这些不是泛泛的“可能过时”，而是本轮已从源码/文档中定位到的具体问题。

### 13.1 可能是代码 bug 或行为风险

1. `/api/projects/:projectId` GET catch `PROJECT_NOT_FOUND`，但 repository 抛 `JOB_NOT_FOUND`，不存在项目可能返回 500。
2. Training dataset revision：DB/repository/worker 写 `ready`，snapshot 只把 `frozen` 映射为 UI ready，`ready` 会显示成 draft。
3. `src/instrumentation.node.ts` 自动恢复路径可能没有走 active Comfy target/tunnel。
4. resume 自动恢复与 server action resume 的本地 run status 语义不完全一致。
5. `OUTPUT_BASE_PATH` 指向外部 Comfy output 时，managed `data/images` 新结果 serving 关系需核验。
6. `prompt-block-service.ts` 与 `lib/actions/prompt-block.ts` 重叠逻辑可能存在行为分叉。
7. API createProject 与 UI server action createProject 能力不同，文档若写“创建项目”不能混为一个入口。

### 13.2 文档事实错误或边界错误

1. `DESIGN.md` 的导航结构不等于当前生产实现。
2. `.env.example` `COMFY_HISTORY_MAX_ATTEMPTS=15` 与源码默认 300 不一致。
3. `docs/ui/component-boundaries.md` 对 `design-demo-ui` 的范围描述太窄。
4. `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md` current/历史边界和链接错误。
5. `docs/prisma-schema-compatibility.md` 需要反映 SQLite 的 `PresetFolder`/`ProjectFolder` timestamp 差异，或修正 schema。
6. `docs/local-verification.md` 的 UI 操作步骤需要按当前页面重写。
7. `docs/prototypes/**` 的保留目的和 inventory action 需要对齐。

### 13.3 架构债

1. `src/lib/server-data.ts` 是反向依赖 `server/` 的 facade。
2. server actions 和 services 有职责重叠。
3. prompt block 和 preset binding 逻辑散落在 service/action/repository/UI helper。
4. Training `dataset_freeze` worker 与同步 freeze service 职责重叠。
5. docs 生成脚本没有 package scripts，维护入口分散。
6. route handler method 统计存在 function export 和 const export 的口径问题，不适合手写为 README 权威数字。

## 14. 正式文档重建建议

下一步不是只移动文件，也不是只补索引，而是用当前代码替换腐烂文档。

优先顺序：

1. 重写 README：保留项目说明、快速开始、主要产品面、最小技术栈、文档入口；移除或弱化大表格精确 count。
2. 重写 `docs/local-verification.md`：按当前 auth、AppShell、bottom nav、queue review、training、Comfy target、worker/status 重写。
3. 重写 `docs/agent-api.md`：区分 Agent REST、普通 API、MCP、training API，不再把 Agent API 写成 7 个端点。
4. 修 `DESIGN.md`：明确是目标设计，还是 current UI；如果是 current UI，就必须承认当前全局底部导航和 sky/blue 现状。
5. 修 `docs/ui/component-boundaries.md`：说明 training 生产 UI 复用 design-demo primitives，或迁移到中性 shared primitives 命名。
6. 修 Prisma compatibility：处理 `ProjectFolder/PresetFolder` timestamp 差异。
7. 归档或合并 `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`。
8. 清理 `docs/prototypes/**` 语义：保留 prototype intent，但不作为 production truth。
9. 重新生成 `docs/repo-inventory.md`。
10. 跑 focused governance tests，再按改动范围跑完整 `npm test`。

## 15. 专项补充阅读结果

本节是对上一版“仍未完成专项”的补读结果。五个子代理分别只读 API、生产生成侧 UI、Training UI、历史 Training 计划迁移、运行时可验证性；均未修改文件、未启动新服务、未提交。

### 15.1 API route contract

`src/app/api/**/route.ts` 当前共有 194 个 route 文件。按静态导出的 HTTP method 统计是 266 个方法，README 中的 261 已经不应继续作为权威数字。这个差异可能来自 alias route、新增 method、统计脚本口径不同，但结论是：README 不适合手写精确 method count，精确 contract 应由生成文档维护。

API 响应主流约定是 `src/lib/api-response.ts` 的 `{ ok: true, data }` / `{ ok: false, error: { message, details? } }`。例外必须显式写入文档：

1. `/api/auth/verify` 使用 flat `{ ok: true }` 或 `{ error }`。
2. `/api/queue-data` 是 legacy raw JSON，不走通用 envelope。
3. `/api/images/:path*` 和 workflow download 返回文件流或附件。
4. `/api/mcp` 走 MCP Streamable HTTP transport，不能按普通 JSON API 描述。

按域看，current API 已经远超旧 README 的“7 个 Agent 端点”：

| 域 | 当前事实 |
|---|---|
| Agent | 仍有核心 project/context/run/review flow，但还包含 preset variant switch/sync/safe flow。`docs/agent-api.md` 是 agent workflow 文档，不是全量 route contract。 |
| Generation | project、folder、section、prompt block、template、preset library、queue、run review、workflow download 均有 API。 |
| Queue | `/api/queue` 是待审核图片队列，不是 active run queue。active/running 应看 `/api/worker/status`、`/api/queue-data`、`pause-active`、`resume-paused`。 |
| Training | `/api/training/**` 是完整一等域，覆盖 project、profile、section、block、generation task、image result、reference image、caption、dataset revision、training run、template、scene preset、scheduler、worker callback。 |
| Runtime | Comfy start/stop/restart/health-probe、worker status、model file manager、logs、audit logs、MCP 都是正式能力，但写操作有运行时边界。 |

已定位的文档漂移：

1. `docs/agent-api.md` 把 `/api/preset-library/presets/:presetId/cascade` 写成 `POST`，源码是 `DELETE`。
2. project/section run body 文档写 `overrideBatchSize`，route 读取 `batchSize`，需要用客户端实际调用再定稿。
3. README 的 route/method/domain count 混用了不同口径，不应继续手写。

正式文档建议：写一个人工维护的 API 入口说明，只解释认证、响应 envelope、例外 route、队列语义、危险 runtime 操作和 agent/training 工作流；全量 method/path/query/body/status/service 映射生成到 `docs/api/generated-route-contracts.md` 一类文件。

### 15.2 生产生成侧 UI props 与状态机

生成侧生产 UI 的 shell 是 `RootLayout -> AppShell -> PersistentBottomNav`。`/login`、`/design-demos`、`/training` 绕过普通 `AppShell`。底部导航不是临时 demo 导航，而是 current production navigation 的关键入口；它读取 pathname/search、work mode、本地最近路由和滚动状态，并在 generation / training 同类资源之间切换。

主要页面树：

| 页面域 | 当前组件结构 |
|---|---|
| Queue/Review | `QueuePage -> QueuePageClient -> Pending/Running/Censoring/Failed/Trash tabs`；单 run 是 `ReviewGroupPage -> ReviewGrid -> ImageCard/SelectionToolbar/BatchActions/ImageLightbox`。 |
| Projects | `ProjectsPage -> ProjectsClient`；详情是 `ProjectDetailPage -> ProjectDetailClient -> SidebarProvider -> AppSidebar + toolbar + SectionFolderControls + SectionCards`。 |
| Section editor | `SectionEditPage -> SectionParamsForm + SectionNameEditor + SectionEditor`；编辑器下接 imported preset bindings、import panel、prompt block、LoRA list。 |
| Results | project results 和 section results 是两条实现：前者有 sidebar/toolbar/gallery/lightbox，后者有 provider、gallery 和 inline lightbox。 |
| Assets | `PresetManager` 组织 category rail、preset/group list、preset form、variant editor；models 用 `ModelFileManager` 管目录、上传、移动、notes。 |
| Settings | monitor/logs 是轮询状态页，monitor 还控制 Comfy start/stop/probe。 |

关键状态机：

1. Queue review：队列页由 active tab、轮询刷新、transition pending 驱动；单 run review 有 optimistic review、pending actions、lightbox index、selection、undo stack。keep/trash/marker 会乐观更新，失败回滚。
2. Project detail：项目列表 folder 写 URL；详情页 section folder 也写 URL。scroll spy 维护 active section，hash 到达后滚动并清 hash，compact 模式用最近可见 section 修正滚动锚点。
3. Section editor：参数表单和 batch size 有 debounce 自动保存；preset import/switch/delete 会重组 prompt blocks 和 LoRA entries；LoRA 删除存在 suppress/tombstone 语义。
4. Results：project results 按 all/featured/featured2/cover 过滤，lightbox 以 image id 驱动；section results 使用 provider 级 optimistic 状态，并支持跨 section 连续审核。
5. Preset/template：preset form 有 `idle -> saving -> queued -> saved/error` save queue；template section detail 有 600ms debounce 保存，`null` 表示导入时不覆盖。
6. Model/settings：model browser 是 `kind/path -> loading/items`，搜索 debounce 200ms；monitor/logs 约 5s polling。

生产 UI 的真实债务不是“没有组件”，而是重复实现很多：

1. queue review、project results、section results 各有相似 lightbox、keep/trash/marker、键盘导航和乐观状态。
2. `SectionEditor` 与 template section detail 都实现 preset binding/import/switch/LoRA 排序。
3. folder UI 在 projects/presets/templates/models 间部分共享、部分重写。
4. 旧 `LoraFileManager` 还在，但 `/assets/loras` 已重定向到 `/assets/models`。

这也解释了为什么 `DESIGN.md` 不能直接当 current truth：它描述的 light mode、glass、green/rose、桌面左侧全局导航和“one main surface”并不等于当前 production UI。`docs/ui/project-page-boundaries.md` 与当前项目详情边界相对一致；`docs/ui/component-boundaries.md` 对 `design-demo-ui` 与 shared primitive 的边界需要重写。

### 15.3 Training UI props 与状态机

Training 的设计目标应写成：Training 与普通生图是平级 work mode，通过导航栏的 mode toggle 切换；models/settings 是共享资源，runs/projects/presets/templates 按当前 work mode 路由到各自模块。

当前 Training shell 是 `TrainingApp -> TrainingShell -> DesignDemoShell + PersistentBottomNav`。它复用 `DesignDemoShell` 的 layout/header/feedback/theme/portal/scroll header 能力，但设置 `navigationChrome="none"`，不用 design-demos 的 sidebar/nav/data。Training 的数据、路由、API、实体、header specs 都在 `src/features/training/**` 和 `/api/training/**`。

核心数据入口：

```ts
TrainingAppData = {
  images: ...
  loraTraining?: {
    projects: ...
    runs: ...
    presets: ...
    templates: ...
  }
  models: ...
  shellData?: ...
}
```

主要路由与页面：

| 路由域 | 页面事实 |
|---|---|
| `/training`、`/training/runs` | `LoraTrainingRunsPage`，读取 training runs route data。 |
| `/training/runs/generation/:taskId` | generation task detail，kind 为 generation。 |
| `/training/runs/training/:trainingRunId` | training run detail，kind 为 training。 |
| `/training/projects` | lightweight project summaries。 |
| `/training/projects/new` | project create form，带 projects/presets/templates/models。 |
| `/training/projects/:id/**` | project detail、profile、sections、compose、dataset、results 等子页。 |
| `/training/presets`、`/training/templates` | scene preset 与 training template 管理。 |

关键状态机：

1. Projects：scope/view mode/selected ids/local projects/order/hidden ids；reorder 乐观 PATCH，失败回滚；archive/restore/delete；创建页先本地 draft，再 POST、上传引用图、跳转详情。
2. Profile/reference/text revisions：profile draft、reference image 编辑、pending sets、revision panel 分离；支持 PATCH profile、GET revisions、POST restore、reference image CRUD、add reference to results。
3. Sections/scene blocks：header 事件触发 add；add/copy/delete/reorder 乐观更新；detail state 以 `projectId:sectionId` 分区；local/imported preset block 支持 move/edit/delete/save。
4. Compose：选择 reference/supplemental images，计算 final input text；生产路径会确保 draft task、写 inputs、preview、run、跳 generation detail。
5. Results/caption：父层维护 filters/selection/bulk review/caption revision，grid 自管 lightbox active id；review 和 caption revision/restore 都走 API。
6. Dataset：维护 result/revision overrides、training draft、loading；bulk caption、freeze dataset、start training 前检查 active run/kept/caption，再跳 training run detail。
7. Run detail：按 generation/training kind 分支；支持 cancel/retry/hide/create preset。create preset 的 current 语义是 training scene preset，不是把最终 LoRA 自动绑定回普通生图 preset。
8. Presets/templates：list sorting/selection/context id isolation/sort rules；template section 复用类似 project section block 的状态机。

当前实现与目标之间的命名和边界债：

1. `DesignDemoShell`、`design-demo-ui` 名称仍带 demo 语义，但已经被 Training 生产 UI 复用。
2. `LoraTraining*` 命名仍偏具体业务，不完全等于更中性的 Training 模块。
3. 部分页面保留 non-production local draft 兼容逻辑，文档不能把这些当最终产品设计。

### 15.4 历史 Training 计划迁移 diff

归档 Training 计划不是没有价值，而是它们混合了“已落地事实”“已改变设计”“未实现目标”。正式 docs 应从源码重写 current truth，再把归档计划作为设计考古材料。

可迁入 current docs 的事实：

1. Training 是一等模块，路径是 `/training/**` 和 `/api/training/**`，不是挂在 generation project 下的附属页。
2. work mode resource entrypoint 已落地：runs/projects/presets/templates 按 generation/lora_training 分流，models/settings 共享。
3. 旧计划里“mode icon 只提示，不切换；去 settings 切换”已过时。当前 bottom nav mode button 可点击，会切同资源槽。
4. Training route 绕过普通 AppShell，但复用 bottom nav。
5. Training image generation 当前政策不是走 Comfy queue，而是 provider policy，偏 `codex_gpt_image2` / GPT-Image-2 类 provider。
6. Training scene preset 独立于 generation preset，有自己的 category/folder/sort/usage/cascade。
7. Profile/reference image/text revision、generation task、input refs、outputs、dataset revision、training run、worker task 这些实体都已成为当前域模型。

需要写成“当前实现限制/风险”的事实：

1. Dataset freeze 当前不是完整 revision-scoped file copy，更多是记录 snapshot artifact id；caption missing 主要计数，不是严格阻断。
2. block 互斥 preset/local 主要在 service 校验，不是强 DB constraint。
3. caption generation 当前更像同步 deterministic/local fallback，不是完整异步模型 worker。
4. worker 协议存在，但真实 sd-scripts/WSL/local runner 的能力不应从旧计划复制到 current docs。
5. archive/delete 多为 DB status 或 project delete，未观察到旧计划描述的完整 artifact cleanup。
6. `create preset from completed run` 的 current 语义已变成创建 training scene description preset。

应继续留在 archive 的内容：

1. `CharacterLoraTraining*` 旧命名、benchmark、promotion、compatibility router、cold-character-training fallback。
2. 旧的 mode icon 非切换设计。
3. 未落地的完整 runner adapter contract、安全 artifact cleanup、revision-scoped file copy、Comfy queue waitReason 协调。
4. HTML prototype 的 CSS/JS/fake data。prototype 只保留 IA、密度、跳转关系、caption/readiness/lightbox 等产品意图。

### 15.5 运行时与视觉 QA 可行性

本机已有 dev service 在 `localhost:3000`，进程链是 screen 启动的 `npm run dev -- --webpack -p 3000` / `next dev --webpack -p 3000`。未发现 `3001` production `next start`，也未发现 `5173`、`4317`、`8188` 监听。Postgres 在 `127.0.0.1:5432` / `[::1]:5432` 监听。

只读 API 探测结果：

| Endpoint | 结果 |
|---|---|
| `/api/health` | 200，service status ok。 |
| `/api/worker/status` | 200，DB queue 可读；generation queued/running 为 0；ComfyUI reachable 为 false。 |
| `/api/comfy/status` | 200，manager state stopped，pid null，lastHealthOk false，managed mode enabled，auto-start disabled。 |
| `/api/training/worker/status` | 200，training totalActive 263、totalQueued 262、totalRunning 1。 |

这说明本机可以验证 DB/API/UI auth 保护页面，但不能验证真实 ComfyUI 生图链路，因为 8188 未监听且 Comfy manager stopped。Training worker status 能反映 DB 队列状态，但未看到真实 worker 进程，所以不能把 `running=1` 解释成 worker 正在消费任务。

浏览器截图 QA 技术上可行，但会产生截图/trace 等文件；本轮按只读约束没有执行。后续正式文档清理如果要声称“页面现状”，应补 desktop/mobile 截图和关键路径交互验证。

### 15.6 本轮后仍不能声称完成的边界

1. 还没有生成可持续维护的全量 route contract 文档，只完成了人工专项阅读。
2. 还没有跑浏览器截图 QA，所以 DESIGN/UI 文档的“视觉现状”只能根据源码和组件结构判断。
3. 还没有真实启动 ComfyUI 或 Training worker 验证端到端任务执行。
4. 还没有把这些结论落入正式 docs，只写在 `.tmp` 临时底稿中。
5. 本文仍是“理解底稿”，不能直接替代 README、`docs/agent-api.md`、`docs/local-verification.md`、`DESIGN.md` 等正式文档。

## 16. 结论

当前仓库最大问题不是“没有文档”，而是：

1. 代码已经演进成一个复杂的双域工作台。
2. README 和部分 docs 仍在用旧模型描述它。
3. 文档层级已经部分归档，但 current/prototype/archive/generated 的边界还不够清。
4. 若继续在旧文档上局部修补，会不断制造新的漂移。

更合理的路径是：以当前源码和本底稿为事实基础，先重写 README、local verification、agent API、UI/design、Prisma compatibility 和 docs map，再物理归档旧计划/原型/实现笔记。
