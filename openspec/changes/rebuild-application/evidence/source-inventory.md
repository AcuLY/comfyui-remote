# 原始决策清单快照

本文件为本轮对话结束时的本地清单原样快照，仅供追溯；正式阅读入口为 [变更索引](../README.md)。下文的时间、分支、运行状态及“本地草稿”描述属于原文件上下文，不是本次新分支的状态声明。

# ComfyUI Manager 生产功能全量决策清单

扫描日期：2026-08-26  
源码工作树：`D:\Luca\Code\MyProject\comfyui-manager-refactor`  
源码分支：`codex/product-refactor`  
源码提交：`3a51ac47f46003d4bbb05ff2d292c6a3edafe5f1`

## 使用方式

把每行最后一列的 `待定` 改成以下一种：

- `保留`：新版本必须具有等价能力。
- `简化`：保留目标，但允许合并入口、减少配置或收窄行为。
- `移除`：新版本不再提供；后续仍需单独决定旧数据、API 和文件如何退役。
- `后置`：不进首版，但保留兼容/迁移空间。

功能状态含义：

- `现用`：当前生产 UI 或核心执行链实际使用。
- `后台`：没有普通页面，但生产执行依赖。
- `隐藏`：有真实 API/代码能力，无普通导航入口。
- `兼容`：为旧路径、旧客户端或旧数据结构保留。
- `部分`：存在入口，但行为不完整或与文案不一致。
- `占位`：路由存在，核心行为基本为空。

## 扫描口径与完整性

- 纳入：所有非 `/design-demos/**` 的生产页面、生产 API、server action、repository、service、进程内启动逻辑、外部 worker、MCP、Agent API、文件/数据生命周期和离线质量工具。
- 排除：Design Demo 功能页、测试夹具、纯文档治理、Harness、CI 和 GitHub 工作流。
- Design Demo 仍被 Training 生产代码依赖的 shell、主题、反馈和 UI primitives 被列为技术依赖。
- 当前运行构建来自 `74445e18`；从该提交到本扫描提交只有文档、OpenSpec 和治理测试变化，没有 `src/**`、`config/**`、`prisma/**` 或包依赖变化，因此本清单与当前运行的应用代码表面一致。
- 扫描覆盖：27 个非 Demo 页面文件、23 条 Training 子路由、194 个 API route、26 个 action 文件、70 个 service、24 个 repository、11 个 MCP 工具、3 个 MCP 资源。
- 最终形成 309 个可独立决策的功能项；另有 27 条不单独决策、但会影响移除方式的风险约束。

## 已确认的新版本全局架构约束

- 2026-09-05 用户明确：系统当前没有投入使用。新版采用全新代码工程和一次性数据迁移；旧版仅数据与业务文件需要保留，旧代码、依赖、构建产物、兼容层和部署体系不作为新版基底。本文“现用/当前入口”等列是 2026-08-26 扫描时的实现证据，不代表目前有在线业务需要维持；实施边界以 MIG-01～MIG-08 为准。
- 新版本保留两个完全对等的业务模块，正式名称为“图像生产”和“LoRA 训练”。
- 2026-09-05 技术选型确认：前端使用 React 19 + Vite + React Router，唯一主组件库为 PrimeReact v10 Styled（primereact 10.9.9，MIT，无需注册、license key 或续期）；后端使用 Fastify 5 + TypeScript + TypeBox，数据库使用 Drizzle ORM + better-sqlite3 + SQLite。具体约束见 CA-01～CA-14 和 TS-01～TS-08；这些是新版设计结论，不表示已完成依赖安装或运行时迁移。
- 对称技术命名固定为 `image-production` 与 `lora-training`；页面路由使用 `/image-production/**` 与 `/lora-training/**`，API 使用 `/api/image-production/**` 与 `/api/lora-training/**`，模块目录使用 `modules/image-production/**` 与 `modules/lora-training/**`。
- 两个模块在产品信息架构、导航层级、前端组件能力、页面外壳、路由命名空间、后端领域模块、API 边界、数据访问层、测试和运维责任上都不得存在主次关系。
- 禁止让 LoRA 训练继续作为图像生产、Design Demo 或其他模块的 adapter、re-export、子路由或特殊兼容分支。
- 共享模型、设置、认证、媒体投递和全局反馈属于独立 shared 平台层，不归属任何一个业务模块。
- 两个模块存在项目、运行、预制、模板、产物等共同概念，但已按 SI-01～SI-10 明确区分“真正共享资源”与“名称相同但生命周期不同的模块聚合”：不建立 shared Project、万能 Task、跨模块 Preset/Template 或全局图片库；模型文件才是主要 shared 业务资源，不得通过隐式 fallback 或交叉读取混淆所有权。
- 模型资源、认证、媒体投递、设置、通知和其他共同依赖必须由 shared 平台提供稳定接口；两个业务模块以对等消费者身份依赖它们。
- LoRA Training checkpoint 输出目录与模型模块管理的 ComfyUI LoRA 模型目录必须在文件路径和领域身份上彻底隔离。TrainingProject 只拥有训练输出目录中的 checkpoint；用户可将任意 checkpoint 单向复制到 ComfyUI LoRA 模型目录。复制后的模型是独立资源，不与 TrainingProject、TrainingRun、Checkpoint 或源文件建立外键、共享 Artifact 身份或反向同步。文档、API 和 UI 只使用实际领域名称，不采用 A/B 等临时简称。
- 新版明确假设整个应用只使用一个物理 GPU。shared 平台只维护一个可配置为本机或远程机器的 compute target 及全应用 GPU 占用事实；图像生产的 ComfyUI adapter 与 LoRA 训练 runner adapter 都使用该目标，而不是把训练从属于 ComfyUI。
- 当唯一 compute target 位于远程机器时，ComfyUI 与 LoRA 训练 runner 都在该远程目标执行；连接、文件路径和进程控制仍通过各自 adapter 处理，但不设计多 target、多 GPU 或并行 TrainingRun 调度。
- GPU 互斥以任务状态而不是进程状态判断：ComfyUI 空闲运行不占用调度权，也不要求在训练前停止；只有已提交到 ComfyUI 或正在运行的图像生产任务会阻止训练启动，未提交和已暂停任务不阻止训练。
- GPU 可用性在实际 compute target 上独立于 ComfyUI HTTP 状态检测。检测到 GPU 从可用变为不可用时停止新任务提交并持久化“ComfyUI 需要在 GPU 恢复后重启”；GPU 恢复后只执行一次受控 ComfyUI restart，健康检查通过才恢复调度，失败后停止自动尝试并提供手工重试。
- 图像生产任务必须使用统一状态机，至少区分“未提交到 ComfyUI”“已提交到 ComfyUI”“运行中”“已暂停”“已完成”“失败”和“已取消”。不得再用同一个 `queued` 同时表达应用内等待与 ComfyUI 队列等待；新版队列 UI、筛选、计数、恢复和调度全部以该状态机为准。
- LoRA 训练模块只保留“训练素材生成任务”和“LoRA 训练运行”两类可执行用户任务。角色分析、整段生图 Prompt 和 Caption 是 Agent/用户直接维护的普通领域内容，不建模为排队执行的生文任务；训练输入预览及启动时生成输入快照也不得冒充独立用户任务。
- 优先通过统一领域状态、实体或交互模型消除特殊分支。后续核对中若发现与“缓冲队列其实是未提交状态”类似的可统一点，需主动提出优化及影响，再纳入设计决策。
- 设置采用“shared 设置与运维中心 + 两个对等模块各自设置”的所有权模型；shared 入口不能吞并模块业务配置，两个模块的设置入口和能力层级必须对称。
- 监控与日志属于 shared 平台的一等模块，但只服务当前状态确认和错误定位：统一收集应用、图像生产、LoRA 训练、任务、数据库、存储和外部依赖的结构化事件，并记录单次慢页面/慢请求与各类任务阶段耗时；不建设趋势、聚合性能指标、实时流或完整可观测性平台。
- 设置所有权方向已经确认，但每一个具体设置项仍必须在后续按模块逐项核对；本清单中的示例不自动授权新增设置。
- 监控只解决当前状态是否准确、任务是否积压、单次页面/请求/任务慢在哪里、错误能否定位和操作是否可恢复，不建设完整可观测性平台；p50/p95/p99、吞吐趋势、资源利用率趋势、恢复时间线、复杂指标和长期分析只有用户另行确认后才进入范围。
- 应建立中性的应用根外壳与共享组件协议；两个业务模块以同等能力的 module shell 组合这些协议，而不是一方复用另一方的具体实现。
- 当前散落的 Generation 路由与 `/training/**` catch-all 都需要在新路由设计中改为对称、可辨认的模块命名空间。

---

## A. 平台、共享资源与兼容层

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `PLAT-001` | Token 登录页 | `/login` 输入单一访问 token，验证成功后回到 `from` 指定页面 | 现用 | `AUTH_TOKEN`；没有用户表、角色或独立 session；`from` 未限制为站内路径 | `src/app/login/page.tsx`、`src/app/api/auth/verify/route.ts` | 简化：保留个人单 Token；中文化并按新版设计重做登录样式；限制 `from` 为站内路径；增加注销。`AUTH_TOKEN` 只通过启动环境变量配置，不存 SQLite、不在网页显示或修改原值；设置页只显示已配置/未配置 |
| `PLAT-002` | Cookie 页面认证 | 写入 30 天 HttpOnly `auth_token` Cookie；未认证页面跳转登录 | 现用 | 所有页面共用同一权限；没有注销入口；未配置 `AUTH_TOKEN` 时不是关闭认证，而是受保护页面无法通过且 verify 返回 500 | `src/proxy.ts`、认证 route | 保留固定 30 天 HttpOnly Cookie，不增加有效期设置；注销立即清除 Cookie。浏览器 Cookie 只负责页面/资源访问，API Token 不受该有效期影响 |
| `PLAT-003` | API Header 认证 | API 支持 Bearer、`x-api-token`、`x-auth-token` | 现用 | Agent、MCP、worker 与运维 API 共用全能 token | `src/proxy.ts` | 简化并保留：跨网络 Agent、worker 和服务调用继续鉴权，统一只接受标准 `Authorization: Bearer <AUTH_TOKEN>`；删除 `x-api-token`、`x-auth-token`、TRAINING_MANAGER_TOKEN 和模块专属 Header/fallback。浏览器继续使用独立登录 Cookie，但来源都是同一个 AUTH_TOKEN |
| `PLAT-004` | AppShell | 除登录、Training、design-demo 外的常规生产页面统一内容宽度、底栏、SFW、Toast，包含 Generation、模型和设置 | 现用 | Training 与登录刻意跳过该 shell | `src/components/app-shell.tsx`、`src/app/layout.tsx` | 简化并重做：保留中性应用根外壳职责；视觉与布局全部重做；两个业务模块必须通过对等 module shell 使用同一共享协议，不能由一方复用另一方实现 |
| `PLAT-005` | Generation / Training 模式切换 | 底栏在两个平级工作模式间切换；模型、设置保持共享 | 现用 | `localStorage` 工作模式；资源 owner 契约 | `work-mode.ts`、`work-mode-resources.ts` | 保留并重做：正式模块为“图像生产”与“LoRA 训练”，技术标识为 `image-production` / `lora-training`；模式切换是突出、易发现的一级入口，使用完全对称的页面、API 和模块命名空间 |
| `PLAT-006` | 持久导航状态 | 记住每个资源最后 URL、查询、hash、滚动位置 | 现用 | `sessionStorage`；重写路由时需迁移或放弃 | `persistent-bottom-nav.tsx` | 保留并重构：保留跨页面/模式的路由、查询、Hash 和滚动恢复体验；实现改为可复用的通用导航状态与滚动恢复组件 |
| `PLAT-007` | 固定底部导航 | 运行、项目、预制、模板、模型、设置六项及模式按钮，桌面与移动端共用 | 现用 | 当前主要导航只存在底栏 | `persistent-bottom-nav.tsx` | 简化并重做：保留资源入口，删除“必须固定底栏”的实现约束，分别设计新版桌面与移动导航 |
| `PLAT-008` | SFW 图片模糊 | 开启后 `/api/images/**` 图片默认模糊，桌面悬停/移动点按临时揭示 | 现用 | 只存浏览器状态；依赖所有图片走统一 route | `sfw-mode-provider.tsx`、`sfw-mode-toggle.tsx` | 保留并重做：作为 shared 用户偏好同时作用于两个模块，默认关闭，统一桌面、触屏和键盘交互；保存在浏览器，不写 SQLite或跨设备同步 |
| `PLAT-009` | Generation 主题 | 默认暗色；现有 `ThemeToggle` 没有生产调用方 | 隐藏 | 当前全局设计 token 与 Training 主题体系分裂 | `globals.css`、`theme-toggle.tsx` | 简化并重做：删除未接线 ThemeToggle，建立 shared 深色/浅色主题；未保存人工选择时实时跟随系统，不设深色或浅色优先级。用户手工选择后长期保持，直到明确点击“改为跟随系统”；偏好保存在浏览器，不跨设备同步 |
| `PLAT-010` | Training 深浅主题 | Training 使用自己拥有的 storage key、Cookie 和 `/training` Cookie path | 现用 | 持久化身份独立，但复用 `DesignDemoShell`、主题类型和 CSS 实现 | `src/features/training/theme.ts`、Demo shell | 合并：移除模块专属主题持久化，接入与图像生产相同的系统跟随和人工覆盖逻辑；模块拥有不同强调色，但基础明暗 token、选择和重置行为一致 |
| `PLAT-011` | Generation Toast | Sonner 提示、关闭、最多三条 | 现用 | 与 Training 反馈系统不同 | `app-shell.tsx` | 保留并重做：保留 shared 短暂操作通知能力，具体组件库在新版设计阶段决定 |
| `PLAT-012` | 通知内容复制 | 为 Sonner 通知动态注入复制按钮，支持 Clipboard fallback | 现用 | MutationObserver 直接修改 DOM | `notification-copy-buttons.tsx` | 保留并重构：错误信息复制成为 shared 通知组件的正式属性，不再通过 MutationObserver 修改 DOM |
| `PLAT-013` | Training 反馈系统 | Training 使用 `DemoFeedbackProvider`，非 Sonner | 现用 | 旧生产代码依赖 Demo UI | `src/components/design-demo-ui/feedback/**` | 新版直接使用选定组件库的反馈组件及统一反馈协议，不迁入 DemoFeedbackProvider；按 MIG-01 全新实现，不要求先维持旧页面运行再逐页替换 |
| `PLAT-014` | 共享设置中心 | `/settings` 汇总 SFW、ComfyUI 监控、后端日志 | 现用 | 不支持编辑认证、target、模型根或日志配置 | `src/app/settings/page.tsx` | 保留并全面重做：建设 shared 设置与运维中心；启动必需配置使用环境变量，可动态应用设置存 SQLite，主题/SFW/导航等个人偏好存浏览器，三者不得互相 fallback。全局与模块专属设置保持明确所有权和对等入口；已确认设置见 SH-01～SH-08，后续组不得自动扩张 |
| `PLAT-015` | 应用日志页面 | `/settings/logs` 5 秒轮询固定最近 300 行；UI 提供模块和级别筛选 | 现用 | 读取 `logs/**`；可能暴露 stack/路径 | settings logs page | 保留并适度升级为统一日志页：支持时间、来源、模块、级别、route、requestId、项目/任务和关键词筛选，分页查看完整结构化事件，并可复制单次性能诊断信息；不增加趋势、聚合指标、实时流、复杂关联分析或日志导出平台 |
| `PLAT-016` | 控制台日志查看 | 同页切换读取根 `server.log` 或 `logs/server.log` | 现用 | 依赖启动时重定向 stdout/stderr | settings logs、`/api/logs` | 合并：不再把原始 `server.log` 作为独立页面来源；必要的 stdout/stderr 进入统一结构化日志来源，不提供另一套原始控制台页面 |
| `PLAT-027` | 日志 API 高级过滤 | `/api/logs` 额外支持可变行数、`since` 时间过滤和最多 1000 行；当前页面无对应控件 | 隐藏/运维 | 外部客户端可能使用 | `/api/logs` | 重构为只服务 shared 日志页的内部查询接口，支持与页面一致的时间、来源、模块、级别、route、requestId、项目/任务、关键词和分页参数；不提供实时 tail、聚合性能查询、复杂关联或无约束外部 API |
| `PLAT-017` | 最小健康接口 | `GET /api/health` 只返回进程存活和时间 | 隐藏 | 不检查 DB、文件、ComfyUI；受认证 | `src/app/api/health/route.ts` | 保留并适度扩展：保留轻量 liveness，增加能直接判断可用性的必要 readiness；不加入趋势、时间线或复杂指标 |
| `PLAT-018` | Generation worker 状态 | 队列计数、近期成功/失败、ComfyUI 可达性 | 隐藏/运维 | SSH target 下 GET 可能创建隧道 | `/api/worker/status` | 保留并重做：监控按统一状态机提供准确当前状态和基础积压，至少分别统计未提交、已提交和运行中；近期成功/失败浏览、错误信息和重试操作属于图像生产队列工作台，前端体验需要单独重做 |
| `PLAT-019` | Training worker 状态 | 当前独立汇总三类 worker 队列 | 隐藏/运维 | 用户不应感知 worker/executor 实现 | `/api/training/worker/status` | 移除用户可见 Worker 状态、面板和术语。前端只展示训练素材 Task/TrainingRun 的 pending/running/completed/failed/cancelled、等待原因、进度和任务错误；心跳/执行器故障由后台映射到任务层并写内部日志，内部诊断接口不进入产品 UI |
| `PLAT-020` | ComfyUI 状态监控 | `/settings/monitor` 展示 PID、uptime、健康、日志、GPU/restart 状态 | 现用/运维 | 进程管理器内存状态与 target 配置 | monitor page、`/api/comfy/status` | 保留并重做：图像生产执行器面板只显示当前 target、GPU 可用性、ComfyUI 可达性、是否需要重启/正在恢复、最后检查时间、已提交/运行中数量和最后错误；应用内“未提交”数量属于图像生产任务工作台，不做趋势和复杂观测指标 |
| `PLAT-021` | ComfyUI 手工探测 | 页面触发 health probe 并显示延迟/错误 | 现用/运维 | 可能触发活动 SSH target 的连接逻辑 | `/api/comfy/health-probe` | 新版移除独立 Health Probe 按钮和 API。GPU 状态、ComfyUI 可达性与重启恢复由自动状态检查维护；恢复失败时的“重新尝试”执行 `PLAT-028` 完整恢复流程，不再用 Probe 修补状态 |
| `PLAT-022` | ComfyUI 启停 | 页面可 start/stop；restart API 存在但 UI 未露出 | 现用+隐藏 | 本地进程或 SSH 生命周期命令，高副作用 | `/api/comfy/{start,stop,restart}` | 简化：任务创建和训练切换流程都不提示启动或停止 ComfyUI；不自动启停。图像生产设置保留手工 start/stop/restart，其中 restart 不配置独立命令，而是受控串行执行 stop→确认停止→start→等待健康；stop/restart 必须检查已提交/运行中任务并确认副作用 |
| `PLAT-023` | ComfyUI 自动启动/重启 | 启动时初始化健康监控；可选 auto-start、auto-restart、重启窗口 | 后台 | 环境配置、进程 manager | `comfy-process-manager.ts`、instrumentation | 移除通用自动启动、连续健康失败自动重启、重启时间窗口和次数上限；唯一自动生命周期动作是 `PLAT-028` 在确认 GPU 断开后重新连接时执行一次受控 restart。ComfyUI 普通不可达时任务保持未提交，不触发泛化重启循环 |
| `PLAT-024` | GPU 感知重启 | 可选 `nvidia-smi` 检查，GPU 不可用时延迟重启 | 后台/运维 | NVIDIA 工具与重启配额 | `comfy-gpu-watchdog.ts` | 保留并重构为轻量 GPU 可用性检测：在实际本机或 SSH compute target 上执行固定每 30 秒一次的 `nvidia-smi --list-gpus`，并在任务准备提交或 GPU 恢复前立即检查；只识别 available/unavailable/unknown 及断开→恢复事件，不提供用户频率设置或通用进程 Watchdog |
| `PLAT-025` | Local / SSH ComfyUI target | 活动目标可为本机或 SSH；统一 HTTP/文件/进程抽象 | 后台核心 | 私有 target 配置、SSH/SCP、远端命令 | `comfy-target.ts`、`comfy-ssh.ts` | 保留并重构为 SQLite 中唯一 shared compute target，只能选择本机或 SSH 远程，不提供 Target 列表或多 GPU。本机模式直接执行 GPU 检查；SSH 模式只保存 user@host、端口和本机私钥绝对路径，不保存密码或上传私钥。切换前验证 SSH/GPU，失败不替换当前配置；存在已提交/运行图像任务或 pending/running TrainingRun 时禁止切换。ComfyUI 与训练模块的具体 Adapter 路径仍分别拥有 |
| `PLAT-026` | SSH 自动隧道 | SSH target 可自动建立本地转发，进程内记录归属 | 后台/运维 | 分离式 ssh 进程；服务重启后归属丢失 | `comfy-ssh.ts` | 保留为固定内部实现，不提供普通开关；应用自动选择/占用本地转发端口并按需重建隧道，状态页只显示连接状态和错误。保存 Target 时的连通验证不得启动、停止或重启远程进程 |
| `PLAT-028` | GPU 断开后恢复 ComfyUI | 旧版只有通用 GPU-aware auto-restart，不能表达“应用/ComfyUI 存活但显卡断开后重新连接” | 新版需求 | compute target GPU 探测、Comfy start/stop 命令、任务调度、SQLite 状态 | 无完整实现 | 新增并确认 GPU-1～GPU-6：①在实际 compute target 检测 GPU；②GPU 消失时停止图像提交和 TrainingRun 启动，任务保持 unsubmitted/pending；③在 SQLite 持久化 gpuState、restartRequired、最后检查时间和错误；④GPU 恢复且无真实活动任务时加互斥锁，并只自动执行一次 stop→确认停止→start→等待健康；⑤健康检查通过后清除标记并按训练优先规则恢复调度；⑥恢复失败、GPU unknown、SSH 断开或缺少 start/stop 命令时停止自动尝试，显示错误和手工“重新尝试”。不增加独立 restart 命令或睡眠模式按钮 |
| `PLAT-029` | 慢页面与慢请求诊断 | 当前 Logger 有未接线的 timer/requestId 能力，前端没有 Web Vitals 或页面导航计时 | 新版需求 | Proxy/请求上下文、浏览器 Performance API、结构化日志、日志页 | 无完整实现 | 新增并确认 AF1～AF6：①为页面/API 请求生成全局 requestId 并透传响应头与日志；②记录首次加载/站内跳转的 TTFB、FCP、LCP 和可交互耗时；③记录服务端请求总耗时及 SQLite、文件系统、SSH/远程请求、数据组装等阶段汇总，不记录 SQL/Prompt/Token；④默认启用慢事件诊断，页面加载/服务端请求/内部阶段阈值默认分别为 2500/1000/500ms，可在 shared 设置中修改，只影响是否写日志；⑤日志页可按 route、requestId、项目和任务筛选并复制诊断信息；⑥可测量的 API/数据响应返回 `Server-Timing`。不引入外部 APM、Prometheus、长期趋势或告警平台 |
| `MODEL-001` | 统一模型页 | `/assets/models` 在 checkpoint 与 LoRA 间切换，目录浏览、搜索、面包屑、详情 | 现用/共享 | 本地或远端模型根 | model page/manager | 保留一个 shared 模型管理页，但数据边界改为直接映射当前 compute target 的 ComfyUI `models` 根目录；统一浏览其下 `checkpoints/`、`loras/` 等实际子目录，支持本机/远程目录、搜索、面包屑、详情和真实绝对路径显示，不再分别配置多个模型根 |
| `MODEL-002` | 模型上传 | 上传 checkpoint 或 LoRA 到选择目录 | 现用/写文件 | 本地流写入或 SSH/SCP；元数据 upsert | `/api/models`、`model-asset-service.ts` | 新版移除浏览器上传和上传 API。用户直接在本机或远程机器文件系统中向 ComfyUI `models` 目录写入文件，再使用模型页刷新扫描；LoRA Training checkpoint 的“复制到模型库”是服务器侧直接复制到 `models/loras` 后刷新索引，不属于上传功能 |
| `MODEL-003` | 模型移动 | 文件在目录间移动并同步 DB 路径 | 现用/写文件 | 文件 rename/远端命令与 DB 是两个副作用 | `/api/models/move` | 保留：以拖放到目标文件夹为主要交互，同时保留“移动到”菜单；直接在映射的本机/远程文件系统中移动文件，成功后刷新模型索引路径，失败时不得只更新数据库 |
| `MODEL-004` | 模型备注与 LoRA 元信息 | notes、trigger words、Civitai URL | 现用 | `LoraAsset`，checkpoint/LoRA 共表 | `/api/models/notes` | 保留普通备注、Trigger words 和 Civitai URL，通过普通文本组件及 GET/PATCH API 编辑；Checkpoint 和 LoRA 可显示不同字段 |
| `MODEL-005` | 模型 SHA-256 | API 计算本地或远端模型哈希；当前 UI 不调用 | 隐藏 | 大文件 IO、SSH hash template | `/api/models/hash` | 新版移除当前隐藏且无 UI 调用的 Hash API；不为模型刷新扫描计算大文件哈希 |
| `MODEL-006` | 模型删除 | 当前没有删除 UI/API | 缺失 | 新版若需要需明确文件和 DB 原子性 | 无 | 新版不增加模型文件删除功能或 API。用户只在机器文件系统中删除真实文件；刷新扫描后应用将对应模型记录标为缺失，并按 MODEL-009 单独处理元数据清理或引用替换，不能把“清理缺失记录”误作删除文件 |
| `MODEL-007` | 模型文件夹置顶 | 当前没有置顶能力 | 新版需求 | ComfyUI `models` 子目录、用户偏好 | 无 | 新增：用户可将映射根目录内任意子文件夹置顶、调整置顶顺序或取消置顶；置顶只影响模型页快捷入口和排序，不创建、移动或复制文件夹 |
| `MODEL-008` | 模型目录刷新扫描 | 当前模型服务按接口读取/登记，缺少明确外部文件变更刷新入口 | 新版需求 | 本机/远程 ComfyUI `models` 文件树、模型索引 | 无统一入口 | 新增显式“刷新扫描”：重新扫描映射的 `models` 根目录及子目录，登记新增文件并更新已有文件状态；扫描不到的既有模型记录改为 `missing`，保留备注、Trigger words、Civitai URL 和原业务键，不自动删除或匹配同名文件。扫描不上传、删除或计算 SHA-256 |
| `MODEL-009` | 缺失模型记录处理 | 当前刷新后缺少明确的残留元数据与引用处置 | 新版需求 | 模型元数据、Preset/Template/Section/Project 引用、历史任务快照 | 无 | 新增两个明确动作：①“清理缺失记录”只物理删除 SQLite 中该模型的元数据/索引，不接触文件；存在当前可编辑配置引用时先阻止并列出位置，历史 Task/TrainingRun 快照不阻止清理且保持原路径；②“替换为其他文件”由用户选择当前已扫描的同类型模型，把旧元数据和所有当前可编辑配置引用迁移到新业务键，不移动/复制文件，也不重写历史任务、归档项目或修改历史快照。操作前显示影响范围并确认 |
| `COMPAT-001` | `/assets/loras` 页面前缀 | 只重定向 `/assets/models` | 兼容 | 旧收藏/深链 | `src/app/assets/loras/page.tsx` | 不保留旧页面实现，但将该已知旧地址直接回退到新版 shared 模型页，避免旧收藏落到无关父页面 |
| `COMPAT-002` | `/api/loras/**` | 固定 `kind=lora` 代理统一模型服务 | 兼容/隐藏 | 外部调用者可能仍依赖 | `src/app/api/loras/**` | 新版移除 LoRA 专用代理 API；前端和 Agent 统一使用 shared 模型查询、元数据及刷新扫描 API |
| `COMPAT-003` | 旧 LoRA 上传实现链 | `lora-file-manager`、`lora-upload-form` 无生产 importer；`uploadLora` 只被旧表单使用，`saveUploadedLora` 已无调用方 | 遗留 | 旧组件、server action、上传 service 应作为一个退役单元核对 | 旧 LoRA components、`actions/lora.ts`、`lora-upload-service.ts` | 整体移除旧上传表单、server action、上传 service 和无调用代码，与取消模型上传保持一致 |
| `COMPAT-004` | `/api/path-maps` 残余 | 旧上传 service 只剩 `getUploadMeta()` 被本 route 使用，返回 LoRA 上传路径是否配置 | 隐藏/遗留 | 当前 UI 无调用方 | path-maps route、lora-upload-service | 新版移除：模型模块只映射当前 ComfyUI `models` 根目录，不再暴露旧上传路径配置状态 |
| `MEDIA-001` | 受保护图片投递 | `/api/images/[...path]` 流式返回 png/jpg/jpeg/webp/gif，阻止穿越和临时文件 | 后台核心/共享 | `data/images` 或 `OUTPUT_BASE_PATH` | image route、`image-url.ts` | 保留底层安全文件响应能力但删除无资源身份的 `/api/images/**` 路径；分别通过 `/api/image-production/images/:imageId/content` 与 `/api/lora-training/images/:imageId/content` 等所属模块资源路由读取，服务端按数据库身份解析受管 Artifact。继续限制文件根、格式、临时文件和路径穿越；浏览器使用登录会话，跨网络客户端使用 Bearer Token |
| `MEDIA-002` | 图片长期缓存 | 返回 `public, immutable` 缓存头并用版本查询参数刷新 | 后台 | 与认证代理/反向缓存策略耦合 | image route | 保留版本化 URL 和长期缓存，但从 `public` 改为 `private, immutable`，避免认证图片进入共享代理缓存；图片内容变化时更换版本参数 |
| `AUDIT-001` | 审计日志写入 | 用户、Agent、系统关键操作 fire-and-forget 写日志 | 后台 | `AuditLog`；失败不阻断业务 | `audit-service.ts` | 保留关键写操作审计，记录时间、操作者类型、动作、目标实体和结果；不记录完整 Prompt、图片内容、Token 或大段请求体。审计写入失败进入应用日志，但不阻断正常业务操作 |
| `AUDIT-002` | 审计日志查询 | `/api/audit-logs` 按实体、动作和数量查询；无 UI | 隐藏/运维 | 可能含业务 payload | audit route | 保留为监控与日志模块中的筛选视图，正式接口为 `/api/monitoring/audit-events`，支持按时间、操作者、实体、动作、项目和任务过滤；删除旧 `/api/audit-logs`，不建设独立审计产品或无约束查询 API |
| `AUTO-001` | Generation Agent HTTP API | 10 个 `/api/agent/**`：项目/运行上下文、更新、运行、变体同步、审核 | 隐藏/外部自动化 | 全局 token；写 Generation 数据与 AuditLog | `src/app/api/agent/**` | 新版移除 `/api/agent/**`；Agent 与前端使用相同的 `/api/image-production/**` 领域 API、Token 鉴权、校验和审计，不维护第二套写路径 |
| `AUTO-002` | MCP Streamable HTTP | `/api/mcp` GET/POST/DELETE，无状态 transport | 隐藏/外部自动化 | MCP SDK、全局 token | MCP route | 移除：新版删除 MCP route、transport 和 SDK 接入 |
| `AUTO-003` | MCP 项目/运行工具 | 项目列表/更新、小节更新、整项目/小节运行、图片审核 | 隐藏/可写 | Project/Section/Run/ImageResult | `src/server/mcp/server.ts` | 移除：随 MCP 模块整体删除 |
| `AUTO-004` | MCP 提示块工具 | list/add/update/remove/reorder prompt blocks | 隐藏/可写 | SectionPromptBlock 与 preset 绑定语义 | MCP server | 移除：随 MCP 模块整体删除 |
| `AUTO-005` | MCP 资源 | project context、run context、section blocks 三类资源 | 隐藏/只读 | 同一 Generation DB | MCP server | 移除：随 MCP 模块整体删除 |
| `COMPAT-005` | API 响应多形态 | 新 envelope、flat auth/legacy、二进制图片、MCP 各自不同 | 兼容负担 | 新前端必须通过 adapter 处理 | `api-response.ts`、route handlers | 普通 JSON API 统一为一种响应结构；图片、ZIP、Workflow 等文件下载继续返回对应二进制响应。删除 legacy flat/MCP 响应适配 |
| `COMPAT-006` | 通用路由 fallback | 旧 `/assets`、预制组、模板深链逐级退到父路由或 `/queue` | 兼容 | 会掩盖真实 404 和被删除功能 | `not-found.tsx`、`route-fallback.ts` | 保留并重做为页面级尽力路由回退，不提供独立 404 页面：未知或失效的深层页面路径逐级回退到最近可用父级，例如 `/abc/some-bad-path` 回到 `/abc`；没有已知父级时回到应用首页。不得跨业务模块固定跳转到 `/queue`。API、文件和领域资源请求不应用页面回退，仍返回明确的标准错误 |
| `COMPAT-007` | Section 范围 trash 查询 | `GET /api/sections/[sectionId]/trash` 已实现但无当前生产调用方 | 隐藏/兼容候选 | Section TrashRecord | section trash route | 保留能力并重做接口：新版回收站同时提供全局、项目和 Section 范围；Section 接口纳入正式回收站协议，不保留当前孤立兼容实现 |
| `ARCH-001` | Training 对 Demo Shell 依赖 | 38 个 Training TSX 中 34 个导入 `design-demo-ui`，12 个还导入 demo shell/routing | 技术债/旧实现 | 旧代码依赖图，仅供重建能力核对 | Training shell、design-demo UI | 新版按 MIG-01 从全新工程实现两个对等模块，不导入 `/design-demos/**`、DesignDemoShell、design-demo-ui、DemoData、注册表或 Demo 专属测试/夹具。旧依赖关系不再构成新版建设的前置迁移步骤；只保留已确认的总体视觉方向 |
| `ARCH-002` | 根布局依赖 Demo theme | 根 `layout.tsx` 读取 design-demo theme Cookie | 技术债 | 影响全站 HTML 属性 | root layout | 重构：根布局只承载 shared 平台能力，不读取任何业务模块或 Demo 专属主题状态；迁移后连同 Design Demo 主题 Cookie、Provider 和样式一起删除 |
| `ARCH-003` | 跨模块共同实体关系 | 当前 Project、Run、Preset、Template、Artifact 在两个模块中名称相近但模型和生命周期不同 | 新版领域约束 | 需要 shared identity、显式关系与模块聚合边界，不能直接合表或交叉 fallback | 两套 Prisma 领域模型、resource boundary | 按 SI-01～SI-10 收口：Project、Task、Preset、Template 和图片 Artifact 都由各模块拥有，不因同名而合表；模型文件、认证、设置、修改历史基础设施、通知、日志和中性 UI 协议属于 shared，禁止跨模块 fallback 或交叉读取业务表 |
| `ARCH-004` | 共同依赖平台层 | 模型、认证、媒体、设置、通知等被两个模块共同使用 | 新版平台约束 | 若归属任一业务模块会重新产生主次关系 | shared routes/components/services | 保留并重构：建立独立 shared 平台接口，两个业务模块作为完全对等的消费者 |
| `ARCH-005` | 单 compute target 与 GPU 占用 | 当前 ComfyUI target、Training runner 和 GpuTaskLock 分散表达同一物理 GPU 资源 | 新版平台约束 | 图像生产与 LoRA 训练竞争唯一远程或本地 GPU | target config、training runner、GpuTaskLock | 保留唯一 compute target，但按 SD-09 删除独立 GpuTaskLock：跨模块协调服务在同一 SQLite 事务中检查 TrainingRun 与图像 Task/Attempt 状态并领取提交/启动权。图像 submitted/running 或内部提交 claim 存在时拒绝启动训练；TrainingRun pending/running 时不再领取新的图像提交。未提交或已暂停图像任务不阻止训练，ComfyUI 空闲进程不算占用；GPU unavailable 或 restartRequired 时两类新执行都等待。状态本身即权威占用信息，不再维护可能失效的第二套锁记录 |
| `ARCH-006` | 图像生产任务状态机 | 当前 `queued` 同时表示应用已创建但尚未提交、ComfyUI 已接收后排队，`comfyPromptId` 被迫承担隐式分界 | 新版领域约束 | 队列 UI、调度、恢复、重试、取消、监控都依赖一致语义 | `RunStatus`、`Run.comfyPromptId`、run executor | 保留并重构：基础状态为 `unsubmitted`（未提交）、`submitted`（已提交）、`running`（运行中）、`paused`（已暂停）、`completed`（已完成）、`failed`（失败）、`cancelled`（已取消）。稳定的任务保存不可变输入快照和当前状态；每次真正提交/执行保存为该任务下的内部 Attempt，`comfyPromptId`、本次错误与执行时间属于 Attempt。失败重试不新建任务，只把原任务重置为 `unsubmitted`，下一次实际提交时再新增 Attempt；修改 Section 输入或参数后再次生成则创建新任务。应用与 ComfyUI/显卡连接共同中断后，若重启时找不到旧 prompt，则把旧 Attempt 记为 interrupted 并将同一任务自动退回 `unsubmitted`，不记为业务失败。暂停已提交/运行中任务时先精确撤销或中断 ComfyUI prompt，确认不再占用 GPU 后转为 `paused`；恢复时回到 `unsubmitted` 并从头重新执行。所有状态转换持久化并由领域服务校验，UI 按状态分类展示，不再创建独立“缓冲队列”概念 |
| `ARCH-007` | 跨模块任务状态协议 | 图像生产 Run、TrainingGenerationTask、TrainingRun 和内部 dataset worker 各自使用不一致的 queued/running/done/failed 映射 | 新版领域约束 | 只有真正交给 executor 的工作才应建模为任务；Agent/用户编辑内容不应为了统一而伪装成队列 | 两套 Run/Task 模型、training worker adapters | 保留并重构：shared 层只为真实可执行任务定义身份、基础状态语义、时间字段、等待原因、错误、执行尝试历史、阶段累计耗时和查询/批量操作协议；消费者为图像生产任务、训练素材生成任务、LoRA TrainingRun 和批量打码任务。角色分析、Prompt、Caption 等普通内容不进入任务状态机；共享协议不等于共享数据表，也不要求执行器能力完全相同 |
| `ARCH-008` | 跨模块 Preset Binding 协议 | 图像生产已有 SectionPresetBinding/PromptBlock，Training 当前有另一套 SceneDescription Block | 新版平台约束 | 两模块都需要 Preset 绑定、排序、detach、resolved preview 和任务快照，但内容维度不同 | Preset/Binding/Prompt services | 保留并统一抽象：shared 提供有序 PromptSegment、PresetBinding、CustomText、detach、resolved preview 与快照协议及 UI 组件；图像生产 Preset 可解析正向/负向/LoRA/参数，Training Preset 解析 generationPromptText/可选 captionText。Preset Group 始终是多个独立 PresetBinding 的有序组合：Group 关系可管理成员与整组操作，但不得把多个 Preset 内容融合成一个 Segment。Preset、Binding 和业务数据仍由各模块拥有，不强制共表或跨模块引用 |
| `ARCH-009` | 跨模块统一项目创建流程 | 当前空白创建、模板创建和部分复制入口分散 | 新版平台约束 | 图像生产与 LoRA 训练都需要可选 Template、元信息预填和创建时深复制 | project create forms/services | 保留并统一交互协议：两个模块各只有一个“新建项目”入口；表单内可选 Template，选择后先预填可编辑的项目元信息和默认参数，用户确认创建时再深复制 Template Sections/Bindings/CustomText/参数。未选 Template 则创建空白项目；创建后项目与 Template 不实时同步，但仍绑定的 Preset 按各模块 Binding 规则解析 |
| `ARCH-010` | 跨模块任务耗时协议 | 当前各任务只零散保存 startedAt/finishedAt/elapsedMs，无法区分等待、外部队列、执行和暂停耗时 | 新版平台约束 | 图像生产 Task/Attempt、训练素材 Task/Attempt、TrainingRun、CensoringBatchTask | 无统一协议 | 新增统一计时协议：每类任务保存 `createdAt`、`stateEnteredAt`、`finishedAt` 及适用状态的累计毫秒数，状态转换时原子累加；总耗时在读取时派生，不复制易漂移的第二真相。用户可见活动任务显示当前已用时间，终态显示总耗时和阶段拆分；任务终态写一条 `task_timing` 结构化日志。不同执行器只实现适用阶段，不强制相同状态集合 |

### A1. Shared 设置细化决策

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `SH-01` | 设置持久化边界 | shared | 启动必需配置使用环境变量，可动态修改的应用设置存 SQLite，主题/SFW/导航等个人偏好存浏览器；三者不得互相 fallback |
| `SH-02` | 单 Token | 环境变量 | `AUTH_TOKEN` 只通过环境变量配置，不在 SQLite 保存，也不允许网页查看或修改原值；设置页只显示已配置/未配置并提供注销 |
| `SH-03` | 登录有效期 | 固定协议 | 浏览器登录固定使用 30 天 HttpOnly Cookie，不增加有效期设置；注销立即清除 Cookie，API Token 不受 Cookie 有效期影响 |
| `SH-04` | 主题 | 浏览器偏好 | 未保存人工选择时实时跟随操作系统深浅模式，不设默认深色或浅色；用户手工选择深色/浅色后长期保持，直到明确执行“改为跟随系统”。两个模块共用同一偏好但使用各自强调色，不跨浏览器或设备同步，也不使用永久三态主选择器 |
| `SH-05` | SFW | 浏览器偏好 | 全局 SFW 默认关闭，同时作用于两个模块并保存在浏览器，不写数据库或跨设备同步 |
| `SH-06` | 应用数据根目录 | 环境变量 | 新增必填 `APP_DATA_ROOT`；网页只读显示/复制。SQLite、项目媒体、训练文件、临时文件和日志从该根派生，不允许在线修改根目录或 SQLite 路径；导出目录遵循独立交付规则 |
| `SH-07` | 日志配置 | SQLite 动态设置 | 文件固定 JSON、控制台固定友好文本；允许修改最低级别、单文件大小和保留文件数，默认 info/10MB/5；日志目录只读展示，不提供格式切换或实时 tail |
| `SH-08` | 慢事件阈值 | SQLite 动态设置 | 默认启用慢事件诊断；页面加载、服务端请求、内部阶段默认阈值分别为 2500/1000/500ms，可在线修改，只影响是否记录 `performance` 日志，不影响请求执行 |

### A2. Shared compute target 设置细化决策

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `CT-01` | Target 数量与模式 | shared / SQLite | 全应用固定一个 compute target，只能为本机或 SSH 远程；不提供 Target 列表、多 GPU 或负载均衡 |
| `CT-02` | 本机模式 | shared / SQLite | 不显示 SSH 字段，GPU 检查在应用机器执行；ComfyUI 与训练模块分别配置本机 Adapter 路径 |
| `CT-03` | SSH 连接 | shared / SQLite | 配置 user@host、端口和本机私钥绝对路径；不支持网页上传私钥或保存 SSH 密码，私钥路径允许认证用户查看/复制 |
| `CT-04` | SSH 隧道 | shared 内部实现 | 固定自动管理，不提供普通开关；自动选择/占用本地转发端口并按需重建，状态页显示连接错误 |
| `CT-05` | 保存与切换 | shared / SQLite | 保存前只验证 SSH 连通和目标 `nvidia-smi`，不得启动/停止/重启进程；验证失败不替换当前配置。存在 submitted/running 图像任务或 pending/running TrainingRun 时禁止切换 |
| `CT-06` | GPU 检查频率 | shared 固定协议 | 每 30 秒低频执行一次，并在任务准备提交或 GPU 恢复前立即检查；命令固定为目标机器 `nvidia-smi --list-gpus`，不提供用户设置 |
| `CT-07` | GPU 恢复状态 | shared / SQLite | 持久化 gpuState、restartRequired、最后检查时间和最后错误；GPU 恢复且 ComfyUI restart 成功后清除 restartRequired |
| `CT-08` | 历史 Target 快照 | 模块任务数据 | Task、TrainingRun 和文件记录保存执行时实际目标及绝对路径快照；修改当前 Target 不重写历史记录 |
| `CT-09` | 模块边界 | shared | Shared Target 不保存 ComfyUI API/根目录/start-stop 命令，也不保存 Python/sd-scripts/staging/checkpoint 路径；由对应模块拥有 |

### A3. 图像生产 ComfyUI Adapter、Workflow 与任务提交设置

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `IP-01` | ComfyUI API | image-production / SQLite | 本机模式配置完整 API URL；SSH 模式配置远程 API Host/Port，本地转发 URL 由 Shared Target 自动生成 |
| `IP-02` | ComfyUI 根目录 | image-production / SQLite | 配置目标机器真实绝对根目录；模型目录固定派生为 `<ComfyUI 根>/models`，输出目录默认 `<ComfyUI 根>/output` 且允许单独覆盖；路径向认证用户显示/复制 |
| `IP-03` | 进程命令 | image-production / SQLite | 配置可选 start、stop 命令，本机模式另配命令工作目录；不配置独立 restart。自动 GPU 恢复和手工 restart 都串行执行 stop→确认停止→start→等待健康；缺少任一命令时只提示手工处理 |
| `IP-04` | Workflow 文件目录 | image-production / 文件系统 | 固定 `<APP_DATA_ROOT>/workflows/image-production`；用户通过机器文件系统添加/更新 JSON 后刷新扫描，不提供浏览器上传或在线编辑 |
| `IP-05` | 当前 Workflow | image-production / SQLite | 从扫描且验证通过的 Workflow 中选择唯一当前版本；切换只影响之后创建的任务，历史任务使用自身 Workflow 快照 |
| `IP-06` | Workflow 验证 | image-production | 扫描时解析 JSON 并检查新版注入协议所需节点；失败文件显示错误且不能激活，原始/调试 Workflow 下载保持不变 |
| `IP-07` | 图像任务提交 | image-production 固定协议 | 不限制 ComfyUI 队列中 submitted 任务数量；条件允许时按应用顺序把所有 unsubmitted 任务提交到 ComfyUI 自有队列。仅对 HTTP 提交请求做内部有界并发/批处理，不能作为业务并发上限；TrainingRun pending 后停止继续提交，已经 submitted/running 的任务仍按既定互斥规则处理 |
| `IP-08` | 状态同步与超时 | image-production 固定协议 | ComfyUI WebSocket 只负责即时执行/进度事件；存在 submitted/running 任务时，系统后台固定每 1 秒执行一次 HTTP queue/history 权威对账，不使用 500ms fallback 或 250ms 队列缓存。没有活动任务时停止队列轮询，只维持 WebSocket reconnect 与 shared GPU 检查；请求超时固定 10 秒，不提供用户频率设置 |
| `IP-09` | 手工 start/stop/restart | image-production | 只出现在模块设置，不进入任务创建流程；存在真实 submitted/running 图像任务或 running TrainingRun 时禁止 stop/restart。restart 复用 IP-03 的 stop/start 串行流程，操作前显示影响并确认 |
| `IP-10` | 设置持久化 | image-production | API、路径、命令和当前 Workflow 存 SQLite；Workflow JSON 存应用数据目录；不再从多组环境变量和旧 target JSON 互相 fallback |

### A4. 图像生产自动打码与导出设置

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `IC-01` | 自动打码运行时 | image-production / 应用依赖 | Python 运行时、Ultralytics、OpenCV 和 Pillow 作为应用随附且版本固定的自包含依赖安装，不提供 Python/venv 路径设置，也不依赖用户机器预装环境 |
| `IC-02` | YOLO 模型 | image-production / SQLite | 配置应用机器上的 `.pt` 模型绝对路径；网页显示、复制并在实际执行时检查文件存在，不提供上传 |
| `IC-03` | 环境验证 | image-production | 不提供用户主动“验证环境”操作；创建打码任务不预跑 Python，真正领取/执行失败时将缺少运行时、依赖或模型等原因写入任务错误并允许复制 |
| `IC-04` | 马赛克尺寸 | image-production / SQLite | 手工与自动打码共用一个值，默认 100、最小 20；修改只影响之后生成的打码版本 |
| `IC-05` | Python 批量大小 | image-production / SQLite | 允许设置一次交给 Python 的图片数，默认 64；只影响内部处理效率，不改变一个用户任务对应一个批次的领域模型 |
| `IC-06` | 检测类别 | image-production 固定协议 | 保持旧版固定类别 `[2,4]`，不向普通设置暴露技术类别 ID；只支持与该类别合同兼容的 YOLO 模型 |
| `IC-07` | 推理设备 | image-production 固定协议 | 固定在应用机器使用 CPU，避免自动打码与唯一 GPU 上的生成/训练竞争；不增加 CPU/GPU 设备选择 |
| `EX-01` | 导出根目录 | image-production / 环境变量 | 新增启动配置 `EXPORT_ROOT`，默认 `<APP_DATA_ROOT>/exports`；网页只读显示/复制，不允许在线修改，项目删除不清理其中交付包 |
| `EX-02` | JPEG 质量 | image-production / SQLite | 允许调整，默认 90、范围 1～100；同一次打包的普通图、P站、预览和封面统一使用该值 |
| `EX-03` | 文件结构 | image-production 固定协议 | 固定 `<slug>.zip`、`<slug>_01.jpg`、`pixiv/`、`preview/`、`cover.jpg`、`cover_censored.jpg`，不提供命名设置 |
| `EX-04` | 导出版本 | image-production 固定协议 | 每个项目只保留并覆盖最新打包结果，不维护历史导出版本或相关设置 |

### A5. LoRA 训练素材图片 Provider 设置

2026-09-02 对 OpenAI 官方图片生成文档、当前 Codex 图片桥接和 `D:\Luca\Code\MyProject\gpt-image-2-generator` 做了只读复核。官方 `gpt-image-2` 确实支持 `size`、`quality` 和 `background`；`aspect` 不是独立官方参数，只能作为界面快捷选择换算为 `size`。Image API 虽支持 `n=1..10`，当前应用实际使用的 Responses/Codex bridge 没有传 `n`，且一次调用只提取一张最终图片。Generator 的 274 条历史任务也只持久化 `size/quality/background`，每条任务只有一个输出；实际参数为 160 条 `1024x1536/high/opaque`、113 条 `1536x1024/high/opaque` 和 1 条 `1024x1024/high/opaque`。269 次成功 Attempt 耗时为 45.8～242.2 秒，P95 约 190.6 秒，没有超过 300 秒。官方只说明复杂 Prompt 可能耗时约两分钟，并未规定 600 秒超时；600 秒是现有本地配置，不是官方限制。

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `TG-01` | Provider | lora-training 固定协议 | 生产固定使用 `openai-codex`，图片模型固定 `gpt-image-2`；不提供 Provider 或图片模型选择器 |
| `TG-02` | Python Bridge | lora-training / 应用依赖 | `codex_gpt_image2.py`、Python 运行时及其依赖作为应用随附运行时，不提供 Python 或脚本路径设置 |
| `TG-03` | Codex 鉴权 | 环境变量 | 只通过启动环境变量 `CODEX_IMAGE_AUTH_FILE` 指向认证 JSON；不存 SQLite、不上传、不显示文件内容。设置页只显示是否配置及文件是否存在 |
| `TG-04` | Base URL 与宿主模型 | lora-training 固定协议 | Codex Base URL 和宿主模型固定为应用支持值，不放入普通设置；升级时随应用版本一起调整 |
| `TG-05` | 图片参数来源 | Template / Project / Section | 只持久化真实请求参数 `size`、`quality`、`background`；界面可将横向、纵向、方形等快捷选项即时换算成 `size`，不再保存独立 `aspect`。候选数量是 Section 的产品参数，不是 Provider 参数。以上参数继续按 TrainingTemplate → TrainingProject → Section 继承，不在 Provider 设置中维护另一套默认值 |
| `TG-06` | 超时 | lora-training 固定协议 | 每个独立候选图片的 Provider 调用固定使用 300 秒超时，不提供用户设置；这不是官方规定值，而是官方约两分钟延迟说明、Generator 历史最大 242.2 秒和现有 bridge 300 秒默认值之间的应用保护边界。超时作为同一生成 Task 的可重试技术错误记录 |
| `TG-07` | 输出位置 | lora-training 固定协议 | 固定写入当前 TrainingProject 的项目媒体区，由 Artifact/TrainingImageResult 管理；不允许配置输出路径模板 |
| `TG-08` | 执行并发与多候选 | lora-training 固定协议 | 执行器一次只领取一个训练素材生成 Task，不提供 Worker 数量或并发设置；一个 Task 的候选数量通过若干次“一次一张”的 Provider 调用实现，结果仍统一属于该 Task，不谎称 bridge 支持 Image API 的 `n`。候选调用如何做内部有界调度属于实现细节，不成为业务设置；该任务不占用 shared GPU 锁 |
| `TG-09` | 可用性检查 | lora-training | 不提供用户主动测试按钮。内部执行器启动时自动检查认证文件和 Provider 基本可用性；不可用时不领取任务，pending 任务显示“训练素材生成环境不可用”及错误 |

### A6. LoRA 训练执行器与机器设置

2026-09-02 对现有 `D:\\Luca\\Code\\LoRATraining` 后端做了只读核对：当前 `run_manager_training.cmd` 硬编码 Python、`sd-scripts`、Accelerate、数据库和 checkpoint 路径，再由 Python Runner 直接读取 Manager SQLite 并启动 `sdxl_train_network.py`。新版保留 `sd-scripts + Accelerate` 的轻量执行路线，但删除任意 shell command、Runner 直读数据库和多处硬编码路径；执行器只消费应用下发的 TrainingRun 快照，并通过正式接口回报进度、checkpoint 和结果。

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `LE-01` | 执行位置 | shared compute target | 始终使用全应用唯一 compute target：本机模式在本机训练，SSH 模式在远程 GPU 机器训练；不增加独立训练 Target 或 Target 选择器 |
| `LE-02` | Python 环境 | lora-training / SQLite | 配置目标机器上训练 venv 的 Python 绝对路径并向认证用户显示；CUDA、PyTorch、bitsandbytes 等与目标显卡和驱动相关，不随 Web 应用打包 |
| `LE-03` | sd-scripts | lora-training / 应用依赖 | `sd-scripts` 作为应用锁定版本的依赖随应用安装和升级，不提供根目录或入口脚本路径设置；入口固定为随附版本的 `sdxl_train_network.py`。本机直接使用随附副本；SSH 模式由应用把同一版本同步到目标训练根下的受管运行时目录，用户不需要预装或指定路径 |
| `LE-04` | Accelerate | lora-training 固定协议 | 不要求配置 `default_config.yaml` 路径；应用按单机、单 GPU、单进程设置为每次 TrainingRun 生成 Accelerate 配置 |
| `LE-05` | 训练工作区 | lora-training / SQLite | 配置目标机器上的训练数据根目录；应用在其下按 TrainingRun 派生 staging、TOML、日志和 checkpoint 目录，所有本机/远程绝对路径可查看和复制 |
| `LE-06` | Base checkpoint | shared 模型管理 | 只能从 shared 模型管理模块选择，不配置执行器默认 checkpoint 路径，也不允许手填任意绝对路径 |
| `LE-07` | 启动方式 | lora-training 固定协议 | 删除任意 `TRAINING_RUNNER_COMMAND`；应用直接构造并启动 `Python -m accelerate.commands.launch ...`，本机直接创建受管进程，远程通过受管 SSH 创建进程。执行器不得直接读取应用 SQLite |
| `LE-08` | 机器参数 | lora-training / SQLite | 当前真实训练环境使用 `bf16`，不是旧清单误写的固定 `fp16`。只提供机器级 `bf16/fp16` 选择，默认 `bf16`；SDPA、gradient checkpointing、缓存和单进程固定启用，不在每次 TrainingRun 重复暴露 |
| `LE-09` | 进度与 checkpoint | lora-training 固定协议 | 逐行读取训练输出；进度最多每 2 秒写回一次，发现 checkpoint 后立即登记。刷新频率属于内部协议，不提供设置 |
| `LE-10` | 超时与取消 | lora-training 固定协议 | 训练不设置总时长超时，以最大训练步数结束；用户取消时必须终止该 TrainingRun 的精确进程树，不得停止其他 Python、Node 或训练进程 |
| `LE-11` | 环境检查 | lora-training | 不提供主动测试按钮；TrainingRun 准备执行时检查 Python、Accelerate、随附 sd-scripts、CUDA 和已选 Base checkpoint。环境不可用时保持 pending，并显示具体等待原因 |

### A7. Shared 修改历史协议

修改历史与审计日志职责分离：修改历史用于查看差异和恢复可编辑业务内容；审计日志用于记录谁在何时执行了什么操作。Shared 只统一记录、查询、分页和通用界面，不直接理解或任意修改各模块业务表；图像生产与 LoRA 训练分别注册自己的快照、校验、摘要和恢复处理器。

| ID | 能力 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `RV-01` | 与审计日志的边界 | shared | 修改历史用于差异和恢复；审计日志用于操作追踪。一次可恢复修改可以同时产生一条 RevisionEntry 和一条 AuditLog，但两者不共享 payload，也不能互相替代 |
| `RV-02` | 统一模型与领域适配 | shared + 模块处理器 | 删除 `SectionChangeLog`、`PresetChangeLog`、`PresetGroupChangeLog`、`TrainingTextRevision` 等专属记录模型，改用一个 shared `RevisionEntry` 表；shared 根据 module/resourceType/scope 路由到模块注册的 capture、validate、summarize 和 restore 处理器，绝不直接按 JSON 任意更新业务表 |
| `RV-03` | 图像生产覆盖范围 | image-production adapter | 覆盖 Section 的 Prompt、LoRA 和生成参数，以及 Preset、Variant、Group、Template 的可编辑配置；项目名称、文件夹移动等普通元数据只写审计，不提供恢复 |
| `RV-04` | LoRA 训练覆盖范围 | lora-training adapter | 覆盖三个角色文本、Section Caption、Prompt Segment、输入图片关系、Provider 参数、代表图片，以及 Prompt Preset、Template 的可编辑配置 |
| `RV-05` | 排除范围 | shared 固定协议 | Task、Attempt、TrainingRun、checkpoint 和图片字节不创建修改历史；它们使用不可变快照或自身生命周期。删除、回收站和任务状态变化只写审计 |
| `RV-06` | 记录时机与粒度 | 模块领域事务 | 每次成功的新增、编辑、删除、排序、绑定或解绑请求最多产生一条对应逻辑范围的记录；无实际变化时不记录。只记录明确保存的语义操作，不记录每次键盘输入、后台进度、idle checkpoint、start training 或 dataset freeze 等伪修订原因 |
| `RV-07` | RevisionEntry 内容 | shared / SQLite | 每条保存 module、resourceType、resourceId、scope、schemaVersion、单份完整 snapshot、summary、actorType 和 createdAt；不同时保存 before/after。差异在读取时与相邻快照或当前状态计算，图片、完整任务 payload、Token 和秘密不得进入 snapshot |
| `RV-08` | 恢复 | 模块领域事务 | 恢复只作用于该记录的逻辑范围；模块处理器先验证实体、schemaVersion 和领域约束，再在同一事务中保存当前状态的新 RevisionEntry 并应用目标快照，因此恢复后仍可撤销。shared 不绕过模块服务直接写库 |
| `RV-09` | 保留策略 | shared / SQLite | 不设数量或时间上限，不自动删除；按 resourceType、resourceId、scope、createdAt 建索引并强制分页。归档项目保留历史，彻底删除资源时由模块删除事务同步删除对应 RevisionEntry；只有实际体积形成负担后才另行设计手工清理能力 |
| `RV-10` | 界面与 HTTP 接口 | shared UI + 模块 API | 在具体编辑页提供统一“修改历史”抽屉，展示时间、操作者、摘要和差异并支持恢复，不建设全局历史中心。前端与 Agent 共用规范的历史查询、详情和恢复 HTTP 接口，恢复仍进入对应模块处理器和审计流程 |

### A8. Shared 实体与跨模块关系

“Shared”只用于生命周期确实跨模块的资源与基础协议，不因两个模块都出现 Project、Task、Preset、Template 或 Artifact 等名称就强行共表。图像生产与 LoRA 训练保持对等，但对等不表示业务实体和功能必须完全相同。

| ID | 关系 | 所有权 | 决策 |
| --- | --- | --- | --- |
| `SI-01` | 项目身份 | 两个业务模块 | 不建立 shared Project；分别使用 ImageProductionProject 与 LoraTrainingProject，各自拥有数据库、API、路由和生命周期 |
| `SI-02` | 两类项目直接关联 | 无 | 不增加项目外键。训练 checkpoint 经用户复制并由模型模块扫描后成为独立模型文件，图像生产只引用 shared 模型业务键；复制后的模型与原训练项目完全解绑 |
| `SI-03` | 项目通用界面 | shared UI primitives | 只复用项目卡片、排序、归档提示等中性组件，不复用或交叉调用另一模块的具体页面、服务或数据库实体 |
| `SI-04` | 模型资源 | shared 模型模块 | 模型文件是真正 shared 的业务资源；模型模块直接扫描当前 compute target 的 ComfyUI `models` 根目录，统一向两个模块提供 checkpoint、LoRA 等文件选择能力 |
| `SI-05` | 模型文件身份与任务快照 | shared 模型模块 + 模块配置 | 使用“模型类型 + 相对 `models` 根目录路径”作为业务键；文件移动后由受管移动操作更新当前可编辑引用。Project、Section、Preset 和 Template 保存业务键，Task/TrainingRun 创建时保存实际绝对路径快照，之后不得随当前文件位置改写 |
| `SI-06` | 模型元数据与缺失处置 | shared 模型模块 / SQLite | 普通备注、Trigger words、Civitai URL 和缺失状态按模型业务键保存；扫描不到时保留记录并显示缺失，不自动换成同名文件。按 MODEL-009 支持清理无当前引用的缺失记录，或由用户选择同类型文件替换旧记录及当前可编辑引用；历史快照永不重写 |
| `SI-07` | 图片与 Artifact | 各业务模块 / 项目 | 不建立跨模块、跨项目的全局图片库或全局 Hash 去重；各项目只在自身范围内保证同一字节不重复保存并管理引用生命周期。Shared 只提供安全读取、缩略图和文件操作基础设施 |
| `SI-08` | Preset 与 Template | 两个业务模块 | 两模块分别拥有自己的 Preset、Group 和 Template；可以共享编辑器基础组件与修改历史协议，但不共享业务表或允许跨模块绑定 |
| `SI-09` | 任务实体 | 两个业务模块 + shared 协议 | 图像生产 Task、训练素材生成 Task、TrainingRun 分别建模；只共享状态展示、耗时记录、通知和日志协议，不合并为万能 Task 表 |
| `SI-10` | 跨模块归档与删除 | 两个业务模块 | 归档或删除任一项目不得级联修改另一模块。项目对 shared 模型只保存引用，模型模块不提供应用内文件删除，因此项目删除也不得删除 ComfyUI 模型文件 |

### A9. Shared 最终领域模型

Shared 数据模型只保存真正跨模块的配置、资源索引和平台记录；模块专属设置、项目、任务、Preset、Template、图片关系和业务状态不得塞入 shared 表。所有动态设置继续使用结构化列或结构化单例记录，不建立任意 key-value 配置系统。

| ID | 领域模型 | 形态 | 决策 |
| --- | --- | --- | --- |
| `SD-01` | `SharedSettings` | SQLite 单例 | 保存日志最低级别、轮转大小/数量和页面、服务端请求、内部阶段的慢事件阈值；使用明确结构和校验，不使用任意 key-value 表 |
| `SD-02` | `ComputeTarget` | SQLite 单例 | 保存当前 local/SSH 模式、SSH user/host/port/私钥路径及目标身份；全应用最多一条当前配置，不提供 Target 列表 |
| `SD-03` | `ComputeTargetState` | SQLite 单例运行状态 | 与 ComputeTarget 配置分开，保存 gpuState、restartRequired、最后检查/恢复时间和最后错误；频繁状态变化不得改写配置记录 |
| `SD-04` | `ModelFileRecord` | SQLite 文件投影 | 以 modelKind + relativePath 为唯一业务键，保存 present/missing 状态、普通备注、Trigger words、Civitai URL、最近扫描时间等元数据；取代旧 LoraAsset 身份，同时覆盖 checkpoint、LoRA 和其他已支持模型类型 |
| `SD-05` | `PinnedModelFolder` | SQLite 有序关系 | 保存相对 ComfyUI `models` 根目录的文件夹路径和置顶顺序；目录缺失时保留记录并显示缺失，用户可取消置顶 |
| `SD-06` | `RevisionEntry` | SQLite 通用记录 | 使用 RV-01～RV-10 的单快照模型；shared 负责记录、索引、分页和路由，模块处理器负责捕获、校验、摘要与恢复 |
| `SD-07` | `AuditLog` | SQLite 追加记录 | 只保存操作者、动作、目标、结果和时间等最小审计信息，不保存完整业务快照、Prompt、图片、Token 或秘密；与 RevisionEntry 独立 |
| `SD-08` | 非数据库状态 | 环境变量 / 浏览器 / 文件 | AUTH_TOKEN、APP_DATA_ROOT、EXPORT_ROOT 和 Codex auth 文件指针来自环境变量；主题、SFW、导航偏好在浏览器；结构化日志写轮转文件，不建立数据库副本或 fallback |
| `SD-09` | GPU 协调 | 无独立表 | 删除 GpuTaskLock。协调服务通过图像 Task/Attempt 的 submitted/running/提交 claim 和 TrainingRun pending/running 状态，在同一 SQLite 事务内决定提交或训练启动；状态记录本身是唯一真相 |

### A10. 图像生产最终领域模型

新版使用明确的 ImageProduction 命名空间；旧 `Project`、`Run`、`ImageResult`、`CensoringTask` 等名称只作为迁移来源，不继续承担跨模块或含义模糊的身份。配置实体保存当前可编辑真相，任务保存创建时不可变快照，Attempt 保存每次真实 ComfyUI 提交，图片和回收站使用独立生命周期。

| ID | 领域模型 | 决策 |
| --- | --- | --- |
| `IPD-01` | `ImageProductionProject` | 保存名称、唯一 slug、active/archived、项目文件夹、排序、Section 默认参数、唯一封面引用、lastExportedAt、最新 ZIP 路径和最小导出摘要；活动任务数、待审核数等实时派生，不复制任务状态 |
| `IPD-02` | `ImageProductionProjectFolder` | 多级树结构，保存父文件夹和同级顺序；删除非空文件夹时由同一领域操作连同全部子文件夹和项目处理，不提供删除时迁移内容 |
| `IPD-03` | `ImageProductionSectionFolder` | 项目内多级树结构并保存同级顺序；Template 使用自己的同构文件夹实体，导入项目时完整复制层级、父子关系和 Section 归属 |
| `IPD-04` | `ImageProductionSection` | 保存名称、文件夹、项目内顺序、画幅/尺寸/生成数量/放大参数、Checkpoint 模型业务键、两阶段 KSampler 和 Seed 策略等当前权威配置；不保存 enabled、任务状态或历史任务参数 |
| `IPD-05` | `ImageProductionPromptSegment` | 有序 Segment，只能是 CustomText 或 PresetBinding；正向/负向内容、名称和来源明确，不维护另一份可编辑整段 Prompt。Group 导入仍产生多个独立 PresetBinding Segment |
| `IPD-06` | `ImageProductionLoraEntry` | 保存第一/第二阶段、模型业务键、权重、顺序、是否启用和来源；手动 LoRA、Preset LoRA、转为手动及 Section 停用关系使用明确字段，UI 不暴露 tombstone 等实现词 |
| `IPD-07` | Preset 聚合 | 保留 ImageProductionPresetCategory、PresetFolder、Preset、PresetVariant、PresetVariantLink、PresetGroup、PresetGroupMember 和 CategorySlot；Group 始终组合多个独立 Preset/Variant，保留嵌套与循环检测，不融合成员内容 |
| `IPD-08` | Template 聚合 | ImageProductionTemplate、TemplateSection、TemplateSectionFolder、Segment、Binding 和 LoRA 使用与项目 Section 同构的配置协议，但拥有独立业务表和物理删除生命周期；导入/另存时按已确认规则深复制 |
| `IPD-09` | `ImageProductionTask` | 取代旧 Run；保存 Project、Section、创建时完整 resolved config/Prompt/Workflow JSON 快照、预期输出数量、当前状态、等待原因、提交 claim 和累计阶段耗时。任务输入不可在创建后修改 |
| `IPD-10` | `ImageProductionAttempt` | 每次真正向 ComfyUI 提交时创建，保存 promptId、内部状态、submittedAt、startedAt、finishedAt、排队/生成耗时、错误和中断原因；同一 Task 重试新增 Attempt，但不新建 Task |
| `IPD-11` | `ImageProductionImage` | 保存所属 Task、Project、Section、项目内 ImageArtifact、审核状态 pending/kept、P站/预览布尔标记和可选打码 Artifact；唯一封面引用保存在 Project。任务不存在部分成功，只有完成任务才产生正式图片记录 |
| `IPD-12` | `ImageArtifact` | 只在同一 ImageProductionProject 内按 Hash 复用图片字节，保存受管路径、缩略图、尺寸和引用状态；不与 LoRA 训练 Artifact 共表，不跨项目复用 |
| `IPD-13` | `ImageTrashEntry` | 保存图片及原 Project/Section/Task、原路径、删除时间等恢复上下文；恢复成功后删除 TrashEntry，永久删除时清理图片关系、缩略图、原图/打码字节和封面引用 |
| `IPD-14` | `CensoringBatchTask` / `CensoringBatchItem` | 一次“P站＋预览＋封面”批量打码对应一个用户任务，每张去重后的图片对应一个 Item 并保存执行结果；手工单图打码和单图自动打码直接更新图片打码 Artifact，不创建大量批量任务 |
| `IPD-15` | 导出状态 | 不建立导出历史表或版本实体；Project 只保存最新导出时间、ZIP 绝对路径和最小摘要。每次重新导出覆盖上一份，项目删除仍保留 EXPORT_ROOT 中的交付文件 |

### A11. LoRA 训练最终领域模型

LoRA 训练的当前可编辑真相归 Project/Profile/Section，训练素材候选统一归 Section，训练启动时直接创建不可变 TrainingRunSample，不再经过 DatasetVersion。训练素材图片和实际 LoRA 训练都保留自己的任务与 Attempt，但只共享状态、耗时、日志和反馈协议，不与图像生产任务共表。

| ID | 领域模型 | 决策 |
| --- | --- | --- |
| `LTD-01` | `LoraTrainingProject` | 保存名称、active/archived、排序、可选 Base checkpoint 业务键和项目训练默认参数；不需要 slug，也不保存缺图、缺 Caption、生成中或训练中等派生业务状态 |
| `LTD-02` | `LoraTrainingCharacterProfile` | 与 Project 一对一，只保存允许为空的 triggerToken、characterDescription、productionPrompt；Section Caption 不进入 Profile |
| `LTD-03` | `LoraTrainingImageArtifact` | 只在同一个 LoraTrainingProject 内按 Hash 保存一份图片字节、受管路径、尺寸和引用状态；不跨项目或模块复用 |
| `LTD-04` | `LoraTrainingReferenceImage` | 引用项目 Artifact，保存 name、可选 description 和 sortOrder；删除参考图关系时，仍被 Section、Task 或 TrainingRunSample 引用的字节继续保留 |
| `LTD-05` | `LoraTrainingSection` | 保存名称、项目内 sortOrder、size/quality/background、候选数量、权威 trainingCaption 和唯一 selectedImageId；不保存 enabled 或独立 generationPrompt |
| `LTD-06` | `LoraTrainingSectionInput` | 保存 Section、Artifact、顺序和可选用途说明；输入可来自项目参考图库、Section 手工上传或历史生成结果，创建项目时上传的参考图默认建立到每个初始 Section 的输入关系 |
| `LTD-07` | `LoraTrainingPromptSegment` | 有序 CustomText/PresetBinding；确定性解析完整生图 Prompt 和可选 Caption 初始参考，但不得自动覆盖 Section 当前 trainingCaption |
| `LTD-08` | Prompt Preset 聚合 | 保留一层 LoraTrainingPromptPresetCategory、PromptPreset 和简单 PromptPresetGroup。Preset 保存生图文本和可选 Caption 参考；Group 只是多个独立 Preset 的有序组合，不融合内容，也不增加 Variant 或嵌套 Group |
| `LTD-09` | Template 聚合 | LoraTrainingTemplate 保存名称、排序、Base checkpoint、训练默认参数及 TemplateSection；TemplateSection 与项目 Section 使用同一参数、Segment、Caption 和候选数量协议，创建项目时按既定规则深复制 |
| `LTD-10` | `LoraTrainingImageGenerationTask` | 保存 Section、完整 Prompt/Segment/输入图片/Provider 参数快照、请求候选数、pending/running/completed/failed/cancelled 状态、等待原因和阶段耗时；Task 输入创建后不可修改 |
| `LTD-11` | `LoraTrainingImageGenerationAttempt` | 一次 Attempt 可发起若干次一次一张的 Provider 调用。部分调用成功时保留已生成候选，Task 因结果数量不足进入 failed；重试仍属于同一 Task 并只生成缺少的候选数，既不丢弃成功图片也不重复花费 |
| `LTD-12` | `LoraTrainingImage` | 统一表示生成或手工上传的 Section 候选并引用 Artifact；生成来源 Task/Attempt 允许为空。没有 reviewStatus 或 Caption，是否采用只由 Section.selectedImageId 表达 |
| `LTD-13` | `LoraTrainingRun` | 启动训练时保存最终训练参数、Base checkpoint 路径快照、pending/running/completed/failed/cancelled 状态、进度、等待原因、阶段耗时以及 manifest、日志和工作区路径；输入创建后不可修改 |
| `LTD-14` | `LoraTrainingRunAttempt` | 同一 TrainingRun 故障重试时新增，保存目标机器快照、启动/结束时间、错误、受管进程身份和使用的 sd-scripts 恢复状态；修改训练样本或核心参数时才创建新 TrainingRun |
| `LTD-15` | `LoraTrainingRunSample` | 保存当次 Section ID/名称/顺序、代表图片及 Artifact 引用和 Caption 文本快照；不复制图片字节，也不依赖 DatasetVersion，来源生成 Task 可从 LoraTrainingImage 追溯 |
| `LTD-16` | `LoraTrainingCheckpoint` | 保存 Run、Attempt、step、模型 Artifact、可选 sd-scripts 恢复状态路径、创建时间和文件可用状态；任意 checkpoint 均可由用户复制到 ComfyUI LoRA 模型目录，不建立唯一 final checkpoint |
| `LTD-17` | 归档后的 checkpoint | 项目归档删除 checkpoint 和恢复状态的实际文件，但保留 checkpoint 最小记录、step、原路径和所属 Run/Attempt 用于查看训练历史；此前复制到模型目录的文件完全独立 |
| `LTD-18` | 删除的旧实体 | 移除 TrainingDatasetRevision/Item、TrainingSectionRun、通用 TrainingGenerationTaskOutput、PromptCardVersion 和专属 TrainingTextRevision；训练输入预览是实时查询，不新增 Preview 实体 |

### A12. HTTP API 通用协议

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

### A13. 图像生产 HTTP API 路由

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
| `IAPI-15` | Workflow 下载 | `/sections/:sectionId/workflow?variant=original|debug` 下载当前解析结果；`/tasks/:taskId/workflow?variant=original|debug` 下载历史不可变快照，两者均返回文件流 |
| `IAPI-16` | `/api/image-production/projects/:projectId/actions/**` | 提供 generate、import-template、sync-variant-assignments、export、archive、set-cover、clear-cover 等跨项目聚合动作；不把这些副作用隐藏进普通 PATCH |
| `IAPI-17` | `/api/image-production/comfyui/**` | 提供模块 settings、当前连接/队列状态及手工 start/stop/restart；任务创建不调用启停提示接口，GPU 恢复流程复用同一受控进程服务 |
| `IAPI-18` | 修改历史 | 在 Section、Preset、Group、Template 等具体资源下提供 `/revisions` 和 `/:revisionId/restore`；查询可复用 shared RevisionEntry，恢复必须进入 image-production adapter 和领域事务 |

### A14. LoRA 训练 HTTP API 路由

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

### A15. 前端信息架构与导航

新版是长期操作型生产工作台，不采用营销页、大 KPI 仪表盘或依赖单一颜色表达状态的设计。React Router 页面路由、稳定深链、浏览器历史和模块对称性是信息架构基础；Fastify 托管前端静态产物并支持页面深链刷新，API 和文件错误不得被 SPA 回退吞掉。

| ID | 范围 | 决策 |
| --- | --- | --- |
| `IA-01` | 根入口 `/` | 有有效导航记录时恢复用户上次使用的模块和页面；首次访问、记录缺失或记录无效时与旧版心智一致，默认进入 `/image-production/tasks`，不进入项目列表或新增数据仪表盘 |
| `IA-02` | 模块切换 | “图像生产 / LoRA 训练”作为始终可见且突出的一级切换入口；切换后恢复该模块最后访问页面，不把 LoRA 训练藏在图像生产导航下 |
| `IA-03` | 对称一级导航 | 两个模块都始终显示“项目、任务、预制、模板”四个独立一级入口；“任务”不能收进项目详情或更多菜单。LoRA 训练任务页同时呈现训练素材生成 Task 与 LoraTrainingRun，并可按类型筛选 |
| `IA-04` | 全局工具入口 | 模型、监控与日志、设置作为全局入口，不归入任何业务模块；模块专属设置仍可从对应模块和设置中心进入 |
| `IA-05` | 桌面导航 | 使用稳定侧边导航：顶部为模块切换，中部为当前模块的项目/任务/预制/模板，底部为模型、监控与日志、设置和注销；内容为导航预留固定空间，不被遮挡 |
| `IA-06` | 移动导航 | 顶部保留模块切换，底部放当前模块的项目/任务/预制/模板四个入口；模型、监控、设置和注销进入明确“更多”菜单，任务入口不得被收起 |
| `IA-07` | 图像生产项目页 | 项目内导航为概览、小节、图片、任务；编辑项目、导出、归档等作为当前项目操作，不增加同级主页面 |
| `IA-08` | LoRA 训练项目页 | 项目内导航为概览、角色档案、参考图、构图、训练素材、任务；训练素材页集中选择代表图并编辑 Caption |
| `IA-09` | Section 页面 | 图像生产 Section 围绕参数/Prompt 编辑和近期结果设计；LoRA Training Section 围绕 Prompt、输入图、候选、代表图和 Caption 设计，不强行使用同一业务布局 |
| `IA-10` | 全局与项目任务 | 全局任务页支持跨项目筛选、时间排序和按项目分组；项目内任务页复用相同任务组件但固定 Project 范围，不维护两套任务交互 |
| `IA-11` | 深层导航 | 三级以上页面显示面包屑，Project 与 Section 名称可点击返回；每个视图具有稳定可复制 URL，浏览器后退/前进不得被自定义路由状态破坏 |
| `IA-12` | 页面状态持久化 | 保留每个模块最后路由、查询、展开状态、选中 Tab 和滚动位置；刷新后恢复。失效资源按页面级尽力规则回退最近可用父页面 |
| `IA-13` | 归档项目 | 使用持续可见的只读标识和禁用原因；隐藏或禁用全部写入动作，保留浏览、文件下载和彻底删除 |
| `IA-14` | 加载与错误 | 每个真实路由提供页面级加载骨架和局部错误状态；操作错误保留当前输入并允许复制详情，不跳转独立错误页 |
| `IA-15` | Design Demo 处置 | 新版全新工程从一开始就不纳入 `/design-demos/**`、Demo Shell、DemoData、design-demo-ui、展示注册表、演示夹具和 Demo 专属测试；总体视觉方向仍按 VD 参考。不再要求先完成旧生产页面替换才移除旧 Demo；实际整理旧目录前先保存 MIG 规定的数据和业务文件 |
| `IA-16` | 导航可访问性 | 活动项同时使用文字、图标和视觉状态，不只依赖颜色；支持键盘焦点、跳到主内容和 prefers-reduced-motion，移动端保持浏览器返回行为 |

### A16. 新版视觉设计方向

视觉方向参考当前 `DESIGN.md` 和 Design Demos 的整体气质，而不是逐组件、逐像素迁移：新版继续是紧凑、任务导向、图片优先、状态可见的创作工作台，并保留柔和半透明层级。Design Demo 不是交互规范；任何与已确认业务流程、可访问性、响应式、浏览器导航、操作反馈或触摸目标准则冲突的现有实现都不记录为要求，也不得因为“Demo 已有”而继承。

| ID | 设计方向 | 决策 |
| --- | --- | --- |
| `VD-01` | 总体气质 | 沿用 Design Demos 柔和、轻盈、有创作感的生产工作台方向，不改成传统灰蓝企业后台、营销页或大 KPI 仪表盘 |
| `VD-02` | 表面语言 | 保留半透明面板、柔和边框、有限背景光晕和层次阴影；只用于表达页面层级和浮动区域，避免每层内容都嵌套玻璃卡片 |
| `VD-03` | 模块色与语义色 | 图像生产固定使用青绿色作为模块强调色，LoRA 训练固定使用品红到粉色作为模块强调色，两者保持同等视觉权重。成功、失败、警告、信息、暂停等交互状态使用通行语义色及文字/图标，不拿模块色代替状态，也不只靠颜色传达含义 |
| `VD-04` | 深浅主题 | 未人工选择时实时跟随系统，不区分深色/浅色优先；两套主题都保持柔和半透明层级和足够对比度。人工选择深色或浅色后持久保存，并提供明确“改为跟随系统”重置 |
| `VD-05` | 字体方向 | 沿用现代中文无衬线字体 + 清晰等宽字体的组合方向；可参考 HarmonyOS Sans SC/Geist 与 IBM Plex Mono 的气质，但不要求复用当前全部字体文件或 Demo 专属变量 |
| `VD-06` | 页面外壳 | 大体沿用桌面可折叠侧栏、明确路由页头和移动端紧凑导航的方向，再按 IA-01～IA-16 的真实模块、路由和入口重建 |
| `VD-07` | 信息密度 | 沿用紧凑但可读的行、网格、工具栏和分段控件；减少重复页头、空洞大留白与层层装饰容器，紧凑不能以隐藏名称、状态或主要操作为代价 |
| `VD-08` | 图片工作台 | 沿用图片网格、结果预览、灯箱和就近操作为核心的方向；图像生产与 LoRA 训练只共享图片展示、缩放和导航，业务操作分别设计 |
| `VD-09` | 任务页面 | 沿用状态分段、项目分组、当前运行进度和失败详情的工作台方向，但内容和分类必须按新版完整状态机重建，不复制 Demo 的旧三个 Tab 或旧统计口径 |
| `VD-10` | 反馈与动效 | 沿用短促、柔和的悬停、展开、Toast、待处理和乐观操作反馈；失败必须可见并恢复本地状态，所有非必要动效服从 prefers-reduced-motion |
| `VD-11` | 两模块关系 | 使用同一视觉语言、基础 Token 和同等级外壳；青绿色与品红/粉色区分模块，具体页面构成可不同，不做机械镜像或产生主次 |
| `VD-12` | 实现边界 | 视觉方向可以沿用，组件技术选型则按 CA-01～CA-14 独立确定；优先使用 PrimeReact v10 Styled 现成组件，通过统一主题与必要业务组合实现视觉方向，不从零重建基础组件。最终仍按 IA-15 删除 Design Demo 路由、DemoData 和旧组件体系 |
| `VD-13` | 不照搬的细节 | 不直接继承当前固定像素、旧路由结构、Demo 数据、组件注册表、具体断点或所有现存交互；这些只在实现具体页面时按真实内容重新验证 |
| `VD-14` | 交互准则优先级 | 已确认业务规则与当前交互/可访问性准则高于 Design Demo 实现。任何不满足键盘操作、明确焦点、足够触摸区域、对比度、语义标签、浏览器历史、错误反馈或安全操作范围的 Demo 行为直接舍弃，不进入迁移清单 |

### A17. 组件库、样式组织与复用

本组选型从项目需求出发，不以 Design Demos 或旧前端实现决定组件库与代码结构；已确认的 VD 视觉方向继续有效。目标是优先使用完整且一致的现成组件，尽量减少自行实现的基础控件以及散落的样式特例。

2026-09-05 最终许可决策：用户不接受申请 license 或定期续期，因此取消采用 v11，改用 `primereact@10.9.9` Styled。已读取该 npm 发布包的 LICENSE.md，确认为 MIT，支持使用、修改和分发且无需注册、key 或续期，须保留版权及许可声明。`primeicons@7.0.0` 同样为 MIT。v11 Community 虽对符合资格的个人免费，但需要申请 key，故不采用。文档与示例统一以 [v10 安装指南](https://v10.primereact.org/installation/) 和 [v10 主题指南](https://v10.primereact.org/theming/) 为准；不混用 v11 组件名称、包路径或主题 API。

| ID | 决策项 | 决策 |
| --- | --- | --- |
| `CA-01` | 唯一主组件库 | 固定 PrimeReact v10 Styled，实施基线锁定 primereact 10.9.9（MIT）；不采用需要注册、license key、续期或付费的版本/附加产品。补丁升级按兼容性和许可核对后进行，不自动跨到 v11；不同时保留 Mantine、MUI、Ant Design、shadcn 或另一套主 UI 库 |
| `CA-02` | 依赖与文档范围 | 使用 primereact 包，从 `primereact/button` 等组件路径按需导入，Provider 来自 `primereact/api`；主题使用发行包内免费 theme.css。删除此前 v11 的 `@primereact/ui`、`@primereact/core`、`@primeuix/themes` 选型要求，不增加 license 配置或申请流程；保留 MIT 声明 |
| `CA-03` | 图标 | 使用 primeicons 7.0.0（MIT）及其配套 CSS；不采用需要 key 的新发行线，不同时引入多套图标库或按页面手绘同类图标 |
| `CA-04` | 组件复用顺序 | 优先直接使用 v10 已有的 Button、InputText、Dropdown、MultiSelect、Dialog、Sidebar、TabView、Toast、Tree、DataTable、Paginator、Galleria 等；其次使用其公开属性、Pass Through 和模板；确有缺口才开发职责明确的业务组合组件，不混用 v11 Compound API |
| `CA-05` | 包装与组合边界 | 页面直接复用稳定组件与组合方式；Provider 支持的全局选项、主题及必要默认属性集中管理，不假设 v10 具有 v11 的统一 defaults API。仅当需要跨页面的稳定行为契约时做轻量包装，不按颜色/尺寸逐个创建 Button/Card/Panel；业务组合组件同类交互共用一份实现 |
| `CA-06` | 样式技术 | 允许组件库主题引擎和模块化 CSS-in-JS，也允许独立 CSS Module；禁止 Tailwind、shadcn/Tailwind 生成链和 PrimeFlex 等工具类体系。本项目自有样式必须有明确文件所有者，不散落在 JSX、逐页 style 对象或一次性覆盖中 |
| `CA-07` | 样式文件组织 | `ui/theme/tokens.css` 管理应用基础/语义 CSS 变量，`ui/theme/themes.ts` 统一管理 v10 免费明暗 theme.css 的选择/加载，`ui/theme/components/**` 集中放置必要组件样式及 Pass Through 配置；`ui/styles/base.css` 只放字体、基础文档规则。业务布局放所属组件旁的 `.module.css` 或集中复用的 `.styles.ts`，不维护两份同义样式；不使用 v11 preset API |
| `CA-08` | 稳定定制接口 | 从 v10 配套免费主题出发，优先使用公开 CSS 变量、组件属性及应用命名变体；主题未暴露的必要定制统一在组件主题层通过公开类名或 Pass Through 表达，不按页面各写一套覆盖、不依赖生成类名、不使用付费主题设计器 |
| `CA-09` | 模块色与浮层 | 图像生产青绿色、LoRA 训练品红/粉色作为两组模块强调 Token；语义状态色独立。两个模块复用同一套组件，主题上下文统一处理弹窗/菜单等 Portal 浮层，避免浮层丢失模块色或明暗主题 |
| `CA-10` | 主题与状态 | 深浅主题实时跟随系统并支持已确认的手动覆盖/重置；大小、圆角、间距、字体和标准状态优先来自统一 Token/组件配置，业务页通过命名变体使用，不随意新造近似样式 |
| `CA-11` | 拖放与媒体缺口 | 先使用 PrimeReact v10 Tree、OrderList、DataTable、Galleria/Image 等已有能力；先核对 v10 实际支持范围，不把 v11 Gallery 的缩放等能力当作 v10 已有能力。跨区域拖放或业务图片操作确有缺口时才补充集中维护的适配；不预先必选 dnd-kit |
| `CA-12` | 数据与交互 | React/Vite 页面通过正式 HTTP API 读取和修改；React Router 管理页面/深链，筛选与可分享状态进入 URL，组件管理临时交互。取消 Next.js Server Component/Server Action 方案，已确认的滚动恢复和局部加载/错误反馈能力保留 |
| `CA-13` | 开发约束 | 添加组件前查阅所锁版本官方组件和项目已有业务组合；统一记录组件默认值和复用用法，不产生多个平行设计系统。升级在代表性表单、列表、树、菜单、弹窗和图片视图中核对样式与交互，不能假定使用组件库就自动消除样式漂移 |
| `CA-14` | 旧前端退役 | 新版从全新工程引入已选依赖，不复制旧 Tailwind/shadcn/Radix 直接依赖、生成组件、配置、工具函数或 Demo 体系；按 MIG 保存数据和业务文件后，旧前端没有运行保留要求。上游组件库必要的传递依赖不等同于项目另行维护第二套 UI |

### A18. 前后端技术栈

用户已确认采用独立前端构建和轻量后端服务，以降低 Next.js 页面、服务端与 API 编译链之间的耦合。此前编译慢尚未做专项耗时归因；该选型不等于已测得性能提升，也不承诺具体秒数。正式领域模型、页面命名空间和 HTTP 合同沿用已确认决策。

| ID | 层级 | 决策 |
| --- | --- | --- |
| `TS-01` | 前端 | React 19 + Vite + React Router，构建浏览器 SPA 静态产物；按模块和页面拆分加载，不使用 Next.js、RSC 或应用 SSR |
| `TS-02` | 后端 | Fastify 5 + TypeScript，按图像生产、LoRA 训练、模型、设置、认证和监控等职责组织模块；领域服务、文件/SSH/进程适配独立于 HTTP 路由 |
| `TS-03` | 请求与类型协议 | TypeBox + Fastify Route Schema 统一请求/响应验证与 TypeScript 类型，并从实际路由 Schema 生成 OpenAPI；浏览器只共享接口合同，不导入数据库或后端运行代码 |
| `TS-04` | SQLite 访问 | Drizzle ORM + better-sqlite3，使用一套 SQLite schema 和迁移链；新版移除 Prisma schema/client 生成依赖及所有 PostgreSQL 专属依赖、配置和构建分支。旧 SQLite 数据仍需按 INFRA-011 在副本上验证一次性迁移 |
| `TS-05` | 开发与构建 | 开发时 Vite 和 Fastify 分别运行并独立更新，Vite 代理 API；前后端分别构建和类型检查，生产运行编译后的后端与前端静态文件。框架插件按兼容范围选版本并锁定，不盲目拼接各包 latest |
| `TS-06` | 同源交付与认证 | 生产由 Fastify 托管 API、前端静态产物和深链页面响应，使用同一域名/端口。保留 AUTH_TOKEN、浏览器 Cookie 和跨网络 Bearer 认证；应用页面、受保护资源、API 和文件下载在服务端执行门禁，登录本身所需页面/资源有明确边界。SPA 回退只服务页面路径，不把 API/文件错误改成 index.html |
| `TS-07` | 后台执行 | 按已确认规则全新实现图像调度/恢复、批量打码和 GPU 恢复检查，并接入 Fastify 服务生命周期；不迁入旧 instrumentation 或调度代码。训练素材与 LoRA 训练轻量执行器保持已确认职责，LoRA 训练调用作为新版依赖安装的 sd-scripts + Accelerate |
| `TS-08` | 性能与验证 | 实施时分别测前端冷启动/热更新/生产构建、后端启动/编译和代表性页面加载，便于定位具体耗时来源；继续采用已确认的慢事件及任务阶段耗时协议。CPU 密集打码等保持在已有独立执行链，避免阻塞 API；不因框架替换增加完整可观测性平台 |

官方接入依据：[PrimeReact v10 安装](https://v10.primereact.org/installation/)、[PrimeReact v10 主题](https://v10.primereact.org/theming/)、[Fastify 技术原则](https://fastify.dev/docs/latest/Reference/Principles/)、[Vite](https://vite.dev/guide/why)、[Drizzle](https://orm.drizzle.team/docs/overview)。

### A19. 全新工程与完整数据迁移

用户于 2026-09-05 明确系统当前没有投入使用，旧版只有数据和文件需要保留。本组取代上一轮关于旧版持续服务、逐页替换、双版本过渡和在线切换的建议。当前只记录迁移设计，尚未执行文件清理、数据复制、数据库转换或新工程创建。

| ID | 范围 | 决策 |
| --- | --- | --- |
| `MIG-01` | 建设方式 | 使用全新代码工程实现已确认功能、领域模型、API 和视觉方向；旧应用仅作为数据来源和必要业务含义的核对依据，不保留运行框架、组件、业务代码或兼容层 |
| `MIG-02` | 数据完整保存 | 实施前保存一致的完整 SQLite 备份和真实业务文件，包括项目媒体、参考图、候选/结果、打码图、训练模型、训练输入/Caption、Workflow JSON、交付包和有保留价值的历史资料；外部目录也按实际引用纳入盘点，不只复制仓库内 data。原始备份保留为完整数据底档，与新版运行目录分开 |
| `MIG-03` | 新库转换 | 建立干净的 Drizzle/SQLite schema，把保留能力对应的项目、层级/顺序、Preset/Variant/Group/Binding、Template、配置、图片关系、角色文本、Caption、用途标记、任务历史和模型元数据显式转换到新版；记录必要的旧新 ID 和路径映射，不让新版依赖旧表或旧 ORM |
| `MIG-04` | 已移除结构与异常数据 | 废弃功能的旧表不进入新版运行模型，但其有用文本、文件和历史信息仍应迁入对应新版资源。无法明确映射、存在冲突或损坏的记录保留原件并列出具体条目核对；不得因为某功能被移除就静默丢弃相关数据，也不以保留原始备份代替本应完成的转换 |
| `MIG-05` | 文件与配置 | 新版按 APP_DATA_ROOT、EXPORT_ROOT 和目标训练数据根组织受管文件，转换数据库文件引用；ComfyUI 模型继续映射其实际目录，不因重建应用删改模型。旧配置中的有效路径/参数属于需核对的数据，按新版设置合同导入；凭据继续按独立配置保存，不继承旧配置加载代码。node_modules、构建目录和可再生缓存不属于需保留的业务文件 |
| `MIG-06` | 历史执行真实性 | 迁入能真实还原的任务、输出、参数和时间；旧库缺少的 Attempt、阶段耗时或 Workflow 不伪造。导入过程中不启动生成、训练、打码或 ComfyUI 控制动作；旧非终态记录先核对执行事实，不能在首次启动时意外重放 |
| `MIG-07` | 完成标准 | 按数据类别核对来源/去向数量、引用、层级/排序、文本、选图/发布标记和文件可读取性；核对清单明确哪些已迁入、哪些仅原样保存及原因。最终以新版真实项目流程验证数据可用性。所有条目都有明确处置后才称为完整迁移 |
| `MIG-08` | 旧版退役 | 不设计旧新双写、兼容代理、在线流量切换或旧程序回退；新版功能和数据验收完成后只使用新应用。旧程序、依赖、构建产物和历史部署工具无保留要求；数据与业务文件的原始备份继续独立保留。具体旧目录清理在实际路径和数据保全确认后执行 |

---

## B. Generation 生图模式

### B1. 运行、队列与审核

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-RUN-001` | 运行总览 | `/queue` 汇总待审核、运行中、打码、失败、回收站五个 Tab | 现用 | Run、ImageResult、CensoringTask、TrashRecord | queue page/client | 保留并重做：任务主视图按统一状态机分类，清晰区分未提交、已提交、运行中、已暂停、已完成、失败和已取消；活动任务显示当前已用时间，终态任务显示总耗时，并可展开查看应用内等待、ComfyUI 队列、实际生成、暂停和各 Attempt 耗时。同时改善最近成功/失败浏览、上下文跳转和重试流程，审核与打码作为后处理维度而非混入执行状态 |
| `GEN-RUN-002` | 队列分页与自动刷新 | 分页读取，运行状态下每 5 秒刷新 | 现用 | `/api/queue-data`；GET 会触发 stale recovery | queue client、queue-data route | 移除为产品功能：前端不提供手工刷新或固定轮询；任务子系统在存在 submitted/running 任务时每 1 秒执行一次 HTTP queue/history 权威对账，WebSocket 只补充即时进度事件，页面消费本应用最新状态。读取接口不得顺带执行恢复等写操作 |
| `GEN-RUN-003` | 失败运行查看与重试 | 展示错误、重新提交失败运行 | 现用 | Run 已保存的 prompt/config snapshot | queue failed UI、run lifecycle | 保留并重做：失败重试直接复用同一任务及其不可变输入快照，保留旧 Attempt，清除任务当前执行字段并回到 `unsubmitted`；下一次实际提交时再创建新 Attempt。原 `comfyPromptId`、错误和时间保留在旧 Attempt 中，不使用 `retryOfTaskId` / `resolvedByTaskId`。失败列表只显示当前状态仍为 `failed` 的任务，因此重试后立即退出失败列表，不堆积重复任务历史。失败和已取消任务支持按选择、项目或时间范围物理清理 |
| `GEN-RUN-004` | 单运行取消 | 取消 queued/running/paused run，并尝试取消 ComfyUI prompt | 现用/高副作用 | DB + ComfyUI 队列 | cancel route、run-lifecycle | 保留并重构：未提交任务在本应用内取消；已提交任务精确删除对应 prompt；运行中任务经确认后中断。只有外部执行器确认停止后才转为 `cancelled`，取消失败时保留权威原状态并展示原因 |
| `GEN-RUN-005` | 单运行暂停/恢复 | 暂停时取消 Comfy prompt；恢复时重提交并轮询 | 现用/高副作用 | DB + ComfyUI | run-lifecycle | 保留并重构：`paused` 纳入状态机。未提交任务可直接暂停；已提交/运行中任务必须先从 ComfyUI 精确撤销或中断，确认释放 GPU 后暂停。ComfyUI 不支持从生成中间进度续跑，因此恢复统一回到 `unsubmitted` 并从头执行；暂停任务不阻止 LoRA 训练 |
| `GEN-RUN-006` | 活动运行批量暂停/部署批次恢复 | 暂停全部活动项；恢复只处理由 `pause-active` 标记的暂停批次，并可限定 batchId/runIds，不恢复普通手工暂停项 | 现用/运维 | 部署流程依赖精确来源标记 | queue pause/resume routes | 不进入新版产品功能或正式领域 API；以后整理部署流程时基于新版任务状态重新设计必要的内部维护动作，不保留当前 batchId/pause-active 实现 |
| `GEN-RUN-007` | 清空活动队列 | 流式报告取消进度，取消 Manager 与 ComfyUI 活动任务 | 现用/高副作用 | queue-control stream | 保留能力但取消“清空队列”模型：每个状态可独立查询、选择和执行适用的批量操作；任务工作台支持按时间排序、按项目分组及在这些视图中多选。相关交互由新版任务工作台重新设计，不依赖或保留 Design Demo 实现 |
| `GEN-RUN-008` | 清除终态运行及输出 | 先删除每个 Run 的受管输出目录，再删除 Run 并级联 ImageResult 等关联记录 | 现用/破坏性 | DB + 受管文件目录 | clear route、run-lifecycle | 保留并简化：终态任务默认永久保留、不自动过期，用户可按状态、项目、Section 和时间筛选后手动批量删除。删除任务只有一种语义：物理删除任务、全部 Attempt、全部 ImageResult、缩略图和受管图片字节，不提供“仅删记录并保留输出”。领域模型不支持“部分成功”；一次执行只有全部完成或失败，失败过程中产生的临时文件由执行器清理，不作为可管理结果保留 |
| `GEN-RUN-009` | 简化队列读取 API | `/api/queue` 返回简化队列；页面主要不用 | 隐藏/兼容 | 外部客户端可能依赖 | queue route | 新版移除 `/api/queue`；前端和跨网络 Agent 统一使用 `/api/image-production/tasks` |
| `GEN-REV-001` | Run 审核组 | `/queue/[runId]` 展示一次 run 的全部图片 | 现用 | Run、ImageResult、受管图片 | queue run page | 保留并重做：作为某次图像生产任务结果的筛选视图，图片仍归属项目和 Section；任务、项目和 Section 入口复用生产模块自己的审核能力，不与 LoRA 训练的候选选择流程合并 |
| `GEN-REV-002` | 图片灯箱 | 大图预览、上一/下一张、键盘导航 | 现用 | 图片 route | review lightbox components | 保留并按模块分别设计：图像生产灯箱支持前后切换、键盘导航、保留、丢弃、P站、预览和封面操作；LoRA 训练灯箱围绕代表训练素材选择与参考图使用设计，不出现生产模块的发布动作。两者只复用图片展示、缩放和导航等中性基础组件 |
| `GEN-REV-003` | 选择与批量审核 | 单选、全选、批量 keep/trash | 现用 | ImageResult.reviewStatus | review mutations | 保留并简化：活动图片只有“未审核、已保留”两种审核状态；丢弃由 TrashRecord 生命周期表达，不再同时保存 `trashed` 审核状态。多选状态只属于当前 UI 会话，不持久化；批量操作支持当前任务、当前 Section 和当前筛选结果范围 |
| `GEN-REV-004` | 删除剩余图片 | 保留已选后批量删除其他待审图片 | 现用 | DB + 文件移动到 trash | review UI/actions | 保留，操作名称为“删除剩余”：保留当前已选图片，将当前任务其余未审核图片移入回收站；执行前显示保留数和删除数 |
| `GEN-REV-005` | 撤销删除 | 将 TrashRecord 对应文件移回原路径 | 现用 | TrashRecord、文件移动 | restore actions | 保留即时撤销；即时入口消失后仍可从当前 Section、当前项目或全局回收站恢复 |
| `GEN-REV-006` | 审核组连续导航 | 上一/下一审核组、完成后自动跳转、快捷键 | 现用 | Review group repository | queue detail client | 保留上一组、下一组和快捷键；完成当前任务审核后自动进入下一个仍有未审核图片的图像生产任务 |
| `GEN-REV-007` | 从审核页重跑 | 按当前小节配置重新运行，只从旧 executionMeta 取默认 batch | 现用 | 当前 Section 配置，不是旧 Run 不可变快照 | review actions | 保留并澄清：失败任务按原不可变快照重试时复用同一任务并回到 `unsubmitted`，实际再次提交时创建新 Attempt；从审核页按当前 Section 输入和参数再次生成时创建新任务。UI 分别命名为“重试本任务”和“按当前小节再次生成”，避免混淆 |
| `GEN-IMG-001` | “P站”标记 | 设置/取消 `featured`，并自动 keep | 现用 | ImageResult.featured | featured route | 保留名称和功能：与“预览”“封面”同为图像生产项目一次打包发布所使用的图片用途；可多选，设置后自动将图片标为已保留。新版所有用户界面和文档统一写作“P站” |
| `GEN-IMG-002` | “预览”标记 | 设置/取消 `featured2`，并自动 keep | 现用 | ImageResult.featured2 | featured2 route | 保留名称和功能：与“P站”“封面”同为图像生产项目一次打包发布所使用的图片用途；可多选，设置后自动将图片标为已保留 |
| `GEN-IMG-003` | 项目封面 | 设置项目唯一封面并自动 keep | 现用 | Project.coverImageId | cover route | 保留并重新定位：不是普通项目装饰，而是与“P站”“预览”并列的打包发布用途；每个项目只能选择一张封面，设置后自动保留。封面图片移入回收站时清空引用，恢复图片后不自动重新设为封面 |
| `GEN-TRASH-001` | 全局回收站列表 | `/queue` 回收站 Tab 分页显示已删除图片 | 现用 | TrashRecord | queue trash tab | 保留并重做：既有全局回收站之外，项目和 Section 内也提供各自范围的回收站入口、筛选、批量恢复和永久删除；TrashRecord 保留 `projectId`、`sectionId`、来源任务和结果上下文，支持按时间排序及按项目/Section 分组 |
| `GEN-TRASH-002` | 回收站恢复 | 标记 TrashRecord 已恢复，将既有 ImageResult 重置为 pending 并恢复原路径；文件移动失败不阻断 DB 更新，可能留下 DB/文件不一致 | 现用/尽力而为 | DB + 文件系统 | image-review actions | 保留并重做：单项或批量恢复都回到原项目和原 Section；文件恢复与数据库状态更新必须作为同一个受控操作，文件恢复失败时不得把数据库标成已恢复，并明确报告失败项 |
| `GEN-TRASH-003` | 永久清空回收站 | 重置引用图片的项目封面，删除 TrashRecord 与 ImageResult，再尽力删除 trash、原图和缩略图文件 | 现用/破坏性 | DB + `data/images/.trash/**` | clearTrash | 保留并重做：支持全局、项目和 Section 范围永久清空；删除 TrashRecord、ImageResult、原图/缩略图并清理项目封面等引用。任何失败都报告具体未清理项，不再静默尽力而为；任务历史删除与图片回收站始终是两个独立概念 |

### B2. 项目、文件夹与小节

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-PROJ-001` | 项目列表 | `/projects` 展示活跃项目、状态、最近结果 | 现用 | Project、Run、ImageResult | projects page/repository | 保留并重做：展示项目名称、文件夹、最近结果、活动任务数和待审核图片数，不暴露 worker 等实现状态；项目不再复制任务运行状态，只展示由任务和结果即时汇总的活动信息 |
| `GEN-PROJ-002` | 项目 UI 范围筛选 | 页面处理文件夹浏览与“显示归档”；没有标题/status/pending 搜索控件 | 现用 | Project query | projects page/repository | 保留并补齐普通 UI：支持名称搜索、文件夹范围、正常/归档、是否有活动任务和是否有待审核图片；页面与正式 HTTP API 使用同一查询语义 |
| `GEN-PROJ-003` | 项目文件夹 | 新建、重命名、删除、排序、进入文件夹 | 现用 | ProjectFolder | project-folder service | 保留多级文件夹、新建、改名、排序和导航。删除非空文件夹必须弹出模态框并列明包含的子文件夹和项目数量，只允许“删除整个文件夹及其中全部项目”或取消；不提供删除时移动/保留内容的功能 |
| `GEN-PROJ-004` | 项目移动与批量移动 | 单项目或多选移动到文件夹/根 | 现用 | Project.folderId | project folder actions/API | 保留并重做交互：项目元素可直接拖入目标文件夹，拖动时显示有效落点；多选后拖动可一次移动全部已选项目。为键盘、触屏和精确选择保留“移动到”菜单作为同一能力的备用入口 |
| `GEN-PROJ-005` | 统一项目创建入口 | 当前 `/projects/new` 主要按空白参数/项目级预制创建 | 现用 | Project、ProjectTemplate、bindings | project form/service | 保留并重做：图像生产也只提供一个新建项目入口；表单内可选 ProjectTemplate，选择后预填可编辑元信息/默认参数，提交时深复制模板 Sections、Bindings、CustomText 和参数。未选模板则创建空白项目，与 LoRA 训练采用相同创建心智。创建表单正式提供必填“英文标识（slug）”，与可含中文的项目名称分离；只允许小写英文字母、数字和连字符并校验全局唯一，模板不得复制另一个项目的 slug |
| `GEN-PROJ-006` | 从已有项目创建 | `/projects/new/from-existing` 复制结构并重新选择 checkpoint/预制 | 现用 | 源项目及所有 sections | createProjectFromExisting | 新版移除：暂不保留“从已有项目创建”，删除独立页面、表单分支、服务写路径和相关兼容入口；统一新建项目只支持空白项目或可选 ProjectTemplate |
| `GEN-PROJ-007` | 直接复制项目 API | 复制完整项目；当前项目卡片无复制按钮，仅 action/API 可达 | 隐藏/API-only | Project/Section/bindings | copyProject | 新版移除：删除原样复制项目的 action、HTTP API、服务/仓储写路径和相关兼容入口；若以后出现明确的一键副本需求，再按新版领域模型重新设计，不保留当前隐藏实现 |
| `GEN-PROJ-008` | 项目编辑 | `/projects/[id]/edit` 修改标题、默认尺寸、批次、checkpoint 等 | 现用 | Project | project edit form | 保留：项目参数作为新 Section 的默认值；修改默认值不暗中覆盖既有 Section，也不改变历史任务快照。编辑页允许修改“英文标识（slug）”并执行格式/唯一性校验；它用于导出目录、ZIP 和图片文件名，不替代中文项目名称 |
| `GEN-PROJ-009` | 参数应用到全部小节 | 将单个项目参数批量写入全部 sections | 现用 | ProjectSection | apply-param route | 保留为显式批量操作：用户选择要覆盖的字段后应用到全部 Section，不使用“保存项目时顺带同步”的隐式行为 |
| `GEN-PROJ-010` | 项目详情 | `/projects/[id]` 汇总 sections、运行、结果和项目动作 | 现用 | Project detail view | project detail page | 保留：汇总 Section、近期任务、结果和项目操作，具体布局在前端设计阶段单独确定 |
| `GEN-SEC-001` | 小节新增 | 在项目内创建普通 section | 现用 | ProjectSection | addSection/API | 保留：从项目当前默认参数创建空白 Section，创建后独立编辑 |
| `GEN-SEC-002` | 小节复制 | 复制 section 参数、bindings、blocks、LoRA，并插入源后 | 现用 | Section 子表 | copySection | 保留并重做：副本插入来源 Section 之后，复制参数、Prompt Segment、Preset Binding 和 LoRA，不复制任务、结果、回收站或变更历史 |
| `GEN-SEC-003` | 小节删除 | 删除单个 section 及关联运行/资源 | 现用/破坏性 | DB + 可能的运行/图片 | deleteSection | 保留并统一语义：单个与批量删除使用同一领域操作；存在非终态任务时阻止删除并要求先取消。确认删除后物理清理 Section、终态任务、结果和受管文件 |
| `GEN-SEC-004` | 小节批量删除 | 多选删除、服务端阻塞检查 | 现用/破坏性 | 多 section 及关联资源 | batch-delete route | 保留并并入统一 Section 删除能力：多选后一次确认，服务端按同一规则检查非终态任务并返回无法删除的具体 Section，不维护另一套删除语义 |
| `GEN-SEC-005` | 清空全部小节 | 预览后删除项目所有 sections | 现用/高风险 | 项目全部 section 数据 | clearAllSections | 新版移除：“全选后批量删除”已经覆盖相同需求，删除独立按钮、action/API 和专用写路径 |
| `GEN-SEC-006` | 小节排序 | 拖拽持久化 section 顺序 | 现用 | sortOrder | reorderSections | 保留：以拖放为主要交互，并持久化项目及文件夹范围内的 Section 顺序 |
| `GEN-SEC-007` | 小节文件夹 | 新建、改名、删除、排序、移动 sections | 现用 | ProjectSectionFolder | section-folder actions | 保留多级文件夹并重做交互：支持直接将 Section 或多选 Section 拖入文件夹。删除非空文件夹时弹出模态框，只允许连同全部子文件夹和 Section 删除或取消；不提供删除时移动/保留内容的功能 |
| `GEN-SEC-008` | 紧凑/展开视图 | 项目详情切换卡片密度与展开状态 | 现用/UI | 浏览器状态 | section cards | 保留为纯界面偏好，不进入领域模型；项目和页面之间切换后恢复用户最后使用的视图 |
| `GEN-SEC-009` | 批量创建小节 | `/batch-create` 搜索预制/组，构建导入队列并连续创建 | 现用 | Preset/Group/Section | batch-create client | 新版移除：该功能实际没有被使用，删除独立页面、客户端状态、专用 action/API 和兼容入口；普通新增、复制和模板导入覆盖新版需要的创建方式 |
| `GEN-SEC-010` | 批量创建覆盖同分类 | 导入时替换已有同分类绑定 | 现用 | Category/bindings | batch create logic | 新版移除：它只是旧批量创建页中的“覆盖添加”按钮——选择一个 Preset/Group 时先从临时导入列表删除同分类项，再保留当前选择；不是独立领域能力，也没有单独持久化。随 `GEN-SEC-009` 一并删除 |
| `GEN-SEC-011` | 从模板创建小节 | 选择模板 section 复制进项目 | 清单误判/无真实功能 | 实际未读取 ProjectTemplateSection | 名为 create-from-template 的 route/action | 纠正清单并移除误导实现：当前没有“选择一个模板 Section 复制进项目”的产品入口。`createSectionFromTemplate` 只是旧批量创建页的普通建节助手，不读取 Template；`create-from-template` API 的 `sectionId` 参数也未使用。随批量创建功能删除该误命名函数和无效路由，不把它迁移到新版 |
| `GEN-SEC-012` | 导入整套模板 | 将模板的 sections/folders/bindings 导入项目 | 现用 | ProjectTemplate 全树 | template import | 保留：允许向已有项目追加模板中的全部文件夹和 Section，不覆盖已有内容；导入后项目数据与模板独立，Preset Binding 继续保持绑定 |
| `GEN-SEC-013` | 整项目运行 | 对所有 enabled sections 入队 | 现用 | Run、ComfyUI | runProject | 保留但移除 `enabled` 语义：新版 Section 不再有“启用/停用”字段；运行整个项目时为项目内全部未删除 Section 分别创建 `unsubmitted` 任务，ComfyUI 不可达或 LoRA 训练占用 GPU 时由任务状态机等待 |
| `GEN-SEC-014` | 指定小节运行 | 运行单个或选择的一组 sections | 现用 | Run、ComfyUI | runSection/runSections | 保留单个和多选运行；按当前 Section 参数分别创建不可变任务快照并进入 `unsubmitted`，不依赖 Section 启用状态 |
| `GEN-PROJ-015` | 外部项目搜索与状态筛选 | Service/Agent/MCP 支持 title、status、hasPending；普通项目页无对应控件 | 隐藏/外部自动化 | Project query | listProjects、Agent/MCP | 保留查询能力并统一到正式项目列表 HTTP API 和普通 UI；删除随 MCP 模块存在的重复入口，不再维护仅外部可用的另一套筛选语义 |
| `GEN-PROJ-016` | 参考项目同步角色变体 | 项目详情可选择来源项目/文件夹，Dry Run、抽查后 Apply，同步 role preset variants | 现用/深层入口 | 两个项目的 section role bindings | SyncPresetVariantFlowDialog、agent flow API | 保留但大幅简化为一次“同步变体分配”：在目标项目选择来源项目和 Preset 分类，系统按 Section 名称精确匹配，在同一个模态框列出将要改变的 Section→Variant 及未匹配数量，用户确认后直接应用。删除来源文件夹筛选、独立 Dry Run、抽查步骤、分阶段 Apply 和专用 Agent flow；持续 Preset Binding 仍只负责内容更新，不能替代该分配复制能力 |

### B3. 小节编辑、提示词、预制绑定与 LoRA

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-EDIT-001` | 小节名称与相邻导航 | 改名、上一/下一 section、快捷键 | 现用 | ProjectSection | section page | 保留改名、上一/下一 Section 和快捷键 |
| `GEN-EDIT-002` | 图像尺寸与批次 | aspect ratios、短边、batchSize、upscale | 现用 | ProjectSection params | section params form | 保留画幅、多个输出比例、短边尺寸、一次生成数量和放大倍数；具体字段布局在前端设计阶段逐项确定 |
| `GEN-EDIT-003` | Checkpoint 与 workflow | section 或项目默认 checkpoint、workflow 参数 | 现用 | 模型文件、workflow config | section editor | 保留 Checkpoint 的项目默认值和 Section 覆盖，并从 shared 模型管理模块选择。Workflow 不作为每个 Section 的选择字段，由图像生产模块设置当前 Workflow；Section 保存参与解析的业务参数。同时保留下载当前 Section 解析后 Workflow 和历史任务实际提交 Workflow 的能力 |
| `GEN-EDIT-004` | 两阶段 KSampler | KSampler1/2 参数、是否启用第二阶段 | 现用 | resolved config snapshot | section params | 保留两阶段能力和“是否使用第二阶段”；详细采样参数放入高级区域但允许完整编辑 |
| `GEN-EDIT-005` | Seed 策略 | random/fixed/increment 等两阶段策略 | 现用 | run payload | section params | 保留随机、固定和递增策略，用于复现结果或批量生成不同结果 |
| `GEN-EDIT-006` | 最近结果预览 | 编辑页显示近期运行与结果 | 现用 | Run/ImageResult | section edit page service | 保留：编辑 Section 时直接查看近期任务和图片，并可进入完整结果页 |
| `GEN-EDIT-007` | 小节变更历史 | 展示参数、提示词、LoRA 等维度的变更记录 | 现用/深层入口 | SectionChangeLog | section-change-history UI/service | 保留并迁移到 RV-01～RV-10：Section 的 Prompt、LoRA 和生成参数分别作为明确 scope 接入 shared 修改历史协议，由 image-production adapter 校验和恢复；删除专属 SectionChangeLog 模型和服务 |
| `GEN-PROMPT-001` | 自定义提示词块 CRUD | 正/负文本、label、新增/编辑/删除 | 现用 | SectionPromptBlock | prompt-block service | 保留并迁移为 `CustomText` Segment：包含普通正向文本、负向文本和可选名称；名称只用于界面识别，不参与 Prompt 编译 |
| `GEN-PROMPT-002` | 提示词块排序 | 拖拽顺序并影响最终 prompt | 现用 | sortOrder | reorder blocks | 保留拖放排序；最终正向和负向 Prompt 严格按当前 Segment 顺序解析 |
| `GEN-PROMPT-003` | 导入预制 | 把 preset variant 作为绑定导入 section | 现用 | SectionPresetBinding | importPresetToSection | 保留并迁移为持续 `PresetBinding` Segment，不复制预制文本；Preset 更新影响仍绑定的 Section，任务保存当时的解析快照 |
| `GEN-PROMPT-004` | 导入预制组 | 一个 group binding 解析为多个成员块 | 现用/复杂 | PresetGroup、成员/category order | importPresetGroup | 保留并明确 Group 为多个 Preset 的有序组合：绑定 Group 后，Section 中仍生成并展示多个彼此独立的 PresetBinding Segment，每个成员保留自己的 Preset、Variant、顺序和解析结果；Group Binding 只保存组合来源、成员关系与整组操作身份，不融合成员内容。Group 成员变化继续同步到仍绑定的 Section |
| `GEN-PROMPT-005` | 切换绑定变体 | 保持绑定身份，仅切换 variant | 现用 | PresetVariant | switchBindingVariant | 保留：在同一 Binding 上切换 Variant，不改变 Segment 身份和排序 |
| `GEN-PROMPT-006` | 独立编辑预制内容 | 编辑绑定来源内容时自动 detach，避免后续同步覆盖 | 现用/复杂 | binding provenance | prompt-block service | 保留明确的“转为自定义文本”操作：把当前解析结果转换为 `CustomText`，此后不再跟随 Preset 更新；普通编辑不得暗中 detach |
| `GEN-PROMPT-007` | 独立/级联移除 | 移除单个导入或整个 group binding | 现用/复杂 | 绑定键与组成员 | removeImportedPreset | 保留两种明确操作：可只从当前 Section 移除 Group 中某个 PresetBinding 成员，也可移除该 Group Binding 带来的全部成员；两者都不删除预制库中的 Preset 或 Group。单独移除的成员在当前 Section 记录为该 Group 的排除项，后续 Group 同步不得自动加回；若要保留某成员当前解析文字，应先“转为自定义文本”再解除 Binding |
| `GEN-LORA-001` | LoRA1 / LoRA2 分区 | 两阶段 LoRA 列表与权重 | 现用 | SectionManualLoraEntry、Preset Lora | section LoRA editor | 保留两个阶段的独立 LoRA 列表并与两阶段 KSampler 对应；界面使用“第一阶段 LoRA、第二阶段 LoRA”。关闭第二阶段时隐藏第二阶段列表但不删除配置 |
| `GEN-LORA-002` | 手动添加 LoRA | 从模型选择器加入路径、权重、启用状态 | 现用 | 模型文件与 LoraAsset | section-lora service | 保留：从 shared 模型管理模块选择已登记 LoRA，显示其本机或远程真实路径，并设置权重和是否启用；不允许手工填写任意路径 |
| `GEN-LORA-003` | LoRA 排序 | 拖拽决定应用顺序 | 现用 | sortOrder | LoRA editor | 保留各阶段内拖放排序，解析和注入 Workflow 时使用该顺序 |
| `GEN-LORA-004` | Trigger words 查看 | 从 LoraAsset 元数据展示触发词 | 现用 | LoraAsset.triggerWords | LoRA editor | 保留查看和复制；内容来自 shared 模型元数据，不在 Section 内维护另一份 |
| `GEN-LORA-005` | 继承、分离与抑制 | 区分 preset LoRA、manual LoRA、detached tombstone | 现用/高复杂 | bindingKey、detachedFromBinding | resolvers/services | 保留必要能力并简化界面：Preset 提供的 LoRA 显示来源，可选择“仅在本小节停用”或“转为手动项后编辑”；手动 LoRA 可直接编辑、排序和删除。内部保存 Section 级停用关系，但 UI 不暴露 tombstone 等实现术语 |

### B4. 结果、打码、导出与生命周期

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-RESULT-001` | 小节结果页 | `/projects/[id]/sections/[id]/results` 按 Run 展示 | 现用 | Run/ImageResult | section results | 保留：按任务分组展示当前 Section 的全部结果，任务默认按时间倒序；可展开查看任务参数、Attempt 和图片 |
| `GEN-RESULT-002` | 跨小节连续审核 | 完成当前 section 后导航下一 pending section | 现用 | Section pending counts | results client | 保留：完成当前 Section 后进入下一个仍有未审核图片的 Section；与已确认的生产审核导航共用同一实现 |
| `GEN-RESULT-003` | 临时批次重跑 | 从结果页以临时 batch 覆盖重新运行 | 现用 | enqueue overrideBatchSize | results actions | 保留为本次任务覆盖：从结果页“按当前小节再次生成”时允许临时修改本次生成数量，不修改 Section 默认值；新任务保存实际数量快照 |
| `GEN-RESULT-004` | 项目结果汇总 | `/projects/[id]/results` 汇总全部 sections | 现用 | Project/Run/ImageResult | project results | 保留：汇总项目全部 Section 图片，支持按 Section 分组或按时间浏览，并可跳回来源 Section 和任务 |
| `GEN-RESULT-005` | 结果筛选 | 全部、P站、预览、封面筛选 | 现用 | featured flags | project results client | 保留“全部、P站、预览、封面”四类筛选；不扩展成通用标签系统 |
| `GEN-RESULT-006` | 删除项目全部图片 | 项目结果页批量移入回收站 | 现用/破坏性 | 全部 ImageResult 与文件 | trashProjectImages | 保留并重做：项目或 Section 范围批量丢弃结果时统一进入图片回收站，并保留原项目、Section、任务和结果上下文；不与任务历史清理合并 |
| `GEN-CENSOR-001` | 手工快速打码 | 单图画布手工绘制并持久化打码图片 | 现用 | 原图/censored 文件 | quick-censor canvas | 保留：用户在单图画布绘制打码区域并保存独立打码版本，原图不被覆盖 |
| `GEN-CENSOR-002` | Python 自动打码 | YOLO + OpenCV mosaic 自动处理 | 现用/外部依赖 | Python、模型文件、图片 | auto-censor runner | 保留 YOLO 与 OpenCV 自动打码，但只提供单图自动打码和 `GEN-CENSOR-003` 的精选图片批量打码；Python、Ultralytics、OpenCV、Pillow 作为应用随附依赖，不要求用户配置解释器。仅在任务实际无法执行时报告缺失运行时/模型等错误，不提供主动验证入口；固定 CPU 推理和类别 `[2,4]` |
| `GEN-CENSOR-003` | 项目批量打码 | all/kept/marked 范围建立任务 | 现用 | CensoringTask | censoring actions | 保留并收敛为唯一批量范围“P站＋预览＋封面”：合并三类已选图片并去重，自动跳过已有打码版本的图片；移除“全部”和“仅已保留”批量入口。任意单图仍可单独执行自动打码或手工打码 |
| `GEN-CENSOR-004` | 打码任务队列 | 进程内批处理、状态/进度/历史 | 后台核心 | CensoringTask、启动 instrumentation | censoring executor | 保留并重构为一次精选图片批量操作对应一个用户可见任务，内部记录各图片处理项；用户查看总数、已完成、失败、当前状态，以及等待、实际处理、暂停和总耗时，不在任务中心堆积大量单图任务 |
| `GEN-CENSOR-005` | 项目范围打码暂停/恢复/取消 | actions 以 projectId 批量控制项目下任务，没有单 CensoringTask 控制入口 | 现用/运维 | CensoringTask 与外部进程 | censoring actions | 保留并改为控制具体批量任务：暂停后不再领取下一张，当前图片处理完即暂停；恢复后继续剩余图片；取消后停止领取新图片。项目范围可多选任务批量控制，但不再只能一次控制项目下全部任务 |
| `GEN-EXPORT-001` | 图片整合导出 | 生成 ZIP、封面、P站、预览目录 | 现用/写文件 | `data/images`、`data/export`、Archiver | project-export service | 保留并重做为单一完整 ZIP：全部已保留原图、封面、P站打码图和预览打码图一次打包。ZIP、导出目录和普通图片文件名统一使用项目“英文标识（slug）”，例如 `<slug>.zip`、`<slug>_01.jpg`；保留原有兼容性更好的英文结构与文件名 `pixiv/`、`preview/`、`cover.jpg`、`cover_censored.jpg`，用户界面仍显示“P站、预览、封面”。同时支持浏览器下载 ZIP，并向认证用户显示/复制服务器导出绝对路径 |
| `GEN-EXPORT-002` | 导出前置检查 | 要求唯一封面和 kept 图片；成功写 `publishedAt` | 现用 | Project/ImageResult | export route | 保留并重构检查：要求有效且唯一的 slug、恰好一张封面及至少一张已保留图片；P站和预览允许为空。所有被标记为封面/P站/预览的图片都必须已有打码版本，否则阻止导出并列出缺失项。每次导出覆盖该项目上一份结果，不保留历史版本；记录 `lastExportedAt`，移除把本地打包等同外部发布的 `publishedAt` 语义 |
| `GEN-LIFE-001` | 项目归档 | 要求完成/导出，取消任务并尽力清理图片、trash、Comfy output、export，写 archivedAt | 现用/高风险 | DB + 本地/SSH 文件系统 | archive service | 保留并重构为永久只读归档，不要求先导出，只要求没有非终态任务。保留 Project、文件夹、Section、参数、Prompt/LoRA 配置、任务/Attempt、数据库中的任务 Workflow JSON 快照、全部正常图片及打码版本和最新导出文件；删除执行临时文件、磁盘上的 Workflow 下载/缓存文件及回收站中的图片。归档后仍通过原 Preset/Group Binding 正常解析最新内容，不保存额外 resolved config/Prompt/LoRA 归档快照 |
| `GEN-LIFE-002` | 项目反归档 | 当前没有反归档 | 缺失 | 归档会已删除多类文件，难以恢复 | 无 | 新版不增加：归档项目永久只读且不可恢复为 active；只允许浏览、下载保留文件和彻底删除项目 |
| `GEN-LIFE-003` | 项目彻底删除 | 清理任务/文件后级联删除项目 DB | 现用/高风险 | Project 全树、文件、Comfy output | deletion service | 保留并重构为真正彻底删除：要求先取消全部非终态任务，随后删除 Project 全部数据库记录、Section、任务/Attempt、数据库中的 Workflow JSON 快照、磁盘 Workflow 文件、图片、打码版本、回收站和临时文件，并清理已成功持久化后的已知 ComfyUI 输出副本。`data/export/<slug>/` 等打包目录中的交付文件完全保留，不随项目删除；文件清理失败时不得把项目错误标记为已删除 |

### B5. Generation 预制与模板

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-PRESET-001` | 预制分类 CRUD | 分类新增、编辑、删除、排序 | 现用 | PresetCategory | preset-category actions | 保留分类新增、编辑、删除和排序；分类继续用于资源组织、Group 组合及跨项目 Variant 分配同步 |
| `GEN-PRESET-002` | 分类槽位模板 | 为预制组定义固定 slot 结构 | 现用/复杂 | PresetCategorySlot | slot-template route | 保留：分类可为 Group 定义固定 Slot，每个 Slot 约束允许放入的 Preset 分类和显示顺序 |
| `GEN-PRESET-003` | 分类导入排序规则 | 分别编辑分类在正向、负向、LoRA1、LoRA2 四个维度的导入顺序；预制自身 sortOrder 是另一拖拽功能 | 现用 | category sort orders | sort-rules page | 保留并与旧版一致：继续分别维护分类在正向 Prompt、负向 Prompt、第一阶段 LoRA、第二阶段 LoRA 四个维度的编译顺序；资源库展示排序和 Preset 自身排序仍是独立概念 |
| `GEN-PRESET-004` | 预制文件夹 | CRUD、排序、移动、多选移动 | 现用 | PresetFolder | preset-folder actions | 保留多级文件夹、排序和拖放移动。删除非空文件夹时模态框只提供“连同其中全部子文件夹和 Preset 删除”或取消，不提供把 Preset 移到其他位置的保留方案 |
| `GEN-PRESET-005` | 预制 CRUD/复制 | 新建、编辑、复制、删除、排序 | 现用 | Preset | preset-variant-crud | 保留创建、编辑、复制、删除和拖放排序；删除时如何处理现有 Binding 在 Preset 生命周期组单独确认 |
| `GEN-PRESET-006` | 预制变体 CRUD | 多变体新建、编辑、删除、排序 | 现用 | PresetVariant | variant actions | 保留一个 Preset 下的多个 Variant，以及新增、改名、复制、删除和排序；每个 Preset 明确一个默认 Variant |
| `GEN-PRESET-007` | 变体提示词与 LoRA | positive/negative、LoRA path/weight 属于 PresetVariant；Civitai links 属于 Preset 主记录 | 现用 | Preset + PresetVariant | preset form | 保留 Variant 的正向文本、负向文本、第一阶段 LoRA 和第二阶段 LoRA，LoRA 必须从 shared 模型管理模块选择。Civitai 等普通参考链接归 Preset；若链接指向具体 LoRA 模型，则由模型模块维护，Preset 只引用该模型 |
| `GEN-PRESET-008` | 关联变体 | 一个变体递归引用其他变体并防循环 | 现用/复杂 | PresetVariantLink | preset resolver | 保留旧版设计：Variant 可递归关联其他 Variant，解析时按原规则展开，并继续执行循环引用检测和拒绝写入 |
| `GEN-PRESET-009` | 跨变体批量文本替换 | 对选中变体预览并替换 prompt 文本 | 现用 | 多个 PresetVariant | bulk text utilities | 保留：选择若干 Variant，预览正向/负向文本替换结果后一次应用 |
| `GEN-PRESET-010` | 预制变更历史 | 记录和展示 preset/group 变更 | 现用 | PresetChangeLog/GroupChangeLog | change history service/UI | 保留并迁移到 RV-01～RV-10：Preset、Variant、Group 及 Template 的可编辑配置接入 shared 修改历史协议，由 image-production adapter 负责快照和恢复；删除 PresetChangeLog/GroupChangeLog 专属模型和服务 |
| `GEN-PRESET-011` | 使用情况查询 | 查找预制在项目/模板中的使用 | 现用+API | bindings | usage route | 保留为领域查询和正式 HTTP API，不新增独立“使用情况”页面。当前生产 UI 在删除 Preset 前调用该查询并列出受影响的项目/模板 Section；新版继续复用同一查询完成删除确认和外部调用 |
| `GEN-PRESET-012` | 级联清理并停用预制 | 清理 links、bindings、prompt blocks、manual LoRA 后设 `Preset.isActive=false`；Preset/Variant 主记录保留 | 现用/高风险 | 多域 bindings | cascade route | 改为物理删除而非停用/软删除：删除前把各 Section/Template Binding 的当前 Prompt 转为 `CustomText`、Preset LoRA 转为手动 LoRA，并从 Group 中移除成员；随后物理删除 Preset 和 Variant。归档项目也执行这项系统级转换 |
| `GEN-PRESET-013` | 绑定惰性解析最新预制 | Section/Template 绑定读取时解析最新源内容；手工 detach 不重新附着 | 现用/核心 | bindings/provenance/resolvers | preset resolvers | 保留惰性解析：未 detach 的 Binding 始终读取最新 Preset/Variant，不向使用方批量写入缓存 |
| `GEN-PRESET-014` | 旧 sync endpoint | `syncPresetToSections()` 只校验、revalidate 并返回 `skipped:true`，不主动重写使用方缓存 | 兼容/no-op | 外部调用者可能存在 | preset-sync、sync route | 新版移除：当前只返回 `skipped:true`，惰性解析不需要手工同步 Preset；删除旧 endpoint 和兼容调用 |
| `GEN-GROUP-001` | 预制组 CRUD/复制/排序 | 管理组合预制 | 现用 | PresetGroup | preset-group actions | 保留创建、编辑、复制、物理删除和拖放排序 |
| `GEN-GROUP-002` | 组成员与嵌套组 | 添加、替换、移除、排序普通预制或子组 | 现用/复杂 | PresetGroupMember | group member routes | 保留普通 Preset、子 Group 的添加、替换、移除和排序，并保留嵌套循环检测；解析到 Section 后每个具体 Preset 仍是独立 Binding，不融合内容 |
| `GEN-GROUP-003` | 固定槽位 | 按 category slot 安排组成员并支持 overflow | 现用/复杂 | slot template | group detail UI | 保留旧版行为：按分类 Slot 安排成员，未进入固定 Slot 的成员进入 overflow 区域并按明确顺序解析 |
| `GEN-GROUP-004` | 组扁平化 API | 递归解析嵌套组；只有隐藏 `/flatten` route 调用，当前 UI/导入链无调用者 | 隐藏/API-only | group resolver | flatten route | 保留内部递归解析能力，删除无 UI 调用的公开 `/flatten` HTTP 接口；Section Binding 和任务快照直接调用内部解析器 |
| `GEN-REPLACE-001` | 项目批量替换预制 | Dry Run、同分类约束、阻塞项、Apply、后验复查 | 现用 | Project bindings | replacement dialog/service | 保留并简化为单个模态框：选择原 Preset 和目标 Preset，展示受影响 Binding 数量及不能替换的项目，确认后一次应用；删除独立 Dry Run、分阶段 Apply 和后验复查流程 |
| `GEN-REPLACE-002` | 模板批量替换预制 | 同一流程作用于 template sections | 现用 | Template bindings | template replacement route | 保留并与项目共用同一简化替换操作，作用范围限定为当前 Template |
| `GEN-TPL-001` | 模板列表与 CRUD | `/assets/templates` 创建、编辑、删除 | 现用 | ProjectTemplate | template actions | 保留创建、编辑和物理删除，不增加归档或软删除；删除 Template 不影响已经创建或导入过它的项目 |
| `GEN-TPL-002` | 模板小节 CRUD/排序/复制 | 管理模板 sections | 现用 | ProjectTemplateSection | template actions/API | 保留新增、编辑、复制、删除和拖放排序；移除 `enabled` |
| `GEN-TPL-003` | 模板小节文件夹 | CRUD、排序、移动 template sections | 现用 | ProjectTemplateSectionFolder | section-folder actions | 保留多级文件夹和拖放移动。删除空文件夹可直接执行；删除非空文件夹时只允许“连同全部子文件夹和 Template Section 删除”或取消，不提供保留 Section 并移动到其他位置的功能 |
| `GEN-TPL-004` | 模板小节参数编辑 | KSampler、尺寸、批次、workflow | 现用 | TemplateSection params | template section page | 与项目 Section 使用同一参数协议：尺寸、生成数量、两阶段 KSampler、Seed、Checkpoint 覆盖和 LoRA；Workflow 由图像生产模块统一选择，不作为 Template Section 字段 |
| `GEN-TPL-005` | 模板提示词/预制/LoRA | 与项目 section 类似的 bindings、blocks、manual LoRA | 现用/复杂 | Template section 子表 | template prompt editor | 与项目 Section 使用同一 Segment、Binding、Group 和 LoRA 协议；Group 仍展开为多个独立 Preset Binding |
| `GEN-TPL-006` | 项目另存模板 | 将项目结构固化为 template | 现用 | Project -> Template clone | saveProjectAsTemplate | 保留：复制项目的完整文件夹层级、Section 归属/名称/顺序、参数、Segment、Binding 和手动 LoRA；不复制任务、结果、图片、项目 slug 或导出文件 |
| `GEN-TPL-007` | 模板导入项目 | 复制 template sections/folders/bindings | 现用 | Template -> Project clone | importTemplateToProject | 保留并完整迁移结构：向当前项目深复制 Template 的全部文件夹层级、父子关系、同级顺序以及每个 Section 的文件夹归属和顺序，不扁平化、不覆盖已有项目内容；导入后项目与 Template 独立，Preset Binding 继续保持绑定 |

### B6. Workflow 与 Generation 后台执行

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-WF-001` | 标准 workflow 配置 | 从版本化 JSON 加载 ComfyUI graph | 后台核心 | `config/workflows/standard-workflow.api.json` | workflow-prompt-builder | 保留版本化基础 Workflow；图像生产模块配置当前使用版本，不允许 Section 各自选择文件 |
| `GEN-WF-002` | 参数/提示词/LoRA 注入 | 将 resolved section 配置写入 graph | 后台核心 | Preset resolvers、Section snapshot | workflow builder | 保留确定性注入：将任务快照中的 Prompt、LoRA、尺寸、KSampler 和 Seed 写入 Workflow；目标节点缺失或类型不符时在提交前明确失败 |
| `GEN-WF-003` | 运行不可变快照 | 每个 Run 保存 resolvedConfigSnapshot/submittedPrompt | 后台核心 | Run JSON | enqueue/repository | 保留不可变快照但不把持久文件作为权威数据：创建任务时在数据库保存 resolved config 和最终 Workflow JSON；同一任务重试继续使用该快照，不受 Section、Preset 或基础 Workflow 后续修改影响，Attempt 只保存本次 promptId、时间和错误。下载时从数据库快照即时生成响应；若实现产生临时/缓存 Workflow 文件，必须放入项目受管目录，归档时删除这些磁盘文件但保留数据库快照，彻底删除项目时连数据库快照和文件一起删除 |
| `GEN-WF-004` | 当前小节 workflow 下载 | 下载生成前 workflow | 现用/诊断 | section-workflow route | section workflow service | 保留并补全两种下载：基于当前 Section 参数、resolved Prompt、LoRA 和模块当前 Workflow 生成“原始工作流”；也可从同一入口生成“调试工作流”。下载能力不代表 Section 可以选择另一套基础 Workflow |
| `GEN-WF-005` | 历史 Run workflow 下载 | 下载已提交 run 的 original workflow | 现用/诊断 | Run.submittedPrompt | run workflow route | 保留并补全两种下载：历史任务可下载当时实际提交给 ComfyUI 的不可变“原始工作流”，也可基于该快照转换并下载“调试工作流”；两者都不使用 Section 当前参数重新生成 |
| `GEN-WF-006` | Debug workflow 变体 | 把保存节点改预览、增加中间预览与尺寸切换 | 现用/诊断 | workflow debug transformer | 保留：继续从当前或历史原始 Workflow 派生 ComfyUI 前端可打开的调试版本，包括把保存节点改为预览、增加第一阶段中间预览和横竖尺寸切换；不得覆盖原始 Workflow 快照。当前产品术语为“原始工作流/调试工作流” |
| `GEN-EXEC-001` | 事务入队 | 按 enabled section / aspect ratio 创建 queued Run | 后台核心 | Project/Section/Run | enqueue.ts | 保留并重做：创建任务时先持久化为 `unsubmitted`；不得因 ComfyUI 未连接或训练占用 GPU 而丢失或直接失败，不再另建“缓冲队列”领域概念 |
| `GEN-EXEC-002` | ComfyUI 提交 | 验证 graph、提交 prompt、保存 promptId | 后台核心 | ComfyUI HTTP | run-executor/comfyui-service | 保留并重做：调度器只提交 `unsubmitted` 任务；每次提交先创建内部 Attempt，ComfyUI 可达且没有活动训练任务时幂等、有序提交，接收 promptId 后写入该 Attempt 并原子地把任务转为 `submitted`；不可达时任务保持 `unsubmitted`，不提示启动 ComfyUI；训练结束后自动恢复调度 |
| `GEN-EXEC-003` | 队列位置与历史轮询 | 等待开始、轮询完成/失败、有限并发 | 后台核心 | ComfyUI queue/history | run-executor | 保留并重构：WebSocket 按 promptId 接收即时 execution/progress/completion/error 事件；只要存在 submitted/running 任务，后台同时固定每 1 秒查询一次 queue/history 并以其校正权威状态，WebSocket 断线也不改变频率。Attempt 保存 submittedAt、startedAt、finishedAt、ComfyUI 排队耗时、实际生成耗时和错误，Task 按 `ARCH-010` 累计各阶段。一次 Attempt 不建模部分成功，全部结果持久化后才 completed |
| `GEN-EXEC-004` | 输出下载与持久化 | 下载图片、写 ImageResult 和受管文件 | 后台核心 | ComfyUI output、`data/images` | image-result-service | 保留并改为全有或全无：全部预期图片下载、校验和落盘成功后才创建正式 ImageResult；任一失败则任务失败并清理本次临时文件，不产生“部分成功” |
| `GEN-EXEC-005` | 延迟提交与恢复 | ComfyUI 不可达时保留 queued；后台恢复 stale runs | 后台核心 | Run 状态、恢复上限 | run-executor | 保留并重构：延迟提交就是任务保持 `unsubmitted`，等待原因包括 ComfyUI 不可达、GPU unavailable、GPU 恢复后等待 ComfyUI restart、restart 失败或 LoRA 训练占用；不另建缓冲队列。条件恢复后自动、幂等、有序转为 `submitted`；前端显示等待原因，不在任务创建流程提示启停 ComfyUI |
| `GEN-EXEC-006` | 启动孤儿清理 | server 启动把超过 30 分钟 running 标记 failed | 后台 | instrumentation + DB | instrumentation.node.ts | 移除固定“超过 30 分钟即失败”的孤儿清理；超时不能替代 ComfyUI 权威状态查询 |
| `GEN-EXEC-007` | 启动恢复 | server 启动恢复有 promptId 的活动运行；可选恢复 paused | 后台 | Run/ComfyUI | instrumentation.node.ts | 保留并按共同中断场景重做：应用启动后按 Attempt promptId 查询 ComfyUI queue/history，仍存在则恢复监控，已经完成则下载结果；ComfyUI 不可达时等待后续检查，确认可达但旧 prompt 不存在时把 Attempt 记为 interrupted，并将同一任务自动退回 `unsubmitted` 重新排队。paused 任务保持暂停，不自动恢复 |
| `GEN-EXEC-008` | 优雅关机暂停 | SIGTERM/SIGINT 尝试取消 Comfy prompt 并把活动 Run 改 paused | 后台/运维 | 进程信号、DB、ComfyUI | instrumentation.node.ts | 新版移除：应用关机不自动取消、暂停或中断 ComfyUI 任务；重启后由 `GEN-EXEC-007` 恢复状态 |
| `GEN-EXEC-009` | ComfyUI 队列缓存 | 短时缓存 queue snapshot，减少轮询压力 | 后台 | 内存缓存 | comfyui-service | 新版移除独立队列快照缓存：由唯一后台同步循环每 1 秒读取一次 queue/history 并分发结果，避免多个调用方重复查询；权威状态仍落在 Task/Attempt |
| `GEN-EXEC-010` | ComfyUI 精确取消 | 批量删除 pending prompt、按需 interrupt running | 后台/高风险 | ComfyUI queue | comfy-queue-cancellation | 保留并重构：作为取消和暂停已提交/运行中任务的共同底层能力；必须按稳定 prompt 身份操作并确认实际停止，避免错误中断其他任务 |

---

## C. LoRA Training 模式

### C1. 壳层、运行中心与项目生命周期

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-SHELL-001` | LoRA Training 工作模式入口 | 当前 `/training` 转 `/training/runs`，catch-all 承载全部生产路由 | 现用 | TrainingApp、Prisma snapshot | training page/app | 保留工作模式但按 TS-01 重写路由：正式入口为 `/lora-training/**`，使用 React Router 页面路由；移除旧 Next.js `/training` 重定向/catch-all 和 TrainingApp 分发入口 |
| `TRN-SHELL-002` | LoRA Training 路由 | 当前自有 23 route pattern/matcher | 现用/技术债 | 自定义 matcher 与 Next 路由重复 | `src/features/training/routes.ts` | 移除旧自定义 matcher；Projects、Tasks、Templates、Prompt Presets 及项目内 Profile/Sections/Materials/TrainingRuns 由 React Router 模块路由定义承载，保持对称、可辨认 URL 和浏览器历史 |
| `TRN-SHELL-003` | LoRA Training ModuleShell | 当前独立 Shell 依赖 DesignDemoShell/theme/feedback/routing | 现用/技术债 | shared AppShell 协议 | training shell/runtime | 保留模块外壳职责但彻底重做：接入 shared AppShell、主题、反馈与导航协议，拥有和图像生产完全对等的 LoRA Training ModuleShell；一级导航为项目、运行、模板、Prompt Preset，模型/设置只在 shared 导航出现 |
| `TRN-AUTO-001` | LoRA Training HTTP API | 当前 `GET /api/training` 手写巨型端点/Agent flow manifest | 隐藏/外部自动化 | 外部 Agent 与前端应共用领域 API | training root route | 移除手写能力清单和专用 Agent flow。前端与 Agent 共用 `/api/lora-training/**` 领域 API、验证和 Token 鉴权，不另建 `/agent/**`；来源 actor 写统一审计。接口文档以后由 shared schema/OpenAPI 生成，不在业务 Route 硬编码流程；旧 `/api/training/**` 不保留兼容代理 |
| `TRN-RUN-001` | 全局运行中心 | `/training/runs` 合并 GenerationTask 与 TrainingRun | 现用 | 当前把所有生成任务压成 generation，把 LoRA 训练作为 training | training runs page | 保留并重做：运行中心只管理训练素材生成任务和 LoRA 训练运行；Agent/用户维护的角色分析、Prompt 和 Caption 在项目工作流中管理，不与任务混排；训练输入预览不是运行记录 |
| `TRN-RUN-002` | 运行筛选 | completed/running/queued/failed 过滤 | 现用 | DB 状态映射丢失 draft/cancelled，并把取消伪装成 failed | runs UI | 保留并重做：两类真实执行任务接入 shared 状态协议并支持按任务类型、状态、时间和项目查询；构图候选、代表图和 Caption 完整性属于 Section 就绪状态，不作为任务状态 |
| `TRN-RUN-003` | 项目范围运行列表 | 项目下 generation-tasks 与 training-runs 两页 | 现用 | projectId | scoped runs page | 保留并合并为项目“运行”视图：按类型/状态/时间筛选训练素材生成 Task 与 LoRA TrainingRun；不再维护两套孤立列表逻辑 |
| `TRN-RUN-004` | Generation Task 详情 | 当前展示输入、输出、错误和状态 | 现用 | GenerationTask/Input/Result | run detail | 保留并重做：展示 Segment/Binding 快照、resolved Prompt、输入图片、Provider 参数、Attempts、错误和全部候选结果，并提供“应用本次参数到当前 Section”；同时显示 Provider 等待、实际生成、重试 Attempt 和总耗时 |
| `TRN-RUN-005` | TrainingRun 详情 | 当前展示进度、产物和错误 | 现用 | TrainingRun/Sample/Checkpoint | run detail | 保留并重做：展示 TrainingRunSample、resolvedConfig、进度、checkpoint、日志、取消/失败重试，以及 pending 等待、staging/准备、实际训练和总耗时；checkpoint 可执行“复制到 ComfyUI LoRA 模型目录”，并显示/复制本机或远程源文件绝对路径 |
| `TRN-RUN-006` | 运行隐藏 | UI “删除”非 draft 运行时只写 `hiddenAt` | 现用/软删 | 无恢复 API | run-visibility-service | 移除 hiddenAt 和“删除即隐藏”语义。运行记录保留或通过明确清理/删除操作处理；具体历史删除范围回到延期的全应用历史清理组统一决定 |
| `TRN-RUN-007` | 运行取消 | 当前 Generation/Training cancel API 主要写 DB 状态 | 现用/高风险 | worker/provider/受管进程 | cancel routes | 保留并修复：训练素材生成取消必须通知实际 Provider/worker；LoRA TrainingRun 取消必须终止受管训练进程，确认后才写 cancelled，不得标成 failed |
| `TRN-RUN-008` | 运行重试 | 当前 Generation 重建 task、Training 重建 TrainingRun | 现用 | Task Attempt、sd-scripts state | retry services | 保留并区分：训练素材 Task 参数不变时在同一 Task 下新建 Attempt，需修改时先应用到 Section 再创建新 Task；LoRA 训练故障从最近 sd-scripts state 显式重试同一 TrainingRun，核心参数/输入改变才建新 Run |
| `TRN-PROJ-001` | Training 项目列表 | `/training/projects` 当前/归档项目 | 现用 | TrainingProject | projects page | 保留并重做：active 与永久只读 archived 分区/筛选展示；项目业务状态只持久化 active/archived，缺选图、缺 Caption、生成/训练中等均实时派生 |
| `TRN-PROJ-002` | 项目拖拽排序 | 写 `sortOrder` | 现用 | TrainingProject | project-order-service | 保留：active 项目支持拖拽持久化 sortOrder；归档项目不参与 active 排序 |
| `TRN-PROJ-003` | 项目详情与当前完整性 | 当前汇总 profile、references、sections、results、dataset、runs 缺项 | 现用 | 多个 Training 模型 | project detail | 保留并重做：聚合三个角色文本、参考图、Section/代表结果/Caption、生成任务、TrainingRun/checkpoint 和归档状态；提供项目级“训练素材”工作台集中查看每个 Section 的候选/代表图并编辑 Caption；不再使用 DatasetVersion 或持久化 draft/ready/training 项目状态 |
| `TRN-PROJ-004` | 项目归档 | 写 `status=archived` / `archivedAt` | 现用 | 当前不清理文件 | archive route/service | 保留并重构为永久只读归档：不要求选择或登记唯一最终 LoRA。保留 Project/Profile/Section、Section Caption、参考图、生成 Task/Result、TrainingRun/Sample、训练参数/manifest/必要日志及业务文件；删除该项目 Training checkpoint 输出目录中的全部模型文件、runner 临时 workspace、缓存和失败临时文件。此前复制到 ComfyUI LoRA 模型目录的模型完全独立、不受归档影响；不提供清理预览或恢复为 active |
| `TRN-PROJ-005` | 项目恢复 | 归档项目恢复 active | 现用 | TrainingProject | restore route | 移除：新版归档是永久只读状态，不实现恢复/取消归档功能。保留数据是为了查看、追溯和必要时人工复现，不代表项目能重新变为 active |
| `TRN-PROJ-006` | 项目硬删除 | DELETE 级联删除 DB 大量 Training 记录 | 现用/高风险 | 当前不删除磁盘目录，产生孤儿文件 | project delete service | 保留并重构为真正彻底删除：删除 Project、Profile、Section、生成 Task/Result、TrainingRun/Sample/Checkpoint、参考图、生成图片、日志、manifest、项目 Training checkpoint 输出目录和临时目录。ComfyUI LoRA 模型目录中的复制文件从未与项目绑定，删除项目不得查询、提示或删除这些模型；不提供清理预览 |
| `TRN-PROJ-007` | 隐藏项目 | service 存在 `hiddenAt`，无生产路由调用 | 隐藏/未接线 | 兼容残留 | project-visibility-service | 新版移除 `hiddenAt` 和未接线隐藏服务；项目只有 active、永久只读 archived，以及彻底删除三种生命周期 |
| `TRN-PROJ-008` | 归档写保护 | 当前部分 reference/profile/section API 仍可改归档项目 | 部分/缺陷 | 新版需统一 policy | 多个 Training services | 保留并修复：归档项目所有业务写接口统一拒绝修改，包括 Profile、Section、Caption、参考图、生成和训练；仅允许读取、下载保留文件及执行“删除项目” |

### C2. 项目创建、档案、参考图与文本历史

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-CREATE-001` | 统一 TrainingProject 创建入口 | 当前空白项目走 `/training/projects/new` | 现用 | TrainingProject/Profile/Template | project form/service | 保留并合并：只有一个新建项目页面；表单内可选 TrainingTemplate。未选择则创建空白项目，选择后立即把模板的名称建议、Base checkpoint 和训练默认参数预填到同一表单供编辑，提交创建时再深复制剩余 TemplateSection/Segment/Binding/Caption/生成参数 |
| `TRN-CREATE-002` | 可选 Template 创建 | 当前另有从模板复制全树流程 | 现用 | TrainingTemplate 全树 | project-template-copy-service | 合并进 `TRN-CREATE-001`，不再提供独立“从模板创建”入口。创建后项目不随 Template 更新；深复制 Segment 行，PresetBinding 继续引用 Preset，CustomText 复制文本 |
| `TRN-CREATE-003` | 选择共享 checkpoint | 项目新建读取 `/api/models?kind=checkpoint` | 现用/共享依赖 | 模型管理 | project form | 保留模型管理模块选择器，但创建项目时不必选择。Template 可预填默认模型身份，Project 允许为空；真正启动 TrainingRun 时必须从共享模型管理模块选择有效 Base checkpoint，不允许手填绝对路径 |
| `TRN-CREATE-004` | 从其他项目选引用 | 当前可挑选已有 reference/kept 结果并复制到新项目 | 现用 | 跨项目文件读取/复制 | reference picker/create service | 移除且不列入后续 shared 规划：不做跨项目媒体引用、选择或复用。用户需要旧图片时自行复制粘贴/重新上传到新项目 |
| `TRN-CREATE-005` | 新建时上传参考图 | 本地文件上传并写 references | 现用/写文件 | `data/images/training/.../references` | create hooks/services | 保留但不作为创建必填：统一创建表单只要求项目名称；Template、Base checkpoint、参考图和 triggerToken 都可为空。创建时若上传图片则每张只落盘一个 Artifact/Blob 并按 Hash 去重；参考图可在项目创建后随时补充 |
| `TRN-CREATE-006` | 初始化 sections | 新建时预置/复制/启停初始 sections | 现用 | TrainingSection | project create form | 保留并简化：从 TemplateSection 完整初始化 Section 参数区；不再复制 enabled。创建项目时上传的全部角色参考图默认填入每个 Section 的有序输入图片列表，但各列表只创建指向同一 Artifact 的轻量关系，不复制文件。项目创建后新增的角色参考图保持可选，并提供“添加到全部构图”批量动作，不静默改动既有 Section |
| `TRN-CREATE-007` | 未落地创建配置 | baseModel、captionStrategy、perSectionImageCount、trainingSteps 基本不进入执行 | 部分/表单承诺 | 删除或真正接线 | project form/service | 拆分并真正接线：图片候选数量已归每个 TemplateSection/Section；Base model 与训练参数默认值归 TrainingTemplate 顶层，创建项目时复制到 TrainingProject，启动训练时允许覆盖并固化到 TrainingRun。不存在独立 captionStrategy；Caption 是 Section 普通文本 |
| `TRN-CREATE-008` | 未落地自动流程 | autoGenerateSamples、autoFreezeDataset 可被 schema 接受但无自动执行 | 部分 | 不能当现成功能 | project create schema | 新版移除 `autoGenerateSamples`、`autoFreezeDataset` 等不会执行的 schema 字段和 API 参数，不保留虚假自动流程 |
| `TRN-PROFILE-001` | 角色档案 | `/profile` 编辑 `loraUsagePrompt` 与角色细节 JSON；triggerToken 只展示/创建时设置，不能在该页持久修改 | 现用 | TrainingCharacterProfile | profile page/service | 保留并重构：角色级文本只有三个一等字段——后续生产触发词 `triggerToken`（不得与项目 URL `slug` 混淆）、Agent 分析后由用户审核的完整 `characterDescription`、由完整描述简化为 tag 形式的后续生产 `productionPrompt`。三个字段都允许为空，triggerToken 不根据项目名称自动生成；前端使用普通单行/多行编辑组件和规范 GET/PATCH 接口。训练 Caption 属于 Section，不归入角色文本 |
| `TRN-PROFILE-002` | profileSummary 与生成任务关联残留 | 参数不持久化，现有 Profile 还含若干文本生成 Task 关联 | 部分/缺失 | 已确认三个权威文本字段 | profile service/schema | 移除 profileSummary、loraUsagePromptGenerationTaskId、characterDetailPromptGenerationTaskId 等残留；Profile 只保留 triggerToken、characterDescription、productionPrompt |
| `TRN-REF-001` | 参考图上传 | 写文件、TrainingArtifact、TrainingCharacterImage | 现用/写文件 | references 目录 | reference API | 保留并重构：项目参考图使用 Artifact/Blob 单份存储和 Hash 去重；Section 输入、Task 输入快照和其他引用都复用同一字节对象，只保存关系、顺序及当时 Hash |
| `TRN-REF-002` | 参考图名称、说明与排序 | 当前 PATCH label/note/sortOrder | 现用 | TrainingCharacterImage | reference API/UI | 保留但改用明确名称：`name` 是项目内短名称，默认取文件名，用于缩略图、选择器和 Prompt 引用；`description` 是可选的角色/用途说明；`sortOrder` 控制项目参考图库顺序。删除含义模糊的 label/note 命名；某张图在具体 Section 中承担的角色可由 SectionInput 自己的可选说明覆盖 |
| `TRN-REF-003` | 删除参考图 | 当前只删关系，不删 Artifact 或文件 | 现用/生命周期不完整 | 会遗留磁盘资产 | reference delete route | 保留删除关系能力并重构文件生命周期：从角色参考图列表移除不等于立即删除底层字节；只要仍被 Section、生成 Task、结果或 TrainingRun 输入快照引用，Artifact/Blob 就必须保留。无任何引用后才进入可清理状态 |
| `TRN-REF-004` | 参考图加入结果池 | 复用引用图为 TrainingImageResult | 现用 | CharacterImage/Artifact/ImageResult | add-to-results route | 移除：原始角色参考图只作为 Section 生图输入；训练集只使用 Section 选中的生成结果，不再把参考图转换为结果候选 |
| `TRN-REF-005` | 已有 Artifact 注册为参考图 | 当前隐藏 API 可按 artifactId/relativePath 注册 | 隐藏/API-only | 主要用于内部写入，不应成为跨项目入口 | reference-images POST | 简化为模块内部服务：供本项目上传去重和 Section 手工输入转项目参考图等受控流程使用，不作为普通跨网络公开 API，也不支持从其他 TrainingProject Artifact 注册 |
| `TRN-TEXT-001` | 文本修订历史 | Profile 保存自动创建 revision；Caption revision 只有显式调用 text-revisions POST 才创建，普通 caption 保存/PATCH 不自动版本化 | 现用/不一致 | TrainingTextRevision | text-revision-service | 保留并迁移到 RV-01～RV-10：三个角色文本和 Section Caption 的明确保存操作统一创建 shared RevisionEntry；Caption 所有权按新版模型归 Section，不再给 ImageResult 建文本修订。删除 TrainingTextRevision 专属模型和旧 reasons |
| `TRN-TEXT-002` | 文本历史恢复 | 覆盖前先写 before_overwrite，再恢复旧内容 | 现用 | Profile/ImageResult | restore route | 保留并统一到 shared 修改历史抽屉和恢复接口；由 lora-training adapter 校验并恢复角色文本或 Section Caption，恢复前的当前状态作为一条普通新 RevisionEntry 保存，不再使用 before_overwrite 特殊 reason |
| `TRN-TEXT-003` | PromptCardVersion 兼容概念 | 实际映射当前 Profile，不是真正多版本实体 | 兼容/命名不实 | 已确认普通文本字段，修订后续 shared 化 | profile/text code | 移除 PromptCardVersion 名称、兼容映射和接口；当前 Profile 直接返回三个权威文本字段，修订历史以后接 shared 通用能力 |

### C3. Training sections 与场景描述

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-SEC-001` | 项目 sections 列表 | `/training/projects/:id/sections` | 现用 | TrainingSection | sections page | 保留并迁移到正式 `/lora-training/projects/:id/sections`；作为项目内视图展示 Section 顺序、代表图、Caption 完整性和近期生成任务，不使用 `enabled` 状态 |
| `TRN-SEC-002` | Section CRUD/复制/启停 | 新建、复制、编辑、删除、enabled | 现用 | TrainingSection | project-section-service | 保留新建/复制/编辑/删除，移除 enabled 启停语义；需要保留既有任务历史但退出当前训练方案的场景，后续在归档/删除组单独设计，不复用 enabled |
| `TRN-SEC-003` | Section 排序 | 拖拽持久化 | 现用 | sortOrder | reorder API | 保留：`TrainingSection.sortOrder` 只表示同一个 TrainingProject 内构图项的展示、Agent 处理和 Dataset 排列顺序；`TrainingTemplateSection.sortOrder` 则表示同一模板内的初始顺序，创建项目时复制过去。它不是跨项目的全局顺序 |
| `TRN-SEC-004` | Section 详情 | `/sections/:sectionId` 编辑场景并查看结果；seed hook 只有 UI-local 状态，没有实际 PATCH/持久化合同 | 现用+部分 | Section/Bindings/Runs | section detail UI | 保留并重做为长期“构图生成工作区”：系统字段为 id、name 和项目内 sortOrder；Section 保存有序 PromptSegment（PresetBinding 或 CustomText）、有序输入图片、图片 size/quality/background 等 Provider 参数、候选数量、唯一代表结果及权威 trainingCaption。界面实时展示 resolved Prompt，并通过普通组件/规范 HTTP 接口维护 |
| `TRN-BLOCK-001` | Section Prompt Segment CRUD | 当前新建/编辑/删除/排序 TrainingSceneDescriptionBlock | 现用 | PromptSegment | scene-block service | 保留并重构为有序 Segment：每段只能是持续 `preset_binding` 或 `custom_text`。完全手写 Prompt 可只使用一个长 CustomText；不存在另一份独立可编辑 generationPrompt，避免绑定结构与整段文本双重真相 |
| `TRN-BLOCK-002` | 绑定 Prompt Preset | 当前从 Training preset 导入块，多为文本快照 | 现用/快照 | Preset/Binding | scene-block service | 保留并升级为稳定 Binding：Section 可同时绑定场景 A、姿势 B、机位 C 等多个 Preset，并按 Segment.sortOrder 确定性解析；绑定在 Preset 更新后使用新内容，不再只是一次性文本插入 |
| `TRN-BLOCK-003` | Detach Preset Binding | 当前把 preset 来源块改为本地文本 | 现用 | Binding/CustomText | detach route | 保留：detach 时把当前解析文本复制为 CustomText 并删除 Binding，之后不再随 Preset 变化；支持单 Segment detach，不引入隐藏 fallback |
| `TRN-BLOCK-004` | Resolved Prompt/Caption baseline | 当前 scene-description 与 imagePrompt 合同分散 | 现用/分散 | bindings + custom text | resolved route、section detail | 保留并统一：确定性编译器按顺序解析所有 Segment，生成透明可预览的 resolved generation Prompt；Preset 可提供可选 Caption 文本，同一绑定列表可生成 Caption 初始基线，但不得自动覆盖 Section 已编辑的权威 trainingCaption。每次 Task 必须保存实际 resolved Prompt 和 Segment 轻量快照 |
| `TRN-BLOCK-005` | 旧公开 ID 兼容 | publicSectionId/publicBlockIds 同时支持旧 ID | 兼容 | 数据 JSON 中旧身份 | services/repositories | 移除：新版 Segment/Binding 只使用稳定数据库 ID，不保留 publicSectionId/publicBlockIds 双身份兼容 |
| `TRN-SEC-005` | 全量重建 section 集合 | 隐藏接口会删除并重建全部 sections/blocks | 隐藏/高风险 | ID 稳定性和引用 | `setTrainingProjectSectionCollection` | 新版移除隐藏的全量删除重建接口；只使用单项 CRUD、复制和排序，保持 Section ID、任务及结果引用稳定 |

### C4. Dataset 图片 Generation 与结果审核

2026-08-26 对 `D:\Luca\Code\MyProject\gpt-image-2-generator` 做了只读实践样本核对：SQLite 中有 274 个生成任务、84 个有任务的 section、其中 65 个 section 含多个版本，平均每个有任务 section 3.23 个任务；73 个 section 选择了一个成功任务作为 representative。1766 条输入图片引用只有 93 个不同原始文件名，说明项目参考图被跨构图/版本大量复用。两个角色之间存在 23 组相同 A/B/C 构图编号；每组取首次完整 Prompt 比较，词汇 Jaccard 相似度平均约 0.243，标题/段落结构 Jaccard 平均约 0.083。该证据只说明不能把任意历史最终 Prompt 无损反向拆回固定 Blocks；它不能否定从已知角色上下文、Preset Binding 和自定义文本正向、确定性地编译 Prompt。历史 Prompt 中反复出现 Reference roles、Global character rules、Shot request、Background rule、Hard avoid 等语义段，反而为绑定模型提供了一定支持。最终 Task 无论采用何种编辑模型，都必须保存实际提交的完整 Prompt 快照。独立项目和历史数据均未修改。

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-GEN-001` | Section 生成工作区 | 当前为 Section 创建独立 generation task draft | 现用 | TrainingGenerationTask | compose page | 保留但归入 Section：Section 固定展示 Segment/Binding 编辑器、resolved Prompt、输入图片和参数。点击生成才创建不可变 Task。历史 Task 提供“应用到当前 Section”，恢复其 Segment 快照、输入顺序和 Provider 参数后再编辑/生成，不修改历史 Task |
| `TRN-GEN-002` | 训练集图片生成 | 当前 UI 图片任务只暴露训练集图片生成 | 现用 | GPT-Image worker | compose/task service | 保留为唯一图片生成任务：每条 Task 快照 Section 当时的 Segment/Binding 结构、resolved Prompt、输入图片和 Provider 参数，并可产生多个候选；不建立 sourceTask/correction 派生模型，历史应用动作只覆盖当前 Section |
| `TRN-GEN-003` | 角色描述/说明文本任务 | UI 可创建 text_generation，但 worker 不消费 | 部分/阻塞 | 会永久 queued | provider policy/worker discovery | 移除为任务类型：Agent 分析与用户指正直接写入角色资料，不创建 text_generation 队列；修订历史作为 shared 通用能力后续核对 |
| `TRN-GEN-004` | Caption 类型任务 | 底层支持，但实际 Caption 页另走同步伪生成 | 部分/重复 | 两套语义 | task service/caption service | 移除为任务类型：Agent/用户直接编辑 Section Caption，不创建 Caption worker 任务；Caption 完整性属于 Section 和 Dataset readiness |
| `TRN-GEN-005` | Section 输入图片选择 | 当前 GenerationTask 绑定 profile/scene/CharacterImage/历史结果 | 现用 | SectionInput/TaskInput snapshot | inputs route | 保留并重做：有序输入列表归 Section；输入区提供项目参考图库快速选择器（缩略图、多选、全选/取消、加入并排序），同时支持 Section 手动上传和引用历史生成结果。SectionInput 可写可选用途说明；Task 快照保存 Artifact ID、顺序、说明和 Hash，不复制字节 |
| `TRN-GEN-006` | Supplemental 图片 | 上传任务本地补充图 | 现用/写文件 | task supplemental 目录 | 合并：不再区分 supplemental 与其他输入图片；Section 手动上传的图片也只落盘一次并注册 Artifact，Section 与所有 Task 快照复用同一字节对象 |
| `TRN-GEN-007` | Generation preview | 当前预览最终 payload 后再入队 | 现用 | Section resolved state | preview route | 保留在 Section 工作区：预览 resolved Prompt 并逐段标明 Preset/CustomText 来源，同时显示输入图片顺序、Provider 参数和候选数量；确认生成后才创建 Task 快照 |
| `TRN-GEN-008` | Generation run/cancel | 当前 draft -> queued -> running -> done/failed/cancelled | 现用 | Task + worker | run/cancel routes | 保留并按 LTD-10～LTD-11 简化：Task 保存构图 ID、Segment 轻量快照、实际 resolved Prompt、有序 Artifact/Hash 快照、Provider 参数、请求候选数、状态/时间/错误和候选结果。一次 Attempt 可执行多次单图调用；部分成功候选保留，Task 因数量不足标 failed，重试同一 Task 只补缺少数量。用户调整必须先改 Section 再建新 Task；TrainingSectionRun 合并删除 |
| `TRN-GEN-009` | Generation output 列表 | 读取 worker 输出并映射结果候选 | 现用 | TaskOutput/ImageResult | outputs route | 保留候选结果能力并迁移为 LoraTrainingImage：每次训练素材生成 Task 可产生多个候选，部分成功也直接进入 Section 候选集合；候选没有审核状态，Section 通过唯一 selectedImageId 选择当前最接近“权威训练素材”定义的代表图片。Section Caption 描述权威训练素材本身，更换或清空代表图片都不得自动清空或修改 Caption |
| `TRN-GEN-010` | 候选加入角色参考图库 | 当前按 SHA 去重后复用 Artifact 为 CharacterImage | 现用 | 不复制字节 | generation-output-service | 保留：任意 Section 候选可零拷贝注册为本项目角色参考图，填写 name/description 后用于后续 Section 快速选择；这不等于把原始参考图直接加入训练输入样本 |
| `TRN-GEN-011` | 输出应用到 result pool | 当前基本 no-op | 占位 | 结果已直接属于 Section | generation-output-service | 移除：生成与手动上传都会直接给 Section 创建 TrainingImageResult，不存在额外“应用到结果池”步骤 |
| `TRN-GEN-012` | 参考图生成任务类型 | `reference_image_generation` 仅为底层/API 类型，当前生产 UI 不暴露 | 隐藏/API-only | GPT-Image worker | 移除：原始角色参考图由用户添加并作为 Section 生成输入，不保留独立“参考图生成”任务类型 |
| `TRN-GEN-013` | Draft GenerationTask 删除 | 当前 draft Task 可物理删除，非 draft 只 hidden | 现用/双语义 | 新版无独立 Task Draft | generation-task DELETE | 移除：生成参数长期保存在 Section，确认生成时才创建 Task，因此不存在待物理删除的 GenerationTask draft；终态历史删除随全应用历史清理组决定 |
| `TRN-RESULT-001` | 项目“训练素材”汇总页 | 当前 `/results` 是无明确流程的候选池 | 现用 | TrainingSection/ImageResult/Caption | results page | 保留并全面重做：按 Section 汇总候选数量、当前唯一代表图和权威 Caption；支持集中选择/更换代表图、编辑 Caption、查看缺选图/缺 Caption 的 Section，并跳转 Section 详情。它不是 reviewStatus Results Pool |
| `TRN-RESULT-002` | Section 候选区 | 当前 Section 详情查看和审核结果 | 现用 | TrainingSection/ImageResult | section workspace | 保留并简化：同一候选集合同时接收生成和手动上传的图片；选择关系只由 Section.selectedResultId 表达，无 keep/reject 状态 |
| `TRN-RESULT-003` | 结果 keep/reject | `pending -> keep/reject` | 现用 | reviewStatus | review route | 移除：新版删除 `reviewStatus` 及 keep/reject 状态机。候选图片只有“是否被构图唯一选中”这一关系；全部抛弃时该构图不选择任何候选并可创建下一次生成，旧候选仍随历史生成任务保留或由清理功能处理 |
| `TRN-RESULT-004` | Section 手动添加图片 | 当前上传会写结果并可能伪造完成 Task/Run | 隐藏/API-only/写文件 | TrainingImageResult/Artifact | image upload | 保留并统一：手动上传与生成本质相同，都是为指定 Section 创建一条 TrainingImageResult。上传结果直接进入同一候选集合，generationTaskId 为空，不伪造 Task/Run，也不建立独立 sourceType 业务分类 |
| `TRN-RESULT-005` | 结果编辑 | PATCH 只支持 `captionDraft` 与 `reviewStatus` | 现用 | TrainingImageResult | image result route | 简化：删除候选结果上的 `reviewStatus` 和 Caption 字段编辑；结果只维护图片 Artifact 与来源 Task。最终选中/取消选中、训练 Caption 均由 Section 接口负责 |
| `TRN-RESULT-006` | 候选结果删除 | 当前只写 removedAt/removeReason，不删文件 | 现用/软删 | Selected/TrainingRunSample 可能引用 | image result delete | 保留明确删除：候选未被 Section 选中且未被 TrainingRunSample 引用时可删除结果记录；否则必须先解除引用。底层 Artifact 仅在所有引用归零后清理，不再用 removedAt 长期伪删除 |
| `TRN-CAP-001` | 单图 Caption API | 若未传文本，生成固定模板字符串；当前 UI 无调用者 | 隐藏/API-only/伪生成 | 不调用 AI provider | caption-service | 移除伪生成并改变所有权：Caption 由 Agent 或用户作为 Section 对“权威训练素材”的普通多行文本定义，通常在选出代表图片后编写，但数据所有权不依赖代表图片；提供规范 Section GET/PATCH 接口，不创建 Caption task，也不伪造固定内容。更换/清空代表图片不得自动改动 Caption |
| `TRN-CAP-002` | 批量 Caption | selected、kept_without_captions 或显式 map | 现用 | 同步写 trainingCaption | captions route | 简化保留批量写入能力：Agent 可提交 `sectionId -> trainingCaption` 映射；删除 imageResult selected/kept/reviewStatus 查询语义，目标范围由显式 Section ID 决定 |
| `TRN-CAP-003` | Caption 任务展示 | 返回 synthetic completed task，不创建真实 Task | 部分/命名不实 | UI 可能误认异步 AI | caption-service | 移除：Caption 不再展示为任务，删除 synthetic completed task 响应 |

### C5. 数据集与 TrainingRun

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-DATA-001` | 训练输入预览 | 当前 Dataset readiness 检查 kept 数量和 Caption 缺口 | 现用/分散 | ImageResult；UI 额外读取 TrainingRun | 保留为实时查询而非领域实体：没有 `selectedResultId` 的 Section 直接忽略；有代表图的 Section 只要求同时存在非空 `trainingCaption`。只要至少存在一组“代表图片 + Caption”即可启动一次训练，不额外检查角色描述、生产 Prompt、活动生成任务或文件 Hash |
| `TRN-DATA-002` | 启动训练并创建输入快照 | 当前先创建 DatasetRevision，再从 Revision 创建 TrainingRun | 现用/核心 | manifest/items | project dataset service | 合并进 TrainingRun 创建：用户预览当前训练输入后点击启动，应用一次性创建 TrainingRun、最终训练参数快照和本次输入样本快照；不再预先创建或选择训练集版本，也不保留独立 Revision/Freeze/Create Version 流程 |
| `TRN-DATA-003` | 独立训练集版本列表/详情 | 当前 `/dataset` 与 `/dataset/revisions/:id` | 现用 | Revision/Items/Artifact | dataset pages/routes | 移除：不再存在 `TrainingDatasetVersion`、版本列表和详情路由。历史训练使用了哪些图片与 Caption，直接在对应 TrainingRun 详情中查看 |
| `TRN-DATA-004` | TrainingRun 输入样本 | 当前 RevisionItem 固化 caption/path | 现用 | RevisionItem | freeze logic | 保留快照能力并迁移为 `TrainingRunSample`：每条只保存 TrainingRun ID、Section ID、当次排列顺序、选中结果 ID、图片 Artifact 引用和 Caption 文本副本；来源生成 Task 可由选中结果追溯，不重复复制 Prompt 或 Provider 参数 |
| `TRN-DATA-005` | TrainingRun 样本图片复用 | 当前 RevisionItem 指向原 Artifact，不复制图片 | 现用/高耦合 | 删除源文件会破坏历史 revision | dataset model | 保留零拷贝并补强生命周期：`TrainingRunSample` 引用 Artifact/Blob，不复制图片；TrainingRun 历史存在期间底层字节必须保留，源候选关系删除不能破坏历史训练输入 |
| `TRN-DATA-006` | 训练预览/启动规则一致性 | 当前 readiness 与 freeze 门槛不一致 | 缺陷 | 新版需统一 | readiness/freeze services | 保留并修复：实时预览和启动训练使用同一条最小规则——只纳入有代表图且 Caption 非空的 Section；未选图 Section 被忽略。启动事务创建的 TrainingRunSample 永久不随 Section 后续修改而变化 |
| `TRN-TRAIN-001` | 创建 TrainingRun | 当前从 dataset revision 入队，默认 2400 steps | 现用 | TrainingRun/Revision | 保留并重构：点击启动训练时直接从当前 Section 状态创建 TrainingRun 及其 `TrainingRunSample[]`，不依赖训练集版本。TrainingTemplate 的训练默认参数复制到 Project，启动时允许修改，TrainingRun 保存最终解析后的完整参数快照；具体参数项后续逐个核对 |
| `TRN-TRAIN-002` | 启动输入校验 | 当前允许非 ready revision 入队 | 缺陷 | 可能训练不完整数据 | create run service | 简化：不再校验 Revision；只要求当前至少存在一组“代表图片 + 非空 Caption”。启动时将这些内容一次性写成 TrainingRun 输入快照 |
| `TRN-TRAIN-003` | 全应用活动 TrainingRun 限制 | 当前每项目最多一个未隐藏 queued/running | 现用 | DB query | create run | 保留并收紧：假设应用只运行在单 GPU 设备上，全应用同时最多一个 `pending` 或 `running` 的 LoRA TrainingRun，不按项目或 compute target 分片，也不设计多 GPU 并行 |
| `TRN-TRAIN-004` | Training 进度与中间模型 | 当前 worker 只回报 step、消息、scheduler 数据 | 现用 | TrainingRun.progress | progress route | 保留进度并扩展：新增应用可配置 `checkpointEverySteps`，从 TrainingTemplate 默认值复制到 Project，启动 TrainingRun 时允许覆盖并固化；LoRA 训练执行器按该间隔保存中间模型，并始终保存最后一步。应用实时登记、展示和管理全部 checkpoint，并持续更新 staging/准备与实际训练阶段耗时 |
| `TRN-TRAIN-010` | TrainingRun 状态机 | 当前使用 queued/running/done/failed，取消也写 failed | 现用/缺陷 | worker polling、runner process | TrainingRun.status | 简化为 `pending`（记录已创建、等待 training worker 启动 runner）、`running`、`completed`、`failed`、`cancelled`。当前 worker lease 后直接启动 runner，没有独立外部提交队列，因此不使用 unsubmitted/submitted；暂不加入 paused，checkpoint 的恢复语义在下一组决定 |
| `TRN-TRAIN-005` | Training cancel | 写 cancelRequestedAt 并立即标 failed | 现用/不完整 | 不终止真实外部 runner | cancel route/worker | 保留并修复：取消必须由 LoRA 训练执行器真正终止受管训练进程，确认停止后写 `cancelled`，不得伪装成 failed；已经生成的 checkpoint 保留在 TrainingRun checkpoint 输出目录，归档前可管理或复制到 ComfyUI LoRA 模型目录 |
| `TRN-TRAIN-006` | Training completion 与 checkpoint | 当前只记录 final LoRA 与日志 Artifact | 现用/信任外部 | 不验证文件存在/大小/hash | completion.ts | 保留并重构：最后一步仍必须保存 checkpoint 并标记 Run completed，但不建立 `finalCheckpointId`、项目唯一最终 LoRA 或“采用版本”关系。所有 checkpoint 都是可独立操作的训练结果，用户可将任意多个复制到 ComfyUI LoRA 模型目录 |
| `TRN-TRAIN-007` | Training poll | POST 实际只是读取 GET 语义 | 占位/兼容 | 可删除或改真正轮询 | poll route | 移除：LoRA 训练执行器通过结构化事件主动更新进度与 checkpoint，读取统一走 TrainingRun GET/查询接口，不保留伪 poll POST |
| `TRN-TRAIN-008` | Training cleanup | 当前永远 `cleaned:false` | 占位 | 没有临时产物清理 | cleanup route | 重构为真实清理能力：运行中不得删除 checkpoint；训练结束后默认保留全部，允许用户手工清理。项目归档删除项目 Training checkpoint 输出目录中的全部模型文件及临时文件，但保留 Section、Caption、参考/生成图片、TrainingRun 输入和参数记录；彻底清理其他资源属于项目删除 |
| `TRN-TRAIN-009` | checkpoint 复制到模型库 | 当前“从完成训练创建预制”实际创建 TrainingSceneDescriptionPreset | 部分/命名不实 | 训练输出/ComfyUI 模型路径隔离、文件复制、模型索引 | run-preset-service | 移除“最终 LoRA/创建预制”语义，重构为显式“复制到模型库”：用户可以把任意 Run 的任意 checkpoint 从 TrainingRun checkpoint 输出目录单向复制到 ComfyUI LoRA 模型目录，并按模型模块规则选择名称/目录和填写模型元数据。复制后双方完全解绑；不保留来源项目/Run 外键、不反向同步，源文件删除/项目归档也不影响目标模型 |
| `TRN-TRAIN-011` | TrainingRun checkpoint 与恢复 | 当前没有中间模型实体或恢复协议 | 新版缺失 | sd-scripts checkpoint、失败重试、延伸训练 | 无完整实现 | 按 LTD-14～LTD-16 新增轻量 LoraTrainingRunAttempt 与 LoraTrainingCheckpoint；模型 checkpoint 使用 sd-scripts 原生 save_every_n_steps，需要完整续训时使用 save_state/resume。执行进程意外退出后把 Run 标为 failed并结束当前 Attempt，用户从最近可用状态显式重试同一 Run并创建新 Attempt；不实现自动进程接管、事件 outbox 或复杂恢复控制面 |
| `TRN-TRAIN-012` | Training 参数合同 | 当前表单字段大量未接线，真实历史 TOML 参数由脚本手工维护 | 新版领域约束 | Template/Project/Run 参数继承、sd-scripts config | 历史 TOML、training form | 保留并明确：Base checkpoint 从共享模型管理模块选择；Template → Project → TrainingRun 继承并允许逐层覆盖。普通参数为最大步数（默认 4000）、checkpoint 间隔（500）、LoRA rank/alpha（32/16）、分辨率（1024×1024）、batch（1）、optimizer（AdamW8bit）和主学习率（1e-4）；高级参数为 bucket（启用、256–1280、step 64）、U-Net only/Text Encoder LR、cosine scheduler/warmup 200、keep tokens 2 和 caption dropout 0。混合精度按 LE-08 使用机器级 `bf16/fp16` 设置，gradient checkpointing、SDPA、缓存和单进程由执行器固定启用；路径、输出名、日志和 tokenizer cache 由执行器生成，用户不得填写绝对路径 |

### C6. Training 预制与模板

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-PRESET-001` | Training Prompt Preset CRUD | 当前 `/training/presets` 管理场景描述预制 | 现用 | TrainingPromptPreset | preset-service/UI | 保留为可持续绑定的复用单元：每项保存名称、分类、generationPromptText、可选 trainingCaptionText 和分类内顺序，可表达场景、姿势、机位等内容；TemplateSection/Section 通过 Binding 引用并参与确定性解析 |
| `TRN-PRESET-002` | Preset 分类与排序 | 当前 sort-rules 分散管理 categoryOrder/presetOrder/folder sortOrder | 现用/部分 | Category/Preset/Folder | sort rules route/UI | 简化保留：支持分类顺序、分类内 Preset 拖拽排序；删除独立 sort-rules 配置对象，排序直接写 Category/Preset.sortOrder |
| `TRN-PRESET-003` | Preset 分类 | 当前分类与嵌套文件夹 API，无完整 UI | 隐藏 | Category/Folder | preset routes | 保留一层用户自定义分类 CRUD，用于场景、姿势、机位等浏览；移除嵌套 Folder 实体和相关 API |
| `TRN-PRESET-004` | Preset 物理删除 | 当前 DELETE/cascade 主要设 isActive=false | 现用/软删 | Binding 需要安全退役 | preset-service | 不软删除。删除事务先查出所有 TemplateSection/Section Binding，把每个 Binding 按当前解析内容 detach 成 CustomText/Caption baseline，再物理删除 Preset；现有 Section 最终文本不得丢失 |
| `TRN-PRESET-005` | Usage 查询 | 当前返回硬编码或固定空 usage | 部分/伪语义 | 删除前需要真实 Binding 范围 | usage route | 保留并实现真实查询：展示绑定的 Template/Project/Section 数量和对象，用于删除确认与 detach 结果说明；不得返回硬编码 usage |
| `TRN-PRESET-006` | GET 自动写默认 Preset | 当前每次列表读取会确保并覆盖四个默认预制 | 隐藏副作用 | GET 写数据库 | `ensureDefaultTrainingPresets` | 移除：读取接口绝不创建或覆盖 Preset；初始示例若需要只通过显式 seed/初始化提供 |
| `TRN-PRESET-007` | 旧兼容路由 | `/scene-description/presets/**` 代理 `/presets/**` | 兼容 | 外部调用者可能依赖 | route re-export | 移除：新版只提供 `/api/lora-training/prompt-presets/**`，不保留旧 scene-description/presets 代理 |
| `TRN-TPL-001` | Training 模板列表/CRUD | `/training/templates`、new、edit | 现用 | TrainingTemplate | template service/UI | 保留：Template 是一组可复制的 Section 初始参数并保存项目级 Base model/训练默认参数；TemplateSection 与项目 Section 共同使用持续 Preset Binding + CustomText Segment 模型和 resolved preview，不另建 Prompt 编译体系 |
| `TRN-TPL-002` | 模板 sections | CRUD、排序、详情 | 现用 | TrainingTemplateSection | section routes/UI | 保留并重构：字段为 id、name、模板内 sortOrder、PromptSegment/Binding 列表、权威 trainingCaption、图片 size/quality/background 等 Provider 参数和候选数量；移除 code/enabled 和独立整段 generationPrompt 双重真相 |
| `TRN-TPL-003` | TemplateSection Prompt Binding | 当前持久化 TemplateSectionSceneBlock 子树 | 现用 | PromptSegment/Binding | block routes/service | 保留并重构：TemplateSection 与项目 Section 采用同一有序 Segment 协议。创建项目时深复制 Segment 行；PresetBinding 继续引用同一 Preset，CustomText 复制值。项目需要固定某段时可 detach，不存在 Template 运行时 fallback |
| `TRN-TPL-004` | 从模板建项目 | 复制模板结构为 TrainingProject | 现用 | Template -> Project | template projects route | 保留并重构为深复制参数：TemplateSection 与 TrainingSection 使用同一参数合同；创建项目只复制当时值，不保留运行时 fallback，也不随模板后续修改自动变化 |
| `TRN-TPL-005` | 项目另存模板 | 将当前项目结构写 TrainingTemplate | 现用 | Project -> Template | save-as-template | 保留：复制 Section 名称/顺序、PromptSegment/Binding、Caption、Provider 参数、候选数量及项目训练默认参数；排除角色文本、参考图、Section 输入图片、结果、任务和 checkpoint |
| `TRN-TPL-006` | 模板更新 | 当前先删全部 sections 再整树重建 | 现用/高风险 | ID/关系不稳定 | template-service | 改为普通 Template/TemplateSection CRUD，按稳定 ID 新增、更新、物理删除和排序；不再整树删除重建 |
| `TRN-TPL-007` | 模板删除 | 当前设 inactive 并物理删 sections/blocks | 现用/高风险 | 已创建项目使用深复制 | template delete | 不提供归档或软删除；用户确认后直接物理删除 Template 及其 TemplateSection 数据库记录。已创建项目因使用深复制而完全不受影响 |
| `TRN-TPL-008` | 模板排序 | 当前 `listTrainingTemplateOrderIds()` 固定空数组 | 占位/遗留 | Template.sortOrder | template-order-service | 正式保留 Template 列表拖放排序并持久化 `Template.sortOrder`，删除固定返回空数组的占位/兼容实现；TemplateSection 继续维护各 Template 内独立 `sortOrder` |

### C7. Scheduler、外部 Worker 与文件资产

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-WORK-001` | Worker 状态（内部） | 当前三类队列 queued/running 汇总 | 隐藏/运维 | 任务是唯一用户可见执行抽象 | worker status | 不提供用户可见状态页/API。内部只保留任务领取、心跳和日志所需诊断；所有异常通过 Task/TrainingRun 的等待原因或错误呈现 |
| `TRN-WORK-002` | Scheduler tick | image -> dataset -> training 顺序把 queued 改 running | 现用/高风险 | tick 只占用，不执行 | scheduler.ts | 移除：Worker 直接以数据库条件更新原子领取 pending Task/Run，领取成功并实际开始执行时才写 running |
| `TRN-WORK-003` | Task 领取 | 当前 `/tasks/next` 可能重复返回已有 running target | 现用/不完整 | 单 GPU/两个轻量 worker | leasing.ts | 简化修复：不建立独立复杂 Lease 实体；在 Task/Run 保存内部 workerOwner、heartbeatAt，使用条件更新保证唯一领取。字段不向用户展示 |
| `TRN-WORK-004` | Heartbeat | 当前 image/training/dataset 写入语义不一致 | 现用 | Task/Run 内部执行状态 | heartbeat.ts | 保留为内部机制：两个 worker 定时更新 Task/Run heartbeatAt 和必要进度。心跳超时只把任务标记为执行环境失联/等待用户处理，不自动重领或释放 GPU 锁，避免旧进程仍运行时并发启动 |
| `TRN-WORK-005` | Complete/fail 回调 | generic callback 与 Generation/Training 专用别名重复 | 现用+兼容 | 两类任务 payload 不同 | completion/failure | 删除 generic/domain alias 重复；训练素材 Task 与 TrainingRun 各自保留明确 heartbeat/progress/checkpoint/complete/fail/cancel 接口，不建设通用事件总线 |
| `TRN-WORK-006` | Worker supervisor | `npm run training:workers` 启动/重启三个子进程 | 现用/外部服务 | 独立于 Next.js | worker-queue runtime | 简化保留：移除 dataset-freeze worker，只启动现有训练素材生成 worker 与 LoRA training worker；不引入新的集群调度器、Agent 平台或独立 MLOps 服务 |
| `TRN-WORK-007` | Worker HTTP 认证 | `TRAINING_MANAGER_TOKEN` 或 `AUTH_TOKEN`，`x-api-token` | 现用 | 跨网络内部调用 | worker-common | 保留并统一到 API-02：LoRA 训练执行器只读取 AUTH_TOKEN 并使用标准 Authorization Bearer；删除 TRAINING_MANAGER_TOKEN、x-api-token 和 worker 专属鉴权语义。Token 不进入任务数据、日志或 UI |
| `TRN-WORK-008` | GPT-Image-2 图片 worker | Python/Codex provider 生成训练图片并写 outputs/prompt/metadata | 现用/外部依赖 | auth JSON、Python、网络、DB | image-worker-runtime | 保留为训练素材生成的轻量内部执行器，生产固定使用 openai-codex/gpt-image-2 adapter；用户只看到生成 Task，不看到 worker/provider 进程 |
| `TRN-WORK-009` | 默认图片 provider | supervisor 默认 `task-request`，真实 image worker 会判未配置失败 | 缺陷 | 生产需显式 openai-codex | worker queue/provider policy | 修复：生产默认/唯一 Provider 为 openai-codex/gpt-image-2，worker 启动时验证配置，缺失则不启动并由 pending 任务显示执行环境不可用；不等领取任务后失败 |
| `TRN-WORK-010` | Dataset-freeze worker | 只把 draft 改 freezing/ready，不写 manifest/items | 部分/移除候选 | 与同步 freeze 不等价 | dataset-freeze-worker | 移除：新版没有独立 DatasetRevision/Freeze 流程；TrainingRun 输入样本在启动训练事务中直接生成，不需要 dataset worker |
| `TRN-WORK-011` | LoRA 训练执行器 | 当前 `training-worker.ts` 通过 shell command 调用 sd-scripts | 现用/外部依赖 | `TRAINING_RUNNER_COMMAND` | training-worker-runtime | 保留现有轻量 worker 并更名为“LoRA 训练执行器” / `lora-training-executor`：它只负责轮询领取全应用唯一 TrainingRun、生成 TOML/manifest、启动并终止 `accelerate launch ... sdxl_train_network.py` 子进程、转发日志/进度、发现 checkpoint 并报告完成/失败。执行器启动时若发现数据库仍为 running 但本机/远程已不存在受管训练进程，则把 Run 标为因中断失败，保留已生成 checkpoint，由用户显式重试。训练能力全部复用开源 sd-scripts + Accelerate，不新建 Python 服务、ClearML 类 Agent、容器平台或复杂控制面 |
| `TRN-WORK-012` | LoRA 训练执行协议 | 当前最后一行 stdout JSON 只返回 finalSafetensorsArtifact；mock 虽含 checkpoints 数组，真实解析会丢弃 | 现用/不完整 | 未验证实际文件、不能登记中间模型 | training worker | 轻量扩展现有 HTTP 合同：worker 领取后写 running，运行期间定时 heartbeat/progress 并在发现新 `.safetensors` 时调用 checkpoint 登记接口，退出后调用 complete/fail/cancel。无需通用 typed event bus、sequence/outbox、自动 reattach 或新的入站服务；接口保持幂等即可 |
| `TRN-WORK-013` | Mock/dry-run worker | 可 mock 图片、训练完成 | 隐藏/运维 | 不能进入真实 UI | package scripts/workers | 仅保留测试脚本/夹具，不允许生产 UI/API 创建 mock 图片或伪造训练完成 |
| `TRN-WORK-014` | Scheduler/Worker 聚合状态 | 当前 `/scheduler/status` 同时返回项目/run/worker 汇总 | 隐藏/运维 | 用户只感知任务 | scheduler status route | 移除产品 API 和 UI；任务查询自身返回状态、等待原因、进度与错误，内部执行器健康只写日志/诊断，不建设聚合面板 |
| `TRN-COMPAT-SECTIONRUN-001` | 旧 SectionRun 查询/取消 | `/section-runs/:runId` 是 GenerationTask/TrainingRun 外的兼容入口 | 兼容/隐藏 | TrainingSectionRun 已合并删除 | section-runs routes | 移除旧查询/取消路由与兼容映射，不保留 SectionRun 领域概念 |
| `TRN-FILE-001` | 项目参考图文件区 | 当前 `data/images/training/{project}/references/**` | 后台核心 | Profile/CharacterImage/Artifact | runtime paths | 保留为应用管理的项目媒体区：每个字节只存一个 Artifact，项目参考图库、SectionInput、Task 和 TrainingRunSample 只建立引用。设置与详情页向认证用户展示并允许复制本机/远程绝对路径 |
| `TRN-FILE-002` | Section 输入图片文件 | 当前另有 Generation task supplemental 目录 | 后台核心 | SectionInput/Artifact | runtime paths | 删除 supplemental 独立目录语义；Section 手动上传、项目参考图选择和历史结果引用统一由 Artifact/SectionInput 管理，界面显示实际本机/远程路径 |
| `TRN-FILE-003` | 训练素材生成输出 | 当前 output image、prompt、metadata 分散 | 后台核心 | TrainingImageResult/Artifact | image worker | 保留并统一到项目媒体区：生成图片只落盘一次并直接成为所属 Section 的 TrainingImageResult；Prompt/参数保存在 Task 快照，必要 provider metadata 存 Artifact/Task；向用户显示绝对路径 |
| `TRN-FILE-004` | Section 手动上传结果 | 当前另有 manual results 目录 | 后台核心 | TrainingImageResult/Artifact | upload service | 合并到与生成结果相同的项目媒体/Artifact 体系，不保留单独业务目录或 sourceType；手动上传与生成结果使用同一候选展示和路径展示 |
| `TRN-FILE-005` | TrainingRun 输入 manifest 与远程 staging | 当前每个 revision 的 manifest.jsonl | 后台核心 | TrainingRunSample、compute target | training executor | 启动 TrainingRun 时根据 Sample 生成 manifest，并把图片/Caption 准备到 GPU 机器临时训练工作区；Run 结束后可删除 staging，重试时重新准备。UI/API 显示并允许复制 manifest 与 staging 的本机/远程绝对路径 |
| `TRN-FILE-006` | Training checkpoint 输出与 ComfyUI LoRA 模型目录 | 当前训练 artifacts 与模型路径关系未形成明确合同 | 后台核心 | TrainingArtifact、模型文件管理、本机/远程路径 | training runner/model manager | 重构为强隔离：TrainingRun checkpoint 输出目录由训练模块拥有；ComfyUI LoRA 模型目录由模型模块拥有。唯一跨边界动作是用户触发单向文件复制，允许同一项目复制多个 checkpoint。归档删除训练输出目录中的全部模型文件，ComfyUI LoRA 模型目录永不联动删除；文档/UI/API 不使用 A/B 临时简称 |
| `TRN-FILE-007` | Artifact 生命周期 | 记录 role/path/hash/尺寸/lifecycle，但删除常不删文件 | 现用/不完整 | 大量孤儿风险 | TrainingArtifact/services | 保留并全面重构：只在同一个 TrainingProject 内让相同图片字节使用单份 Artifact/Blob，角色参考图、Section 输入、生成 Task 快照、生成结果和 TrainingRun 输入样本建立轻量引用；禁止覆盖已引用字节，引用归零后才能清理。按 SI-07 不做跨 TrainingProject 或跨模块的全局图片库、复用或 Hash 去重 |

---

## D. 基础设施与生产旁路工具

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `INFRA-001` | PostgreSQL / SQLite 双 provider | 运行时按 `DB_PROVIDER` 选择两套 Prisma client/schema | 现用/架构 | 新版若只留一种需迁移现有 SQLite 数据 | `src/lib/db.ts`、两套 schema | 新版按 TS-04 只使用 Drizzle ORM + better-sqlite3 + SQLite；一套 schema 和迁移链，数据库文件位于明确的应用数据根目录。删除 Prisma client/schema 生成依赖、PostgreSQL 专属 provider/依赖/adapter、DB_PROVIDER 分支及相关构建适配，不提供 PostgreSQL 兼容层或迁移目标 |
| `INFRA-002` | 受管运行数据路径 | 项目图片、导出、Training 文件使用 cwd/配置派生路径 | 后台核心 | 第二 worktree 本身不构成数据隔离 | `runtime-data-path.ts` | 保留集中路径服务，新增必填启动环境变量 `APP_DATA_ROOT`，从该根目录派生 SQLite 数据库、项目图片、训练文件、临时文件和日志目录，不再依赖工作树；网页只允许认证用户查看和复制实际绝对路径，不允许在线修改根目录或 SQLite 文件位置。导出目录继续遵循已确认的独立交付规则 |
| `INFRA-003` | Next.js 启动 instrumentation | 启动恢复、孤儿清理、Comfy manager、打码 processor、关机信号 | 后台核心 | 删除任一功能需拆开启动副作用 | `instrumentation.node.ts` | 按 TS-07 移除 Next.js instrumentation 接入，把图像任务调度/恢复、打码批次处理和 PLAT-028 的轻量 GPU 恢复检查接入 Fastify 启动/关闭生命周期。删除旧版 30 分钟孤儿失败、通用 ComfyUI 自动启停重启、paused 自动恢复/人工恢复提示及 SIGTERM/SIGINT 取消并暂停任务。启动恢复仍遵循 GEN-EXEC-007；restartRequired 在 GPU 可用后只触发一次受控 ComfyUI restart；打码运行项回到待处理并继续。LoRA 训练执行器保持独立进程 |
| `INFRA-004` | 结构化日志与轮转 | pretty/json、level、文件大小、文件数量 | 现用/运维 | `/settings/logs` 依赖 | `src/lib/logger.ts`、env | 保留并固定日志文件为 JSON、控制台为友好文本；正式接线 requestId、duration 和 `performance`/`task_timing` 事件。shared 设置允许动态修改最低级别、单文件大小和保留文件数，默认 info/10MB/5；日志目录只读展示。日志页提供时间、来源、模块、级别、route、requestId、项目/任务和关键词筛选及完整事件查看，不提供格式切换、趋势、聚合指标、实时流、复杂关联分析或独立原始 `server.log` 页面 |
| `INFRA-005` | Phase 0 质量基线 | 从 SQLite 生成统计、CSV/JSON/Markdown 报告 | 离线工具 | 不在 Web 生产运行时 | `quality:baseline`、phase0 | 新版移除：这是 2026-05-17 加入的自动审图可行性基线实验，不属于生产应用；删除算法、CLI、报告产物、测试和命令 |
| `INFRA-006` | Phase 1 离线评估 | 拆分样本、计算指标、生成评估报告 | 离线工具 | 依赖 Phase 0 产物 | `quality:evaluate`、phase1 | 新版移除：这是 2026-05-18 加入、依赖 Phase 0 标签与预测 JSONL 的自动审图离线评估；随 Phase 0 一并删除指标、报告、测试和命令 |
| `INFRA-007` | AI 图片评议 CLI | 通过 Codex 或 OpenAI-compatible vision 生成预测 | 离线工具/外部依赖 | auth/model/命令环境 | `quality:review`、phase1-reviewer | 新版移除：删除 OpenAI-compatible/Codex 图片评议客户端、rubric、预测 JSONL、相关环境配置、测试和 CLI；不进入产品自动审图流程 |
| `INFRA-008` | 质量报告验证 | 非写入校验 baseline/evaluation 汇总 | 离线工具 | 质量流水线 | `quality:verify` | 新版移除：前置 Phase 0/1 流水线删除后，不再保留 summary 验证器、报告 fixture、测试和命令 |
| `INFRA-009` | Fallback prompt builder | 仅作为 Comfy prompt draft 最后验证辅助；标准 JSON 解析失败不会自动变成正常产品路径 | 兼容/诊断 | 不应被新版当正常 workflow | `fallback-prompt-builder.ts` | 新版移除：标准 Workflow 缺失、节点不符或解析失败时明确报错，不再生成参数语义不同的内置 SDXL txt2img fallback，也不保留相关兼容分支 |
| `INFRA-010` | 数据库 seed/bootstrap | 开发初始化和样例数据，不属于现有生产产品功能 | 开发工具 | 新版测试/本地开发可另行决定 | package scripts、seed | 保留但重写为最小 SQLite 开发初始化：只创建 Schema 和少量确定性测试数据，不先删除未知数据库内容、不生成大量示例项目或图片，只允许在明确的可丢弃开发/测试数据库运行，绝不用于生产补数 |
| `INFRA-011` | 数据维护脚本 | 零冗余迁移、预制组折叠、latent 清理等 | 运维工具 | 与现有数据恢复有关，不应混入 UI 重写 | `scripts/db/**` 等 | 不迁移旧维护脚本；按 MIG-01～MIG-08 编写本次所需的一次性数据/文件转换，在独立目标目录验证，完成完整数据核对后退役迁移工具，不进入产品 UI 或长期兼容层；原始数据与文件备份保留 |

---

## E. 当前已确认的半成品、冲突和删除陷阱

这些不是额外功能，而是做“保留/移除”决策时必须同时处理的约束。

| 风险 ID | 当前事实 | 影响 |
| --- | --- | --- |
| `RISK-001` | 认证只有全能单 token，没有注销、角色或运维权限分级 | 保留高风险 API 时应先决定权限模型 |
| `RISK-002` | `/api/queue-data` 的 GET 会调用 `recoverStaleRuns()` | 不能把它当纯只读查询重建轮询 |
| `RISK-003` | Generation 审核逻辑分别存在于队列、小节结果、项目结果三套 UI | 简化 UI 时要先统一状态机和快捷键/撤销差异 |
| `RISK-004` | Generation 项目归档是跨 DB/文件/ComfyUI 的尽力清理，非事务，且无反归档 | “移除归档”与“保留历史项目”必须一起决策 |
| `RISK-005` | Generation 预制绑定包含继承、detach、抑制 tombstone、组级联 | 不能直接降级成单个 JSON 文本框 |
| `RISK-006` | Generation/Training 共库，依赖资源边界过滤保留资源 | 重构 repository 时容易跨模式泄漏 |
| `RISK-007` | Training text_generation 任务可以入队，但没有 worker 消费 | UI 入口目前会制造永久 queued 任务 |
| `RISK-008` | 默认 Training supervisor image provider 与真实 worker 不匹配 | 默认命令无法完成真实图片任务 |
| `RISK-009` | Dataset readiness 要求无缺 caption，但同步 freeze 允许空 caption | 同一按钮链路有矛盾门槛 |
| `RISK-010` | Dataset-freeze worker 不生成 manifest/items，与主同步冻结不等价 | 建议只保留一个权威冻结路径 |
| `RISK-011` | Training lease 没有持久过期、owner 强制或真实 attempt 语义 | 崩溃恢复与并发不能依赖“lease”名称 |
| `RISK-012` | Training cancel 不终止外部 runner，只把 DB 标 failed | 新版取消按钮不能沿用当前承诺 |
| `RISK-013` | Training 项目/参考图/结果/运行删除普遍不清文件 | 数据库删除会留下孤儿资产 |
| `RISK-014` | 归档 Training 项目的写保护不完整 | “归档”不是可靠只读状态 |
| `RISK-015` | Training preset GET 会写默认预制并覆盖文本 | 读取接口存在隐藏 DB 写入 |
| `RISK-016` | Training preset usage/cascade 多为软停用或硬编码，并非真实绑定关系 | 删除确认不能信任当前 usage 数字 |
| `RISK-017` | Training template 更新整树删除重建；删除无恢复 | 模板 ID/历史/引用稳定性差 |
| `RISK-018` | Caption “生成”是同步固定字符串，不是 AI/worker | 新版应改名或接真实 provider |
| `RISK-019` | Training run poll 是读取别名，cleanup 永远 no-op | 属于占位接口，不应迁移为产品功能 |
| `RISK-020` | Training completion 信任外部 Artifact 路径，不验证文件存在/大小/hash | 保留训练必须补产物验收 |
| `RISK-021` | Training 新建表单有多项不进入执行的参数 | 新版应删掉或真正接线 |
| `RISK-022` | “从 TrainingRun 创建预制”实际创建场景描述预制，不注册 LoRA 模型 | 需要重新定义产物晋升流程 |
| `RISK-023` | Training 真实使用 `/api/images`，但资源边界文档把它视为 Generation 入口 | 新版需把媒体 route 明确为共享或拆分 |
| `RISK-024` | Training 旧 UI 深度依赖 design-demo shell/UI/types | 按 MIG-01 全新建设，不导入旧代码；该旧依赖关系不再阻塞新版实现，只在整理旧目录时确保业务数据与文件已保全 |
| `RISK-025` | 通用 route fallback 会把失效深链静默导向父页面或 `/queue` | 删除功能时应显式选择 redirect/tombstone/404 |
| `RISK-026` | 模型上传/移动同时修改文件系统和 DB，但非单一事务 | 新版需设计失败恢复 |
| `RISK-027` | 图片 route 使用 immutable 缓存且处于认证代理后 | 新版反向代理/CDN 策略要重新验证 |

---

## F. 覆盖附录

### F1. 生产页面覆盖

扫描到 27 个非 Demo `page.tsx`：

- 根与认证：`/`（转 `/queue`）、`/login`。
- Generation 运行：`/queue`、`/queue/[runId]`。
- Generation 项目：`/projects`、`/projects/new`、`/projects/new/from-existing`、`/projects/[projectId]`、`edit`、`batch-create`、section 编辑、section 结果、项目结果。
- Generation 预制：`/assets/presets`、preset detail、sort-rules、preset-group detail。
- Generation 模板：`/assets/templates`、new、edit、template section。
- 共享：`/assets/models`、`/assets/loras` 兼容跳转、`/settings`、`/settings/monitor`、`/settings/logs`。
- Training：一个 catch-all `page.tsx` 分派 23 条实际 `/training/**` 路由。

### F2. API route 分组覆盖

总计 194 个 route 文件。下表按第一级/第二级前缀分组，所有组都已映射到上方功能项或兼容项。

| API 组 | Route 数 | API 组 | Route 数 |
| --- | ---: | --- | ---: |
| `agent` | 10 | `audit-logs` | 1 |
| `auth` | 1 | `comfy` | 5 |
| `health` | 1 | `image-review` | 1 |
| `images` | 6 | `logs` | 1 |
| `loras` | 4 | `mcp` | 1 |
| `models` | 5 | `path-maps` | 1 |
| `preset-library` | 25 | `presets` | 1 |
| `project-create-options` | 1 | `project-folders` | 4 |
| `projects` | 23 | `queue` | 5 |
| `queue-data` | 1 | `runs` | 5 |
| `sections` | 1 | `templates` | 6 |
| `training/blocks` | 2 | `training/dataset-revisions` | 1 |
| `training/generation-inputs` | 1 | `training/generation-outputs` | 1 |
| `training/generation-tasks` | 7 | `training/image-results` | 3 |
| `training/presets` | 3 | `training/projects` | 19 |
| `training/reference-images` | 2 | `training` 能力清单 | 1 |
| `training/runs` | 1 | `training/scene-description` | 8 |
| `training/scheduler` | 2 | `training/section-runs` | 2 |
| `training/sections` | 5 | `training/templates` | 10 |
| `training/text-revisions` | 1 | `training/training-runs` | 5 |
| `training/worker` | 10 | `worker` | 1 |

### F3. MCP 覆盖

11 个工具：

1. `list_projects`
2. `update_project`
3. `update_project_section`
4. `run_all_sections`
5. `run_section`
6. `review_images`
7. `list_prompt_blocks`
8. `add_prompt_block`
9. `update_prompt_block`
10. `remove_prompt_block`
11. `reorder_prompt_blocks`

3 个资源：`project-context`、`run-context`、`section-blocks`。

### F4. 数据模型覆盖

- Generation 预制：`PresetCategory`、`Preset`、`PresetVariant`、`PresetVariantLink`、`PresetGroup`、成员、slot、folder、两类 change log。
- Generation 项目/模板：`Project`、`ProjectFolder`、`ProjectSection`、section folder、project/template preset binding、prompt block、manual LoRA、`ProjectTemplate` 及其 section/folder/binding/block/LoRA。
- Generation 执行/审核：`Run`、`ImageResult`、`TrashRecord`、`CensoringTask`。
- Training：scene preset category/folder/preset、template/section/block、project/profile/reference image/artifact、section/block/run、image result、generation task/input/output、dataset revision/item、training run、text revision。
- 共享/平台：`LoraAsset`、`AuditLog`、`GpuTaskLock`。

### F5. 明确排除的非生产表面

- `/design-demos/**` 的 63 个演示路由、演示夹具和展示注册表不计为产品功能；按 IA-15 和 MIG-01 从新版全新工程中排除。
- `src/features/training/build.ts` 的样例数据只作为 Demo/兼容 fallback，不计为生产数据能力。
- 测试、fixture、文档生成器、Harness、CI 和 GitHub 工作流不计入新产品功能。
- Training 对 design-demo shell/UI/types 的旧代码依赖由 ARCH-001/002 记录为历史事实；新版从零实现，不承担该代码迁移依赖。

## G. 扫描后状态

- 本文件是本地决策草稿，位于被 Git 忽略的 `.tmp/`，未提交、未推送。
- 未启动开发服务、未连接生产数据库、未调用 API、未修改任何生产状态。
- 已确认采用全新代码工程与完整数据/文件迁移，边界见 A19；后续按已确认功能和领域/API/技术栈形成实施计划，并逐类核对具体数据映射，不延续旧应用的在线运行和兼容方案。
