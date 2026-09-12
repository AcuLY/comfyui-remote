# 任务 6 当前知识独立审计记录

审计日期：2026-07-12

## 调用

- 调用方：已批准的 OpenSpec 任务 `6.9`；由主任务调度独立审计者 `/root/audit_current_plans` 执行。
- 范围：显式 `paths`，未使用 merge base，也未升级为 `full` 语义范围。
- 操作：`record`。
- 对照基线：分支 `codex/harness-doc-governance-handoff-20260710`，`HEAD` 为 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`；语义判断使用当前工作树源码、schema、测试和活动 OpenSpec 工件。
- 精确调用：

```text
$docs-audit paths README.md ARCHITECTURE.md PRODUCT.md DESIGN.md docs/architecture docs/product docs/design docs/api docs/testing docs/agent-api.md docs/analysis docs/analysis_comprehensive.md docs/WORKFLOW_QUICK_REFERENCE.md docs/WORKFLOW_SYSTEM_ANALYSIS.md docs/design-demos-frontend-parity.md docs/design-v0.1.md docs/design-v0.3-workflow-integration.md docs/frontend-design-guide.md docs/prisma-provider-matrix.md docs/quick-reference.md docs/script-maintenance.md docs/ui docs/worker-boundaries.md record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-current-knowledge.md
```

## 写入边界

本次调用只允许写入：

`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-current-knowledge.md`

被审计文档、源码、schema、测试、运行时文件和其他 evidence 均为只读。输出路径是仓库相对路径，位于活动变更 `rebuild-documentation-governance` 的 `evidence/docs-audit/` 下，不含绝对路径、路径穿越或仓库外链接。

### 写入前完整工作树基线摘要

- 上游：`origin/codex/harness-doc-governance-handoff-20260710`，领先 `0`、落后 `0`。
- 暂存区：干净，暂存项 `0`。
- 工作树：共 `161` 个状态项；已跟踪修改 `83`、已跟踪删除 `14`、未跟踪 `64`。
- `git status --short --untracked-files=all` 规范化输出的 SHA-256：`ee863e105e68e282173614d0d56222c5a45a9651d2d638abf84eee19bdce7920`。
- 顶层状态项计数：`.codex` 3、`agent-rules` 13、`AGENTS.md` 1、`ARCHITECTURE.md` 1、`CLAUDE.md` 1、`config` 1、`DESIGN.md` 1、`docs` 56、`openspec` 23、`position_presets.md` 1、`PRODUCT.md` 1、`README.md` 1、`reports` 1、`scripts` 14、`src` 3、`tests` 40。
- 未跟踪脚本中，`scripts/docs/check/language.ts` 属于当前治理批次；以下五个个人脚本明确在允许写入集合外并保持不变：
  - `scripts/agent-run-sunshangxiang-full-20260703.ts`
  - `scripts/force-resume-all-paused-runs-after-reboot-20260625.ts`
  - `scripts/repair-paused-runs-after-force-resume-20260625.ts`
  - `scripts/test-import-resume-run.ts`
  - `scripts/test-prisma-count-paused.ts`

## 确定性检查

| 命令 | 退出分类 | 结果摘要 | 工具故障 |
| --- | --- | --- | --- |
| `npm run docs:check` | `exit 1`，仓库规则违规 | `errors=9702`、`warnings=3`。主要来源是新增责任方路径尚未进入索引、待删除遗留路径与使用方、第一方英文正文和语言规则误报。该结果是预期的原子迁移前状态，不能记为通过。 | 无；明确不是 `exit 2`。 |
| `node --import tsx --test` 聚焦 owner、API、架构、产品、设计、质量、队列、自动打码和预制替换测试集 | `exit 0` | `216/216` 通过。 | 无。 |
| `node --import tsx --test tests/test-config-runtime-governance.test.ts tests/test-latent-cleanup-source.test.ts tests/test-workflow-debug-download.test.ts tests/test-workflow-prompt-builder.test.ts tests/test-run-submission-deferral.test.ts` | `exit 0` | `15/15` 通过；证明当前工作树源码从 `config/workflows/standard-workflow.api.json` 读取模板并保持相关工作流行为。 | 无。 |
| `npx openspec validate rebuild-documentation-governance --strict` | `exit 0` | 活动变更严格校验通过，任务 `6.9` 的显式调用与输出位置有效。 | 无。 |

由于完整确定性门禁仍为 `exit 1`，本记录不声称任务 6 范围已经通过最终验收；语义证据仍足以给出逐项迁移 disposition。

## 已审查证据

### 当前实现

- 产品与模式归属：`src/lib/work-mode.ts`、`src/lib/work-mode-resources.ts`、`src/features/training/routes.ts`、`tests/test-work-mode-resource-boundary.test.ts`。
- 请求、认证和自动化接口：`src/proxy.ts`、`src/lib/api-response.ts`、`src/server/http/request-json.ts`、`src/app/api/**/route.ts`、`src/server/mcp/server.ts`、`tests/test-api-request-json.test.ts`。
- Generation、队列和工作流：`src/server/services/run-executor.ts`、`src/server/services/comfyui-service.ts`、`src/server/services/workflow-prompt-builder.ts`、`src/server/worker/**`、`config/workflows/standard-workflow.api.json` 及对应聚焦测试。
- Training：`src/features/training/**`、`src/server/worker/training/**`、`scripts/training/**`、两份 Prisma schema 与对应聚焦测试。
- 设计和界面：实际路由、外壳、CSS 模块、组件注册表与 `tests/test-product-design-doc-governance.test.ts`、`tests/test-ui-component-boundaries.test.ts`、`tests/test-design-demo-governance.test.ts`。
- 数据与质量：两份 Prisma schema、生成的 `docs/prisma-schema-compatibility.md`、`src/server/quality/**`、`scripts/quality/**`、`tests/fixtures/quality/**`、`reports/quality/**` 及聚焦测试。

### 已批准目标

- `openspec/changes/rebuild-documentation-governance/design.md` 的迁移地图要求把 analysis、worker、Prisma、UI、frontend、parity、API、testing 与 script-maintenance 材料迁到明确 owner，再删除重复源。
- `openspec/changes/rebuild-documentation-governance/tasks.md` 的任务 `6.1` 至 `6.9` 负责当前知识重建与独立审计；任务 `11.1` 仍负责配置模板的完整运行时切换和部署验证。
- 当前 owner 文档不得把未部署的运行实例状态当作已验证事实。这里对工作流路径的接受仅覆盖当前工作树源码；生产进程切换仍由任务 `11.1` 验证。

### 历史来源

本次范围中的 `docs/agent-api.md`、`docs/analysis/**`、旧 workflow 分析、旧版本设计、旧 UI 地图和 `docs/worker-boundaries.md` 都是迁移输入，不是其自身正确性的证明。它们只有在当前源码或测试重新验证后，才可提供待提取事实。

### 运行时来源

本次没有修改、重启或探测运行中的服务。审计范围内可静态确定的声明均由源码/schema/测试关闭；配置模板在运行中实例上的切换仍保留给任务 `11.1`，不在本记录中伪造运行时证明。

## 新 owner 覆盖结论

| 当前 owner 表面 | 已确认吸收的当前知识 | 证据与结论 |
| --- | --- | --- |
| `README.md` | 稳定仓库入口、两个平级模式、入口路由、源码与本地数据边界 | `tests/test-documentation-governance.test.ts` 通过；保留。 |
| `ARCHITECTURE.md` 与 `docs/architecture/**` | 系统上下文、真实依赖图、运行时拓扑、数据模型、Agent 接口、Generation/Training/shared-resource 边界、队列/worker 与失败恢复上限 | 架构及 worker 聚焦测试通过；保留。 |
| `PRODUCT.md` 与 `docs/product/**` | Generation、Training、共享模型/设置、路由归属与体位提示词目录 | 产品与模式边界测试通过；保留。 |
| `DESIGN.md` 与 `docs/design/**` | 生效外壳、组件所有权、交互、响应式/无障碍、审核工作台与 design-demo 边界 | 产品设计、组件、演示聚焦测试通过；保留。 |
| `docs/api/**` | 稳定 API 家族、公开/受保护认证边界、共享 JSON 封装、MCP 传输与配置模板归属 | API 聚焦测试通过。旧文档“ComfyUI 控制仅限本机回环”的说法与 `src/proxy.ts` 冲突，新责任方已纠正；保留。 |
| `docs/testing/**` | 测试 fixture/源码契约原则及 Phase 0/1 质量流水线、输入与生成产物归属 | 质量与文档治理测试通过；保留。 |
| `docs/prisma-schema-compatibility.md` 与 `docs/runbooks/deployment/database-sync.md` | 两 provider 的 schema 差异、生成检查、真实 provider 选择与部署同步安全序列 | 生成器 check 与 Prisma 聚焦测试通过；作为 `docs/prisma-provider-matrix.md` 的替代 owner。 |

## 删除前逐项 disposition

| 路径 | 证据类别 | 已吸收或仍由当前 owner 维护的事实 | 冲突或剩余价值 | 操作 | 解决状态 |
| --- | --- | --- | --- | --- | --- |
| `docs/agent-api.md` | `history` | 认证、稳定接口家族、响应封装、MCP 与 Agent 接口已进入 `docs/api/**` 和 `docs/architecture/system/agent-interfaces.md`；精确端点继续由路由源码负责。 | `localhost only` 与当前代理边界冲突，穷尽端点清单和“无缺口”声明不可持续。 | `delete` | `historical-only` |
| `docs/analysis/README.md` | `history` | 其图像生命周期导航已由 Generation 架构、数据模型和审核工作台取代。 | 只路由到同组待删除分析，没有独立当前知识。 | `delete` | `historical-only` |
| `docs/analysis/01-IMAGE-LIFECYCLE.md` | `history` | 当前提交、轮询、文件、审核和实体关系分别进入 Generation 架构、执行架构、数据模型与审核工作台。 | 复制 schema、路径和函数流程，部分状态描述已漂移。 | `delete` | `historical-only` |
| `docs/analysis/02-CODE-REFERENCE.md` | `history` | 依赖方向与执行所有权已进入依赖模型和队列/工作进程责任方。 | 易变文件/函数清单本应由源码和测试发现。 | `delete` | `historical-only` |
| `docs/analysis/03-DATABASE-SCHEMA.md` | `history` | 当前关系边界进入 `docs/architecture/system/data-model.md`，精确差异由生成的 Prisma 兼容表负责。 | 手写 schema 与查询清单重复且会漂移。 | `delete` | `historical-only` |
| `docs/analysis/QUICK-REFERENCE.md` | `history` | 状态、数据、审核与故障定位已有当前 owner。 | 压缩复制同组分析，未增加独立权威。 | `delete` | `historical-only` |
| `docs/analysis_comprehensive.md` | `history` | Generation 工作流、数据、受管文件与后处理边界已有当前 owner。 | “未实现”能力与实现建议混合，不能作为当前产品事实或新目标。 | `delete` | `historical-only` |
| `docs/WORKFLOW_QUICK_REFERENCE.md` | `history` | 工作流模板归属、提示词构建、提交和保留边界已进入 Generation 架构与 API owner。 | 仍引用 `docs/workflow.api.json`、旧文档入口和手写节点清单。 | `delete` | `historical-only` |
| `docs/WORKFLOW_SYSTEM_ANALYSIS.md` | `history` | 当前源码流程由 Generation 架构、数据模型、API 配置归属与源码测试覆盖。 | 复制旧模板路径、旧 schema 与易变函数实现。 | `delete` | `historical-only` |
| `docs/design-demos-frontend-parity.md` | `history` | 生效注册表、生产/演示/Training 边界与验证入口进入 `docs/design/design-demo-governance.md`。 | 大型路由对照和“完成”状态是易变进度记录；精确一致性由注册表与测试负责。 | `delete` | `historical-only` |
| `docs/design-v0.1.md` | `history` | 当前产品对象、数据边界、审核模式与 Agent 表面已拆入 product、architecture、design 和 API owner。 | 早期目标模型、API 初稿与实现状态混合。 | `delete` | `historical-only` |
| `docs/design-v0.3-workflow-integration.md` | `history` | 当前模板、参数填充与 Generation 流程已进入 Generation 架构和 API owner。 | 旧模板路径、固定节点号和早期 UI 目标会漂移。 | `delete` | `historical-only` |
| `docs/frontend-design-guide.md` | `history` | 生效主题、外壳、组件、动效、响应式和无障碍边界进入根设计与 `docs/design/**`。 | 手写 token/示例与浅色默认方向不能覆盖实际 CSS 和组件源码。 | `delete` | `historical-only` |
| `docs/prisma-provider-matrix.md` | `history` | provider 选择、schema/client 归属、兼容差异与部署同步已进入数据模型、生成兼容表和数据库同步运行手册。 | 含 POSIX 行内环境变量命令、旧 `agent-rules` 引用和手写矩阵。 | `delete` | `historical-only` |
| `docs/quick-reference.md` | `history` | 关键架构与工作流入口由 root/architecture/API owner 路由。 | 仍引用 `docs/index.md`、旧 workflow 路径和复制式函数签名。 | `delete` | `historical-only` |
| `docs/script-maintenance.md` | `current` 与 `history` 混合 | 质量部分已进入 `docs/testing/quality-analysis.md`；Prisma 生成/同步、Training 工作进程和 Hook 本地输出已有部分责任方。 | 破坏性维护脚本的输入、输出、预览/写入和退出契约尚未进入任务型运行手册；本矩阵自身也已错误声称两个文档 generator 没有 `--check`，并混入当前阶段不应采用的 Hook 实施说明。 | `extract-delete` | `open` |
| `docs/ui/README.md` | `history` | 当前设计入口页是 `docs/design/README.md`。 | 只索引待删除旧 UI 文档。 | `delete` | `historical-only` |
| `docs/ui/component-boundaries.md` | `history` | 稳定层级、生产基础组件与 demo/Training 共享边界进入 `docs/design/component-patterns.md`。 | 逐文件组件清单由源码/测试负责。 | `delete` | `historical-only` |
| `docs/ui/design-demo-governance.md` | `history` | 注册表、数据加载、Training 复用与生产边界进入新的 design-demo 责任方。 | 一致性清单要求和生成命令混入旧治理表面。 | `delete` | `historical-only` |
| `docs/ui/legacy-static-design-demos.md` | `history` | 当前演示权威进入 `docs/design/design-demo-governance.md`，旧资产通过 Git 与后续 archive 审计恢复。 | 续存说明是未批准的待办事项，不是当前实现事实；不得保留为平行计划。 | `delete` | `historical-only` |
| `docs/ui/project-page-boundaries.md` | `history` | 稳定应用/客户端/功能分层进入依赖模型、组件模式和审核工作台；精确模块由源码与聚焦测试负责。 | 逐页面文件地图与后续拆分检查点混合当前实现和未来拆分。 | `delete` | `historical-only` |
| `docs/worker-boundaries.md` | `history` | Generation/Training 工作进程、取消、恢复、依赖与故障边界进入架构执行、领域与依赖责任方。 | 仍引用旧工作流路径，并把实际会抛错的模板加载描述为可回退。 | `delete` | `historical-only` |

## 审计发现

### `T6-ROOT-OWNER-001`

- `path`：`README.md`
- `location`：`# ComfyUI Manager` 至 `## 源码边界`
- `claim`：根入口只维护稳定路由与高层边界，易变事实下沉到当前 owner。
- `claimCategory`：`current`
- `owner`：`repository-maintainers`
- `evidence`：`README.md:25`（当前）、`tests/test-documentation-governance.test.ts`（当前）、`openspec/changes/rebuild-documentation-governance/tasks.md:44`（目标）。
- `conflict`：`none`
- `confidence`：`high`；当前正文与聚焦测试一致。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：`node --import tsx --test tests/test-documentation-governance.test.ts`

### `T6-ARCHITECTURE-OWNER-002`

- `path`：`docs/architecture/**`
- `location`：全部带 `status: current` 的架构 owner 文档
- `claim`：当前系统、领域、数据、接口与执行边界已有源码支持的单一 owner 链。
- `claimCategory`：`current`
- `owner`：`system-architecture`
- `evidence`：`ARCHITECTURE.md` 与 `docs/architecture/**`（当前）、两份 Prisma schema（当前）、工作进程/工作模式聚焦测试（当前）、任务 `6.1` 至 `6.3`（目标）。
- `conflict`：`none`
- `confidence`：`high`；聚焦责任方测试通过，文档保留了已知部分实现与恢复上限。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：本记录所列 `216/216` 聚焦测试中的架构、工作模式、工作进程与 schema 子集。

### `T6-PRODUCT-DESIGN-OWNER-003`

- `path`：`PRODUCT.md`
- `location`：根产品契约及 `docs/product/**`、`DESIGN.md`、`docs/design/**`
- `claim`：产品模式、共享资源、运行界面、组件和交互边界已从旧产品/UI 材料中提取到当前 owner。
- `claimCategory`：`current`
- `owner`：`product`
- `evidence`：`PRODUCT.md`、`DESIGN.md`、`docs/product/**`、`docs/design/**`（当前），产品/设计/组件/演示聚焦测试（当前），任务 `6.2`、`6.4`、`6.5`（目标）。
- `conflict`：`none`
- `confidence`：`high`；当前责任方刻意不复制路由注册表、CSS token 或 prototype 状态。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：`node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-ui-component-boundaries.test.ts tests/test-design-demo-governance.test.ts tests/test-work-mode-resource-boundary.test.ts`

### `T6-API-TESTING-OWNER-004`

- `path`：`docs/api/**`
- `location`：API 与测试 owner 文档全部当前声明
- `claim`：稳定 API/认证/MCP/工作流契约与独立测试知识已有当前 owner，穷尽式清单由源码和测试替代。
- `claimCategory`：`current`
- `owner`：`api-contracts`
- `evidence`：`src/proxy.ts`、`src/lib/api-response.ts`、`src/server/http/request-json.ts`、`src/server/mcp/server.ts`（当前），`docs/api/**`、`docs/testing/**`（当前），API 与质量聚焦测试（当前）。
- `conflict`：旧 `docs/agent-api.md` 的本机回环限制与当前源码冲突；新责任方已明确纠正。
- `confidence`：`high`；当前路由边界与响应封装由聚焦测试证明。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：本记录所列 `216/216` 聚焦测试中的 API、文档治理和质量子集。

### `T6-LEGACY-SOURCES-005`

- `path`：`docs/analysis/**`
- `location`：本记录处置表中除 `docs/script-maintenance.md` 外的全部遗留输入
- `claim`：这些旧源的可验证当前事实已进入新 owner 或由源码/schema/测试直接维护，剩余内容只具有历史、重复或过期价值。
- `claimCategory`：`history`
- `owner`：`documentation-governance`
- `evidence`：逐项处置表（当前与历史）、当前责任方文档与聚焦测试（当前）、迁移地图 `openspec/changes/rebuild-documentation-governance/design.md:243`（目标）。
- `conflict`：逐项表已保留旧认证、工作流路径、回退路径、schema、UI 注册表和未来计划冲突；没有静默采用旧声明。
- `confidence`：`high`；每个路径都有明确替代 owner 或源码/测试权威。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行 owner 聚焦测试、`npm run docs:check`，并搜索全部旧路径 consumer。

### `T6-SCRIPT-MAINTENANCE-GAP-006`

- `path`：`docs/script-maintenance.md`
- `location`：`## Script Contracts` 与 `## Maintenance Rules`
- `claim`：删除脚本矩阵前，破坏性脚本的输入、输出、预览/写入和退出边界已经进入任务型 runbook。
- `claimCategory`：`unresolved`
- `owner`：`operations`
- `evidence`：`docs/script-maintenance.md:7`（当前/历史混合）、`tests/test-script-maintenance-doc.test.ts`（当前使用方）、`openspec/changes/rebuild-documentation-governance/design.md:253`（目标）、`docs/runbooks/README.md`（当前，尚无维护脚本路由）。
- `conflict`：已批准目标要求合并到 runbook，但当前 runbook 树没有该 owner；旧矩阵对 generator `--check` 的描述又已过期，不能原样保留或复制。
- `confidence`：`high`；路径和测试扫描直接证明缺口。
- `action`：`extract-delete`
- `resolution`：`open`
- `verification`：建立中文任务型维护脚本责任方，按当前 CLI/source 重新验证高风险脚本契约，改写遗留使用方，删除旧矩阵后重跑同范围 `$docs-audit` 与 `npm run docs:check`。

### `T6-DETERMINISTIC-GATE-007`

- `path`：`README.md`
- `location`：本次显式 scope 的完整确定性门禁
- `claim`：任务 6 当前知识范围已经达到零确定性错误。
- `claimCategory`：`unresolved`
- `owner`：`documentation-governance`
- `evidence`：`npm run docs:check` 返回 `exit 1`、`errors=9702`、`warnings=3`（当前），任务 `12.4`（目标）。
- `conflict`：当前原子迁移尚未暂存，遗留路径与使用方尚未删除，语言违规尚未清零。
- `confidence`：`high`；命令结果确定。
- `action`：`rewrite`
- `resolution`：`open`
- `verification`：完成原子暂存与删除后，`npm run docs:check` 必须返回 `exit 0`，并由后续同范围审计复核。

## 写入

本次调用只创建：

`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-current-knowledge.md`

没有修改或删除任何被审计文档；没有暂存、提交、推送、构建、部署或运行时操作。

## 验证

- owner check：聚焦测试 `216/216` 通过；工作流配置迁移测试 `15/15` 通过；OpenSpec 严格校验通过。
- same-scope 结论：`record` 不改变审计范围；当前 owner 的语义接受结论不变。
- 路径约束：写入集合只有本文件。写入后应以 `git status --short --untracked-files=all` 确认相对基线只新增本路径，再进入第二个独立 `record` 调用。
- 最终状态：`partial`。21 个遗留路径获得删除前处置；`docs/script-maintenance.md` 必须先完成提取，完整确定性门禁也仍未通过。

## 独立审查

- 审查者：`/root/audit_current_plans`。
- 独立性：审查者不是本批根入口、产品、架构、设计、API、测试责任方文档的作者，仅执行只读证据核对和受路径约束的 `record`。
- 状态：当前责任方语义通过独立审查；除脚本维护矩阵外的遗留删除处置已接受。由于 `T6-SCRIPT-MAINTENANCE-GAP-006` 和 `T6-DETERMINISTIC-GATE-007` 仍为 `open`，本范围不签署最终语义通过。
- 后续任何提取或修正都必须由另一名独立审查者或人工审查者重跑相同受影响 scope；本记录不预先签署尚未实施的修正。

## 待决策项

当前没有需要改变产品方向或重新分配权威的用户决策。尚需实施的事项是已批准目标内的迁移工作：为维护脚本建立任务型 runbook owner，而不是直接删除唯一安全契约。若实施者希望跳过该提取并直接删除，则必须升级为 `user-decision-required`。
