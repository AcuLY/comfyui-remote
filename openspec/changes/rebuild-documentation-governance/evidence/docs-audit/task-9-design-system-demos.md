# 任务 9：设计系统与静态演示独立审计记录

## 调用

- 显式调用方：已批准的 `rebuild-documentation-governance` 任务 `9.2`，由独立审计者 `/root/audit_archive_prototypes` 执行。
- 范围：`$docs-audit paths docs/archive/design-system docs/archive/design-demos`。
- 操作：`record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-design-system-demos.md`。
- 比较基线：分支 `codex/harness-doc-governance-handoff-20260710`，提交 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`。
- 冻结输入：`docs/archive/design-system` 3 个文件，清单摘要 `4eafe84840f3e18065e902a6f1ab90e94fcaf600ab9b23c7c277992edfe7387c`；`docs/archive/design-demos` 12 个文件，清单摘要 `610e8f2af0789c61cf490a762d465fcb8ebda584bab1e88a7272f8dae5375df0`。
- 范围由任务明确给出；确定性门禁按完整模式执行。

## 写入边界

- 唯一允许写入：本文件。
- 写入前完整工作树基线：83 个已修改、14 个已删除、65 个未跟踪条目，共 162 条；规范化状态摘要 `cdc72f7d6ce9147f0b6ece0c9c0d614c86f2aeb8a84c99cf0463e50a7e5f70b9`。
- 输出祖先均为仓库内普通目录；未修改被审计源、个人脚本、运行时文件或其他 evidence。

## 确定性检查

- 命令：`npm run docs:check`。
- 退出分类：`exit 1`，9702 个错误、3 个警告；不是工具或配置故障。
- 与本组直接相关的错误包括遗留英文正文、旧文档链接、`tests/test-legacy-static-design-demos.test.ts` 对 archive 文件存在性的依赖，以及 inventory 尚未按目标树重生成。
- 该结果允许继续语义分析，但禁止报告本范围通过或立即删除。

## 已审查证据

### 当前实现

- `DESIGN.md`、`docs/design/**`：当前设计方向、组件边界、布局、响应式、无障碍与 design-demo 治理。
- `src/app/globals.css`：实际全局 token 与主题。
- `src/app/design-demos/**`、`src/components/design-demo-shell/**`、`src/components/design-demo-ui/**`：可路由的当前演示实现。
- `src/features/training/**`：生产 `Training` 界面所有者及与演示组件的窄复用边界。
- 聚焦验证：`node --import tsx --test tests/test-design-demo-governance.test.ts tests/test-ui-component-boundaries.test.ts tests/test-product-design-doc-governance.test.ts tests/test-legacy-static-design-demos.test.ts`，26/26 通过。
- 静态运行时引用扫描：`src`、`config`、`public`、`next.config.ts`、`package.json` 与 `prisma` 对 `docs/archive/design-demos`、`docs/archive/design-system` 及静态文件名均无运行时引用；仅 inventory 生成器仍按遗留路径分类。

### 已批准目标

- 任务 `9.2`、`9.4`、`9.6`、`9.7`。
- `openspec/changes/rebuild-documentation-governance/design.md` 对当前设计 owner 和 archive 删除边界的约束。

### 历史意图

- 本范围 15 个冻结文件以及删除前基线。
- 历史色值、断点、像素、页面复现状态、迁移指令和“下一步”仅用于核对是否已经有当前 owner，不直接作为当前设计证明。

### 运行时证据

- 无需启动界面。源码导入图、路由注册表和聚焦测试足以证明静态 archive 不是生产依赖。

## 文件核对

| 冻结文件 | 处置 | 发现 |
| --- | --- | --- |
| `docs/archive/design-demos/README.md` | 删除；先切断 live consumer | `DD-001` |
| `docs/archive/design-demos/app.html` | 删除 | `DD-002` |
| `docs/archive/design-demos/components/components.css` | 删除 | `DD-002` |
| `docs/archive/design-demos/design-system.css` | 删除 | `DD-002` |
| `docs/archive/design-demos/full-demo.html` | 删除 | `DD-002` |
| `docs/archive/design-demos/index.html` | 删除 | `DD-002` |
| `docs/archive/design-demos/pages-checklist.md` | 删除，不迁移旧复现状态 | `DD-003` |
| `docs/archive/design-demos/router.js` | 删除 | `DD-002` |
| `docs/archive/design-demos/style-audit-report.md` | 删除，不迁移未验证像素建议 | `DD-003` |
| `docs/archive/design-demos/v2-projects-page.html` | 删除 | `DD-002` |
| `docs/archive/design-demos/v2-queue-page.html` | 删除 | `DD-002` |
| `docs/archive/design-demos/v2-review-page.html` | 删除 | `DD-002` |
| `docs/archive/design-system/DESIGN_SYSTEM_SUMMARY.md` | 删除 | `DS-001` |
| `docs/archive/design-system/design-system-migration.md` | 删除 | `DS-001` |
| `docs/archive/design-system/shadcn-design-guide.md` | 删除 | `DS-001` |

## 审计发现

### `DD-001`

- `id`：`DD-001`
- `path`：`docs/archive/design-demos/README.md`
- `location`：历史分类、已完成清单、下一步计划与组级删除门禁
- `claim`：静态演示目录仍是当前视觉方向或当前路由的权威来源，并且现在可以无条件删除。
- `claimCategory`：`history`
- `owner`：`product-design`
- `evidence`：
  - `history`：README 明示已被取代，但仍保留旧色彩、旧断点、旧页面批次和旧查看命令。
  - `current`：`docs/design/design-demo-governance.md` 把路由、页头、数据与展示注册表交给当前源码。
  - `current`：26/26 聚焦测试证明当前 owner 与演示/生产边界。
  - `current`：运行时扫描对 archive 路径为零引用。
- `conflict`：`tests/test-legacy-static-design-demos.test.ts`、`docs/ui/legacy-static-design-demos.md`、旧索引文档和 inventory 仍要求或链接 archive；完整门禁为 `exit 1`。
- `confidence`：`high`；当前 owner 与 live consumer 都能确定性定位。
- `action`：`delete`
- `resolution`：`open`
- `verification`：先改写或删除 archive 专用测试与旧索引，重生成 inventory；随后要求非 OpenSpec `git grep` 归零、26 项当前 owner 测试通过且 `npm run docs:check` 为 `exit 0`。

### `DD-002`

- `id`：`DD-002`
- `path`：`docs/archive/design-demos/design-system.css`
- `location`：静态 CSS、HTML 页面、`router.js` 与组件样式资产
- `claim`：这些静态资产参与当前 Next.js 路由、样式加载或生产页面服务。
- `claimCategory`：`history`
- `owner`：`product-design`
- `evidence`：
  - `current`：运行时路径和文件名扫描均无引用。
  - `current`：`docs/design/design-demo-governance.md` 指向当前 React 路由、注册表和 CSS module owner。
  - `current`：`tests/test-design-demo-governance.test.ts` 验证当前路由、数据和展示入口。
- `conflict`：`none`；只剩文档、测试和 inventory 级 live consumer，不存在生产加载边。
- `confidence`：`high`；导入/文件加载扫描与当前测试一致。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行当前 design-demo 路由/外壳/组件测试，并确认生产 bundle/source 仍无 archive 引用。

### `DD-003`

- `id`：`DD-003`
- `path`：`docs/archive/design-demos/pages-checklist.md`
- `location`：页面复现状态、复现优先级，以及 `style-audit-report.md` 的 32 项建议
- `claim`：旧页面状态、固定像素建议和修复优先级仍是当前设计缺口清单。
- `claimCategory`：`history`
- `owner`：`product-design`
- `evidence`：
  - `history`：清单以 2026-04-30 的静态页面为对象，审查报告只描述旧选择器与建议值。
  - `current`：`docs/design/layout-and-density.md`、`responsive-and-accessibility.md`、`component-patterns.md` 与当前源码记录已验证边界和明确已知缺口。
  - `current`：当前文档明确记录 `.mobileNavDrawerButton` 的 42×42px 实现与 44×44px 目标，没有宣称全部页面已达标。
- `conflict`：旧建议没有针对当前 React/CSS module 源码逐项验证，不能迁移为当前要求。
- `confidence`：`high`；旧定位符与当前源码所有者不同。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后保留当前已验证的 42×42px 缺口测试；不得从旧 32 项建议自动创建新承诺。

### `DS-001`

- `id`：`DS-001`
- `path`：`docs/archive/design-system/DESIGN_SYSTEM_SUMMARY.md`
- `location`：三份文档的色彩系统、主题切换、组件复用流程、响应式规则与迁移步骤
- `claim`：全仓库统一采用静态 `shadcn` 迁移规则、固定青绿/粉色 token、桌面优先网格和“出现两次立即提取组件”。
- `claimCategory`：`history`
- `owner`：`product-design`
- `evidence`：
  - `current`：`DESIGN.md` 明确不存在强制所有路由共用的单一外壳或单一组件命名空间。
  - `current`：`docs/design/component-patterns.md` 按实际 owner 选择组件，而不是无条件套用 `shadcn` 或固定复用次数。
  - `current`：`src/app/globals.css` 与共享外壳 CSS 是实际样式来源；`src/app/design-system.css` 未被运行时导入。
  - `current`：26/26 设计 owner 测试通过。
- `conflict`：历史迁移指南把当时目标写成全局规范，和当前多外壳、分层 owner 事实冲突。
- `confidence`：`high`；当前导入边界和文档声明一致。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行产品设计、组件边界、响应式与 design-demo 聚焦测试。

## 写入

- `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-design-system-demos.md`
- 被审计源修改：`none`

## 验证

- owner 检查：26/26 通过。
- 完整门禁复跑：`npx tsx scripts/docs/check.ts --format json` 为 `exit 1`，9714 个错误、3 个警告；本文件新增诊断为 0。
- 运行时依赖检查：archive 目录和唯一静态文件名均没有生产引用；inventory 生成器仍有遗留分类分支。
- 同范围重新审计：15 个冻结文件均已映射；没有发现尚未进入当前 owner 或当前源码的唯一现行设计事实。
- 删除就绪状态：未就绪；`DD-001` 的 live consumer 和完整文档门禁仍开放。

## 独立审查

- 审查者：`/root/audit_archive_prototypes`，不是现行设计 owner 文档作者。
- 状态：独立 extraction/deletion disposition 审查完成。
- 最终结论：15 个文件均可作为历史/被替代资产删除；不得迁移旧像素建议、旧断点或迁移口号。删除前必须切断 archive 专用测试、旧文档和 inventory consumer，并取得完整门禁通过。

## 待决策项

- `none`。没有需要选择的新视觉方向；未验证的旧建议直接保持历史，不提升为当前目标。
