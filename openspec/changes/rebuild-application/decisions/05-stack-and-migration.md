# 技术栈与完整数据迁移

本文件记录本轮对话已确认的新版目标，尚不代表运行代码已实现。编号保留原清单 ID；冲突时采用最新用户决策及 [最终口径](00-final-decisions.md)，旧实现列仅供数据转换核对。

正式模块、公共生产容器和各类型模型以 [前向兼容边界](09-forward-compatibility.md) 为准。本版只实施图片生成与已确认训练能力；视频仅预留类型位置，不建立视频类、页面、表或空接口。

## A18. 前后端技术栈

用户已确认采用独立前端构建和轻量后端服务，以降低 Next.js 页面、服务端与 API 编译链之间的耦合。此前编译慢尚未做专项耗时归因；该选型不等于已测得性能提升，也不承诺具体秒数。正式领域模型、页面命名空间和 HTTP 合同沿用已确认决策。

| ID | 层级 | 决策 |
| --- | --- | --- |
| `TS-01` | 前端 | React 19 + Vite + React Router，构建浏览器 SPA 静态产物；按模块和页面拆分加载，不使用 Next.js、RSC 或应用 SSR |
| `TS-02` | 后端 | Fastify 5 + TypeScript，按 production、training、模型、设置、认证和监控等职责组织模块；模块目录、页面和 HTTP API 命名分别统一为 production/training。production 内统一 ProductionProject、ProductionTemplate 与文件夹/排序，图片配置、任务和资产使用 ProductionImage* 专属模型；training 正式模型使用 Training*。领域服务、文件/SSH/进程适配独立于 HTTP 路由，不建立万能任务或媒体业务表 |
| `TS-03` | 请求与类型协议 | TypeBox + Fastify Route Schema 统一请求/响应验证与 TypeScript 类型，并从实际路由 Schema 生成 OpenAPI；浏览器只共享接口合同，不导入数据库或后端运行代码 |
| `TS-04` | SQLite 访问 | Drizzle ORM + better-sqlite3，使用一套 SQLite schema 和迁移链；新版移除 Prisma schema/client 生成依赖及所有 PostgreSQL 专属依赖、配置和构建分支。旧 SQLite 数据仍需按 INFRA-011 在副本上验证一次性迁移 |
| `TS-05` | 开发与构建 | 开发时 Vite 和 Fastify 分别运行并独立更新，Vite 代理 API；前后端分别构建和类型检查，生产运行编译后的后端与前端静态文件。框架插件按兼容范围选版本并锁定，不盲目拼接各包 latest |
| `TS-06` | 同源交付与认证 | 生产由 Fastify 托管 API、前端静态产物和深链页面响应，使用同一域名/端口。保留 AUTH_TOKEN、浏览器 Cookie 和跨网络 Bearer 认证；应用页面、受保护资源、API 和文件下载在服务端执行门禁，登录本身所需页面/资源有明确边界。SPA 回退只服务页面路径，不把 API/文件错误改成 index.html |
| `TS-07` | 后台执行 | 按已确认规则全新实现图像调度/恢复、批量打码和 GPU 恢复检查，并接入 Fastify 服务生命周期；不迁入旧 instrumentation 或调度代码。训练素材与 LoRA 训练轻量执行器保持已确认职责，LoRA 训练调用作为新版依赖安装的 sd-scripts + Accelerate |
| `TS-08` | 性能与验证 | 实施时分别测前端冷启动/热更新/生产构建、后端启动/编译和代表性页面加载，便于定位具体耗时来源；继续采用已确认的慢事件及任务阶段耗时协议。CPU 密集打码等保持在已有独立执行链，避免阻塞 API；不因框架替换增加完整可观测性平台 |

官方接入依据：[PrimeReact v10 安装](https://v10.primereact.org/installation/)、[PrimeReact v10 主题](https://v10.primereact.org/theming/)、[Fastify 技术原则](https://fastify.dev/docs/latest/Reference/Principles/)、[Vite](https://vite.dev/guide/why)、[Drizzle](https://orm.drizzle.team/docs/overview)。

## A19. 全新工程与完整数据迁移

用户于 2026-09-05 明确系统当前没有投入使用，旧版只有数据和文件需要保留。本组取代上一轮关于旧版持续服务、逐页替换、双版本过渡和在线切换的建议。当前只记录迁移设计，尚未执行文件清理、数据复制、数据库转换或新工程创建。

| ID | 范围 | 决策 |
| --- | --- | --- |
| `MIG-01` | 建设方式 | 使用全新代码工程实现已确认功能、领域模型、API 和视觉方向；旧应用仅作为数据来源和必要业务含义的核对依据，不保留运行框架、组件、业务代码或兼容层 |
| `MIG-02` | 数据完整保存 | 实施前保存一致的完整 SQLite 备份和真实业务文件，包括项目媒体、参考图、候选/结果、打码图、训练模型、训练输入/Caption、Workflow JSON、交付包和有保留价值的历史资料；外部目录也按实际引用纳入盘点，不只复制仓库内 data。原始备份保留为完整数据底档，与新版运行目录分开 |
| `MIG-03` | 新库转换 | 建立干净的 Drizzle/SQLite schema，按前向兼容边界把原生产项目/模板及其文件夹映射为 ProductionProject、ProductionTemplate、ProductionProjectFolder、ProductionSectionFolder、ProductionTemplateSectionFolder，原图片小节/模板小节映射为 ProductionImageSection/ProductionTemplateImageSection，图片任务/Attempt/结果/资产及预制等映射为对应 ProductionImage* 模型；原 LoraTraining* 目标模型统一为 Training*。完整转换层级/顺序、配置、图片关系、角色文本、Caption、用途标记、任务历史和模型元数据，记录必要的旧新实体名、ID 和路径映射；历史证据与原始备份仍用真实旧名，不让新版依赖旧表、旧 ORM 或兼容别名。生产与训练的预制/模板分别拥有；项目与模板配置协议复用但记录独立，应用时深复制 |
| `MIG-04` | 已移除结构与异常数据 | 废弃功能的旧表不进入新版运行模型，但其有用文本、文件和历史信息仍应迁入对应新版资源。无法明确映射、存在冲突或损坏的记录保留原件并列出具体条目核对；不得因为某功能被移除就静默丢弃相关数据，也不以保留原始备份代替本应完成的转换 |
| `MIG-05` | 文件与配置 | 新版按 APP_DATA_ROOT、EXPORT_ROOT 和目标训练数据根及各类型资产归属组织受管文件，转换数据库文件引用；ComfyUI 模型继续映射其实际目录，不因重建应用删改模型。旧配置中的有效路径/参数属于需核对的数据，按新版设置合同导入；原 productionPrompt 文本显式映射到 imageProductionPrompt，内容与可空规则不变，不在新版维护两份字段或兼容别名。凭据继续按独立配置保存，不继承旧配置加载代码。node_modules、构建目录和可再生缓存不属于需保留的业务文件 |
| `MIG-06` | 历史执行真实性 | 迁入能真实还原的任务、输出、参数和时间；旧库缺少的 Attempt、阶段耗时或 Workflow 不伪造。导入过程中不启动生成、训练、打码或 ComfyUI 控制动作；旧非终态记录先核对执行事实，不能在首次启动时意外重放 |
| `MIG-07` | 完成标准 | 按数据类别核对来源/去向数量、引用、层级/排序、文本、选图/发布标记和文件可读取性；核对清单明确哪些已迁入、哪些仅原样保存及原因。最终以新版真实项目流程验证数据可用性。所有条目都有明确处置后才称为完整迁移 |
| `MIG-08` | 旧版退役 | 不设计旧新双写、兼容代理、在线流量切换或旧程序回退；新版功能和数据验收完成后只使用新应用。旧程序、依赖、构建产物和历史部署工具无保留要求；数据与业务文件的原始备份继续独立保留。具体旧目录清理在实际路径和数据保全确认后执行 |
