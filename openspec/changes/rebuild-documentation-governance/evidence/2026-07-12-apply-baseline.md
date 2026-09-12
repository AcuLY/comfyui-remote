# 文档治理 `apply` 基线 — 2026-07-12

这是在文档变更前采集的非规范性实施证据。活动提案、规范、设计和 `tasks.md` 继续拥有权威。

## 已跟踪范围

使用 `git ls-files` 和非写入 `rg` 搜索枚举基线。

- 迁移表面共有 91 个已跟踪 Markdown 文件：
  - 5 个根 Markdown 文件
  - `agent-rules/**` 下 13 个文件
  - `docs/**` 下 40 个当前 Markdown 文件
  - `docs/archive/**` 下 33 个 Markdown 文件
- `docs/archive/**` 下共 42 个文件，其中 9 个不是 Markdown。
- `docs/prototypes/**` 下共 28 个文件，其中 27 个不是 Markdown。
- `docs/plans/**` 下共 7 个文件，其中 5 个不是 Markdown。
- `docs/superpowers/**` 下有 4 个 Markdown 文件。
- 搜索还包括 OpenSpec 工件与证据、项目 Skill、文档生成器、治理测试、源码相邻 Markdown 和入站引用。

`git status` 中原先已有的 5 个 untracked `scripts/*.ts` recovery/debug 文件与本变更无关，必须保持不变。

## 阻断删除的已知 consumer

- `tests/test-asset-page-boundaries.test.ts` 和 `tests/test-work-mode-resource-boundary.test.ts` 读取已归档的全仓路线图。
- `tests/test-documentation-governance.test.ts` 要求当前 archive 与 `agent-rules/**` 结构存在。
- `tests/test-legacy-static-design-demos.test.ts` 要求已归档演示资产存在。
- `tests/test-training-prototype-governance.test.ts` 要求原型路由与文件映射存在。
- `src/server/quality/phase0-baseline.ts`、`src/server/quality/phase1-offline-eval.ts` 和 `tests/test-quality-script-governance.test.ts` 使用 `docs/plans/auto-review-analysis/**` 作为 owner path。
- `src/server/services/comfyui-service.ts` 和 workflow test 在运行时加载 `docs/workflow.api.json`。
- `scripts/docs/generate-repo-inventory.ts` 以启发式方式分类遗留归档、原型、计划、`Superpowers` 和智能体规则路径。

## 验证基线

- `npm run docs:check`：`apply` 前不可用（`Missing script: docs:check`）。
- 仓库固定 `npm run openspec:validate`：通过，2 个变更通过、0 个失败。
- 聚焦遗留治理套件：79 个测试，78 个通过、1 个失败。既有失败为 `README current route and MCP facts match source`，原因是 `/` 已不在该测试的源码路由枚举中。
- 完整 `npm test`：1303 个 test，1298 个通过、5 个失败。既有失败为：
  - 设计演示展示页的 CSS 归属；
  - 两个 Python 自动审查 CLI 进程断言；
  - 同一个 README 路由与 MCP 断言；
  - 一个 Training API test 读取缺失的遗留 `docs/plans/2026-06-07-manager-lora-training-backend-api-schema-design.md` 文件。

这些失败是基线证据，不是新文档门禁的豁免。文档责任方范围内的过时断言会在切换期间替换；无关应用失败仍在本变更范围外，不得隐藏。

## `Apply` 批次边界

唯一 OpenSpec `tasks.md` 按窄批次执行：

1. OpenSpec 基础与只读基线。
2. 元数据 schema、策略、模板与确定性检查器。
3. 显式 `$docs-audit` Skill 与校验。
4. 根目录和当前产品、架构、设计、API 与测试责任方。
5. 运行手册与原子 `AGENTS.md` 权威切换。
6. 计划、归档与原型的核对和删除。
7. 运行时与配置资产迁移以及运行时验证。
8. 清单、零违规门禁、文档 CI 与最终审计。

每个批次都使用按路径限定的 `git diff`、对应聚焦检查和 `git diff --check` 审查。未提交批次失败时，通过显式按路径编辑修复；提交后回滚使用正常的还原提交。宽泛的重置或检出操作不属于本工作流。
