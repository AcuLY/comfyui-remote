# 任务 9：历史交接与测试计划独立审计记录

## 调用

- 显式调用方：已批准的 `rebuild-documentation-governance` 任务 `9.2`，由主任务委托独立审计者 `/root/audit_archive_prototypes` 执行。
- 范围：`$docs-audit paths docs/archive/historical`。
- 操作：`record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-historical.md`。
- 比较基线：分支 `codex/harness-doc-governance-handoff-20260710`，提交 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`。
- 冻结输入：4 个已跟踪文件；`git ls-files -s -- docs/archive/historical` 清单摘要为 `2032e80471c10add2d8c3a57b95ad53d0ee5806c85d0bc1b60910a9d2267ac23`。
- 范围由任务明确给出，不需要升级到 `full` 语义审计；确定性门禁仍按完整模式执行。

## 写入边界

- 唯一允许写入：本文件。
- 写入前于 `2026-07-12T19:28:25.7228268+08:00` 采集完整 `git status --porcelain=v2 --untracked-files=all`：83 个已修改、14 个已删除、65 个未跟踪条目，共 162 条；规范化状态摘要为 `cdc72f7d6ce9147f0b6ece0c9c0d614c86f2aeb8a84c99cf0463e50a7e5f70b9`。
- 5 个既有未跟踪个人脚本均在基线中，未获写入授权。
- 仓库根以及 `openspec/changes/rebuild-documentation-governance/evidence` 的既有祖先均为普通目录，不是链接或联接点；输出路径位于获批变更的 `evidence/docs-audit/` 下。

## 确定性检查

- 命令：`npm run docs:check`。
- 退出分类：`exit 1`，规则违规；不是检查器或配置故障。
- 摘要：9702 个错误、3 个警告。当前迁移中仍有未暂存的现行 owner 文档、遗留英文正文、指向 `docs/archive/**` 的文档与测试，以及待重生成 inventory。该结果允许继续语义分析，但禁止把本范围报告为通过，也禁止据此立即删除源。
- 工具故障：`none`。

## 已审查证据

### 当前实现

- `README.md`、`ARCHITECTURE.md`、`docs/architecture/**`：当前产品入口、领域边界、数据与运行时事实。
- `docs/api/README.md`、`src/app/api/**`、`src/proxy.ts`、`src/lib/api-response.ts`：当前 API、认证、响应封装与 MCP 边界。
- `docs/testing/README.md`、`tests/README.md`、现行 `tests/**/*.test.ts`：当前测试约定与可执行行为事实。
- 聚焦验证：`node --import tsx --test tests/test-documentation-governance.test.ts tests/test-worker-boundary-governance.test.ts tests/test-api-request-json.test.ts`，77/77 通过。

### 已批准目标

- `openspec/changes/rebuild-documentation-governance/tasks.md` 的 `9.2`、`9.3`、`9.6`、`9.7`。
- `openspec/changes/rebuild-documentation-governance/specs/documentation-governance/spec.md` 中删除 archive 且不建立 `docs/history/**` 的要求。

### 历史意图

- 本范围 4 个冻结文件及 `openspec/changes/rebuild-documentation-governance/evidence/2026-07-12-legacy-input-baseline.md`。
- 未使用历史正文自身证明当前行为；页面数、路由数、工具数、资源数、完成百分比和“下一步”均只按历史记录处理。

### 运行时证据

- 无。源码、schema 与聚焦测试足以区分当前行为和历史声明；本次未读取秘密、数据库或运行中服务。

## 审计发现

### `HIST-001`

- `id`：`HIST-001`
- `path`：`docs/archive/historical/development-progress.md`
- `location`：`Current State (2026-03-27)`、页面/API 清单、`Version History` 与 `Repo Rules`
- `claim`：带日期的完成状态、易变数量、唯一开发分支和旧文档路由可以继续代表当前仓库。
- `claimCategory`：`history`
- `owner`：`documentation-governance`
- `evidence`：
  - `history`：`docs/archive/historical/development-progress.md` 明示自身为历史记录，但正文仍保留易变清单与旧入口。
  - `current`：`README.md`、`ARCHITECTURE.md`、`docs/api/README.md` 与当前源码取代这些易变声明。
  - `current`：上述 77 项聚焦测试全部通过，证明现行入口、API 与执行边界有独立可执行 owner。
- `conflict`：历史正文引用已被替代的 `docs/index.md`、`agent-rules/**` 等入口，并把 2026-03-27 快照写成“当前状态”。
- `confidence`：`high`；日期、旧路径与当前 owner 均可静态核对。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除批次后运行 `git grep -n -I -e 'docs/archive/historical/' -- ':!openspec/**'`、`npm run docs:check` 与上述 77 项聚焦测试。

### `HIST-002`

- `id`：`HIST-002`
- `path`：`docs/archive/historical/development-todo.md`
- `location`：全部 `Completed` 段落与 `Working Notes`
- `claim`：旧版本完成清单和旧组织说明是当前功能覆盖或当前架构的权威来源。
- `claimCategory`：`history`
- `owner`：`documentation-governance`
- `evidence`：
  - `history`：文件按版本记录旧模型、旧路由与旧完成项。
  - `current`：`docs/architecture/**`、`docs/product/**`、`docs/testing/**` 分别拥有当前架构、产品和测试知识。
  - `current`：当前测试文件而不是勾选清单证明行为。
- `conflict`：勾选完成不能证明当前实现仍存在，也不能证明旧命名、数量或回退行为仍成立。
- `confidence`：`high`；文件用途和替代 owner 明确。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后确认当前 owner 的聚焦测试保持通过，并确认没有现行文档把旧勾选项当作验收证据。

### `HIST-003`

- `id`：`HIST-003`
- `path`：`docs/archive/historical/handoff.md`
- `location`：`当前代码组织`、`当前完成度`、`已知限制`、`推荐接手顺序` 与 `本地运行`
- `claim`：旧交接文档中的路径、计数、无鉴权结论、启动命令和接手顺序仍可用于当前操作。
- `claimCategory`：`history`
- `owner`：`documentation-governance`
- `evidence`：
  - `history`：该文件保留旧服务分层、旧 API/MCP 数量、旧限制和 POSIX 启动步骤。
  - `current`：`README.md`、`docs/api/README.md`、`docs/runbooks/**` 与 `AGENTS.md` 分别拥有当前安装、接口和操作流程。
  - `current`：`src/proxy.ts` 与 `tests/test-documentation-governance.test.ts` 证明当前受保护界面和 API 需要认证。
- `conflict`：历史交接文档的“MCP 无鉴权”、旧文档入口与旧启动路径会误导当前操作。
- `confidence`：`high`；当前认证与操作 owner 有源码和测试支持。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行 API/认证聚焦测试，并确认现行入口不再链接该交接文档。

### `HIST-004`

- `id`：`HIST-004`
- `path`：`docs/archive/historical/integration-test-plan.md`
- `location`：测试策略、模块 1 至模块 10、测试数据库示例与优先级表
- `claim`：未执行的 `Vitest`/PostgreSQL 计划、待确认项和旧数量可以代表当前测试覆盖。
- `claimCategory`：`history`
- `owner`：`test-infrastructure`
- `evidence`：
  - `history`：正文多处使用“待确认”、计划用例和旧工具/数据库假设。
  - `current`：`docs/testing/README.md` 与 `tests/README.md` 明确当前测试 owner、fixture 和最小验证原则。
  - `current`：当前仓库使用可执行 `node:test`/`tsx` 测试证明行为；本次 77 项聚焦测试通过。
- `conflict`：测试计划不是执行结果，其中的未确认行为不能提升为当前契约。
- `confidence`：`high`；计划语气与当前测试入口均明确。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行 `docs/testing/**` owner 检查与相关聚焦测试，不迁移未执行用例清单。

### `HIST-005`

- `id`：`HIST-005`
- `path`：`docs/archive/historical/development-progress.md`
- `location`：组级删除门禁
- `claim`：冻结 4 个文件现在可以在不处理 live consumer 的情况下直接删除。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：
  - `current`：`git grep` 仍发现 `docs/design-v0.1.md`、`docs/documentation-map.md`、`docs/index.md`、`docs/repo-inventory.md` 与 inventory 生成器引用本组。
  - `target`：任务 `9.6` 与 `9.7` 要求先移除当前引用并证明搜索归零。
- `conflict`：当前仍有 live consumer，完整 `docs:check` 为 `exit 1`。
- `confidence`：`high`；引用可确定性复现。
- `action`：`delete`
- `resolution`：`open`
- `verification`：先改写或删除这些 consumer、重生成 inventory，再要求 `git grep` 对非 OpenSpec 当前表面返回零且 `npm run docs:check` 为 `exit 0`。

## 写入

- `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-historical.md`
- 被审计源修改：`none`

## 验证

- owner 检查：77/77 通过。
- 完整门禁复跑：`npx tsx scripts/docs/check.ts --format json` 为 `exit 1`，9714 个错误、3 个警告；本文件新增诊断为 0。错误总数包含并行迁移中的其他未完成表面，不把它解释为本记录通过。
- 同范围重新审计：4 个冻结文件均已映射到明确 disposition；没有发现必须从这些文件继续提取的唯一当前事实。
- 删除就绪状态：未就绪；`HIST-005` 与完整文档门禁仍开放。

## 独立审查

- 审查者：`/root/audit_archive_prototypes`，不是这些现行 owner 文档的作者。
- 状态：独立 extraction/deletion disposition 审查完成。
- 最终结论：4 个源文件均只具历史价值，语义上可删除且不应迁移旧数量、旧完成度或未执行测试计划；在 live consumer 清零和完整门禁通过前，不得执行删除，也不得报告本范围通过。

## 待决策项

- `none`。当前阻塞是确定性的迁移工作，不需要产品方向选择。
