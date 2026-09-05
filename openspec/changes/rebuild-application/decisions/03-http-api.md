# HTTP API 合同与资源路由

本文件记录本轮对话已确认的新版目标，尚不代表运行代码已实现。编号保留原清单 ID；冲突时采用最新用户决策及 [最终口径](00-final-decisions.md)，旧实现列仅供数据转换核对。

## A12. HTTP API 通用协议

`shared` 只作为内部架构边界，不作为无业务含义的 URL namespace。每项平台能力使用实际模块名；修改历史由所属领域资源暴露，不能通过一个万能 `/api/revisions` 绕过模块校验。前端、Agent 和内部执行器复用同一领域 API、Schema、鉴权和审计路径。

| ID | 协议 | 决策 |
| --- | --- | --- |
| `API-01` | 一级模块 | 使用 `/api/auth/**`、`/api/settings`、`/api/compute-target/**`、`/api/models/**`、`/api/monitoring/**`、`/api/image-production/**`、`/api/lora-training/**` 和生成的 `/api/openapi.json`；不建立 `/api/shared/**`。图像生产与 LoRA 训练修改历史分别挂在所属资源下，不建立顶层 `/api/revisions` |
| `API-02` | 鉴权 | 浏览器使用登录 Cookie；Agent、LoRA 训练执行器及跨网络客户端统一使用 `Authorization: Bearer <AUTH_TOKEN>`。删除 `x-api-token`、模块专属 Token Header 和多套鉴权 fallback |
| `API-03` | 成功响应 | 普通 JSON 固定为 `{ data, meta? }`；删除成功且无正文时返回 204，不再同时维护 flat、ok、success 等多种包装 |
| `API-04` | 错误响应 | 固定为 `{ error: { code, message, details?, requestId } }`，配合正确的 400/401/403/404/409/422/500 状态码；不得以 200 包装业务错误 |
| `API-05` | 字段命名 | JSON 使用 camelCase，时间使用 ISO 8601，ID 使用不可推断字符串；用户界面中文名称不进入 API 字段名，枚举使用稳定英文值 |
| `API-06` | CRUD | 列表/详情使用 GET，新建使用 POST，局部编辑使用 PATCH，物理删除使用 DELETE；不使用 PUT，也不允许 GET 产生写操作或恢复副作用 |
| `API-07` | 领域动作 | 无法自然表达为 CRUD 的生成、重试、暂停、恢复、归档、导出、复制 checkpoint 等使用明确 POST action，不伪装成字段 PATCH |
| `API-08` | 分页 | Task、图片、修改历史、审计和日志统一使用 cursor + limit；Project、Preset 等小列表使用同一响应形态，但可使用更大的默认 limit。任何列表不得默认无界读取 |
| `API-09` | 查询与排序 | 使用明确 query 参数，如 projectId、sectionId、status、createdAfter、createdBefore、sort、order；前端与 Agent 共用相同筛选、排序和计数语义 |
| `API-10` | 批量操作 | 使用与单项相同的领域服务并接收明确 ID 数组，不为单项和批量维护两套规则；响应逐项返回 ID、success 或标准错误，避免部分失败被隐藏 |
| `API-11` | 并发编辑 | 可编辑聚合返回 version 和 ETag；PATCH、DELETE、排序及修改历史恢复使用 If-Match，版本过期返回 409，防止浏览器与 Agent 静默覆盖彼此修改 |
| `API-12` | 幂等请求 | 创建生成任务、启动训练、重试、导出、归档和 ComfyUI restart 等可能重复产生副作用的请求支持 Idempotency-Key；同一身份和 key 的网络重试返回原结果，不重复执行 |
| `API-13` | 异步操作 | 生成、训练和批量打码返回 202 及对应 Task/TrainingRun；用户只读取任务状态、等待原因、进度和错误，API 不暴露 worker、lease 或 heartbeat |
| `API-14` | 文件响应 | 图片、ZIP、Workflow、checkpoint 和日志下载返回二进制流及明确 Content-Disposition 文件名，不包进 JSON；仍执行 Cookie/Bearer 鉴权、资源归属和路径边界校验 |
| `API-15` | 接口文档 | 从实际请求/响应 Schema 生成 OpenAPI；不再维护手写 Agent flow manifest、巨型能力清单端点或与真实 route 分离的第二份接口定义 |
| `API-16` | 页面与 API 回退 | 页面路由继续尽力回退到最近可用父级；API、文件和不存在的领域资源必须返回标准错误，不能执行页面式回退或跳到其他模块 |

## A13. 图像生产 HTTP API 路由

图像生产的前端与 Agent 只使用 `/api/image-production/**` 领域路由，由 Fastify 路由调用对应模块的领域服务；新版移除 Next.js Server Action。除明确的文件流和异步 Task 响应外，全部遵循 API-01～API-16。

| ID | 路由组 | 决策 |
| --- | --- | --- |
| `IAPI-01` | `/api/image-production/projects` | GET 支持名称、文件夹、active/archived、活动任务和待审核筛选；POST 统一创建空白或可选 Template 项目。`/:projectId` 提供 GET/PATCH/DELETE，PATCH 使用 version/If-Match |
| `IAPI-02` | `/api/image-production/project-folders` | 提供项目文件夹 CRUD、排序和项目移动；删除非空文件夹使用明确 action，服务端按相同领域规则连同全部子文件夹和项目处理 |
| `IAPI-03` | `/api/image-production/projects/:projectId/sections` | 提供 Section 列表、新建、详情、PATCH、DELETE、复制、排序、批量删除及运行单个/所选 Section；单项与批量复用同一删除和生成服务 |
| `IAPI-04` | `/api/image-production/projects/:projectId/section-folders` | 提供 Section 文件夹 CRUD、排序、拖放移动和连同全部内容删除；不提供删除时迁移/保留内容的分支 |
| `IAPI-05` | `/api/image-production/sections/:sectionId/segments` 与 `/loras` | 提供 Prompt Segment、PresetBinding 和手动 LoRA 的增删改、排序、detach、仅本 Section 停用及转为手动；所有写操作创建适用的修改历史 |
| `IAPI-06` | `/api/image-production/tasks` | 提供全局、Project、Section、状态和时间范围查询；创建任务、详情、DELETE，以及 retry/pause/resume/cancel 等明确 action。删除终态 Task 按唯一语义同时删除 Attempt、结果和受管输出 |
| `IAPI-07` | `/api/image-production/tasks/:taskId/attempts` | 只读 Attempt 列表与详情；Attempt 只能由提交/重试执行器创建和结束，普通前端或 Agent 不得直接伪造、PATCH 或 DELETE |
| `IAPI-08` | `/api/image-production/images` | 按 Project、Section、Task、审核状态、P站、预览、封面和时间查询；PATCH 维护 pending/kept 与 P站/预览用途，不接受任意文件路径 |
| `IAPI-09` | `/api/image-production/images/:imageId/content` | 按 query 明确返回 original、thumbnail 或 censored 版本，服务端从图片和 Artifact 身份解析路径；执行 Cookie/Bearer、归属、格式、临时文件和路径穿越校验 |
| `IAPI-10` | `/api/image-production/images/:imageId/actions/**` | 提供 trash、auto-censor、保存 manual-censor 等明确动作；设置/清除唯一封面使用 Project action，以便同时校验同项目归属并自动保留图片 |
| `IAPI-11` | `/api/image-production/trash` | 支持全局、Project 和 Section 范围分页查询、批量恢复与永久删除；文件与数据库必须保持受控一致，批量响应逐项报告结果 |
| `IAPI-12` | `/api/image-production/censoring-tasks` | 创建“P站＋预览＋封面”批量打码 Task，查询列表/详情，并提供 pause/resume/cancel action；单图打码不伪造成批量 Task |
| `IAPI-13` | Preset 资源路由 | `/preset-categories`、`/preset-folders`、`/presets`、`/preset-groups` 及子资源提供 Category、Folder、Variant、VariantLink、GroupMember、Slot、排序、usage、replace 和物理删除能力；Group 成员始终保持独立 |
| `IAPI-14` | `/api/image-production/templates` | 提供 Template、SectionFolder、Section、Segment、Binding 和 LoRA CRUD；项目另存 Template、向项目导入整套 Template 和批量替换 Preset 使用明确 action |
| `IAPI-15` | Workflow 下载 | `/sections/:sectionId/workflow?variant=original\|debug` 下载当前解析结果；`/tasks/:taskId/workflow?variant=original\|debug` 下载历史不可变快照，两者均返回文件流 |
| `IAPI-16` | `/api/image-production/projects/:projectId/actions/**` | 提供 generate、import-template、sync-variant-assignments、export、archive、set-cover、clear-cover 等跨项目聚合动作；不把这些副作用隐藏进普通 PATCH |
| `IAPI-17` | `/api/image-production/comfyui/**` | 提供模块 settings、当前连接/队列状态及手工 start/stop/restart；任务创建不调用启停提示接口，GPU 恢复流程复用同一受控进程服务 |
| `IAPI-18` | 修改历史 | 在 Section、Preset、Group、Template 等具体资源下提供 `/revisions` 和 `/:revisionId/restore`；查询可复用 shared RevisionEntry，恢复必须进入 image-production adapter 和领域事务 |

## A14. LoRA 训练 HTTP API 路由

LoRA 训练前端与 Agent 只使用 `/api/lora-training/**`；训练素材图片执行与实际 LoRA 训练保持两条清晰资源链。执行器领取和回报接口属于模块内部执行协议，不出现在普通 UI，也不重新建立 worker/scheduler 产品抽象。

| ID | 路由组 | 决策 |
| --- | --- | --- |
| `LAPI-01` | `/api/lora-training/projects` | GET 支持 active/archived、名称和活动任务筛选；POST 统一创建空白或可选 Template 项目。`/:projectId` 提供 GET/PATCH/DELETE，并通过明确 archive action 进入永久只读归档 |
| `LAPI-02` | `/api/lora-training/projects/:projectId/profile` | GET/PATCH triggerToken、characterDescription、productionPrompt；三个字段都允许为空，每次明确保存进入 shared 修改历史协议 |
| `LAPI-03` | `/api/lora-training/projects/:projectId/reference-images` | 提供上传、查询、改名、description、排序和移除；内容通过资源自身 `/:referenceImageId/content` 返回，不接受任意路径 |
| `LAPI-04` | `/api/lora-training/projects/:projectId/sections` | 提供 Section CRUD、复制、排序和批量删除；不提供 enabled、全量重建或另一套 SectionRun 接口 |
| `LAPI-05` | `/api/lora-training/sections/:sectionId/inputs` | 从本项目参考图选择、手工上传、引用历史候选、删除和排序；不接受其他 Project Artifact 或跨项目复用 |
| `LAPI-06` | `/api/lora-training/sections/:sectionId/segments` | 提供 CustomText/PresetBinding CRUD、排序、detach 和 resolved Prompt/Caption baseline 预览；权威 Caption 仍由 Section PATCH 维护 |
| `LAPI-07` | `/api/lora-training/sections/:sectionId/images` | 查询生成与手工上传候选、上传候选和删除；通过 Section PATCH 设置 selectedImageId 与 trainingCaption，不给候选增加 reviewStatus 或 Caption |
| `LAPI-08` | `/api/lora-training/images/:imageId/content` | 返回候选图片内容；ReferenceImage 和 SectionInput 使用各自资源 content URL。所有入口从数据库身份解析所属 Artifact并执行鉴权、归属和路径校验 |
| `LAPI-09` | `/api/lora-training/image-generation-tasks` | 提供全局/Project/Section/状态/时间查询、详情、创建、cancel、retry 和 DELETE；失败重试同一 Task 只补足缺少候选 |
| `LAPI-10` | `/api/lora-training/image-generation-tasks/:taskId/attempts` | 只读展示 Attempt、单图调用结果、错误和耗时；普通前端与 Agent 不得直接写执行结果 |
| `LAPI-11` | `/api/lora-training/projects/:projectId/training-input-preview` | 实时返回将纳入训练的代表图片 + Caption 列表和缺失项；只读，不创建 Preview、DatasetVersion 或文件副本 |
| `LAPI-12` | `/api/lora-training/projects/:projectId/training-runs` | POST 根据同一训练输入预览规则创建 TrainingRun 与 Sample 快照并返回 202；全局 `/training-runs` 提供按 Project、状态和时间筛选的列表 |
| `LAPI-13` | `/api/lora-training/training-runs/:trainingRunId` | GET 详情，并提供 cancel、retry、cleanup action；同一 Run 故障重试新增 Attempt，样本或核心参数改变则从 Project 创建新 Run，不修改旧 Run |
| `LAPI-14` | `/api/lora-training/training-runs/:trainingRunId/attempts` 与 `/samples` | 只读展示实际执行尝试和输入快照；Sample 不提供独立 PATCH/DELETE，也不通过当前 Section 重新解析历史内容 |
| `LAPI-15` | `/api/lora-training/training-runs/:trainingRunId/checkpoints` | 查询 checkpoint；`/:checkpointId/content` 下载，并提供 delete、copy-to-models 等 action。运行中禁止删除，复制后目标模型与源 checkpoint 完全解绑 |
| `LAPI-16` | Prompt Preset 路由 | `/prompt-preset-categories`、`/prompt-presets`、`/prompt-preset-groups` 提供一层 Category、Preset、简单 Group CRUD、成员排序、usage 和物理删除；不引入 Variant 或嵌套 Group |
| `LAPI-17` | `/api/lora-training/templates` | 提供 Template、TemplateSection、Segment、Binding、Caption、Provider 参数和训练默认参数 CRUD；Project 另存 Template 使用明确 action |
| `LAPI-18` | `/api/lora-training/settings` | 管理训练 Python 绝对路径、目标训练数据根和 bf16/fp16；不暴露 worker 数量、sd-scripts 路径、Accelerate 配置路径或任意 Runner 命令 |
| `LAPI-19` | 修改历史 | 在 Profile、Section、PromptPreset、PromptPresetGroup、Template 等具体资源下提供 `/revisions` 与 `/:revisionId/restore`；恢复必须进入 lora-training adapter 和领域事务 |
| `LAPI-20` | 内部执行回报 | `/api/lora-training/execution/image-generation-tasks/**` 与 `/execution/training-runs/**` 只供受管执行器领取或回报 heartbeat、progress、checkpoint、complete、fail、cancel；使用同一 Bearer 鉴权但不链接到普通 UI |
| `LAPI-21` | 移除旧路由 | 删除 DatasetRevision、SectionRun、Caption Task、PromptCardVersion、scheduler tick/status、worker status、巨型 capability manifest 和全部 `/api/training/**` 兼容接口 |
