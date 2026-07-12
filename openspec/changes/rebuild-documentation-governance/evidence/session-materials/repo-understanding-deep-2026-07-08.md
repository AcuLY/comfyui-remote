# ComfyUI 远程深度项目理解底稿

生成日期：2026-07-08

原位置：`.tmp/repo-understanding-deep-2026-07-08.md`；现归档为 OpenSpec 非规范性证据

性质：临时工作底稿，原先位于被 `.gitignore` 忽略的 `.tmp/`。现为跨设备续作而归档，但本文仍不是正式文档，不应被长期引用。它用于在正式清理 `README.md`、`docs/**`、`DESIGN.md` 前，先把当前仓库作为一个全新的项目重新理解清楚。

## 0. 本轮阅读方式

这轮不再只做粗目录扫描，而是采用主代理加 6 个只读子代理并行阅读：

- 前端页面与 UI 组件架构。
- 后端 API、服务、仓库、server 操作。
- Prisma 数据模型、实体关系、双 provider。
- Training v2 子系统。
- ComfyUI、队列、worker、图片和运行时配置。
- 文档治理、测试治理、历史资料和当前事实混杂问题。

主代理同时做了仓库目录、页面路由、API 路由、模块导入边、关键源码片段和子代理风险点核验。

本轮没有修改正式文件，没有运行破坏性命令，没有提交。本文只写入 `.tmp/`。

## 1. 项目当前真实定位

这个仓库当前是一个围绕 ComfyUI 和 LoRA 训练工作流的私有生产控制台。它不是单纯的图片管理器，也不是只面向人工 UI 的 Next.js 项目。

设计目标上，项目应由两个平级工作模式和一个共享运行底座构成。Training 不是生图模块下的附属页面，而是和当前主要生图模块平级的一等模块；用户通过导航栏上的模式切换在“生图模式”和“LoRA 训练”之间切换。

1. 生图域：项目、小节、模板、预设资源库、prompt 区块、LoRA 绑定、运行参数、队列、审图、结果图库、导出。
2. Training v2 域：训练项目、角色资料、场景描述、训练场景预设、训练模板、生成任务、训练图片池、数据集修订、训练运行、训练产物。
3. 共享底座：Next.js App Router、Prisma 双 provider、ComfyUI target/SSH/tunnel、图片文件服务、模型资产管理、底部导航、认证、审计、MCP/Agent API、部署队列治理。

因此，正式 README 应该解释“这是一个移动优先的 ComfyUI 生图和 LoRA 训练工作台”，而不是继续停留在“7 个智能体 API 端点”或“普通 ComfyUI 管理后台”的旧语义。

## 2. 仓库结构与模块边界

当前顶层目录的实际职责：

- `AGENTS.md`：智能体入口规则，要求每次读 `agent-rules/git.md` 和 `agent-rules/deploy/index.md`。
- `agent-rules/**`：git、部署、开发服务、Next.js、UI 认证、子代理、mypc PowerShell 等工作规则。
- `src/app/**`：Next App Router 页面、API 路由处理器、server 操作周边 UI 页面。
- `src/components/**`：生产和部分 training 复用组件，包括 app 外壳、底部导航、小节编辑器、审查、preset/template 组件、`shadcn` 风格基础组件、design-demo 基础组件。
- `src/features/training/**`：Training v2 前端子应用，包含路由登记表、外壳、数据 DTO、页面组件、Hook。
- `src/lib/**`：环境、Prisma client、共享类型、server 操作、RSC 数据外观层、图片 URL、工作模式、审查状态、preset/section UI 工具。
- `src/server/**`：HTTP 辅助工具、MCP server、prompt 配置解析器、仓库、服务、worker、training worker。
- `prisma/**`：PostgreSQL schema、SQLite schema、迁移、种子。
- `scripts/**`：数据库、文档、质量、training worker 启动/运行脚本。
- `tests/**`：业务、治理、API、schema、UI 边界、training、worker、文档 contract 测试。
- `docs/**`：当前文档、运行手册、API、UI、架构、generated 清单、归档、原型和历史资料。
- `config/**`：ComfyUI 目标示例、path 映射。
- `data/**`、`logs/**`、`.next/**`、`.tmp/**`：运行时或临时数据，git 已忽略。

模块导入方向的实际情况：

- `src/app` 是最大编排层，大量导入 `src/components`、`src/lib`、`src/server`。
- `src/features/training` 主要导入自身和 `src/components`，少量导入 `src/lib`。
- `src/lib/server-data.ts` 是 RSC/server 数据外观层，会从 `src/server/repositories` re-export。文件自己标注为架构妥协，因为理想上 `lib/` 不应反向依赖 `server/`。
- `src/server` 主要依赖 `src/lib` 和自身，也会少量引用 `src/features/training` 类型或 DTO。
- `tests` 横跨 `src/app`、`src/lib`、`src/server`、`scripts` 和文档，是当前治理事实的重要来源。

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
- UI 图标：`lucide-react`。
- 拖放：`@dnd-kit/**`。
- MCP：`@modelcontextprotocol/sdk`。
- Prisma 适配器：`@prisma/adapter-pg` 和 `@prisma/adapter-better-sqlite3`。

主要命令：

- `npm run dev`：Next 开发。
- `npm run build`：`next build --webpack`。
- `npm run start`：Next 生产启动。
- `npm run test`：Node 测试运行器加 tsx。
- `npm run lint`。
- `npm run prisma:generate`。
- `npm run db:bootstrap`、`npm run db:bootstrap:sqlite`。
- `npm run training:workers`、`npm run training:workers:mock`。

数据库：

- 默认 provider 是 PostgreSQL。
- `DB_PROVIDER=sqlite` 时使用 SQLite schema 和 better-sqlite3 适配器。
- `docker-compose.yml` 提供 PostgreSQL 16，数据库名 `comfyui_manager`。

认证：

- `src/proxy.ts` 是 Next 16 代理入口，不是 `middleware.ts`。
- 页面认证走 `auth_token` cookie。
- `/api/**` 也接受 Bearer、`x-api-token`、`x-auth-token`。
- `/api/auth/**`、`/_next/**`、`/login`、`/favicon.ico` 是公共路径。

配置：

- `src/lib/env.ts` 读取 `DB_PROVIDER`、`DATABASE_URL`、`COMFY_API_URL`、`COMFY_HISTORY_*`、`MODEL_BASE_DIR`、`OUTPUT_BASE_PATH`、ComfyUI launch/target、认证、自动审查、training worker 等。
- 源码默认 `COMFY_HISTORY_MAX_ATTEMPTS=300`，`.env.example` 当前写的是 `15`，这是已核验的配置漂移。
- README 对 `OUTPUT_BASE_PATH` 的说明把外部 ComfyUI 输出和受管 `data/images` 混在一起。代码里 worker 生成图片会下载并写入受管 `data/images/**`，图片服务根目录由 `OUTPUT_BASE_PATH` 或默认 `data/images` 决定。若生产把 `OUTPUT_BASE_PATH` 指向外部 ComfyUI 输出，需要专项核验新生成受管图片是否可访问。

## 4. 页面地图和真实 UI 功能

当前源码有 28 个 `page.tsx` 页面入口。页面不是一组简单增删改查，而是多个工作台。

### 4.1 全局外壳和导航

`src/app/layout.tsx` 判断路径：

- `/login` 不包生产 `AppShell`。
- `/design-demos/**` 不包生产 `AppShell`。
- `/training/**` 不包生产 `AppShell`，Training 使用自己的外壳。
- 其他页面包 `AppShell`。

生产 generation 外壳：

- `src/components/app-shell.tsx` 提供 `SfwModeProvider`、`PersistentBottomNav`、通知复制按钮、提示。
- 主内容 `max-w-5xl`，底部留出导航空间。
- `PersistentBottomNav` 在所有宽度固定底部显示，不是只移动端显示。
- 底部导航有 6 个资源键：运行、项目、预制、模板、模型、设置，再加一个模式切换按钮。
- 模式切换在 `generation` 和 `lora_training` 之间切换。
- 设计目标上，这个切换不是“进入训练子页面”的临时入口，而是两个平级模块之间的模式切换：同一组资源键在不同模式下指向生图或训练的对应工作台；模型和设置是共享资源。
- 导航会用 `localStorage` 保存工作模式，用 `sessionStorage` 保存每个资源最后访问路径和滚动位置。

这和 `DESIGN.md` 中“桌面左侧全局导航、移动底部导航”的描述不一致。当前生产事实是：全局导航是固定底部导航；左侧导航只在项目详情、项目结果、模板/上下文页面中出现。

### 4.2 根路由和登录

- `/`：重定向到 `/queue`。
- `/login`：独立登录页，表单调用 `POST /api/auth/verify`，成功写 cookie 后跳回 `from`。

### 4.3 队列和审图

`/queue`：

- 数据来自 `getQueueRunsPage`、`getRunningRuns`、`getFailedRuns`、`getTrashItems`、`getCensoringQueueData`。
- 客户端轮询 `/api/queue-data`。
- UI 包括待处理审查、运行中、内容审查、失败、回收站等区域。
- 注意 `/api/queue` 更接近“待审图完成运行”，不是活动队列事实源。
- 活动队列应看 `/api/worker/status`、`/api/queue-data` 或部署用的 `pause-active/resume-paused`。

`/queue/:runId`：

- 数据来自 `getReviewGroup` 和 `getReviewGroupIds`。
- 核心 `ReviewGrid`。
- 支持批量 keep/trash、灯箱、快捷键、撤销回收站、跳到上一/下一运行、工作流下载、复跑。
- 灯箱会先显示当前图，当前图已加载后低优先级预加载后续图。

### 4.4 生图项目列表、项目详情、小节编辑

`/projects`：

- 数据来自 `listProjects`、`listProjectFolders`。
- `ProjectsClient` 支持项目文件夹、面包屑、项目卡片、归档显示、批量移动、列表状态。

`/projects/new`、`/projects/new/from-existing`、`/projects/:projectId/edit`、`/projects/:projectId/batch-create`：

- 创建、复制、编辑、批量创建项目。
- 页面和 server 操作路径可能不同于 `/api/projects` 创建路径。后端子代理确认：API `project-service.createProject` 创建基础项目，页面 server 操作 `lib/actions/project.createProject` 还会写项目级预设绑定。正式文档要说明“UI 创建”和“API 创建”的能力边界。

`/projects/:projectId`：

- 数据来自 `getProjectDetail` 和 `getPresetLibraryV2`。
- `ProjectDetailClient` 是小节管理工作台。
- 功能包括：小节目录、小节侧栏、滚动监视、compact/expanded 卡片切换、滚动锚点恢复、添加小节、导入模板、预设变体同步、预设替代项、进入项目结果、清空小节、打码、批量运行。
- 小节卡片支持最新结果缩略图、运行状态、选择/排序、进入编辑或结果。

`/projects/:projectId/sections/:sectionId`：

- 数据来自 `getProjectSectionEditPageData`。
- 页面顶部吸附 header 提供返回、上一/下一小节、运行、结果。
- 页面显示最近运行结果缩略图和工作流下载。
- `SectionParamsForm` 管批次尺寸、宽高比、简短侧边、种子 policy、KSampler1/2、放大、checkpoint 等。
- `SectionEditor` 管 prompt 区块、preset/group 导入、变体切换、LoRA 双分区、手工 LoRA、改名。
- 已解决配置会把 preset/group 绑定合成成可编辑视图；resolver-only 区块会以临时 id 注入 UI。

### 4.5 结果图库

`/projects/:projectId/sections/:sectionId/results`：

- 单小节结果页。
- 支持按运行分组、连续审图、临时批次尺寸、trash/restore、标记、灯箱、快捷键。

`/projects/:projectId/results`：

- 项目级聚合图库。
- 有小节侧栏、过滤器状态、画廊、灯箱。
- 支持 `Pixiv`、预览、封面、审查、回收站等图片操作。

### 4.6 预设库

`/assets/presets`：

- 数据来自预设视图仓库。
- 管理分类、目录、预设、变体、分组。
- UI 包括 `PresetManager`、category/folder/group/preset 组件、拖放排序、批量移动。

`/assets/presets/:presetId`：

- 单预设编辑。
- `PresetEditClient` 和 `PresetForm` 管 prompt、负向 prompt、LoRA、变体列表、批量编辑和全部应用。

`/assets/preset-groups/:groupId`：

- 预设组编辑。
- 支持成员、嵌套分组、槽位模板、排序、展开/扁平化、引用预览。

`/assets/presets/sort-rules`：

- 管各分类在正向、负向、lora1、lora2 维度的顺序。

### 4.7 项目模板

`/assets/templates`、`/assets/templates/new`、`/assets/templates/:templateId/edit`、`/assets/templates/:templateId/sections/:sectionIndex`：

- 模板列表、创建、编辑、模板小节编辑。
- 数据来自 `template-view-repository` 和 `getPresetLibraryV2`。
- 模板有自己的小节、小节目录、预设绑定、prompt 区块、手工 LoRA 条目。
- 模板小节编辑器与生产小节编辑器逻辑类似，但数据形态不同，所以有平行实现而非完全共享。

### 4.8 模型资产

`/assets/models`：

- 统一管理检查点和 LoRA。
- 调用 `/api/models/browse`、`/api/models`、`/api/models/notes`、哈希、移动等。
- 底层可走本地文件系统或 SSH 远程目标。

`/assets/loras`：

- 当前是兼容跳转到 `/assets/models`。
- 旧的 `LoraFileManager` / `LoraUploadForm` 仍在代码中，可能是遗留组件。

### 4.9 设置

`/settings`：

- 小型工具页，不是完整配置中心。
- 包含 `SFW` 切换、monitor/logs 入口。
- 工作模式切换不在这里，已经由底部导航承担。

`/settings/monitor`：

- 调用 `/api/comfy/status`、`/api/comfy/start`、`/api/comfy/stop`、`/api/comfy/health-probe`。
- 监控 ComfyUI 进程管理器状态。

`/settings/logs`：

- 调用 `/api/logs?lines=300`。
- 支持 source/module/level 过滤器。

### 4.10 设计演示

`/design-demos/**`：

- 当前是路由化设计演示和组件实验室，在 `src/app/design-demos/**`。
- 旧根目录 `design-demos/*.html` 不存在于 tracked 当前根目录，旧静态演示已归档到 `docs/archive/design-demos/**`。
- 设计演示可以作为视觉参考，但不是生产行为事实源。

## 5. 后端 API 和服务架构

当前 API 路由处理器数量很大。它不只是智能体 API。

主要分组：

- `/api/projects/**` 和 `/api/project-*`：项目、项目文件夹、小节、运行、导出、复制、归档、模板化、预设替代项、结果清理。
- `/api/preset-library/**`：分类、目录、预设、变体、分组、成员、slot-template、sort-orders、重排、级联、用法、同步。
- `/api/templates/**`：模板增删改查、导入、模板小节、预设替代项。
- `/api/runs/**`、`/api/image-review`、`/api/images/**`：运行详情、工作流下载、keep/trash、封面、精选、手工审查、恢复、文件读取。
- `/api/queue/**`、`/api/queue-data`、`/api/worker/status`：队列读取、清理、暂停、恢复、worker 状态。
- `/api/comfy/**`：ComfyUI status/start/stop/restart/health-probe。
- `/api/models/**`、`/api/loras/**`、`/api/path-maps`：模型和 LoRA 文件浏览、上传、移动、哈希、说明。
- `/api/auth/verify`、`/api/logs`、`/api/audit-logs`、`/api/health`。
- `/api/agent/**`：高层智能体 REST API。
- `/api/mcp`：MCP Streamable HTTP 传输。
- `/api/training/**`：Training v2 专属 API，见 Training 章节。

分层真实现状：

- 路由处理器多数只做参数、JSON 正文、调用 service/repository、统一响应。
- `src/server/services/**` 做业务校验、字段白名单、审计、流程编排、文件操作编排、错误映射。
- `src/server/repositories/**` 做 Prisma 查询、事务、数据序列化。
- `src/lib/actions/**` 是 server 操作，很多 UI 写操作走这里。
- `src/lib/server-data.ts` 是 RSC/server 页面数据外观层，会 re-export repository/service 函数。

需要注意的架构妥协：

- `src/lib/server-data.ts` 自称技术债务，因为 `lib/` 反向依赖 `server/`。
- `prompt-block-service.ts` 和 `src/lib/actions/prompt-block.ts` 有重叠逻辑。
- `prompt-block-repository.ts` 名字像仓库，但实际更像服务封装器。
- API 项目详情路由捕获 `PROJECT_NOT_FOUND`，但仓库 `getProjectDetail` 抛 `JOB_NOT_FOUND`。这已核验，可能导致 `/api/projects/:id` 不存在时返回 500 而不是 404。

## 6. 生图主流程

### 6.1 创建和组织项目

UI 创建项目：

- 页面 server 操作可初始化项目级预设绑定。
- 项目可以归入 `ProjectFolder`。
- 项目包含多个 `ProjectSection`，小节可归入 `ProjectSectionFolder`。

API 创建项目：

- `/api/projects` 走 `project-service.createProject`，更像基础项目创建。
- 与 UI 创建入口能力并不完全一致。

### 6.2 小节和预设绑定

新增小节：

- 读取项目级预设绑定。
- 按分类顺序初始化 `SectionPresetBinding` 和 `SectionPromptBlock`。

导入预设：

- 写 `SectionPresetBinding`。
- 写预设 prompt 行。
- 解析变体 content，返回 prompt/LoRA。

编辑 preset-sourced prompt 区块：

- 可能触发分离，把 preset-sourced LoRA 转成手工 LoRA，保留分离源码字段。

Prompt / LoRA 模型是“零冗余倾向”：

- 小节区块不直接复制全部预设数据，而是保存自定义文本或绑定引用。
- LoRA 有 preset/group/manual 来源。
- 运行创建时解析成已解决快照。

### 6.3 运行入队

运行入口：

- `runProject`、`runSections`、`runSection`。
- 仓库在事务里创建 `Run(status="queued", comfyPromptId=null, resolvedConfigSnapshot=...)`。
- 如果小节有多个宽高比，会生成多个排队中运行。
- `scheduleQueuedRunsToComfyUI()` 异步提交。

已解决配置来源：

- 小节参数。
- 项目级覆盖。
- prompt 区块。
- preset/group LoRA。
- 手动 LoRA。
- `KSampler`。
- checkpoint。
- extraParams。

运行使用点击运行那一刻的 `resolvedConfigSnapshot`，后续编辑小节不影响历史运行。

### 6.4 ComfyUI 提交和轮询

提交：

- `run-executor.ts` 读取 `WorkerRunSnapshot`。
- `payload-builder.ts` 生成 `ComfyPromptDraft`。
- `comfyui-service.ts` 校验并提交到 ComfyUI `/prompt`。
- 成功后写回 `Run.comfyPromptId`、`submittedPrompt`、`executionMeta`。

轮询：

- 先用 ComfyUI `/queue` 判断 prompt 是 pending/running/not_found。
- 只有进入 ComfyUI 运行中后，本地 `Run` 才从排队中转运行中。
- 再轮询 `/history/:promptId`。
- 大量排队时会扩展窗口，避免把还在 ComfyUI 队列里的任务误判为超时。

恢复：

- `/api/queue-data` 发现运行中运行时触发 `recoverStaleRuns()`。
- `src/instrumentation.node.ts` 启动时也触发恢复。
- 已有 `comfyPromptId` 的 queued/running 会继续轮询。
- 没有 `comfyPromptId` 的排队中在 ComfyUI 可达时重新提交。

### 6.5 工作流填充

默认使用 `docs/workflow.api.json`。

`workflow-prompt-builder.ts` 填充关键节点：

- `1`：checkpoint。
- `511`：正向 prompt。
- `513`：负向 prompt。
- `407`：潜空间宽度、高度、batch_size。
- `522`：一阶段 LoRA。
- `36`：二阶段 LoRA。
- `3`：KSampler1。
- `425`：LatentUpscale。
- `427`：KSampler2。
- `410`：`VAE` 解码。
- `515`：图像保存输出 path 和文件名前缀。

单阶段模式会删除 `425`、`427`、`36`，并把 `410` 重连到 `3`。

优先级：

1. `extraParams.comfyPrompt/workflowApiPrompt/apiPrompt` 显式覆盖。
2. 标准 `docs/workflow.api.json`。
3. 兜底 SDXL txt2img。

### 6.6 图片落盘和审图

ComfyUI 生成结果不会直接引用 ComfyUI 输出。

`persistComfyOutputImages()`：

- 从 ComfyUI `/view` 下载。
- 转成 `JPEG`。
- 写到 `data/images/{projectSlug}/{sectionSlug}/run-XX-{runId}/raw/NN.jpg`。
- 生成 `thumb/NN.jpg`，最大边 400，质量 80。
- 写 `ImageResult.filePath/thumbPath`。

路径安全：

- ComfyUI 文件名禁止 `/`、`\`、`..`。
- 子目录规范化并拒绝 `.` / `..`。
- `/api/images/[...path]` 只允许图片扩展名，拒绝危险路径段、冒号、`NUL`、`Unicode` 斜杠、尾随空白/点和 `.tmp`。
- 用 `path.resolve` 确认最终路径仍在服务根目录下。

审图：

- `ImageResult.reviewStatus` 驱动 pending/kept/trashed。
- `TrashRecord` 记录回收站补充信息。
- 封面操作会自动保留。
- 队列审查偏任务流，结果画廊偏图库流。

## 7. Training v2 子系统

Training 不是演示，也不是普通生图项目的一个页面。设计目标上，它是和当前主要生图模块平级的一等模块，通过全局底部导航的模式切换与生图模式切换；实现上，它已有独立路由、独立 API、独立实体和独立 worker 队列，但仍复用了部分 design-demo shell/primitives。

### 7.1 路由和外壳

入口：

- `src/app/training/[[...route]]/page.tsx`。
- 裸 `/training` 重定向到 `/training/runs`。
- 服务端调用 `loadTrainingRouteData(route)`。
- `TrainingApp` 用 `src/features/training/routes.ts` 匹配路由键，然后渲染对应页面。

外壳：

- Training 不走根目录 `AppShell`。
- `TrainingShell` 使用 `DesignDemoShell`，但 `navigationChrome="none"`。
- 仍复用全局 `PersistentBottomNav` 作为页脚导航。
- `header-specs.ts` 按路由生成标题、计数、状态、操作槽位。

这说明 `docs/ui/component-boundaries.md` 中“design-demo-ui 只属于演示基础组件”的说法过窄。生产 `/training/**` 明确复用 design-demo shell/primitives，需要文档调整。

### 7.2 Training 页面地图

`/training/runs`：

- 训练/生成任务总览。
- 支持筛选、取消、删除、重试。

`/training/runs/generation/:taskId`：

- 生成任务详情。
- 展示输入、输出、审查、应用结果。

`/training/runs/training/:trainingRunId`：

- 训练运行详情。
- 展示进度、数据集样例、配置、日志、最终工件。
- 支持取消和从完成训练创建预设。

`/training/projects`：

- 训练项目列表。
- 支持当前/归档、排序、批量操作。
- 数据加载刻意轻量，不读完整项目详情。

`/training/projects/new`：

- 创建训练项目。
- 选模板、checkpoint、参考图、初始小节。

`/training/projects/:id`：

- 项目概览。
- 展示 profile、训练入口、最近任务、最近结果。

`/training/projects/:id/profile`：

- 角色资料。
- 使用提示词、角色详情 JSON、参考图上传/管理、参考图加入结果池、文本修订恢复。

`/training/projects/:id/sections`：

- 训练小节列表。
- 新增、复制、拖拽排序、生成样图。

`/training/projects/:id/sections/:sectionId`：

- 小节详情。
- 场景描述区块、预设区块导入、生成结果审查。

`/training/projects/:id/sections/:sectionId/generation-tasks/new`：

- 生成任务 compose。
- 拼装 profile、小节场景、参考图、补充图、补充 prompt。
- 支持预览再入队。

`/training/projects/:id/results`：

- 训练图片池。
- pending/kept/rejected 审查、说明文字、批量操作。

`/training/projects/:id/dataset`：

- 训练集准备质量门。
- 保留数、说明文字缺失、冻结修订、启动训练。

`/training/projects/:id/dataset/revisions/:revisionId`：

- 数据集修订详情。
- 冻结样例、说明文字快照、清单行、相关 training 运行。

`/training/projects/:id/training-runs`、`/training/projects/:id/generation-tasks`：

- 项目内限定运行。

`/training/presets/**`：

- 训练场景描述预设，不是普通 `/assets/presets`。

`/training/templates/**`：

- 训练模板和模板小节场景区块。

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
- `TrainingCharacterImage`：参考图和工件关联。
- `TrainingSection`：训练场景小节。
- `TrainingSceneDescriptionBlock`：场景描述区块，可来自预设。
- `TrainingGenerationTask`：profile/scene/image/caption/training-set 等生成任务。
- `TrainingSectionRun`：小节级生成运行。
- `TrainingImageResult`：训练图片结果，可审查、说明文字、加入数据集。
- `TrainingDatasetRevision`：冻结训练集版本。
- `TrainingDatasetRevisionItem`：冻结时的图片、说明文字、prompt、文件快照。
- `TrainingRun`：训练任务。
- `TrainingArtifact`：训练域统一文件实体。

### 7.4 Training API、服务与 worker

API 层：

- `/api/training/projects/**`：项目、profile、小节、参考资料图像、结果、数据集修订、training 运行、generation 任务。
- `/api/training/sections/**`：小节、区块、运行、场景说明。
- `/api/training/generation-tasks/**`：草稿、运行、预览、输入、输出、补充图像、取消。
- `/api/training/image-results/**`：审查、说明文字、更新、删除。
- `/api/training/presets/**` 和 `/api/training/scene-description/**`：训练场景 preset/category/folder。
- `/api/training/templates/**`：训练模板。
- `/api/training/worker/**`：worker 租约、心跳、完整、失败、状态。
- `/api/training/scheduler/**`：调度器 tick/status。

服务与仓库：

- `route-data-service.ts` 组装路由数据。
- `snapshot-service.ts` 把 Prisma 行映射成 training UI DTO。
- `project-actions-service.ts` 做 project/profile/dataset/training 运行编排。
- `generation-task-draft-service.ts` 管生成任务草稿。
- `generation-output-service.ts` 管输出应用。
- `caption-service.ts` 当前是 deterministic/local 说明文字逻辑，不是真异步模型说明文字。
- `run-preset-service.ts` 从训练运行创建预设。
- `repositories/training/**` 做数据库持久化。

Worker：

- worker 类型：`image_generation`、`dataset_freeze`、`training`。
- `leasing.ts` 做任务领取。
- `heartbeat.ts` 做续约。
- `completion.ts`、`failure.ts` 做完成/失败。
- `scheduler.ts` 做调度。
- `task-id.ts`、`target-discovery.ts`、`task-serialization.ts`、`task-json.ts` 做边界拆分。
- `scripts/training/worker-queue.ts` 和 runtime 脚本启动真实或模拟 worker。

Training 与普通生图的平级关系和边界：

- 平级关系：生图和 Training 都有自己的运行、项目、预设、模板工作台；底部导航模式切换在两套资源入口之间切换。
- 共享资源：模型和设置是共享资源，不属于任一单独模式。
- 实现状态：当前 Training 已有独立生产 route/API/service/entity/worker，但 UI 外壳仍借用 design-demo shell/primitives；这属于实现复用，不应被解释为 Training 是演示或附属模块。

- Training 图片生成提供方策略写在 `src/lib/training/provider-policy.ts`，当前训练图片生成不是普通 ComfyUI workflow/queue。
- Training 预设是 `TrainingSceneDescriptionPreset*`，普通生图预设是 `Preset*`。
- Training worker 队列独立于 `/api/queue`。
- 共享模型资产、图片文件服务、底部导航、部分 design-demo 基础组件。

已核验的 Training 风险：

- `TrainingDatasetRevision.status` schema 默认是 `ready`，仓库冻结和 worker 完成也写 `ready`。
- `snapshot-service.ts` 只把 `frozen` 映射为前端 `ready`，把 `freezing` 映射为 `training`，其他都变 `draft`。
- 因此当前冻结后的 `ready` 修订可能在 UI DTO 中显示成 `draft`。这应列入正式清理后续 bug/risk。
- `caption-service.ts` 当前自动生成说明文字的回退是 `${triggerToken}, candidate image, autogenerated caption`，不是外部说明文字模型。
- `dataset_freeze` worker 与 API 同步冻结职责有重叠，当前更像占位/状态完成器。

## 8. 数据模型和实体关系

Prisma 当前有 PostgreSQL 和 SQLite 两份 schema。

PostgreSQL schema：

- 54 个模型。
- 5 个枚举：`JobStatus`、`RunStatus`、`ReviewStatus`、`ActorType`、`PromptBlockType`。

SQLite schema：

- 54 个模型。
- 枚举用字符串兼容。

### 8.1 生图项目实体

核心链：

`Project`
→ `ProjectSection`
→ `Run`
→ `ImageResult`
→ `TrashRecord` / `CensoringTask`

补充：

- `ProjectFolder`：项目文件夹树。
- `ProjectSectionFolder`：小节文件夹树。
- `SectionChangeLog`：小节参数、prompt、绑定修改历史。
- `Run.resolvedConfigSnapshot`：运行时配置快照。
- `Run.submittedPrompt`：提交给 ComfyUI 的 prompt。
- `Run.executionMeta`：执行元信息。
- `ProjectSection.latestRunId`：最新运行快捷引用。

### 8.2 预设资源库实体

核心：

`PresetCategory`
→ `PresetFolder`
→ `Preset`
→ `PresetVariant`

关系：

- `PresetVariantLink` 表达变体间链接，替代旧 JSON 冗余字段。
- `PresetGroup` 和 `PresetGroupMember` 管预设组和嵌套。
- `PresetCategorySlot` 管槽位模板。
- `PresetChangeLog`、`PresetGroupChangeLog` 记录修改。

注意：

- `PresetGroupMember` schema 没强制 preset/variant/subgroup 互斥，这需要服务层保证。

### 8.3 绑定和 prompt 区块

Project/template/section 三层都有绑定语义：

- `ProjectPresetBinding`
- `ProjectTemplatePresetBinding`
- `SectionPresetBinding`
- `TemplateSectionPresetBinding`

Prompt 区块：

- `SectionPromptBlock`
- `TemplateSectionPromptBlock`

手动 LoRA：

- `SectionManualLoraEntry`
- `TemplateSectionManualLoraEntry`

重要字段：

- `bindingKey` 是父作用域内稳定键。
- `sortOrder` 控制显示/拼接顺序。
- 分离源码字段保留从预设脱离的来源。

### 8.4 模板实体

`ProjectTemplate`
→ `ProjectTemplateSection`
→ 模板小节绑定 / prompt 区块 / 手动 LoRA

还有：

- `ProjectTemplateSectionFolder`
- 模板级预设绑定

模板可从项目保存，也可导入到项目。导入支持预演和重复策略。

### 8.5 Training 实体

见 Training 章节。Training 完整独立，使用 `Training*` 模型，不应与普通 `Project*` 混用。

### 8.6 Asset/Ops 实体

- `LoraAsset`：LoRA 元数据，说明、trigger 词语、`Civitai` link 等。
- `AuditLog`：操作审计，执行者区分 user/system/agent。
- `GpuTaskLock`：图形处理器任务锁。

### 8.7 PostgreSQL / SQLite 差异

已确认差异：

- PostgreSQL 使用 Prisma 枚举，SQLite 用字符串。
- PostgreSQL 使用 `@db.Text` 等数据库特定标注，SQLite 无。
- 生成 client 分别是 `src/generated/prisma` 和 `src/generated/prisma-sqlite`。
- `src/lib/prisma.ts` 根据 provider 动态加载 runtime client，并把 SQLite client 转换成统一 PrismaClient 类型。

已核验的 schema 漂移风险：

- `PresetFolder` 和 `ProjectFolder` 在 PostgreSQL schema 有 `createdAt/updatedAt`。
- SQLite schema 中这两个模型没有 `createdAt/updatedAt`。
- 当前 `docs/prisma-schema-compatibility.md` 若宣称所有共享模型完全兼容，就需要修正或让生成脚本覆盖这个差异。

Migration/seed 风险：

- PostgreSQL migration 树只有 20260616 之后几条。
- SQLite migration 树保留更早遗留 migration。
- 训练测试使用 `prisma migrate diff --from-empty --to-schema prisma/schema.sqlite.prisma --script` 更信当前 schema，而不是逐条 migration 树。
- `prisma/seed.ts` 与 `src/scripts/seed.mts` 是两套种子入口，需要正式文档说明哪个是推荐入口。

## 9. ComfyUI、队列、Worker 和运行时治理

### 9.1 ComfyUI 目标

`getActiveComfyTarget()` 支持：

- 无配置时 local 回退。
- `COMFY_TARGET_CONFIG_PATH + COMFY_ACTIVE_TARGET` 指定目标。
- 本地目标：apiUrl、modelBaseDir、启动命令、启动工作目录。
- ssh 目标：localApiUrl、远端 host/port/root/model 根目录、start/stop/restart/log/hash 命令、隧道自动启动。

SSH 模式：

- HTTP 走本地隧道 URL。
- `ensureActiveComfySshTunnel()` 按需启动 `ssh -L`。

### 9.2 ComfyUI 进程管理器

`ComfyProcessManager`：

- local 模式可启动 `COMFY_LAUNCH_CMD`。
- 健康 check 打 `/system_stats`。
- 支持 auto-start、auto-restart、GPU-aware 重启、kill-by-port。
- ssh 模式执行目标配置的 start/stop/restart 命令，不本地启动。

`/api/comfy/status`：

- 返回 ComfyUI 进程管理器状态，包含状态、pid、健康、重启数量、目标 id/mode、日志、apiUrl。

`/api/worker/status`：

- 是活动队列 + ComfyUI 可达性状态。
- 同时读 generation worker queued/running 计数和 ComfyUI `/system_stats`。
- 与 `/api/comfy/status` 语义不同。

### 9.3 暂停与恢复

部署前 runtime-affecting 动作必须检查活动队列。

`POST /api/queue/pause-active`：

- 对没有 `comfyPromptId` 的本地排队中可直接标记已暂停。
- 对有远端 prompt 的运行，先调用 ComfyUI 队列 delete 或中断，并确认远端队列消失。
- 在 `executionMeta.__queuePause` 写 `source/batchId/pausedAt`。

`POST /api/queue/resume-paused`：

- 默认只恢复 `source=api-pause-active` 且本批次标记的运行。
- 用保存的 `submittedPrompt` 重新提交 ComfyUI，拿新 prompt id。
- 不应误恢复用户手动暂停的任务。

### 9.4 Node 插桩

`src/instrumentation.node.ts`：

- 启动时清理超过 30 分钟还运行中的孤立运行。
- 启动时恢复过时运行。
- 默认不会自动恢复已暂停运行。
- 只有 `AUTO_RESUME_PAUSED_RUNS_ON_STARTUP=true` 时才自动恢复。

风险点：

- 自动恢复和平滑关闭部分使用 `env.comfyApiUrl`，可能未走活动 target/tunnel。ssh 目标场景需专项核验。
- 自动恢复分支和 server 操作 `resumeRun()` 对已恢复运行的状态语义不完全一致。

## 10. 智能体 API 和 MCP

智能体 REST API 当前不是 7 个端点，而至少有 10 个高层方法入口：

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
- 传输：Streamable HTTP。
- 实现：`src/server/mcp/server.ts`。

当前 MCP 工具：

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

当前 MCP 资源：

- `comfyui://projects/{projectId}/context`
- `comfyui://runs/{runId}/context`
- `comfyui://sections/{sectionId}/blocks`

README 中可以概述这些能力，但不应长期手写大而全的端点数量表。具体契约应交给 `docs/agent-api.md`、源码、测试或生成文档。

## 11. 测试和治理系统

测试不只是功能回归，也约束仓库治理。

重要测试类别：

- 文档治理：`test-documentation-governance.test.ts`。
- 仓库清单：`test-repo-inventory.test.ts`。
- 脚本文档：`test-script-maintenance-doc.test.ts`。
- API request JSON 和响应辅助工具：`test-api-request-json.test.ts`。
- 全局 API 路由：`test-global-api-routes.test.ts`。
- Prisma provider/docs：`test-prisma-provider-matrix-doc.test.ts`、`test-prisma-schema-compatibility-doc.test.ts`。
- runtime 配置：`test-config-runtime-governance.test.ts`。
- worker 边界：`test-worker-boundary-governance.test.ts`。
- UI 边界：`test-ui-component-boundaries.test.ts`。
- 设计演示治理：`test-design-demo-governance.test.ts`。
- training prototype/governance：`test-training-prototype-governance.test.ts`、`test-training-feature-entry-boundaries.test.ts`。
- fixture 治理：`test-fixture-governance.test.ts`。
- 质量脚本治理：`test-quality-script-governance.test.ts`。

脚本：

- `scripts/docs/generate-repo-inventory.ts` 生成 `docs/repo-inventory.md`。
- `scripts/docs/generate-prisma-schema-compatibility.ts` 生成 `docs/prisma-schema-compatibility.md`。
- 当前没有 package-level `docs:inventory`、`docs:prisma-compat` 快捷脚本。正式文档维护时可以考虑补。

测试带来的约束：

- README 目前有页面/API/MCP 数量测试约束，说明它不是完全无人维护，但这也让 README 负担过重。
- 清单覆盖强，但 owner/action 是启发式，分类是否最佳仍需人工。
- 归档文档要有当前源码横幅。
- 设计演示和原型的生产边界被测试约束，但文档仍有语义混乱。

## 12. 文档系统真实状态

### 12.1 应保留为当前事实的层

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

### 12.2 Generated / 清单层

- `docs/repo-inventory.md`
- `docs/prisma-schema-compatibility.md`
- `docs/plans/auto-review-analysis/**` 更像 generated/quality 工件，不是活动计划。

### 12.3 原型 / 历史层

- `docs/prototypes/**`：Training 原型意图，不能作为生产行为事实。
- `docs/archive/**`：旧 plans、旧 PRD、旧交接、旧静态 design 演示、旧 design-system。
- `docs/superpowers/specs/**`：偏持久 spec/reference，但当前夹在 `superpowers` 目录中，边界不够清。
- `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`：被清单标为当前，但链接到不存在的 `docs/superpowers/plans/**`，且当前层级不清。

### 12.4 已确认的文档漂移

README：

- 已比旧版本更接近事实，但仍承担过多精确数字、环境变量表、API 数量表。
- `OUTPUT_BASE_PATH` 说明需结合受管 `data/images` 重新写。
- training worker、提供方策略、数据集冻结、说明文字占位等实现细节没有进入当前文档。

DESIGN.md：

- 写了桌面左侧全局导航，但当前生产 generation 外壳全宽度固定底部导航。
- 主色方向写绿色/玫瑰色，但当前生产 generation 大量使用 sky/blue 活动。
- 更像目标设计方向，不是完整当前实现。

`docs/ui/component-boundaries.md`：

- 把 `design-demo-ui` 定位为演示基础组件，但生产 training 复用它。

`docs/local-verification.md`：

- 仍有旧操作文案，例如旧项目/任务/运行全部/回收站标签页等表达。
- 测试只约束 auth/service/Comfy/protected 页面，不保证 UI 操作步骤贴合当前页面。

`docs/design-demos-frontend-parity.md`：

- 时间较早，大量非 Training “静态对齐/完成”说法需要重新核验。

`docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`：

- 当前/历史边界不清，且链接到不存在的 `./plans/2026-05-21-queue-pause-resume.md`。

`docs/prototypes/**`：

- README 说是原型意图源码，但清单对 HTML/CSS/JS 原型操作多为归档。需要明确“保留意图”与“未来归档动作”的语义。

## 13. 当前高价值风险清单

这些不是泛泛的“可能过时”，而是本轮已从源码/文档中定位到的具体问题。

### 13.1 可能是代码缺陷或行为风险

1. `/api/projects/:projectId` GET 捕获 `PROJECT_NOT_FOUND`，但仓库抛 `JOB_NOT_FOUND`，不存在项目可能返回 500。
2. Training 数据集修订：DB/repository/worker 写 `ready`，快照只把 `frozen` 映射为 UI 就绪，`ready` 会显示成草稿。
3. `src/instrumentation.node.ts` 自动恢复路径可能没有走活动 ComfyUI target/tunnel。
4. 恢复自动恢复与 server 操作恢复的本地运行状态语义不完全一致。
5. `OUTPUT_BASE_PATH` 指向外部 ComfyUI 输出时，受管 `data/images` 新结果服务关系需核验。
6. `prompt-block-service.ts` 与 `lib/actions/prompt-block.ts` 重叠逻辑可能存在行为分叉。
7. API createProject 与 UI server 操作 createProject 能力不同，文档若写“创建项目”不能混为一个入口。

### 13.2 文档事实错误或边界错误

1. `DESIGN.md` 的导航结构不等于当前生产实现。
2. `.env.example` `COMFY_HISTORY_MAX_ATTEMPTS=15` 与源码默认 300 不一致。
3. `docs/ui/component-boundaries.md` 对 `design-demo-ui` 的范围描述太窄。
4. `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md` 当前/历史边界和链接错误。
5. `docs/prisma-schema-compatibility.md` 需要反映 SQLite 的 `PresetFolder`/`ProjectFolder` 时间戳差异，或修正 schema。
6. `docs/local-verification.md` 的 UI 操作步骤需要按当前页面重写。
7. `docs/prototypes/**` 的保留目的和清单操作需要对齐。

### 13.3 架构债

1. `src/lib/server-data.ts` 是反向依赖 `server/` 的外观层。
2. server 操作和服务有职责重叠。
3. prompt 区块和预设绑定逻辑散落在 service/action/repository/UI 辅助工具。
4. Training `dataset_freeze` worker 与同步冻结服务职责重叠。
5. 文档生成脚本没有包脚本，维护入口分散。
6. 路由处理器方法统计存在函数导出和常量导出的口径问题，不适合手写为 README 权威数字。

## 14. 正式文档重建建议

下一步不是只移动文件，也不是只补索引，而是用当前代码替换腐烂文档。

优先顺序：

1. 重写 README：保留项目说明、快速开始、主要产品面、最小技术栈、文档入口；移除或弱化大表格精确数量。
2. 重写 `docs/local-verification.md`：按当前认证、AppShell、底部导航、队列审查、training、ComfyUI 目标、worker/status 重写。
3. 重写 `docs/agent-api.md`：区分智能体 REST、普通 API、MCP、training API，不再把智能体 API 写成 7 个端点。
4. 修 `DESIGN.md`：明确是目标设计，还是当前 UI；如果是当前 UI，就必须承认当前全局底部导航和 sky/blue 现状。
5. 修 `docs/ui/component-boundaries.md`：说明 training 生产 UI 复用 design-demo 基础组件，或迁移到中性共享基础组件命名。
6. 修 Prisma 兼容性：处理 `ProjectFolder/PresetFolder` 时间戳差异。
7. 归档或合并 `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`。
8. 清理 `docs/prototypes/**` 语义：保留原型意图，但不作为生产事实。
9. 重新生成 `docs/repo-inventory.md`。
10. 跑聚焦治理测试，再按改动范围跑完整 `npm test`。

## 15. 专项补充阅读结果

本节是对上一版“仍未完成专项”的补读结果。五个子代理分别只读 API、生产生成侧 UI、Training UI、历史 Training 计划迁移、运行时可验证性；均未修改文件、未启动新服务、未提交。

### 15.1 API 路由契约

`src/app/api/**/route.ts` 当前共有 194 个路由文件。按静态导出的 HTTP 方法统计是 266 个方法，README 中的 261 已经不应继续作为权威数字。这个差异可能来自别名路由、新增方法、统计脚本口径不同，但结论是：README 不适合手写精确方法数量，精确 contract 应由生成文档维护。

API 响应主流约定是 `src/lib/api-response.ts` 的 `{ ok: true, data }` / `{ ok: false, error: { message, details? } }`。例外必须显式写入文档：

1. `/api/auth/verify` 使用平坦 `{ ok: true }` 或 `{ error }`。
2. `/api/queue-data` 是遗留原始 JSON，不走通用封装。
3. `/api/images/:path*` 和工作流下载返回文件流或附件。
4. `/api/mcp` 走 MCP Streamable HTTP 传输，不能按普通 JSON API 描述。

按域看，当前 API 已经远超旧 README 的“7 个智能体端点”：

| 域 | 当前事实 |
|---|---|
| 智能体 | 仍有核心 project/context/run/review 流程，但还包含预设变体 switch/sync/safe 流程。`docs/agent-api.md` 是智能体工作流文档，不是全量路由 contract。 |
| Generation | 项目、目录、小节、prompt 区块、模板、预设资源库、队列、运行审查、工作流下载均有 API。 |
| 队列 | `/api/queue` 是待审核图片队列，不是活动运行队列。active/running 应看 `/api/worker/status`、`/api/queue-data`、`pause-active`、`resume-paused`。 |
| Training | `/api/training/**` 是完整一等域，覆盖项目、profile、小节、区块、generation 任务、图像结果、参考资料图像、说明文字、数据集修订、training 运行、模板、场景预设、调度器、worker 回调。 |
| Runtime | ComfyUI start/stop/restart/health-probe、worker 状态、模型文件管理器、日志、审计日志、MCP 都是正式能力，但写操作有运行时边界。 |

已定位的文档漂移：

1. `docs/agent-api.md` 把 `/api/preset-library/presets/:presetId/cascade` 写成 `POST`，源码是 `DELETE`。
2. project/section 运行正文文档写 `overrideBatchSize`，路由读取 `batchSize`，需要用客户端实际调用再定稿。
3. README 的 route/method/domain 数量混用了不同口径，不应继续手写。

正式文档建议：写一个人工维护的 API 入口说明，只解释认证、响应封装、例外路由、队列语义、危险 runtime 操作和 agent/training 工作流；全量 method/path/query/body/status/service 映射生成到 `docs/api/generated-route-contracts.md` 一类文件。

### 15.2 生产生成侧 UI 属性与状态机

生成侧生产 UI 的外壳是 `RootLayout -> AppShell -> PersistentBottomNav`。`/login`、`/design-demos`、`/training` 绕过普通 `AppShell`。底部导航不是临时演示导航，而是当前生产 navigation 的关键入口；它读取 pathname/search、工作模式、本地最近路由和滚动状态，并在 generation / training 同类资源之间切换。

主要页面树：

| 页面域 | 当前组件结构 |
|---|---|
| Queue/Review | `QueuePage -> QueuePageClient -> Pending/Running/Censoring/Failed/Trash tabs`；单运行是 `ReviewGroupPage -> ReviewGrid -> ImageCard/SelectionToolbar/BatchActions/ImageLightbox`。 |
| 项目 | `ProjectsPage -> ProjectsClient`；详情是 `ProjectDetailPage -> ProjectDetailClient -> SidebarProvider -> AppSidebar + toolbar + SectionFolderControls + SectionCards`。 |
| 小节编辑器 | `SectionEditPage -> SectionParamsForm + SectionNameEditor + SectionEditor`；编辑器下接已导入预设绑定、导入面板、prompt 区块和 LoRA 列表。 |
| 结果 | 项目结果和小节结果是两条实现：前者有 sidebar/toolbar/gallery/lightbox，后者有 provider、画廊和行内灯箱。 |
| 资产 | `PresetManager` 组织分类栏、预设与分组列表、预设表单、变体编辑器；模型用 `ModelFileManager` 管目录、上传、移动、说明。 |
| 设置 | monitor/logs 是轮询状态页，监控还控制 ComfyUI start/stop/probe。 |

关键状态机：

1. 队列审查：队列页由活动标签页、轮询刷新、过渡待处理驱动；单运行审查有乐观审查、待处理操作、灯箱索引、选择、撤销栈。keep/trash/marker 会乐观更新，失败回滚。
2. 项目详情：项目列表目录写 URL；详情页小节目录也写 URL。滚动监视维护活动小节，哈希到达后滚动并清哈希，紧凑模式用最近可见小节修正滚动锚点。
3. 小节编辑器：参数表单和批次尺寸有防抖自动保存；预设 import/switch/delete 会重组 prompt 区块和 LoRA 条目；LoRA 删除存在 suppress/tombstone 语义。
4. 结果：项目结果按 all/featured/featured2/cover 过滤，灯箱以图像 id 驱动；小节结果使用 provider 级乐观状态，并支持跨小节连续审核。
5. 预设与模板：预设表单有 `idle -> saving -> queued -> saved/error` 保存队列；模板小节详情有 600 毫秒防抖保存，`null` 表示导入时不覆盖。
6. 模型与设置：模型浏览器是 `kind/path -> loading/items`，搜索防抖 200 毫秒；监控与日志约 5 秒轮询。

生产 UI 的真实债务不是“没有组件”，而是重复实现很多：

1. 队列审查、项目结果、小节结果各有相似灯箱、keep/trash/marker、键盘导航和乐观状态。
2. `SectionEditor` 与模板小节详情都实现预设 binding/import/switch/LoRA 排序。
3. 目录 UI 在 projects/presets/templates/models 间部分共享、部分重写。
4. 旧 `LoraFileManager` 还在，但 `/assets/loras` 已重定向到 `/assets/models`。

这也解释了为什么 `DESIGN.md` 不能直接当当前事实：它描述的浅色模式、玻璃、green/rose、桌面左侧全局导航和“一个主要表面”并不等于当前生产 UI。`docs/ui/project-page-boundaries.md` 与当前项目详情边界相对一致；`docs/ui/component-boundaries.md` 对 `design-demo-ui` 与共享基础组件的边界需要重写。

### 15.3 Training UI 属性与状态机

Training 的设计目标应写成：Training 与普通生图是平级工作模式，通过导航栏的模式切换切换；models/settings 是共享资源，runs/projects/presets/templates 按当前工作模式路由到各自模块。

当前 Training 外壳是 `TrainingApp -> TrainingShell -> DesignDemoShell + PersistentBottomNav`。它复用 `DesignDemoShell` 的 layout/header/feedback/theme/portal/scroll header 能力，但设置 `navigationChrome="none"`，不用 design-demos 的 sidebar/nav/data。Training 的数据、路由、API、实体、header specs 都在 `src/features/training/**` 和 `/api/training/**`。

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
| `/training`、`/training/runs` | `LoraTrainingRunsPage`，读取 training 运行路由数据。 |
| `/training/runs/generation/:taskId` | generation 任务详情，类型为 generation。 |
| `/training/runs/training/:trainingRunId` | training 运行详情，类型为 training。 |
| `/training/projects` | 轻量项目摘要。 |
| `/training/projects/new` | 项目创建表单，带 projects/presets/templates/models。 |
| `/training/projects/:id/**` | 项目详情、profile、小节、compose、数据集、结果等子页。 |
| `/training/presets`、`/training/templates` | 场景预设与 training 模板管理。 |

关键状态机：

1. 项目：scope/view mode/selected ids/local projects/order/hidden 标识；重排乐观 PATCH，失败回滚；archive/restore/delete；创建页先本地草稿，再 POST、上传引用图、跳转详情。
2. Profile/reference/text 修订：profile 草稿、参考资料图像编辑、待处理集合、修订面板分离；支持 PATCH profile、GET 修订、POST 恢复、参考资料图像增删改查、添加参考资料到结果。
3. Sections/scene 区块：header 事件触发添加；add/copy/delete/reorder 乐观更新；详情状态以 `projectId:sectionId` 分区；local/imported 预设区块支持 move/edit/delete/save。
4. Compose：选择 reference/supplemental 图像，计算最终输入文本；生产路径会确保草稿任务、写输入、预览、运行、跳 generation 详情。
5. Results/caption：父层维护 filters/selection/bulk review/caption 修订，网格自管灯箱活动 id；审查和说明文字 revision/restore 都走 API。
6. 数据集：维护 result/revision 覆盖项、training 草稿、加载中；批量说明文字、冻结数据集、启动 training 前检查活动 run/kept/caption，再跳 training 运行详情。
7. 运行详情：按 generation/training 类型分支；支持 cancel/retry/hide/create 预设。创建预设的当前语义是 training 场景预设，不是把最终 LoRA 自动绑定回普通生图预设。
8. 预设与模板：列表排序、选择、上下文 ID 隔离和排序规则；模板小节复用类似项目小节区块的状态机。

当前实现与目标之间的命名和边界债：

1. `DesignDemoShell`、`design-demo-ui` 名称仍带演示语义，但已经被 Training 生产 UI 复用。
2. `LoraTraining*` 命名仍偏具体业务，不完全等于更中性的 Training 模块。
3. 部分页面保留 non-production local 草稿兼容逻辑，文档不能把这些当最终产品设计。

### 15.4 历史 Training 计划迁移 diff

归档 Training 计划不是没有价值，而是它们混合了“已落地事实”“已改变设计”“未实现目标”。正式文档应从源码重写当前事实，再把归档计划作为设计考古材料。

可迁入当前文档的事实：

1. Training 是一等模块，路径是 `/training/**` 和 `/api/training/**`，不是挂在 generation 项目下的附属页。
2. 工作模式资源入口已落地：runs/projects/presets/templates 按 generation/lora_training 分流，models/settings 共享。
3. 旧计划里“模式图标只提示，不切换；去设置切换”已过时。当前底部导航模式按钮可点击，会切同资源槽。
4. Training 路由绕过普通 AppShell，但复用底部导航。
5. Training 图像 generation 当前政策不是走 ComfyUI 队列，而是提供方策略，偏 `codex_gpt_image2` / GPT-Image-2 类 provider。
6. Training 场景预设独立于 generation 预设，有自己的 category/folder/sort/usage/cascade。
7. Profile/reference image/text 修订、generation 任务、输入引用、输出、数据集修订、training 运行、worker 任务这些实体都已成为当前域模型。

需要写成“当前实现限制/风险”的事实：

1. 数据集冻结当前不是完整 revision-scoped 文件副本，更多是记录快照工件 id；说明文字缺失主要计数，不是严格阻断。
2. 区块互斥 preset/local 主要在服务校验，不是强数据库约束。
3. 说明文字 generation 当前更像同步 deterministic/local 回退，不是完整异步模型 worker。
4. worker 协议存在，但真实 sd-scripts/WSL/local 运行器的能力不应从旧计划复制到当前文档。
5. archive/delete 多为数据库状态或项目 delete，未观察到旧计划描述的完整工件清理。
6. `create preset from completed run` 的当前语义已变成创建 training 场景说明预设。

应继续留在归档的内容：

1. `CharacterLoraTraining*` 旧命名、benchmark、推广、兼容性 router、cold-character-training 回退。
2. 旧的模式图标非切换设计。
3. 未落地的完整运行器适配器 contract、安全工件清理、revision-scoped 文件副本、ComfyUI 队列 waitReason 协调。
4. HTML 原型的 CSS/JS/fake 数据。原型只保留 `IA`、密度、跳转关系、caption/readiness/lightbox 等产品意图。

### 15.5 运行时与视觉质检可行性

本机已有开发服务在 `localhost:3000`，进程链是屏幕启动的 `npm run dev -- --webpack -p 3000` / `next dev --webpack -p 3000`。未发现 `3001` 生产 `next start`，也未发现 `5173`、`4317`、`8188` 监听。PostgreSQL 在 `127.0.0.1:5432` / `[::1]:5432` 监听。

只读 API 探测结果：

| 端点 | 结果 |
|---|---|
| `/api/health` | 200，服务状态 ok。 |
| `/api/worker/status` | 200，数据库队列可读；generation queued/running 为 0；ComfyUI 可达为否。 |
| `/api/comfy/status` | 200，管理器状态已停止，pid 空值，lastHealthOk 否，受管模式启用，auto-start 禁用。 |
| `/api/training/worker/status` | 200，training totalActive 263、totalQueued 262、totalRunning 1。 |

这说明本机可以验证 DB/API/UI 认证保护页面，但不能验证真实 ComfyUI 生图链路，因为 8188 未监听且 ComfyUI 管理器已停止。Training worker 状态能反映数据库队列状态，但未看到真实 worker 进程，所以不能把 `running=1` 解释成 worker 正在消费任务。

浏览器截图质检技术上可行，但会产生截图/追踪等文件；本轮按只读约束没有执行。后续正式文档清理如果要声称“页面现状”，应补 desktop/mobile 截图和关键路径交互验证。

### 15.6 本轮后仍不能声称完成的边界

1. 还没有生成可持续维护的全量路由 contract 文档，只完成了人工专项阅读。
2. 还没有跑浏览器截图质检，所以 DESIGN/UI 文档的“视觉现状”只能根据源码和组件结构判断。
3. 还没有真实启动 ComfyUI 或 Training worker 验证端到端任务执行。
4. 还没有把这些结论落入正式文档，只写在 `.tmp` 临时底稿中。
5. 本文仍是“理解底稿”，不能直接替代 README、`docs/agent-api.md`、`docs/local-verification.md`、`DESIGN.md` 等正式文档。

## 16. 结论

当前仓库最大问题不是“没有文档”，而是：

1. 代码已经演进成一个复杂的双域工作台。
2. README 和部分文档仍在用旧模型描述它。
3. 文档层级已经部分归档，但 current/prototype/archive/generated 的边界还不够清。
4. 若继续在旧文档上局部修补，会不断制造新的漂移。

更合理的路径是：以当前源码和本底稿为事实基础，先重写 README、local 验证、智能体 API、UI/design、Prisma 兼容性和文档映射，再物理归档旧计划/原型/实现笔记。
