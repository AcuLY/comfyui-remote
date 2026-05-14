# Design Demos Component Inventory

这份清单不再维护逐组件历史大表。当前可信来源是：

- `showcase/registry.ts`：组件 showcase 的唯一机器可验证索引，包含功能族、审查名、组件名、真实源码路径、覆盖场景和状态。
- `showcase/preview-keys.ts` 与 `showcase/pages/component-previews.tsx`：registry 条目的预览覆盖。
- `COMPONENT_TAXONOMY.md`：功能族边界、命名规则和归属解释。
- `FRONTEND_RULES.md`：新增或调整组件时必须遵守的目录、样式和 showcase 规则。

## Current Path Families

`src/app/design-demos` 下的正式入口如下：

| 路径族 | 作用 |
| --- | --- |
| `routing/` | demo 内部路由、href、状态、header spec。 |
| `shell/` | 全局 demo 外壳、导航、固定 header、loading 壳。 |
| `data/` | demo 数据类型、fixture、sqlite/source 读取和 shape transforms。 |
| `shared/primitives/` | Button、Checkbox、Field、PageHeader、StatusBadge 等底层控件。 |
| `shared/patterns/` | UnitRowShell、FolderRow、WorkbenchSurface、ToolbarCluster 等跨业务结构。 |
| `shared/media/` | 图片缩略图、图片列表、图片网格、审核面板、Lightbox。 |
| `shared/feedback/` | toast provider、operation state strip 等操作反馈。 |
| `features/projects/` | 项目列表、详情、小节、结果、批量创建和小节编辑器业务适配。 |
| `features/projects/editor/` | 生成参数、预设绑定、Prompt、LoRA、历史和结果面板。 |
| `features/runs/` | 队列指标、运行进度、运行列表、待审核分组和审核元信息。 |
| `features/presets/` | 预设库、分类、预设详情、预设组、排序规则。 |
| `features/templates/` | 模板列表、模板编辑和模板小节编辑。 |
| `features/models/` | 模型文件浏览、文件行和右侧详情。 |
| `features/settings/` | 设置入口、日志、监控和 404 辅助页。 |
| `features/auth/` | 登录页和 token 面板。 |
| `showcase/` | registry、功能族页面、预览容器和辅助展示组件。 |
| `showcase/icons/` | Lucide 图标列表、自定义图标展示和图标数据。 |

## Update Flow

新增、移动或删除 demo 组件时：

1. 先确认组件归属是否符合 `COMPONENT_TAXONOMY.md`。
2. 更新 `showcase/registry.ts` 的 `paths`，路径必须指向上表正式入口下真实存在的文件或目录。
3. 如果 showcase 需要展示该组件，同步更新 `showcase/preview-keys.ts` 和 `showcase/pages/component-previews.tsx`。
4. 运行 registry 测试，防止路径失效或重新写入已删除的顶层目录。

## Verification

```powershell
npx tsx src/app/design-demos/showcase/registry.test.ts
```

这个测试会检查：

- 功能族顺序、路由和中文审查信息。
- 每个 registry 条目都有真实预览。
- 每个 `paths` 条目指向真实存在的源码文件、目录、入口文件或 CSS Module。
- `paths` 不使用已删除的顶层目录名。
