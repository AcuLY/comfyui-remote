# ComfyUI 远程 Harness 文档信息架构草案

日期：2026-07-10

状态：顶层 `IA`、authority 与保留/删除边界已确认；本文件仍不是当前事实或正式 spec，也不授权实施

原位置：`.tmp/harness-docs-ia-draft-2026-07-10.md`；现归档为 OpenSpec 非规范性证据

## 1. 使用方式

- 本文件保存结构讨论，防止长对话中的树、边界和决定丢失。
- 本文件最初位于被 Git 忽略的 `.tmp/**`；现为跨设备续作而归档，但不替代正式 OpenSpec 工件。
- 已确认结构现已进入正式 `rebuild-documentation-governance` OpenSpec 工件；本文件只保留讨论证据与决策来源。
- 未经用户审阅正式 OpenSpec 工件修订，不得执行目标目录迁移或安装 `Impeccable`。

## 2. 参考与适配原则

- 主要参考 OpenAI Harness 工程：短 `AGENTS.md` 作为地图，根级架构入口，结构化知识库、渐进式披露、文档静态检查器、CI 和维护；不照搬其 generated/reference 或 ExecPlan 目录。
- OpenSpec 是 proposal、行为 specs、变更设计、任务、验证和归档的唯一 authority；根文件与 `docs/**` 不得建立平行的规范、设计、任务或历史体系。
- 后续可能引入 `pbakaus/impeccable`；当前只确认兼容所需的文档和工具边界，不安装 skill、hook 或检测器。
- Generation 与 Training 是平级工作模式；models/settings 等属于共享资源。
- `.tmp/**` 永远只是临时证据。

## 3. 已确认目标骨架

```text
/
├── README.md
├── AGENTS.md
├── ARCHITECTURE.md
├── PRODUCT.md
├── DESIGN.md
├── CLAUDE.md                 # 只兼容转发到 AGENTS.md
│
├── openspec/
│   ├── config.yaml
│   ├── specs/
│   └── changes/
│       ├── <active-change>/
│       └── archive/
│
└── docs/
    ├── README.md
    ├── QUALITY_SCORE.md
    ├── RELIABILITY.md
    ├── SECURITY.md
    ├── _meta/
    │   ├── README.md
    │   ├── documentation.schema.json
    │   ├── policy.yaml
    │   └── templates/
    ├── architecture/
    │   ├── README.md
    │   ├── core-beliefs.md
    │   ├── system/
    │   │   ├── context.md
    │   │   ├── dependency-model.md
    │   │   ├── runtime-topology.md
    │   │   ├── data-model.md
    │   │   ├── agent-interfaces.md
    │   │   ├── execution/
    │   │   │   └── queue-worker.md
    │   │   └── observability/      # 仅在 observability 阶段落地后激活
    │   ├── domains/
    │   │   ├── generation/
    │   │   ├── training/
    │   │   └── shared-resources/
    │
    ├── design/
    │   ├── README.md
    │   ├── layout-and-density.md
    │   ├── component-patterns.md
    │   ├── interaction-and-motion.md
    │   ├── responsive-and-accessibility.md
    │   ├── review-workbench.md
    │   └── design-demo-governance.md
    │
    ├── product/
    │   ├── README.md
    │   ├── generation/
    │   │   └── README.md
    │   ├── training/
    │   │   └── README.md
    │   └── shared-resources/
    │       └── README.md
    │
    ├── runbooks/
    │   └── README.md
    └── ...                    # 其余 current docs 按后续逐目录确认结果落位
```

核心树、authority 与删除/deferred 边界已经批准。只有经过 current-evidence 审计后确有内容的详细文件才创建，不能为了填满骨架制造空文档。

### 3.1 OpenAI 原文位置基线

```text
/
├── AGENTS.md
├── ARCHITECTURE.md
└── docs/
    ├── design-docs/
    ├── exec-plans/
    ├── generated/
    ├── product-specs/
    ├── references/
    ├── DESIGN.md
    ├── FRONTEND.md
    ├── PLANS.md
    ├── PRODUCT_SENSE.md
    ├── QUALITY_SCORE.md
    ├── RELIABILITY.md
    └── SECURITY.md
```

OpenAI 树仅作为来源基线。本仓库固定保留根级 `README.md`、`AGENTS.md`、`ARCHITECTURE.md`、`PRODUCT.md`、`DESIGN.md`；不建立 `FRONTEND.md` 或 `PLANS.md`；OpenSpec 独占 specs/change design/tasks/verification/archive；保留 `docs/architecture/**`、`docs/product/**`、`docs/design/**`、`docs/runbooks/**` 与最小 `docs/_meta/**`。

## 4. 根目录逐项确认状态

| 节点 | 当前状态 | 待确认内容 |
| --- | --- | --- |
| `README.md` | 已确认保留 | 后续只确认与 docs/OpenSpec 的链接 |
| `AGENTS.md` | 已确认保留 | 唯一智能体 policy authority；不再从其他目录生成或手工同步 |
| `ARCHITECTURE.md` | 已确认需要 | 根级短地图；详细当前技术架构进入 `docs/architecture/**` |
| `PRODUCT.md` | 已确认根级保留 | 根级当前产品映射；`docs/product/**` 展开当前知识；OpenSpec specs 是唯一规范权威 |
| `DESIGN.md` | 已确认根级保留 | 当前设计入口；未来 `Impeccable` 变更才能原子迁移 schema、旁车、hook 与检测器 |
| `FRONTEND.md` | 已确认从目标树删除 | 现有前端契约必须先分流到 architecture、design 文档和工程规范，不得因依赖未来内容留下空洞 |
| `PLANS.md` | 已确认从目标树删除 | 不采用独立 ExecPlan；规格、设计、任务、执行状态和归档全部遵循 OpenSpec |
| `docs/QUALITY_SCORE.md` | 已确认预留占位 | 后续确认评分对象、数据来源、生成方式和激活阶段 |
| `docs/RELIABILITY.md` | 已确认预留占位 | 后续确认原则、SLO、运行手册与可观测性的边界 |
| `docs/SECURITY.md` | 已确认预留占位 | 后续确认安全模型、操作规则、漏洞报告和秘密边界 |
| `agent-rules/**` | 已确认删除 | policy 迁入 `AGENTS.md`、步骤迁入运行手册后原子删除，无桩 |
| `openspec/**` | 已确认唯一权威 | proposal、specs、变更设计、任务、验证、归档全部遵循 OpenSpec |
| `docs/**` | 核心 `IA` 已确认 | 保留 architecture/product/design/runbooks/_meta 和诚实占位；删除 archive/prototypes；generated/references 分层 deferred |

## 5. `Impeccable` 兼容性待确认

未来集成可能涉及：

- `PRODUCT.md`
- `DESIGN.md`
- `.impeccable/config.json`
- `.impeccable/design.json`
- `.impeccable/critique/*.md`
- `.agents/skills/impeccable/**`
- `.codex/hooks.json`
- `Impeccable` 检测器的本地与 CI 入口

这些路径目前都不因本草案而创建。未来必须通过独立 OpenSpec 变更评估与现有 `DESIGN.md`、`.codex/skills/ui-ux-pro-max/**`、Git 忽略规则、Hook 信任和 CI 的冲突。

## 6. 决策日志

- 已确认：先定信息架构，再写完整文档治理 spec。
- 已确认：`README.md`、`AGENTS.md`、`ARCHITECTURE.md` 是需要的入口层。
- 已确认：目标结构参考 OpenAI Harness 工程，但需要适配 OpenSpec 和本仓库既有边界。
- 已确认：未来考虑 `Impeccable`，但本阶段不安装。
- 已确认：原 `docs/design-docs/**` 改名为 `docs/architecture/**`；内部职责不变，目录入口统一使用 `README.md`，不使用 `index.md`。
- 已确认：原候选 `docs/product-specs/**` 改为 `docs/product/**`，保存当前产品的解释性知识，不与 OpenSpec 争夺规范权威。
- 已确认：采用 `docs/architecture/**`，避免与根级、由 `Impeccable` 使用的 `DESIGN.md` 混淆，并复用仓库现有的薄入口。

### 6.1 根级产品与设计入口

- 已确认：优先满足 `Impeccable` 的默认上下文 contract，最终保留根级 `PRODUCT.md` 和 `DESIGN.md`。
- 已确认：现有根级 `DESIGN.md` 在未来独立的 `Impeccable` 变更开始前始终保持当前，不在文档治理阶段提前移动。
- 已确认：未来 `Impeccable` 变更必须在一个原子、可回滚批次中保护现有当前内容，再生成并核验新的根级 `DESIGN.md`；不得提交根级入口缺失的中间状态。
- 已确认：固定六段格式、旁车、hook 与检测器只属于未来 `Impeccable` 变更；旧文件中的当前页面模式、实现说明和演示治理先按本次责任方文档迁移，过时内容删除而不建立历史。
- 已确认：目标骨架不保留独立 `FRONTEND.md`。`Impeccable` 承担通用设计/UX 指南；仓库特有的 React、Next.js、RSC/client、模块依赖、性能和测试约束仍必须由 `ARCHITECTURE.md`、`docs/architecture/**` 与后续工程规范承载。
- 已确认：删除独立入口不等于删除现有前端知识；`docs/frontend-design-guide.md`、`docs/ui/**` 和 `src/app/design-demos/FRONTEND_RULES.md` 等内容必须先逐条验证并迁入对应 owner 层，之后才能退役重复入口。

### 6.2 ExecPlan 与 OpenSpec

- 已核对：Codex ExecPlan 是面向多小时任务的自包含持续维护执行文档，要求维护进度、意外与发现、决策日志、成果与复盘、具体命令、验收、幂等与恢复等内容。
- 已核对：OpenSpec 已拥有 proposal、行为 specs、design、任务、apply/verify/archive 生命周期；直接再维护独立 `PLANS.md` 和 `exec-plans/**` 会产生两套设计、任务进度和归档状态。
- 已确认：目标骨架删除独立 `PLANS.md` 和 `docs/exec-plans/**`。
- 已确认：不单独采用 Codex ExecPlan 文件体系，也不建立第二套进度、决策日志或归档规则。
- 已确认：所有 proposal、行为 specs、design、任务、执行状态、验证和归档都依照 OpenSpec 当前规范；若未来 OpenSpec 版本或官方 schema 提供长任务能力，按正常 OpenSpec 变更评估，而不是预先自建平行层。

### 6.3 后续三个文档知识入口

- 已确认：在最终目标树中预留 `docs/QUALITY_SCORE.md`、`docs/RELIABILITY.md`、`docs/SECURITY.md` 三个占位文件。
- 占位文件只声明目的、状态、责任方、激活阶段和替代与权威边界，不编造尚未验证的质量分数、SLO 或安全模型。
- 为遵守“完整 `IA` 批准后再实施”的顺序，这三个 tracked 文件在当前讨论阶段不实际创建；正式迁移批次再同批创建、更新 index/manifest 和验证。

## 7. 一手来源核对结果

### 7.1 OpenAI Harness 工程示例

- 原文示例只有 `AGENTS.md`、`ARCHITECTURE.md` 位于仓库根级。
- 原文中的 `DESIGN.md`、`FRONTEND.md`、`PLANS.md`、`PRODUCT_SENSE.md`、`QUALITY_SCORE.md`、`RELIABILITY.md`、`SECURITY.md` 都位于 `docs/` 下。
- 因此第 3 节把这些文件全部列在根目录只是上一轮候选，不是对原文的准确复刻，必须修正。

### 7.2 `Impeccable`

- `Impeccable` 正常项目默认将 `PRODUCT.md` 和 `DESIGN.md` 放在仓库根目录，并优先从根目录读取。
- 根目录缺失时，skill 还会检查 `.agents/context/` 和 `docs/`，所以放在 `docs/` 技术上可被发现，但不是默认路径。
- `/impeccable document` 明确生成根级 `DESIGN.md`，并生成不可手改的 `.impeccable/design.json` 旁车。
- `Impeccable` 不要求 `FRONTEND.md`；它是 OpenAI 示例中的仓库知识入口，不是 `Impeccable` 上下文 contract。

### 7.3 OpenSpec

- OpenSpec 1.5.0 的默认 spec-driven 工件是 `proposal`、`specs`、`design`、`tasks`。
- `PLANS.md` 不是 OpenSpec 规定文件，也不参与默认工件图。
- 本仓库已决定不保留 `PLANS.md` 或独立 ExecPlan 层，所有规划与执行状态遵循 OpenSpec。

### 7.4 `QUALITY_SCORE.md`、`RELIABILITY.md`、`SECURITY.md`

- OpenAI 文章只明确解释了质量文档用于按产品领域和架构层评分并持续追踪缺口。
- 文章列出了 `RELIABILITY.md` 和 `SECURITY.md`，但没有规定它们的固定 schema 或必选内容。
- 本轮已决定在 `docs/` 下预留三个诚实占位文件；具体内容、owner 和激活阶段后续再评估，当前不把未验证内容写成事实。

## 8. `docs/architecture/**` 已确认职责

状态：已确认

### 8.1 总边界

- `ARCHITECTURE.md` 是短小顶层地图，只说明系统边界、领域、层级、依赖方向和下一跳。
- `docs/architecture/**` 描述已经实现并由证据验证的当前架构：为什么这样分、谁拥有、如何连接、有哪些不变量和失败边界。
- 未实现目标、方案比较、实施设计和决策过程只进入活动 OpenSpec 变更。
- 变更落地并接受后，当前架构结果才同步到 design 文档；历史理由由 OpenSpec 归档保留。
- API 字段清单、schema 转储、运行命令、测试命令和视觉 token 不在本层重复，分别链接参考资料与生成文件、运行手册与测试以及根级 `DESIGN.md`。

### 8.2 `README.md`

- `ARCHITECTURE.md` 进入详细技术知识的唯一下一跳。
- 按任务列出系统与领域文档、责任方、权威、验证状态、代码映射、更新触发条件和关联 OpenSpec 能力。
- 只做导航和状态，不复制设计结论、接口清单或操作步骤。

### 8.3 `core-beliefs.md`

- 保存少量跨领域、长期稳定的架构信念及其理由。
- 候选内容包括：Generation 与 Training 平级；共享资源必须显式归属；当前事实、批准目标和历史意图分离；跨层依赖必须显式；失败和隔离边界必须可验证。
- 不放文件路径、具体工具、阈值、静态检查命令、任务进度或未来方案。
- 后续工程规范把这些信念编码为可检查规则，但不复制其理由。

### 8.4 `system/`

用于不属于单一工作模式的跨领域当前系统结构。

- `context.md`：用户/智能体、Next.js 应用、数据库、ComfyUI、worker、文件系统、`mypc` 与外部边界的系统上下文和信任边界。
- `dependency-model.md`：App/API、feature/component、服务、仓库、Prisma、client/server 等层级和允许依赖方向。
- `runtime-topology.md`：进程、启动副作用、Next/Node 运行时、外部 ComfyUI 目标、worker 及本地、工作树与生产拓扑；不写启动命令。
- `data-model.md`：跨领域实体归属、关系、事务/一致性边界、PostgreSQL/SQLite 兼容策略；精确 schema 暂留现有当前责任方和生成位置，未来再评估目录分层。
- `agent-interfaces.md`：智能体 API、MCP、认证、tool/resource 边界和通用封装的架构；精确 endpoint/field 清单由 contracts/reference 承担。
- `execution/queue-worker.md`：认领与租约、调度、并发、心跳、暂停与恢复、恢复流程和状态真源；领域自己的业务生命周期仍回到对应领域。
- `observability/`：后续可观测性变更落地后再激活，描述遥测 schema、信号关联、环境与工作树身份、收集器、存储和查询架构；当前不预建空目录或技术选型。

### 8.5 `domains/`

用于用户可识别的业务能力、术语、实体、状态机、流程、owner 和业务不变量。

- `generation/`：生图工作模式的项目、小节、运行、review/results、preset/template 等已验证业务架构。
- `training/`：与 Generation 平级的 Training 工作模式、项目/profile/sections、generation 任务、数据集修订和 training 运行等业务架构。
- `shared-resources/`：仅保存真正由两个工作模式共同面向用户拥有的资源，初始硬边界为模型、设置和模式导航；“两边代码都使用”本身不能成为共享的理由。

每个领域初始只建立 `README.md`，包含目的与非目标、所有代码、实体与状态、公开接口、依赖、主要流程、不变量、失败模式、测试与证据和更新触发条件。只有出现两个以上独立责任方或生命周期时才继续拆文件。

### 8.6 不设置 `decisions/`

- 目标树不设置 `docs/architecture/decisions/**`，避免与 OpenSpec design/archive 形成第二套 `ADR` 历史。
- 活动方案和取舍保存在 OpenSpec 变更；已落地结果进入持续维护 specs 和相应当前描述性文档；历史理由留在 OpenSpec 归档。
- 本阶段不创建 OpenSpec 归档的额外生成索引；未来是否需要只能由独立 OpenSpec 变更决定。

## 9. `docs/product/**` 已确认职责

状态：已确认采用第 2 种方案

### 9.1 命名方案

有三种可行方案：

1. 保留 `docs/product-specs/**`：最接近 OpenAI Harness 工程示例，但名称会暗示这里也是 spec authority，与 `openspec/specs/**` 冲突。
2. 改为 `docs/product/**`：保存已验证当前产品的可读知识，OpenSpec 继续作为唯一规范权威。推荐此方案。
3. 删除该目录，只保留根级 `PRODUCT.md` 与 OpenSpec：权威最少，但根级入口会膨胀，Generation、Training 和共享资源无法渐进式披露。

推荐目标：

```text
docs/product/
├── README.md
├── generation/
│   └── README.md
├── training/
│   └── README.md
└── shared-resources/
    └── README.md
```

目录入口继续统一使用 `README.md`。初始不预建更多空文件；只有出现独立 owner、受众或生命周期后才拆分。

### 9.2 与其他知识层的 authority 边界

- 根级 `PRODUCT.md`：短产品宪章，说明项目定位、目标用户、核心价值、Generation/Training 平级关系、共享资源和产品原则，并路由到详细知识。
- `docs/product/**`：已验证当前产品的解释性知识，回答“用户面对什么、为什么存在、概念如何理解、当前工作流是什么”。它不是需求规范。
- `openspec/specs/**`：唯一行为规范权威，保存精确 SHALL/MUST 要求、不变量和可验收场景。
- `openspec/changes/**`：已提议或批准但尚未成为当前事实的目标行为、设计、任务和验证状态。
- `docs/architecture/**`：说明当前技术实现如何支撑产品，保存代码所有权、技术领域模型、依赖、数据流、接口关系、失败和隔离边界。
- 根级 `DESIGN.md`：视觉系统和全局体验原则；产品文档只链接，不复制 token 或组件规则。
- 精确路由、API、schema 和自动生成清单暂留现有当前责任方和现有生成位置；产品文档不手抄这些库存。
- `docs/runbooks/**`：操作和故障处理步骤；产品文档不包含命令。
- OpenSpec active/archive：分别承载已批准目标与变更历史；不建立 prototypes/history 文档层。

### 9.3 文件职责

#### `docs/product/README.md`

- 作为详细产品知识入口，列出三个产品领域、公共术语、权威、责任方、证据状态、更新触发条件和关联 OpenSpec 能力。
- 只做产品层导航和跨域心智模型，不复制各领域旅程或规范要求。

#### `docs/product/generation/README.md`

- 描述 Generation 的目标用户与任务、项目/section/run/review/results 等用户心智模型、当前可见能力、关键旅程、业务状态含义、当前限制和明确 non-goals。
- preset/template 属于 Generation，除非代码和用户模型验证为真正跨模式共享。

#### `docs/product/training/README.md`

- 描述与 Generation 平级的 Training 工作模式，而不是演示、子模块或未来设想。
- 覆盖训练项目、profile、小节、generation 任务、数据集修订、training 运行、Training 自有 preset/template 等已验证用户工作流和产品状态。

#### `docs/product/shared-resources/README.md`

- 只覆盖真正同时面向两个工作模式的模型、设置和模式导航。
- 基础设施、复用组件、队列与 worker、认证或 API 因“两边都使用”并不会成为共享产品领域；它们进入设计文档、规范或运行手册。

### 9.4 每个产品领域 README 的固定内容

1. 目的、用户与非目标
2. 术语与用户心智模型
3. 当前用户可见能力，只摘要并链接 OpenSpec 能力 ID
4. 关键用户旅程
5. 业务规则、用户可见状态与失败语义
6. 当前限制
7. 证据与验证状态
8. 相关 OpenSpec、`docs/design/**`、当前清单 owner 和运行手册
9. 负责人和更新触发条件

不得放入精确 API 或字段清单、数据库实现、代码依赖规则、运维命令、未落地路线图、历史决策过程或视觉 token。

### 9.5 对 `architecture/domains/**` 的同步收窄

- 用户术语、用户旅程、可见能力和产品状态语义归 `docs/product/**`。
- `docs/architecture/domains/**` 只保留技术领域模型、代码归属、持久化与执行状态机、依赖、接口、技术不变量和失败/隔离边界。
- 两层允许相互链接，但不得复制同一份要求或能力清单。

## 10. 原 `docs/design-docs/**` 改名决定

状态：已确认采用 `docs/architecture/**`

### 10.1 候选方案

1. `docs/architecture/**`：推荐。根级 `ARCHITECTURE.md` 是短地图，目录是渐进披露的详细当前架构；仓库已经存在同名目录及入口，可在验证后扩展而不是再造并行层。
2. `docs/technical-architecture/**`：语义最明确，但名称较长，而且与根级 `ARCHITECTURE.md` 的导航关系不如方案 1 直接。
3. `docs/system-design/**`：能表达技术设计，但仍保留 `design` 一词，不能彻底消除与根级视觉 `DESIGN.md` 的认知冲突。

最终采用 `docs/architecture/**`，并保持：

```text
ARCHITECTURE.md              # 根级短地图
docs/architecture/           # 已验证当前技术架构
├── README.md
├── core-beliefs.md
├── system/
└── domains/

DESIGN.md                    # Impeccable 视觉系统与体验原则
docs/product/                # 当前产品心智模型与用户旅程
```

现有 `docs/architecture/README.md` 只是一份很薄的旧入口。正式迁移时必须验证其中列出的源码和分类，重写为新结构的 authority/router；不能因为目录名复用就直接认定旧内容仍然有效。

## 11. `Impeccable` 当前版本兼容性核对

状态：已核对官方提交 `da99645a58400ed7acb201e6904f9413efd89c6e`、Skill `3.9.1`，并在隔离 `/tmp` Git 仓库演练 Codex project-scope 安装；集成策略待用户确认。当前仓库未安装或执行 `Impeccable`。

### 11.1 项目级 Codex 安装会写入什么

| 路径 | 触发 | 性质 |
| --- | --- | --- |
| `.agents/skills/impeccable/**` | `npx impeccable install --providers=codex --scope=project` | 项目级 Skill、参考资料、脚本和内嵌 Codex 智能体；建议跟踪并固定版本 |
| `.codex/hooks.json` | 安装时接受 hook，或未传 `--no-hooks` 的非交互安装 | Codex PostToolUse hook 清单；项目级，可 tracked；每个开发者仍需在 Codex `/hooks` 信任 |
| `.impeccable/config.local.json` | 交互式记录 hook 确认或 local 覆盖 | 每开发者本地状态，不提交；安装器同时写本地 `.git/info/exclude` |
| `.codex/hooks.json.bak` | 仅现有 hook 清单损坏且显式 `--force` | 异常备份，不提交 |

安装本身不生成 `PRODUCT.md`、`DESIGN.md`，也不修改 `package.json` 或锁文件。当前版本不再创建独立 `.codex/agents/*.toml`；Codex 智能体嵌在 Skill 自己的 `agents/` 下。

### 11.2 `Impeccable` 命令会写入什么

| 命令/功能 | 产物 | 备注 |
| --- | --- | --- |
| `/impeccable init` | 根级 `PRODUCT.md` | 策略 owner；已有文件不静默覆盖 |
| `/impeccable init` | 可选根级 `DESIGN.md` | 实际委托 `document`；本仓库有代码，应使用扫描而非种子 |
| `/impeccable init` | 条件生成 `.impeccable/live/config.json` | 网页项目 live-mode 框架连接；本仓库应验证 `src/app/layout.tsx`，不能照抄官方表中的 `app/layout.tsx` |
| `/impeccable init` | 可选修改 `AGENTS.md` | 它会询问是否追加 `## Design Context`；本仓库应拒绝自动摘要，改由治理后的短指针控制 |
| `/impeccable document` | 根级 `DESIGN.md` + `.impeccable/design.json` | 扫描模式；后者是机器可读旁车 |
| `/impeccable document --seed` | 只有最小 `DESIGN.md` | 无真实 token 时才用；明确不生成旁车，不适用于当前仓库 |
| `/impeccable critique` | `.impeccable/critique/<timestamp>__<slug>.md` | 目标必须能解析为稳定 path/URL；官方定义为 tracked 审查报告 |
| 评议 policy | `.impeccable/critique/ignore.md` | 人工确认的设计偏差/忽略项；tracked |
| hooks/ignores | `.impeccable/config.json` | 团队共享 hook/detector/ignore 配置；tracked |
| hook runtime | `hook.cache.json`、`hook.pending.json`、可选 `NDJSON` 日志 | ephemeral/local，不提交 |
| 实时模式 | `live/server.json`、`sessions/`、`previews/`、`annotations/`、缓存与 manual-edit 状态 | ephemeral/local，不提交；每个工作树隔离 |
| `/impeccable pin <command>` | `.agents/skills/<command>/SKILL.md` | 可选命令别名；默认不固定，避免 skill 入口膨胀 |

官方要求 tracked 的 `.impeccable` 共享产物是 `config.json`、`live/config.json`、`design.json` 和 `critique/*.md`；其 README 提供精确的临时 `.gitignore` 区块。正式集成必须采用或等价覆盖该区块，不能只依赖某个开发者的 `.git/info/exclude`。

### 11.3 与当前仓库和目标 `IA` 的契合度

#### 直接契合

- 根级 `PRODUCT.md` 与目标一致。它必须是可直接消费的简短策略 document，而不能只是指向 `docs/product/**` 的空壳；详细产品知识仍由后者渐进披露。
- 根级 `DESIGN.md` 的位置与目标一致；`docs/architecture/**` 不与它竞争视觉 authority。
- `docs/product/**`、`docs/architecture/**`、OpenSpec 的路径均不会被 `Impeccable` 自动创建或覆盖。
- `.codex/hooks.json` 与现有 `.codex/config.toml` 是不同文件；当前无路径冲突。
- 项目级 `.agents/skills/impeccable/**` 可以在不同 clone/worktree 中提供同一份实现；local/live/cache 状态留在各自 `.impeccable/**`，可以满足实现一致、数据隔离。

#### 必须先解决的冲突

1. 当前根级 `DESIGN.md` 没有当前 Impeccable/Google DESIGN.md 所需的机器 frontmatter，并包含九个自由章节、`/design-demos` 实现说明和验证命令，不可直接作为新格式使用。
2. 根 `DESIGN.md` 与 `docs/design/**` 的当前知识先按本次治理结构重建；固定六段 schema 与旁车只在未来 `Impeccable` 变更中决定。过时演示内容在提取当前值后删除，不建立历史。
3. 当前 `.codex/skills/ui-ux-pro-max/**` 与 `Impeccable` 都会自动介入 UI/UX 工作，并且前者可生成第二套 `design-system/MASTER.md`。未来必须二选一：退役它，或降级为显式调用的研究工具并禁止 `--persist`；不能保留两个设计 authority。
4. 当前 `.gitignore` 没有 `Impeccable` 官方临时区块；直接使用 live/hook 会制造未分类文件。
5. 当前 UI 明确使用克制渐变和玻璃表面，而 `Impeccable` 的通用反模式可能产生有效或误报问题项。必须先跑基线，逐条确认后用狭窄的共享忽略规则；不得整条禁用检测器规则来迁就现状。

### 11.4 OpenSpec 与 `Impeccable` 的流程边界

- OpenSpec 仍是代码变更唯一 proposal/design/tasks/apply/verify/archive authority。
- `Impeccable` `shape` 只产生 task-scoped design 简报；确认后的长期决策必须写入或链接到活动 OpenSpec 变更，不能建立第二套 tracked spec。
- `Impeccable` `craft` 只能在相关 OpenSpec 变更已批准并进入实施后执行；形态的确认不等于代码变更授权。
- 评议与审计是评审证据，不是需求、批准或当前事实；已接受问题项进入 OpenSpec 任务与变更或后续 `QUALITY_SCORE.md`。
- `Impeccable` hook 只在 Codex 编辑后提供反馈，不替代 OpenSpec 校验、文档静态检查器、测试或 CI。

### 11.5 本地与 CI 一致性建议

- 使用项目范围安装并提交 `.agents/skills/impeccable/**`，不要依赖某台机器的全局安装。
- 提交相对路径的 `.codex/hooks.json`，由每个开发者显式批准信任。
- CI 不调用浮动的 `npx impeccable@latest detect`。应调用已提交 skill 中与 hook 相同的随包检测器，或使用被锁文件精确固定且经过等价性验证的封装器。
- 提交共享 config/sidecar/live wiring/critique 报告；忽略 local 确认、hook 缓存、server/session/preview/annotation/manual-edit 运行时状态。
- `Impeccable` 升级必须是独立 OpenSpec 变更：审阅上游差异、Hook 清单、规则数量与误报基线、生成式 schema 和 CI 输出后再更新。

### 11.6 当前结论

目标 `IA` 与 `Impeccable` **总体契合，但不是零配置兼容**。目录结构无需为它改回 `product-specs` 或 `design-docs`；需要在未来独立的 `Impeccable` OpenSpec 变更中新增 `.agents/**`、`.codex/hooks.json`、`.impeccable/**` 的治理边界，并原子迁移现有 `DESIGN.md`、处理 `ui-ux-pro-max` 重叠、建立本地/CI 同版本检测器。

## 12. 根 `DESIGN.md` 与 `docs/design/**` 联动决定

状态：已确认采用“根 `DESIGN.md` 为当前设计入口，`docs/design/**` 为详细展开层”的结构；`Impeccable` schema 与工具集成 deferred 到独立变更。

本节中涉及固定六段 schema、`.impeccable/design.json`、`/impeccable document`、Hook、检测器和 CI 耦合的内容，只是未来 `Impeccable` 变更的已验证输入，不属于本次文档治理实施合同。

### 12.1 `Impeccable` 原生限制

- 上下文 loader 只查找精确文件名 `PRODUCT.md` / `DESIGN.md`，顺序为项目根、`.agents/context/`、`docs/`，不会递归读取 `docs/design/**`，也不会自动展开 Markdown 链接。
- 检测器、hook、实时模式和其他命令默认消费根 `DESIGN.md` 与 `.impeccable/design.json`。
- 根 `DESIGN.md` 必须保持固定结构，不能增加布局、动效、响应式等自定义顶级章节。
- 因此不能把根文件移走、改成纯链接桩，或假设 `Impeccable` 会自动理解多文件设计库。

### 12.2 三种方案

1. **根 `DESIGN.md` 为机器与规范入口，`docs/design/**` 为详细展开层（推荐）**：原生兼容最好，只需要仓库自己的路由、交叉链接和漂移检查。
2. **`docs/design/**` 为唯一源，再生成根 `DESIGN.md` 投影**：需要自建生成器，把多文件内容裁剪成 `Impeccable` 六段格式；`/impeccable document` 又会从代码重写根文件，形成双向同步，维护成本高。
3. **移走根文件，根级只留 symlink/stub**：多文件内容无法满足单一固定格式；桩缺少检测器所需技术值，符号链接也不能解决 authority 和拆分问题，不采用。

### 12.3 推荐权威

- 根 `DESIGN.md`：唯一全局视觉规范入口；frontmatter 技术值、概览、颜色、排版、提升、规范组件、推荐做法与禁忌。
- `.impeccable/design.json`：由根文件和代码生成的机器扩展，包含色阶、动效、断点和可渲染组件片段；不得手改或独立定方向。
- `docs/design/**`：当前、已验证的详细页面/组件应用规则、示例、解释和设计实验治理；不得重定义根技术值或建立另一套全局视觉原则。
- `docs/architecture/**`：代码归属、导入、RSC/client、组件层级、数据与实现约束；不拥有颜色、排版或视觉方向。
- OpenSpec 活动变更：未来设计目标、方案比较和尚未落地的重新设计。
- Git 历史与 OpenSpec 归档：恢复被替代材料和变更理由；不建立 `docs/history/**`。

冲突时不静默选择一边：根 `DESIGN.md` 与详细设计文档描述已验证当前知识；已批准目标只在 OpenSpec 变更。与代码不一致时必须标为漂移并裁决。

### 12.4 推荐最小结构

```text
docs/design/
├── README.md
├── layout-and-density.md
├── component-patterns.md
├── interaction-and-motion.md
├── responsive-and-accessibility.md
├── review-workbench.md
└── design-demo-governance.md
```

- 初期保持扁平，避免为少量文件创建 `foundations/`、`patterns/` 等只有一个孩子的目录。
- 每个文件必须声明所属 `DESIGN.md` 小节、责任方、证据、更新触发条件和验证。
- `responsive-and-accessibility.md` 以及其他候选只有在现有 guide、代码和渲染证据核验后才创建；不得为了填满骨架编造内容。
- 未来只有出现独立 owner/lifecycle 时才继续拆目录；新增子目录仍使用 `README.md` 作为入口。

### 12.5 当前 `DESIGN.md` 分流

| 当前章节 | 根 `DESIGN.md` | `docs/design/**` | 其他层 |
| --- | --- | --- | --- |
| 前言/Classification/Placement | 概览留一句视觉定位 | `README.md` 保存治理、索引和基线说明 | authority 映射进入文档 metadata/map |
| 视觉方向 | `Overview` 的全局氛围、密度、产品语气 | 详细布局/应用解释 | 无 |
| 颜色技术值 | `Colors` + frontmatter；旁车保存扩展 metadata | 只写 token 使用场景，不复制字面值 | 精确实现由 CSS/source 负责 |
| 背景与材料 | `Elevation` 的系统规则 | component/material 应用模式 | CSS 路径和变量归属进入 architecture |
| 排版 | `Typography` 的字体栈和共享角色 | 详细角色与应用指南 | 无 |
| 布局规则 | 概览留工作台与单主表面等原则 | `layout-and-density.md`、`review-workbench.md` | 路由与容器归属进入架构 |
| 组件 | `Components` 保存规范 rules/tokens | `component-patterns.md` 保存状态、密度、组合和使用情境 | 强制 primitive/import 边界进入 architecture/standards |
| 动效 | Overview/Components 留总则；旁车保存 token | `interaction-and-motion.md` | reduced-motion 验证进入 testing |
| 应做与不应做 | 固定 `Do's and Don'ts` | 详细文档只链接，不抄整表 | 实施禁止项进入架构与工程规范 |
| 实施说明 | 不保留 | 只保留真正的设计实验治理 | 路径/依赖进 architecture；命令进 testing/runbooks；过时内容进历史 |

### 12.6 现有 `docs/ui/**` 迁移边界

不能同时长期保留 `docs/ui/**` 和 `docs/design/**` 两个入口：

- `docs/ui/README.md` 的视觉知识入口职责由 `docs/design/README.md` 替代。
- `design-demo-governance.md` 拆出设计实验/视觉参考部分进入 `docs/design/**`；路由、数据 loader、source-of-truth 和 parity 实施进入 `docs/architecture/**`。
- `component-boundaries.md` 与 `project-page-boundaries.md` 是代码归属，应迁入 `docs/architecture/**`，不是 design 文档。
- `legacy-static-design-demos.md` 已是历史映射；提取仍有效的当前边界后删除，不建立历史或新的 generated 目录。
- 原 `docs/ui/**` 只有在每一份内容完成迁移、交叉链接和验证后才能删除，不能直接改目录名。

### 12.7 联动与自动化

1. 根 `DESIGN.md` 在合法的 `Overview` / `Components` 正文内放受控链接块，指向 `docs/design/README.md` 和相关详细文档；不新增顶级章节。
2. `AGENTS.md` 增加短 trigger：UI/UX、页面模式、交互或组件设计任务先读根 `DESIGN.md`，再按 `docs/design/README.md` 路由到相关文件。
3. `docs/design/README.md` 反向链接根 `DESIGN.md`、旁车、代码证据、OpenSpec capability/change 和验证入口。
4. `/impeccable document` 的输出视为待审查更新；同批恢复/核验受控 link 区块，并审计受影响的 `docs/design/**`，不能把命令输出直接视为完成。
5. CI 检查固定 DESIGN schema、根与 `docs/design` 双向链接、每个详细文件的所属小节、禁止重复字面 token，以及 `DESIGN.md` 变化时旁车必须同批变化。
6. 人工文档审计比较根规则、详细模式、真实组件和渲染页面，识别自动静态检查器无法发现的语义冲突、过时截图和伪当前事实。

### 12.8 更新流

```text
实现/渲染证据
  -> /impeccable document 提议根 DESIGN + sidecar 更新
  -> 人工核验全局规则
  -> 按影响同步 docs/design 详细模式
  -> docs/design/link/schema/drift checks
  -> OpenSpec verify/archive
```

单页面应用方式变化只更新实现与对应 `docs/design/**`；全局 token、视觉原则或规范组件变化必须同时更新根 `DESIGN.md`、旁车、实现和受影响的详细文档。

## 13. `runbooks`、历史材料、原型与 deferred 层的决定

状态：已确认保留 `docs/runbooks/**`；已确认删除旧归档与 Training 原型；已确认暂缓建立 `generated` / `references` 目录分层。

### 13.1 `docs/runbooks/**`

- 保存以结果为导向、可执行的操作流程：前置条件、风险检查、精确步骤、预期输出、验证、失败分支、回滚或恢复。
- 适用于本地启动/验证、故障排查、数据维护、受控运维等需要智能体或人逐步执行的任务。
- `README.md` 只做按任务场景路由，并明确 local/dev/production 边界。
- 每份运行手册声明适用环境、owner、最后已验证、前置状态、破坏性级别、验证和恢复路径。
- 可自动检查的命令、链接、环境变量名和脚本入口进入 linter/smoke 测试；真实风险、步骤顺序和恢复有效性进入人工审计。
- 现有 `config-runtime-assets.md` 混合了操作步骤、配置说明、生成文件策略和静态资源说明，必须按事实归属拆分，不能整文件搬迁。

### 13.2 当前 `docs/archive/**`：提取后整体删除

- 目标树不建立 `docs/history/**`，也不把当前归档改名保存。
- 对归档中每份文件执行 extract/delete 审计：仍有效的产品、设计、架构、约束或操作知识，经代码/测试核验后写入对应当前责任方；无当前值的内容直接删除。
- 所有旧文件完成提取后，删除整个 `docs/archive/**`。Git 历史负责旧文件恢复，不在当前知识库中保留一套遗留包。
- 新 proposal、spec 增量、design、任务、验证和变更历史统一由 `openspec/changes/**` 与 OpenSpec 归档管理。
- 删除前必须解除当前错误权威：现有测试仍读取归档路线图，根文档与脚本也有归档链接；先提取规则、改写消费者并验证无引用，再删除目录。

### 13.3 当前 `docs/prototypes/**`：整体丢弃

- 目标树不建立 `docs/prototypes/**`。
- 删除现有全部 Training HTML、CSS、JavaScript、图片、字体和原型 README；不迁入历史。
- 当前生产代码与已验证当前文档是 Training 行为和设计的证据；Training 继续作为与 Generation 平级的工作模式。
- 删除批次同时移除原型路由映射、原型治理测试、仓库清单分类、文档路由与旧计划中的当前链接，并保留“生产代码不得依赖已删除原型资产”的通用边界（如仍有必要，应改为通用源码边界检查，而不是保留原型专用测试）。

### 13.4 `docs/generated/**` 与 `docs/references/**`：暂缓分层

- 初始 harness 不创建这两个目录，也不为了贴合参考骨架迁移现有文件。
- 当前生成文档继续留在已有位置并由已有 generator/check 维护；人工查阅材料也先留在其当前责任方下。
- 运行一段时间后，以真实维护数据决定是否拆分：变更频率、手工漂移、重复事实、生成耗时、智能体查找失败、owner 不清和 CI 噪声。
- 到时通过独立 OpenSpec 变更决定采用 `generated` 或 `references`、只采用其中之一，或继续按领域共置；当前规范不预设最终答案。

## 14. `agent-rules/**` 收敛到 `AGENTS.md` 与 `docs/runbooks/**` 的评估

状态：已确认采用。现有 `agent-rules/**` 共 13 个文件、301 行，没有运行时代码依赖；消费者仅为文档、OpenSpec 配置与提案、仓库清单生成器和文档治理测试。

### 14.1 权威分工

- 根 `AGENTS.md` 是唯一智能体工作流 policy authority，保存必须始终可见的触发条件、默认行为、禁止项、安全边界和任务路由。
- `docs/runbooks/**` 是步骤 authority，保存命令、步骤、检查、预期输出、失败恢复和环境实例说明；只有任务命中 trigger 时渐进读取。
- 删除“`agent-rules/**` 是源码、`AGENTS.md` 是手工同步摘要”的双源模式，不生成第三份投影。
- `AGENTS.md` 不放长 PowerShell、`curl`、Prisma、构建或服务启动代码块；运行手册不重新定义另一套策略。

### 14.2 逐文件分流

| 当前文件 | 性质 | 目标归宿 |
| --- | --- | --- |
| `deploy/index.md` | policy + 步骤 | runtime/deploy 门禁进 `AGENTS.md`；完整编排进 `runbooks/deployment/README.md` |
| `deploy/lock.md` | 安全 policy + 步骤 | 持锁/失败释放边界进 `AGENTS.md`；获取、等待、metadata 进 `runbooks/deployment/lock.md` |
| `deploy/next-build.md` | 安全策略与步骤 | 禁止并发或破坏活跃开发缓存进入 `AGENTS.md`；查询、构建、诊断进入运行手册 |
| `deploy/prisma.md` | 安全 policy + 步骤 | provider 必须匹配真实目标进 `AGENTS.md`；命令进 `runbooks/deployment/database-sync.md` |
| `deploy/queue.md` | 安全 policy + 步骤 | 只恢复本部署暂停任务进 `AGENTS.md`；API/记录/恢复进 `queue-safety.md` |
| `deploy/service-restart.md` | 安全 policy + 步骤 | 禁止全局杀 Node 进 `AGENTS.md`；精准筛选/启动命令进运行手册 |
| `deploy/verification.md` | 步骤 | 完成条件一句进 `AGENTS.md`；完整验证进运行手册 |
| `dev-service.md` | 策略与步骤 | 开发不等于部署且不得碰生产这一规则进入 `AGENTS.md`；启动与验证进入开发运行手册 |
| `git.md` | 策略为主 | 用户语义、范围暂存、运行时排除项进入 `AGENTS.md`；交付检查清单进入 `git-delivery.md` |
| `mypc-powershell.md` | procedure/reference | `AGENTS.md` 只保留 trigger；完整内容进 `runbooks/mypc/powershell-over-ssh.md` |
| `nextjs.md` | 短硬性 policy | 直接并入 `AGENTS.md` |
| `subagents.md` | 智能体硬性 policy | 直接并入 `AGENTS.md` |
| `ui-auth.md` | 安全 policy + 步骤 | token 禁止项进 `AGENTS.md`；认证验证流程进 local-verification 运行手册 |

### 14.3 推荐结构

```text
AGENTS.md

docs/runbooks/
├── README.md
├── git-delivery.md
├── development/
│   ├── README.md
│   ├── dev-service.md
│   └── local-verification.md
├── deployment/
│   ├── README.md
│   ├── lock.md
│   ├── queue-safety.md
│   ├── database-sync.md
│   ├── next-build.md
│   ├── service-restart.md
│   └── verification.md
└── mypc/
    ├── README.md
    └── powershell-over-ssh.md
```

### 14.4 不采用的方案

1. **把全部内容合并进 `AGENTS.md`**：会把 301 行细节和长命令放进每次任务上下文，破坏短入口与渐进式披露。
2. **继续保留 `agent-rules/**`，另建运行手册**：会维持 policy、摘要、步骤多处重复，增加漂移。
3. **从运行手册生成 `AGENTS.md`**：policy 与步骤生命周期不同，生成裁剪规则会成为新的隐藏 authority，不采用。

### 14.5 不能机械照搬的现有语义

正式迁移前必须以代码和实际环境重新验证：

- 部署入口支持“当前本机生产”，但 lock/restart 命令目前只实现 Windows `mypc` 路径。
- Windows 项目路径、3000/3001 端口和公开域名均硬编码，需要确认哪些是稳定环境配置、哪些只是实例示例。
- 重启输出 `server.log`，Git 排除配置列出的却是另一组生产日志名称。
- 生产 Prisma 当前使用 `db push`，必须确认是否仍为批准策略，不能仅因旧规则存在就作为当前事实。
- 队列 pause/resume 路由仍存在，但认证、错误响应和部分暂停失败恢复尚需补全验证。
- 默认自动 commit/push、发现生产后默认部署是重大 policy；除非用户通过 OpenSpec 明确修改，否则迁移应先保持语义不变。

### 14.6 原子迁移顺序

1. 核验每条现有规则与当前代码/运行环境；不确定的重大 policy 向用户确认。
2. 在 `AGENTS.md` 建立唯一 hard-policy 与 trigger 路由。
3. 建立并验证 `docs/runbooks/**` 步骤。
4. 同批更新 `CLAUDE.md`、README、OpenSpec 配置、当前文档、清单 generator 和治理测试。
5. lint/CI 证明所有 trigger 链接有效、dev/prod 隔离仍受测、仓库中没有旧 `agent-rules` 引用。
6. 删除整个 `agent-rules/**`，重新生成清单，不保留兼容桩。

## 15. `docs/_meta/**` 最小机器治理控制面

状态：已确认采用；现有治理测试可以按目标契约重写或删除，不能反向约束新结构。

```text
docs/_meta/
├── README.md
├── documentation.schema.json
├── policy.yaml
└── templates/
    ├── document.md
    ├── directory-readme.md
    └── runbook.md
```

- `README.md`：说明 `_meta` 只治理文档，不承载产品、架构、设计或变更事实。
- `documentation.schema.json`：定义各当前文档配置的元数据必填项；实例元数据与文档共置，禁止维护第二份逐文件登记表。
- `policy.yaml`：定义允许的路径、必需 `README.md`、根目录与详情链接、禁止遗留路径、更新触发映射和 OpenSpec 排除与验证边界。
- `templates/**`：只为当前文档提供标准骨架，不提供 proposal/spec/design/tasks 模板；这些始终由 OpenSpec schema 管理。
- 人工语义审计进入 `docs/runbooks/documentation-audit.md`；静态检查器实现在 `scripts/docs/**`；CI 配置进入仓库 CI 目录；审计报告和清单不进入 `_meta`。
- 治理测试是 schema/policy 和 `docs:check` 的消费者。任何要求保留 `agent-rules/**`、归档、原型或旧文案的测试都必须重写/删除，并以新契约的正反例替代。

## 16. 正式 OpenSpec 工件

结构确认后，正式子变更已建立在：

- `openspec/changes/rebuild-documentation-governance/proposal.md`
- `openspec/changes/rebuild-documentation-governance/specs/documentation-governance/spec.md`
- `openspec/changes/rebuild-documentation-governance/design.md`
- `openspec/changes/rebuild-documentation-governance/tasks.md`

本 `.tmp` 文件至此只保留讨论与决策来源；正式工件修订经用户审阅批准后，实施只能按子项 `tasks.md` 执行，不再创建任何平行计划。
