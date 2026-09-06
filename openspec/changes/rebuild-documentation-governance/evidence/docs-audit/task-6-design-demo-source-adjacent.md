# 任务 6：Design-demo 源码旁文档独立审计记录

## 调用

- 显式调用方：已批准的 OpenSpec 任务 `6.4`、`6.8` 与 `6.9`。
- 范围：`$docs-audit paths src/app/design-demos/COMPONENT_INVENTORY.md src/app/design-demos/COMPONENT_TAXONOMY.md src/app/design-demos/DEMO_CODE_CLEANUP_PLAN.md src/app/design-demos/DESIGN_TODO.md src/app/design-demos/FRONTEND_RULES.md src/app/design-demos/IMAGE_SURFACES.md src/app/design-demos/README.md src/app/design-demos/SCROLL_RESTORE_PATTERNS.md`。
- 操作：`record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-design-demo-source-adjacent.md`。
- 比较基线：分支 `codex/harness-doc-governance-handoff-20260710`，`HEAD` 为 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`；本次使用显式路径范围，没有扩展写入范围。

## 写入边界

- 唯一允许写入：本文件。
- 写入前暂存区为零；工作树共有 178 个状态项，其中 101 个已跟踪修改或删除、77 个未跟踪项。
- `git status --porcelain=v2 -z --untracked-files=all` 的规范化 SHA-256 为 `da71f74244f8ea8979aa3ae26b922daf7fd7a88faacb40116cd8703c178e294d`。
- 五个既有个人脚本位于范围外，未修改、未删除、未暂存。

## 确定性检查

- 命令：`npm run docs:check -- --format json`。
- 外层进程退出 `1`；检查器 JSON 的 `exitCode` 为 `2`，规则为 `tool/configuration`。
- 原因：清单生成器按新合同解析当前文档元数据时，首先遇到待删除的旧 `docs/runbooks/config-runtime-assets.md`，该文件仍使用旧格式且没有 YAML frontmatter。
- 这是原子迁移删除前的工具阻塞，不是本范围八个文件需要补元数据的理由。按 Skill 合同，本记录不宣称完整确定性范围已经通过；删除旧版内容、暂存新路径并重生成清单后必须重跑。

## 已审查证据

### 当前实现

- 路由、工作模式导航与页面身份：`src/app/design-demos/routing/routes.ts`、`header-specs.ts` 与对应路由测试。
- 展示系列、组件条目、真实预览、源码路径、使用方和状态：`src/app/design-demos/showcase/registry.ts`、`preview-keys.ts`、`component-previews.tsx` 与注册表测试。
- 当前共享组件：`src/components/design-demo-ui/**` 与 `src/components/design-demo-shell/**`。
- 当前样式与交互 owner：`docs/design/design-demo-governance.md`、`component-patterns.md`、`interaction-and-motion.md`、`responsive-and-accessibility.md`。
- 独立审查者运行的产品/设计治理、路由、组件与图像无障碍聚焦测试共 53 项，全部通过。

### 已批准目标

- 任务 `6.4` 要求把当前前端材料拆入设计、架构、运行手册或测试 owner，通过后删除重复源。
- 任务 `6.8` 要求删除混合当前事实、历史意图、待办与重复清单的文件。
- 策略只允许显式注册的源码旁 Markdown；这八个文件最终不得保留为平行权威。

### 历史意图

- 清理阶段、迁移表、已完成状态、旧 CSS 类、旧路由表和设计待办只用于核对是否仍有当前价值。
- 未经当前源码或测试重新证明的旧建议没有被提升为新设计承诺。

### 运行时证据

无需启动服务。当前 import、注册表、CSS Module 与聚焦测试足以判断这些 Markdown 不参与运行时加载，也不拥有生产数据。

## 问题项

### `T6-DD-001`

- `path`：`src/app/design-demos/COMPONENT_INVENTORY.md`、`COMPONENT_TAXONOMY.md`、`IMAGE_SURFACES.md` 与 `README.md`。
- `location`：人工路径族、功能族、迁移状态、路由映射和图片显示面表格。
- `claim`：这些人工表格仍是当前组件、路由或使用方的权威清单。
- `claimCategory`：`history`。
- `owner`：`product-design`。
- `evidence`：`current`：`showcase/registry.ts`、`routing/routes.ts` 与对应测试；`current`：`docs/design/design-demo-governance.md` 明确禁止恢复人工组件与路由清单。
- `conflict`：清单仍引用不存在的 `src/app/design-demos/shared/**`、遗漏当前 Training 路由，并列出不存在的文件；源码注册表已拥有这些动态事实。
- `confidence`：`high`；路径、注册表和测试可直接核对。
- `action`：`delete`。
- `resolution`：`historical-only`。
- `verification`：删除后运行 design-demo 路由、注册表、图像无障碍与设计治理测试，并确认当前文档没有入站引用。

### `T6-DD-002`

- `path`：`src/app/design-demos/DEMO_CODE_CLEANUP_PLAN.md` 与 `DESIGN_TODO.md`。
- `location`：全部清理阶段、完成状态、旧设计章节和待办表。
- `claim`：旧实施阶段与待办仍是当前获批计划。
- `claimCategory`：`history`。
- `owner`：`product-design`。
- `evidence`：`current`：实际源码与中文设计 owner；`target`：OpenSpec 是唯一重大变更计划；`current`：响应式 owner 已诚实记录 42×42px 抽屉按钮缺口。
- `conflict`：正文包含已完成历史、旧文件结构、易漂移命令和未重新批准的未来建议。
- `confidence`：`high`；计划语气、旧路径与当前 owner 均明确。
- `action`：`delete`。
- `resolution`：`historical-only`。
- `verification`：删除后确认没有非 OpenSpec 当前计划入口；未来行为必须重新提案。

### `T6-DD-003`

- `path`：`src/app/design-demos/FRONTEND_RULES.md`。
- `location`：CSS Module、共享组件、Tailwind 与功能样式边界。
- `claim`：仍有效的 design-demo 样式和组件边界尚未进入中文当前 owner。
- `claimCategory`：`current`。
- `owner`：`product-design`。
- `evidence`：`current`：`docs/design/design-demo-governance.md` 已记录功能自有 CSS Module、共享演示组件、不得修改全局样式或引入 Tailwind、`tailwind-merge`、`class-variance-authority`；`current`：聚焦源码合同通过。
- `conflict`：`none`；有效内容已迁移，旧英文文件只会形成重复权威。
- `confidence`：`high`；中文 owner 与当前源码一致并有测试保护。
- `action`：`delete`。
- `resolution`：`duplicate-removed`。
- `verification`：运行 `tests/test-design-demo-governance.test.ts` 与 `tests/test-ui-component-boundaries.test.ts`。

### `T6-DD-004`

- `path`：`src/app/design-demos/SCROLL_RESTORE_PATTERNS.md`。
- `location`：列表返回位置机制、路由矩阵与代码模板。
- `claim`：列表到详情再返回的当前位置恢复语义只存在于该文件。
- `claimCategory`：`current`。
- `owner`：`product-design`。
- `evidence`：`current`：`docs/design/interaction-and-motion.md` 已记录路由专用 `sessionStorage`、一次性读取清除、`scroll={false}` 与不维护路由矩阵的边界；`current`：相关页面源码和设计治理测试通过。
- `conflict`：旧矩阵还把 batch-create 列为写入来源键的详情页，但当前源码没有该写入。
- `confidence`：`high`；源码和新 owner 可直接核对。
- `action`：`delete`。
- `resolution`：`duplicate-removed`。
- `verification`：运行产品设计治理测试并搜索八个旧文件名的当前使用方。

## 写入

- `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-design-demo-source-adjacent.md`
- 被审计源修改：`none`

## 验证

- 独立聚焦验证：53/53 通过。
- 八个文件的有效当前知识已进入中文 owner；其余内容均为历史、错误或重复表格。
- 完整确定性门禁仍被待删除旧版元数据阻塞；原子删除、暂存与重生成后必须重跑，当前不报告完整范围通过。

## 独立审查

- 审查者：`/root/review_current_extraction`，不是当前设计 owner 文档作者。
- 状态：八个文件的 extraction/deletion disposition 已独立通过。
- 最终结论：八个文件均可删除，不建立历史副本；删除后由当前源码注册表、中文设计责任方与聚焦测试承接。

## 待决策项

- `none`。剩余工作是确定性的原子删除、清单重生成与门禁复跑，不需要新的产品或设计方向选择。
