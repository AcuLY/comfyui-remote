## Context

仓库目前拥有有价值的文档组件，但缺少单一、持久的知识契约。在 2026-07-10 设计基线上，仓库有 107 个已跟踪 Markdown 文件，其中 73 个位于 `docs/`；13 个 `agent-rules/**` 文件共 301 行，混合了策略与步骤；42 个 archive 文件；以及 28 个 Training prototype 文件与资产。这些数量只是发现证据，不是稳定要求，因此实施前必须重新枚举已跟踪文件。

现有治理部分自循环：`docs/index.md`、`docs/documentation-map.md` 与 `docs/repo-inventory.md` 相互重叠；元数据是自由格式且许多文档缺失；测试硬编码当前路径，有时还把已归档计划当作权威；精确路由与 API 事实被复制进正文；`docs/workflow.api.json` 等运行时数据放在文档树下；仓库中也没有运行完整文档门禁的 CI 工作流。

已批准的设计约束如下：

- 先确定结构，再完成子规范和迁移；
- OpenSpec 是唯一重要变更生命周期，本 `tasks.md` 是唯一实施任务计划；
- 当前实现、已批准目标与历史意图保持独立；
- 提取并删除 `docs/archive/**`，不得改名为 history；
- 丢弃全部 Training prototype；
- 将 `agent-rules/**` 拆分为 `AGENTS.md` 策略和 runbook 步骤，再删除原目录；
- 明确延后 `docs/generated/**` 和 `docs/references/**`；
- `Impeccable` 保持为未来独立变更；
- 治理测试若编码了无效旧契约，可以重写或删除；
- 文档治理先于可观测性和工程规范；
- 第一方维护文档的正文与 frontmatter 人类可读字符串默认使用简体中文，并由确定性门禁阻止英文正文回归。

## Goals / Non-Goals

**目标：**

- 建立简洁、渐进披露、Agent 可理解的当前知识库。
- 为每个维护文档提供明确 owner、authority、类型化源关系、证据契约和验证路径。
- 用逐文档 metadata 和小型机器策略取代路径启发式及重复地图。
- 在本地与 CI 提供同一个确定性非写入文档命令。
- 为软件无法证明的语义提供可重复审计。
- 提取已验证持久知识、消除重复当前权威并删除过时文档表面。
- 只在仓库达到范围内零违规后启用文档专用必需 CI 检查。
- 让最终保留的第一方文档以简体中文为默认人类语言，并为明确技术例外保留原始稳定形式。

**非目标：**

- 选择或实施可观测性技术、性能预算、工程规范或后续统一 CI 设计。
- 安装或运行 `Impeccable`、把根 `DESIGN.md` 重写为最终 `Impeccable` schema，或引入 `Impeccable` Hook 和检测器输出。
- 引入新的历史文档存储或自定义历史迁移 schema。
- 在运维证据支持前强制 generated/reference 目录分类。
- 让静态检查器假装证明语义正确性。
- 将被忽略的 `.tmp/**` 综合草稿直接提升为当前文档。
- 增加受控 `docs:read` CLI、文档 MCP 网关、定时语义审计或普通开发自动 `$docs-audit` 触发器。
- 把保留的 PreToolUse 路径匹配实验安装或生产化为文档治理插桩；另行授权的根级后继实验只能作为父变更记录的受限本地实验运行。
- 翻译技术标识、命令、路径、协议字段、第三方 Skill、测试 fixture、数据载荷或 OpenSpec 解析器所需结构词。

## Decisions

### 1. 使用固定核心信息架构和证据门控的当前 owner 区域

固定核心结构如下：

```text
/
├── README.md
├── AGENTS.md
├── ARCHITECTURE.md
├── PRODUCT.md
├── DESIGN.md
├── CLAUDE.md                         # 仅兼容 pointer
├── .codex/
│   └── skills/
│       └── docs-audit/
│           ├── SKILL.md              # 唯一语义审计调用表面
│           ├── agents/openai.yaml
│           └── references/evidence-contract.md
├── openspec/
│   ├── config.yaml
│   ├── specs/
│   └── changes/
└── docs/
    ├── README.md
    ├── QUALITY_SCORE.md              # deferred placeholder
    ├── RELIABILITY.md                # deferred placeholder
    ├── SECURITY.md                   # deferred placeholder
    ├── repo-inventory.md             # 现有生成工件暂时原地保留
    ├── _meta/
    │   ├── README.md
    │   ├── documentation.schema.json
    │   ├── policy.yaml
    │   └── templates/
    │       ├── document.md
    │       ├── directory-readme.md
    │       └── runbook.md
    ├── architecture/
    │   ├── README.md
    │   ├── core-beliefs.md
    │   ├── system/
    │   │   ├── README.md
    │   │   ├── context.md
    │   │   ├── dependency-model.md
    │   │   ├── runtime-topology.md
    │   │   ├── data-model.md
    │   │   ├── agent-interfaces.md
    │   │   └── execution/
    │   │       ├── README.md
    │   │       └── queue-worker.md
    │   └── domains/
    │       ├── README.md
    │       ├── generation/README.md
    │       ├── training/README.md
    │       └── shared-resources/README.md
    ├── product/
    │   ├── README.md
    │   ├── generation/README.md
    │   ├── training/README.md
    │   └── shared-resources/README.md
    ├── design/
    │   ├── README.md
    │   ├── layout-and-density.md
    │   ├── component-patterns.md
    │   ├── interaction-and-motion.md
    │   ├── responsive-and-accessibility.md
    │   ├── review-workbench.md
    │   └── design-demo-governance.md
    ├── runbooks/
    │   ├── README.md
    │   ├── git-delivery.md
    │   ├── development/
    │   │   ├── README.md
    │   │   ├── dev-service.md
    │   │   └── local-verification.md
    │   ├── deployment/
    │   │   ├── README.md
    │   │   ├── lock.md
    │   │   ├── queue-safety.md
    │   │   ├── database-sync.md
    │   │   ├── next-build.md
    │   │   ├── service-restart.md
    │   │   └── verification.md
    │   └── mypc/
    │       ├── README.md
    │       └── powershell-over-ssh.md
    ├── api/                           # 仅作为已验证当前 owner 保留
    │   └── README.md
    └── testing/                       # 仅作为已验证当前 owner 保留
        └── README.md
```

`docs/api/**` 与 `docs/testing/**` 得以保留，是因为本阶段延后通用参考资料分类，而仓库目前确有独立 API 契约和测试基础设施责任方。语义审计可以把单个文件合并进架构或运行手册，但只有当所有独立归属都消失时才删除这些目录。所有保留路径都必须出现在 `policy.yaml` 中，不允许无限制匹配 `docs/**`。

只有当前证据支持内容时才创建详细设计文件；目标文件名不授权创建空白或推测性文档。架构 `observability/` 子树只由后续可观测性变更新增。

`CLAUDE.md` 是指向 `AGENTS.md` 的薄兼容适配器，永不拥有规则。根 `PRODUCT.md` 与 `DESIGN.md` 是当前地图，`docs/product/**` 与 `docs/design/**` 扩展已验证当前知识。拟议产品或体验变化归 OpenSpec。

**考虑过的替代方案：** 完全复制 OpenAI 文章目录树。否决原因是 OpenSpec 已取代 ExecPlans，`Impeccable` 预期未来根上下文文件，而本仓库有明确的 API、测试、部署和 Training 归属。

**考虑过的替代方案：** 保留每个现有文档目录，只增加 metadata。否决原因是这会保留重复和过时权威。

### 2. 文档实例 metadata 与文档同处

每个受治理 Markdown 文件使用由 `documentation.schema.json` 校验的 YAML frontmatter。通用模型如下：

```yaml
schemaVersion: 1
document:
  type: architecture | product | design | runbook | api | testing | router | placeholder
  status: current | deferred
  owner: <稳定 owner ID>
  authority: <规范化 subject 与 authority kind>
  readWhen: [<任务 trigger>]
  sources: [<code、schema、test 或 root-contract 路径>]
  verifiedBy: [<非写入命令或测试>]
```

运行手册还必须提供环境、风险、恢复和最后验证字段。现有生成器所有的文档还必须声明生成器、输入、重新生成命令和非写入检查。这些来源字段不创建生成文件目录类别。

根文件使用按路径指定的配置，使 `AGENTS.md` 保持简洁，也让未来 `Impeccable` frontmatter 扩展可与核心 `DESIGN.md` 契约共存。OpenSpec 工件排除在该 frontmatter schema 外，由固定的 OpenSpec 集成校验。

`policy.yaml` 负责允许路径、配置分配、必要入口页、受控根目录与详情关系、禁止遗留路径、有限治理范围矩阵和精确的变更源码文档关系。每个关系只能是带确定性非写入验证器与阻断语义的 `contract`，或带责任方与理由并生成非阻断语义审查警告的 `review`。它不列出每个文档的责任方和实例值。`repo-inventory.md` 从已跟踪路径和已解析元数据派生，不是独立权威。

**考虑过的替代方案：** 每个文档一行的中央清单。否决原因是它会重复实例元数据，成为另一份人工地图。

**考虑过的替代方案：** 从路径子串推断类别和 owner。否决原因是当前 generator 已证明启发式会隐藏错误权威。

### 3. 分离确定性校验与语义审计

`npm run docs:check` 是实现在 `scripts/docs/**` 下的唯一非写入编排入口。`full` 模式是默认、验收和 CI 模式。显式 `fast` 模式从有效合并基准开始，对变更文档、导航相邻项、责任方、来源关系、生成器和 OpenSpec 父变更求闭包。当合并基准缺失，策略、schema、OpenSpec、Skill 或生成器代码变化，文档移动或删除，根目录或导航权威变化，或无法证明影响闭包完整时，自动升级到 `full`。

`full` 模式始终评估完整当前结构图，运行每个确定性契约、生成器、OpenSpec 和 Skill 验证器。有比较修订版时，以变更集合选择语义 `review` 警告；否则保守地把所有 `review` 关系视为匹配，并以缺少基准的证据标注警告。CI 与阶段验收始终传入显式比较修订版。

两种模式使用仓库固定 runtime 与 OpenSpec 集成，不依赖网络，并共享同一引擎：

1. 使用 Git 枚举已跟踪路径并解析有限 scope 矩阵；
2. 解析 frontmatter，校验适用 current-document profile；
3. 校验 `policy.yaml`、允许 topology、必要 `README.md` 和禁止 live path；
4. 使用 GitHub 兼容重复 heading slug 解析 GFM link 与 heading；
5. 验证 root-to-current 可达性与必要反向链接；
6. 评估类型化 `contract` 与 `review` 来源关系；
7. 非写入运行现有生成器与源码契约适配器；
8. 运行固定 OpenSpec 和 project-Skill 校验；
9. 输出确定性排序的人类可读或 JSON 诊断；
10. 比较内容感知的仓库前后快照，并拒绝检查器的任何写入。

诊断 schema 为 `ruleId`、`severity`、仓库相对 `path`、`location`、`evidence`、`remediation` 和 `owner`。退出 `0` 表示无确定性错误，`1` 表示仓库规则违规，`2` 表示检查器或配置失败。警告只用于启发式审查事实，绝不降级确定性契约。写入型生成器保持为独立命令。

本地非写入证明比较前后的已跟踪差异、已暂存差异和未跟踪路径与内容指纹；只要检查器不新增修改，用户已有脏工作树仍有效。CI 以干净状态开始并以干净状态结束。必需的 `full` 模式作业在每条受保护合并路径运行，不使用仅文档路径过滤器，因为仅源码变更也可能破坏契约。

有限 scope 矩阵如下：

| 表面 | 确定性治理 | 语义/当前权威 |
| --- | --- | --- |
| 根入口与已批准 `docs/**` | 元数据、拓扑、GFM 链接与锚点、导航、类型化关系、生成器 | 当前文档；可显式 `$docs-audit` |
| `openspec/**` | 固定 OpenSpec 校验及适用内部链接 | 按生命周期作为 target/history；排除 current frontmatter/navigation |
| `.codex/skills/**` 等项目 Skill | 仓库固定的 Agent Skill 元数据、随包参考资料链接、路径安全与前向测试证据 | 仅显式调用 Skill 时拥有工作流权威；不是当前文档 |
| 已注册 `src/**.md` 与 `tests/**.md` | 显式 policy 注册和适用 link/contract | 仅源码相邻知识；未注册文件必须迁移或删除 |
| Fixture、样例与 OpenSpec 证据 | 路径限制和有意保留的 fixture 规则 | 非当前证据；排除实时引用、导航与问题项 |

Markdown 解析使用 GFM AST，而非正则表达式。围栏或缩进代码、行内代码、HTML 注释、负向 fixture 和非当前 OpenSpec 证据不产生实时路径引用或导航边。内部相对目标和锚点为阻断项；外部可达性、年龄启发式、疑似重复和正文质量只形成离线警告或语义问题项，不成为易波动的网络阻断项。

项目 Skill 校验不依赖用户全局 `Skill Creator` 安装。子变更增加精确的直接开发依赖 `js-yaml` `4.1.1` 和仓库自有 `scripts/skills/validate.mjs`，通过 `npm run skills:check -- .codex/skills/docs-audit` 暴露。该离线命令校验 Agent Skill 核心 frontmatter 与文件夹契约、范围内参考资料和本仓库仅显式激活规则；`docs:check` 调用同一路径。

语义审计是 `.codex/skills/docs-audit/**` 下项目本地 `$docs-audit` Skill，不是 runbook，也不是 `AGENTS.md` trigger。契约如下：

- 发现：frontmatter 只描述用户或已批准 OpenSpec 任务的显式调用，因此普通源码或文档编辑不会隐式触发；
- 调用：`$docs-audit changed`、`$docs-audit paths <repo-relative paths>`、`$docs-audit change <id>` 或 `$docs-audit full`；省略 scope 时安全选择 changed scope，否则升级到 full；
- 操作：默认 `report` 不写入；`record` 只写显式命名的 `openspec/changes/<id>/evidence/docs-audit/**` 报告；`fix` 授权限定文档和 evidence 写入；
- 证据优先级：当前源码、schema、测试与必要运行时证据，其次是已批准活动目标，最后是 Git 与 OpenSpec 历史；
- 问题项：包含声明类别、责任方、证据、冲突、置信度、处置、验证和任何 `user-decision-required` 边界；
- 报告：临时运行在任务中返回问题项，不建永久台账；已批准 OpenSpec 任务必须在写证据前命名 `record` 或 `fix` 及范围内输出；
- 审查：修复者不能签署自己的语义通过；独立 Agent 或审查者重新运行相同范围，否则结果保持 `review-required`；
- 调度：本阶段没有；任何周期性审计需要后续批准变更。

Skill 可以调用确定性范围和证据脚本，但不引入受控 `docs:read` CLI 或文档 MCP 网关。只有恰好一个受支持答案的机械修正才能在显式 `fix` 模式进行。权威、产品方向、部分实现、删除潜在当前知识、缺少运行时证据或冲突解释必须升级处理。普通源码或文档变化不自动运行 Skill。`review` 关系警告在显式审计或阶段验收审查中处理；阶段验收前，每个警告与语义问题项都必须有处置。

Skill 自身遵循测试驱动开发：在没有 Skill 时采集基线失败，编写最小工作流，用仓库固定命令校验包，重复运行同一场景，独立测试报告、记录与修复路径边界，并在采用前用全新 Agent 前向测试代表性当前、目标与历史冲突。

**考虑过的替代方案：** 用测试编码语义正确性。否决原因是当前测试已经证明，测试可以在意义错误时仍保留过时结构。

**考虑过的替代方案：** 保留 `docs/runbooks/documentation-audit.md` 作为第二入口。否决原因是它会分裂调用与规则权威；详细复用材料留在 Skill `references/**` 中。

### 4. 将治理测试视为 policy consumer

`tests/test-documentation-governance.test.ts` 和相关测试是实施输入，不是权威。它们围绕 schema、策略、fixture 和公开 `docs:check` 行为重写。测试不得仅因某个遗留路径过去存在，就断言其必须存在。

每个关键规则都需要一个有效 fixture 与一个受控无效 fixture。高价值反例包括元数据缺失、链接或锚点断裂、重复 GFM 标题、代码块假引用、孤立当前文档、无效根目录与详情权威、过时契约、审查警告、禁止实时遗留路径、过时生成器输出、畸形 OpenSpec 关系、不安全的 `fast` 范围缩小，以及检查器退出码区分。

**考虑过的替代方案：** 保留所有当前测试，让迁移迎合它们。否决原因是多个测试依赖目标架构将删除的 archive 或 prototype 文件。

### 5. 按证据 owner 迁移，不做机械改名

迁移地图如下：

| 当前表面 | 目标操作 |
| --- | --- |
| `README.md` | 保留为人类入口；删除易变清单并路由到 owner 文档。 |
| `AGENTS.md` + `agent-rules/**` | 在 `AGENTS.md` 重建策略、在 runbook 重建步骤、更新所有 consumer，再删除 `agent-rules/**`。 |
| 语义文档审计 | 创建并前向测试 `.codex/skills/docs-audit/**` 作为唯一显式审计入口；不创建审计运行手册或 `AGENTS.md` 触发器。 |
| `docs/index.md` + `docs/documentation-map.md` | 将人类路由合并进 `docs/README.md`，机器规则移入 `_meta/policy.yaml`，删除重复项。 |
| `docs/analysis/**`、worker/Prisma 边界文档 | 验证并拆入 `docs/architecture/**`，删除被替代源。 |
| `docs/ui/**`、前端指南、设计一致性文档 | 将已验证视觉知识拆入根目录与设计文档，代码归属拆入架构，删除重复源。 |
| API 与 MCP 文档 | 对照 source/tests 验证；generated/reference 分类延后期间保留在 `docs/api/**`。 |
| testing 指南 | 在 `docs/testing/**` 保留独立 test-infrastructure 知识；可执行操作序列移到 runbook。 |
| 本地验证、脚本维护、部署规则 | 合并为面向任务的运行手册。 |
| 根 `position_presets.md` | 将已验证 product/prompt 知识移到 `docs/product/shared-resources/**`。 |
| `docs/workflow.api.json` | 将运行时模板移到 `config/workflows/standard-workflow.api.json` 等配置所有的路径；更新加载器、测试和文档。 |
| `docs/plans/auto-review-analysis/**` | 将基准与配置输入移给测试和配置责任方，生成式分析输出移给非计划工件责任方；删除 `docs/plans/**`。 |
| 旧规范、计划、PRD、实施说明 | 提取已验证当前知识到责任方文档或现行规范，再删除。 |
| `docs/archive/**` | 审查每个基线项，提取已验证当前价值，更新 consumer，再删除整个目录。 |
| `docs/prototypes/**` | 证明生产无依赖，删除原型专用使用方与测试，再删除全部文件，不建历史副本。 |
| `docs/repo-inventory.md` | 本阶段原地保留，从解析后的元数据派生，并增加非写入新鲜度验证。 |

`workflow.api.json` 的移动虽由文档归属推动，却会影响运行时。因此其实施批次必须运行适用代码测试和正常运行时与部署门禁，不能视为仅文档。

### 6. 原子化迁移 Agent 策略

删除旧规则前先创建并验证新运行手册。在一个切换批次中，把 `AGENTS.md`、`CLAUDE.md`、`openspec/config.yaml`、根目录与文档路由、生成器分类、治理测试和全部当前链接切到新路径，然后才删除 `agent-rules/**`。`$docs-audit` 保持显式调用 Skill，位于普通 `AGENTS.md` 触发路由之外；需要时由 OpenSpec 迁移或验收任务明确调用。

语义验证期间，重新核验而非盲目复制硬编码环境事实：本地与 `mypc` 部署、Windows 路径、端口、公开 URL、日志名、Prisma `db push`、队列认证/恢复和服务重启定位。重大策略不确定时提交用户。除非另行批准，默认 commit/push 与 deployment 行为不变。

### 7. 用显式门禁删除 archive 与 prototype 表面

Archive 迁移在实施开始时以 `git ls-files docs/archive` 作为完整输入集。每个语义批次必须达到两个结果之一：已验证当前信息已集成到 owner 且 consumer 通过；或源没有当前价值。最终门禁要求没有已跟踪 archive/history path 和 live reference。Git 保留恢复能力，OpenSpec archive 保留变更工件。

用户已明确丢弃全部原型，因此清理不要求保存设计。删除前源码扫描必须证明生产不导入原型资产。删除原型专用测试和映射；生产测试及当前文档继续保护当前 Training 路由、共享导航模式切换和平级工作模式行为。

### 8. 仅在零违规时启用文档专用 CI

迁移期间可以在本地运行 `fast` 或 `full` 模式的 `docs:check`；阶段验收要求零确定性错误、每个警告和语义问题项都有显式处置，并纳入仓库一个从干净状态到干净状态的 `full` 模式文档专用 CI 作业。证据必须包含成功运行、受控负向 fixture 失败、恢复成功、无仅文档路径过滤器，以及检查在每条受保护合并路径为必需项的确认。

该门禁比最终 Harness CI 收口更窄：它立即保护文档，但不提前选择可观测性或工程规范作业。

### 9. 保持未来文件诚实并延后未来工具

`QUALITY_SCORE.md`、`RELIABILITY.md` 与 `SECURITY.md` 只包含元数据、目的、延后状态、激活责任方与阶段以及权威边界。问题项与拟议工作进入 OpenSpec，而不是占位待办清单。

文档阶段建立可支持未来 `Impeccable` 的根 `PRODUCT.md`/`DESIGN.md` 与详细设计路由，但不把根 `DESIGN.md` 改为 `Impeccable` 六段 schema，也不创建 `.impeccable/**`、`.agents/skills/impeccable/**`、`Impeccable` Hook 配置、检测器基线或旁车检查。该集成必须在独立变更中重新验证当时仓库。独立粗粒度路径匹配 Hook 不是 `Impeccable` 集成。

### 10. 将 PreToolUse 实验移交可观测性阶段但不采用

已脱敏 `pretooluse-file-access-poc/**` 留在本变更证据目录，作为非规范性可行性记录。子变更不直接安装保留脚本，也不用于验收。Windows 续接后，用户另行授权了不含操作分类或服务依赖的简化根级后继实验。它只写被忽略的 `logs/**` 和 `metrics/**`，位于本子变更实施与验收之外，也不让证据副本成为规范。遗留样例字段 `access_total` 与后继字段 `access_attempt_total` 都只表示尝试匹配路径，不能证明工具成功、文件系统读取或模型理解。

本子变更归档后，证据随归档可恢复。文档治理验收后，`build-agent-observability` 可以引用归档路径或复制绑定摘要的快照，再重新决定信号归属，并验证 Windows/POSIX 解析、并发写入器、崩溃恢复、保留、隐私、开销、环境/工作树/服务/运行身份、存储的封闭失败隔离和清理。本阶段不选择离线存储或保留机制。

### 11. 第一方文档默认使用简体中文并由门禁保护

最终保留的第一方维护文档，其 Markdown 正文、标题、表格说明及 frontmatter 中面向人的字符串必须使用简体中文。稳定机器值不应为了中文化而改变：责任方与权威 ID、命令、路径、代码符号、路由、API/MCP/协议字段、第三方 Skill 原文、测试 fixture、数据载荷以及 OpenSpec 解析器所需 `## ADDED Requirements`、`### Requirement:`、`#### Scenario:`、`WHEN`/`THEN`/`AND`/`BUT` 等结构词均是明确例外。

语言检查属于确定性 `docs:check` 门禁。实现必须基于受治理范围与 Markdown/frontmatter 结构识别人类正文，而不是对整个文件做粗糙的 `ASCII` 禁止；代码块、行内代码、链接目标和明确机器字段不参与正文判定。可疑英文句子必须产生带路径、位置、证据、修复建议与责任方的阻断诊断。例外必须按语法类别或精确技术 token 建模，不允许用宽泛逐文件白名单掩盖整篇英文文档。正反 fixture 必须证明中文正文通过、英文解释正文失败、合法技术标识不误报。该门禁接入本地与 CI 同一个 `full` 检查，任务 `12.6` 在实现和证明前保持未完成。

**理由：** 语言本身是文档可维护性和用户可读性契约，不能依赖一次性人工翻译；结构感知例外又能避免破坏代码、协议与第三方内容。

## 数据流

```text
已跟踪文件 + 当前 source/tests/schemas + 活动 OpenSpec changes + Git history
  -> 受治理路径枚举
  -> metadata/profile 解析
  -> topology/link/reachability 图
  -> 确定性 docs:check error 与 review warning
  -> 对选定语义 scope 显式调用 $docs-audit
  -> current-owner 重写或 extract/delete 决策
  -> 应用修正后的独立语义审查
  -> owner test/runtime 验证
  -> 原地重新生成 inventory
  -> 零违规本地 docs:check
  -> clean-checkout 文档 CI
  -> 用户审查与阶段验收
```

## 错误处理

- 无效 metadata、topology、link 或 OpenSpec 结构通过确定性诊断阻断迁移验收。
- 仓库规则违规退出 `1`；引擎或配置失败退出 `2`；两者都不能隐藏成警告。
- 不安全 fast-scope 计算升级到 full mode，不跳过不确定检查。
- 冲突证据只阻断受影响语义重写并升级处理；不能选择最新正文文件来解决。
- 缺少必要 runtime evidence 时，受影响声明不能成为当前事实。
- 混合内容迁移失败时保留原文件，直到该批次所有当前责任方替代项均验证通过。
- `agent-rules` 切换失败时整批恢复原路径，不接受半迁移双权威。
- 任一基线项缺少 disposition、consumer 仍读取路径或已提取 contract 缺少 verification 时，archive 删除失败。
- 生产源码 import prototype 资产或当前 Training 覆盖回退时，prototype 删除失败。
- 生成器检查模式绝不能自动修复漂移，只报告独立写入命令。
- 缺少分支保护权限时，必需检查任务保持未完成并报告外部操作。
- 显式授权审计修复若没有独立审查，结果保持 `review-required`，不能通过。
- 第一方文档英文解释正文或 frontmatter 人类字符串回归时，语言门禁阻断；合法技术例外不能被自动改写。

## 验证

- 使用仓库固定 OpenSpec 版本，以 strict、non-interactive mode 校验 proposal、design、specs 和 tasks。
- 单元测试元数据解析、schema 配置、路径规范化、范围解析、策略校验、GFM 链接与锚点、图可达性、`contract` 与 `review` 匹配、诊断格式与退出码、从 `fast` 升级到 `full`、仓库快照保持和生成器检查模式。
- 为每个关键文档规则运行有效与无效 fixture。
- 每个迁移批次后运行聚焦源码契约测试，切换前运行完整仓库套件。
- 在没有 Skill 时对 `$docs-audit` 运行基线测试，实现最小 Skill，校验其包，重跑相同场景，并用全新 Agent 前向测试代表性当前、目标与历史冲突和独立审查边界。
- 为代表性架构、Generation、Training、共享资源、部署、API、设计与测试任务运行显式语义审计导航：`AGENTS.md -> docs/README.md -> owner README -> detail/runbook/test`。
- 证明 `npm run docs:check` 的 `full` 与 `fast` 行为确定、无网络、在已有脏本地检出中非写入，并与干净 CI 的 `full` 模式等价。
- 证明 `rg` 与已跟踪文件检查不含实时 `agent-rules`、归档、历史、原型、遗留 `Superpowers` 规划或非 OpenSpec 计划权威。
- 用加载器、Generation 工作流、构建和适用部署检查验证运行时模板迁移。
- 用中文正文有效 fixture、英文解释无效 fixture 与技术例外 fixture 验证语言门禁，并证明 `full` CI 会阻止回归。
- `Apply` 前要求用户明确授权，验证后要求用户明确验收。

## Risks / Trade-offs

- **语义迁移范围大** → 使用小领域批次、显式证据和责任方专用验证；不得通过保留过时兼容目录来缩小范围。
- **Metadata 变得官僚** → 实例字段仅限 routing、authority、evidence、trigger 和 verification；通过派生 inventory 避免重复。
- **变更源码关系产生误报** → 确定性 `contract` 映射保持狭窄；启发式归属信号用非阻断 `review` 警告表示，并要求验收时显式处置。
- **Skill 变成隐藏策略** → 要求显式 `$docs-audit` 调用，规则不进入 `AGENTS.md`，并 forward-test 发现与 scope 行为。
- **删除历史文件降低浏览便利** → Git 与 OpenSpec 保留恢复能力，当前 Agent 则避免默认加载过时上下文。
- **API/testing 路径未来可能适合其他分类** → 目前保留为已验证当前 owner，只在 Harness 产生证据后重新评估。
- **CI 分支设置可能需要外部权限** → 将配置证明视为显式验收门禁。
- **移动运行时模板扩大验证范围** → 用独立批次隔离，并遵循正常运行时安全规则。
- **语言检测可能误报技术英文** → 使用 Markdown/frontmatter 结构感知与精确例外 fixture，不使用粗糙的 `ASCII` 禁止或宽泛文件豁免。

## Migration Plan

1. 完成父变更的仓库固定 OpenSpec 集成、原生生命周期指南和串行阶段顺序契约。
2. 严格校验子工件，并将用户阶段范围 `apply` 授权记录为简洁证据。
3. 冻结只读 `git ls-files` 基线并运行当前测试，采集已知失败但不把它们视为目标权威。
4. 增加 `_meta` schema、类型化关系策略、有限范围矩阵、模板、确定性 `full` 与 `fast` 检查组件和反例 fixture。
5. 在用于迁移决策前，运行基线测试、创建、校验并前向测试显式 `$docs-audit` Skill。
6. 建立根目录与目录路由，再以证据审查批次重建当前架构、产品、设计、API、测试和运行手册知识。
7. 执行原子 `AGENTS.md` 与运行手册切换并删除 `agent-rules/**`，不增加审计触发器。
8. 删除遗留非 OpenSpec plan/spec 表面，把非 plan 数据迁出 `docs/plans/**`。
9. 从全部 archive 项提取当前价值，更新依赖 test/consumer，并删除 `docs/archive/**`。
10. 删除原型专用使用方和全部 `docs/prototypes/**` 文件，同时保留共享 Training 模式切换。
11. 用隔离且已验证批次将运行时与配置资产移出文档归属。
12. 中文化最终保留的第一方文档并实现结构感知语言门禁；随后重建原地清单，清除每个确定性错误，为每个警告和语义问题项给出处置，并运行完整验证套件。
13. 增加并证明必需的 `full` 模式文档 CI，提交证据供用户验收，把 PoC 保留为未来可观测性证据，并仅在验收后归档子变更。

回滚以提交和批次为边界。每个迁移批次在替代项与使用方通过前保留源。只回滚失败批次，保留无关工作树修改，绝不使用宽泛破坏性重置命令。

## 文档影响

本变更会有意重写文档控制面和当前知识集。其 OpenSpec 工件在实施前保持已批准目标权威。当前文档只根据已验证实现证据更新。已删除材料仍可通过 Git 恢复；变更理由和验收记录保留在归档后的 OpenSpec 子变更中。

## 待解决问题

本修订版不再有未解决的信息架构或交接设计决策。用户已于 2026-07-12 授权 `apply`，并在本修订版增加了第一方文档简体中文约束。`Apply` 期间，关于当前产品行为、部署策略、运行时归属、部分实现或语言例外边界的事实冲突，都必须走语义审计的用户决策路径，不能在实施中静默解决。
