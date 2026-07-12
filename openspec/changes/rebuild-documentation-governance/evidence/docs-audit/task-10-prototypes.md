# 任务 10：Training 原型独立审计记录

## 调用

- 显式调用方：已批准的 `rebuild-documentation-governance` 任务 `10.2`，由独立审计者 `/root/audit_archive_prototypes` 执行。
- 范围：`$docs-audit paths docs/prototypes`。
- 操作：`record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-10-prototypes.md`。
- 比较基线：分支 `codex/harness-doc-governance-handoff-20260710`，提交 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`。
- 冻结输入：28 个已跟踪文件；`git ls-files -s -- docs/prototypes` 清单摘要 `8f029874d82a89ac9377beb7cc17c3cfa3f6e74d907a27e398b1a4052fa0342c`。
- 范围明确；确定性门禁按完整模式执行。

## 写入边界

- 唯一允许写入：本文件。
- 写入前完整工作树基线：83 个已修改、14 个已删除、65 个未跟踪条目，共 162 条；规范化状态摘要 `cdc72f7d6ce9147f0b6ece0c9c0d614c86f2aeb8a84c99cf0463e50a7e5f70b9`。
- 未修改 prototype、生产 `Training` 源码、现行 owner 文档、个人脚本或其他 evidence。

## 确定性检查

- 命令：`npm run docs:check`。
- 退出分类：`exit 1`，9702 个错误、3 个警告；不是检查器或配置故障。
- 与本组直接相关的错误包括 `tests/test-training-prototype-governance.test.ts` 对原型路由映射和文件存在性的依赖、旧文档链接、清单分类和遗留英文正文。
- 该结果允许继续语义分析，但禁止立即删除或报告本范围通过。

## 已审查证据

### 当前实现

- 产品 owner：`PRODUCT.md`、`docs/product/training/README.md`。
- 架构 owner：`ARCHITECTURE.md`、`docs/architecture/domains/training/README.md`、`docs/architecture/system/execution/queue-worker.md`。
- 设计 owner：`DESIGN.md`、`docs/design/layout-and-density.md`、`docs/design/component-patterns.md`、`docs/design/design-demo-governance.md`。
- 生产源码：`src/app/training/[[...route]]/page.tsx`、`src/features/training/app.tsx`、`src/features/training/routes.ts`、`src/lib/work-mode-resources.ts`、`src/app/api/training/**`。
- 聚焦验证：`node --import tsx --test tests/test-training-prototype-governance.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-training-prod-route-shell.test.ts tests/test-training-api-boundary.test.ts tests/test-product-design-doc-governance.test.ts`，84/84 通过。
- 静态生产扫描：`src`、`config`、`public`、`next.config.ts`、`package.json`、`prisma` 与运行时脚本对 `docs/prototypes`、两个共享原型资产路径、两张原型图片和原型 HTML 前缀均无引用。
- `src/app/layout.tsx` 使用的是自身 `src/app/fonts/geist-latin.woff2`，不是 `docs/prototypes/assets/fonts/geist-latin.woff2`。

### 已批准目标

- 任务 `10.1` 至 `10.5`。
- 提案与规范明确要求删除全部原型 HTML、CSS、JavaScript、图像、字体与 README，不建立历史副本；`Training` 平级工作模式和生产契约必须保留。

### 历史意图

- 本范围 28 个冻结文件及 README 路由映射。
- prototype 字段、样例数据、视觉层级、交互文案和 HTML 路由映射只用于核对是否已有生产 owner，不提升为当前产品承诺。

### 运行时证据

- 无需启动服务。Next.js 只自动服务 `public/**`，而本组不在 `public/**`；生产源码也没有自定义读取/服务边。源码扫描与聚焦测试足以证明无 import/load/serve 依赖。

## 文件核对

| 冻结文件 | 处置 | 发现 |
| --- | --- | --- |
| `docs/prototypes/README.md` | 删除；生产责任方已取代路由映射 | `PROTO-001` |
| `docs/prototypes/assets/fonts/geist-latin.woff2` | 删除 | `PROTO-002` |
| `docs/prototypes/assets/images/lora-training-generation-result-output.png` | 删除 | `PROTO-002` |
| `docs/prototypes/assets/images/lora-training-generation-result-thumb.png` | 删除 | `PROTO-002` |
| `docs/prototypes/assets/lora-training-shared.css` | 删除 | `PROTO-002` |
| `docs/prototypes/assets/lora-training-shared.js` | 删除 | `PROTO-002` |
| `docs/prototypes/manager-lora-training-generation-compose-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-generation-detail-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-preset-detail-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-preset-sort-rules-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-presets-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-dataset-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-dataset-revision-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-detail-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-generation-tasks-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-new-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-profile-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-results-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-section-detail-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-sections-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-project-training-runs-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-projects-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-runs-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-template-edit-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-template-new-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-template-section-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-templates-prototype.html` | 删除 | `PROTO-003` |
| `docs/prototypes/manager-lora-training-training-detail-prototype.html` | 删除 | `PROTO-003` |

## 审计发现

### `PROTO-001`

- `id`：`PROTO-001`
- `path`：`docs/prototypes/README.md`
- `location`：路由映射、共享资产与验证
- `claim`：原型 README 仍需作为生产 `Training` 路由或产品事实的事实源。
- `claimCategory`：`history`
- `owner`：`product-training`
- `evidence`：
  - `current`：`docs/product/training/README.md` 明确 `/training/**`、`src/features/training/routes.ts` 与 `src/features/training/app.tsx` 是生产 owner。
  - `current`：`tests/test-training-prod-route-shell.test.ts` 验证生产路由 inventory 中的每个路由都能渲染页面。
  - `current`：`tests/test-training-prototype-governance.test.ts` 在删除前证明 22 个 HTML 原型均已映射到生产路由责任方。
- `conflict`：README 自身承认只拥有原型意图；目标变更明确不再保留这个并行意图责任方。
- `confidence`：`high`；生产路由注册表、页面分派和测试一致。
- `action`：`delete`
- `resolution`：`accepted-current`
- `verification`：删除 prototype 专用 route-map 测试后，以生产路由 inventory、产品 owner 与 API 边界测试替代。

### `PROTO-002`

- `id`：`PROTO-002`
- `path`：`docs/prototypes/assets/lora-training-shared.css`
- `location`：原型专用 CSS、JavaScript、字体与图像资产
- `claim`：生产代码会导入、加载或提供这些原型资产。
- `claimCategory`：`current`
- `owner`：`product-design`
- `evidence`：
  - `current`：生产路径和唯一资产名扫描均为零引用。
  - `current`：原型治理测试逐个扫描 `src/**`，确认没有共享 CSS/JavaScript 或 `docs/prototypes/assets` 引用。
  - `current`：生产字体路径位于 `src/app/fonts/**`，与原型字体路径不同。
- `conflict`：`none`；只有 prototype HTML 自身相互引用这些资产。
- `confidence`：`high`；静态依赖边和路径归属可完整扫描。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行生产构建或至少生产 `Training` shell/route/source 测试，并确认源码搜索仍为零。

### `PROTO-003`

- `id`：`PROTO-003`
- `path`：`docs/prototypes/manager-lora-training-generation-compose-prototype.html`
- `location`：全部 22 个 `manager-lora-training-*-prototype.html` 页面
- `claim`：删除 HTML prototype 会删除 `Training` 平级工作模式、生产路由、API、service/repository 或已实现页面契约。
- `claimCategory`：`current`
- `owner`：`training`
- `evidence`：
  - `current`：`PRODUCT.md` 与 `docs/product/training/README.md` 把 `Training` 定义为与 `Generation` 平级的工作模式。
  - `current`：`src/lib/work-mode-resources.ts` 隔离两种模式自有的运行、项目、预制和模板，只共享模型与设置。
  - `current`：`src/features/training/**`、`src/app/api/training/**`、Training services/repositories/workers 拥有生产契约。
  - `current`：84/84 产品、路由、API、资源隔离和 prototype 边界测试通过。
- `conflict`：prototype 中的样例字段与布局没有生产权威地位；生产 owner 已独立存在。
- `confidence`：`high`；生产代码和测试不依赖 prototype。
- `action`：`delete`
- `resolution`：`accepted-current`
- `verification`：删除后运行 84 项组合中的生产责任方子集；改写测试以去掉原型文件存在性和路由映射依赖。

### `PROTO-004`

- `id`：`PROTO-004`
- `path`：`docs/prototypes/README.md`
- `location`：组级删除门禁
- `claim`：本组现在没有 live consumer，可以立即删除。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：
  - `current`：`docs/index.md`、`docs/repo-inventory.md`、inventory 生成器、`tests/test-training-prototype-governance.test.ts`、旧 archive 计划和 policy 仍引用或分类 `docs/prototypes/**`。
  - `target`：任务 `10.3` 要求删除原型路由映射、意图链接、清单分类与专用测试。
- `conflict`：完整文档门禁仍为 `exit 1`。
- `confidence`：`high`；consumer 可确定性搜索。
- `action`：`delete`
- `resolution`：`open`
- `verification`：先完成任务 `10.3`，重生成 inventory，并要求非 OpenSpec 生产/当前文档搜索归零、生产 owner 测试通过及 `npm run docs:check` 为 `exit 0`。

## 写入

- `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-10-prototypes.md`
- 被审计源修改：`none`

## 验证

- `Training` 原型、工作模式、生产页面外壳、API 和产品责任方组合：84/84 通过。
- 生产 import/load/serve 扫描：零 prototype 路径或唯一资产引用。
- 完整门禁复跑：`npx tsx scripts/docs/check.ts --format json` 为 `exit 1`，9714 个错误、3 个警告；本文件新增诊断为 0。
- 同范围重新审计：28 个冻结文件全部映射；没有发现只存在于 prototype、尚未由生产 owner/source/test 承接的当前事实。
- 删除就绪状态：未就绪；`PROTO-004` 和完整文档门禁仍开放。

## 独立审查

- 审查者：`/root/audit_archive_prototypes`，不是生产 `Training` 或当前设计 owner 文档作者。
- 状态：独立 extraction/deletion disposition 审查完成。
- 最终结论：28 个文件不参与生产导入、加载或服务，生产 `Training` 平级工作模式与契约由当前责任方独立保留；全部原型在语义上可删除且不应建立历史副本。删除前必须移除专用路由映射与测试、旧链接和清单分类，并取得完整门禁通过。

## 待决策项

- `none`。原型意图不再是获批目标，生产责任方已明确。
