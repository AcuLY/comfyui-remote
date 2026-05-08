# Design Demo 图片显示面清单

本文档整理当前 demo 中所有会显示生成图片的页面/面板。范围限定在
`src/app/design-demos/**`，不包含图标、空状态符号、模型文件符号或其他非结果图片。

## 组件层级

| 层级 | 组件 | 尺寸 / 行为 | 用途 |
| --- | --- | --- | --- |
| 小缩略图 | `ImageThumbSmall` | 桌面端固定 `80 x 120`；移动端固定 `60 x 90`；纵向 `2:3`，`object-fit: cover`。 | 卡片或队列行里的密集预览。 |
| 小图列表 | `ImageStrip` | 最多渲染 10 个 `ImageThumbSmall`。 | 项目和小节概览预览。 |
| 中等缩略图 | `ImageThumbMedium` | 桌面端固定 `160 x 240`；移动端固定 `120 x 180`；纵向 `2:3`，`object-fit: cover`。 | 结果网格和审核网格。 |
| 中图网格 | `ImageGrid` | 渲染 `ImageThumbMedium`，点击后打开 `ImagePreviewLarge`。 | 通用结果面板。 |
| 审核网格 | `ReviewImageBoard` | 渲染可勾选的 `ImageThumbMedium`，并带批量操作栏。 | 单次 run 的审核页面。 |
| 大图预览 | `ImagePreviewLarge` | 只作为 lightbox 弹窗使用。保留原图比例，支持上一张/下一张、滚轮缩放、放大后拖拽。 | 从中等缩略图打开；不应作为独立页面元素使用。 |

## 中图可选交互和状态层

`ImageThumbMedium` 是结果图和审核图的统一入口，组件本体支持以下可选层：

| 能力 | Prop / 来源 | UI 位置 | 当前行为 |
| --- | --- | --- | --- |
| 点击打开大图 | `onOpen` | 整张图片按钮 `imageThumbImageButton` | 有 `onOpen` 时点击进入 `ImagePreviewLarge`；大图层负责上一张/下一张、保留、删除、精选等操作。 |
| 勾选按钮 | `selectable`、`selected`、`onSelect` | 左上角 `imageThumbSelect` | `selectable` 为 true 时显示。桌面端 hover/focus 才出现；移动端常驻。`selected` 时显示勾选图标和选中边框。 |
| 审核状态 tag | `showStatus` + `image.status` | 底部叠层右侧 `StatusBadge` | `pending` 显示“待审”，`kept` 显示“保留”，`trashed` 显示“删除”。各页面可通过 `showStatus` 控制是否显示。 |
| 图片语义 tag | `tags` 或默认 `imageTagLabels(image)` | 右上角 `imageThumbTags` | 默认根据 `featured`/`featured2`/`cover` 显示“p站”“预览”“封面”；页面也可以传空数组隐藏。 |
| 图片标题 | `image.label` | 底部叠层左侧 `imageThumbLabel` | 单行省略，用于标识当前图片或示例名。 |
| 快速操作槽 | `actionSlot` | 中下部 `imageThumbActions` | 可放“保留”“删除”“精选”等小按钮。桌面端 hover/focus 出现；移动端隐藏。 |
| 状态样式 | `selected`、hover/focus | 卡片边框和阴影 | 选中态使用绿色描边；hover/focus 提升边框强调。 |

当前页面对中图层的使用差异：

| 使用方 | 勾选 | 状态 tag | 图片语义 tag | 快速操作槽 |
| --- | --- | --- | --- | --- |
| `ImageGrid` | 由 `selectable` 参数决定，默认关闭 | 默认显示所有 `status` | 传 `tags={[]}`，不显示 p站/预览/封面 | 无 |
| `ReviewImageBoard` | 常开 | 只对 `kept`、`trashed` 显示；`pending` 不额外压状态 tag | 使用默认 p站/预览/封面 | 无，批量操作在网格上下方 |
| 小节编辑页 `运行结果` tab | 常开；点击勾选切换保留状态 | 非 `pending` 时显示 | 使用默认 p站/预览/封面 | 保留、删除、精选 |

## 已挂路由的图片显示面

| 路由 | Tab / 面板 | 图片来源 | 组件路径 | 显示说明 |
| --- | --- | --- | --- | --- |
| `/design-demos` | `待审核` tab | `row.run.images.slice(0, 5)` | `QueuePage` -> `ImageThumbSmall` | 任务工作台首页等同 `/runs`。按项目分组展示 run 小图预览；行点击进入 run 审核页。 |
| `/design-demos` | `队列` tab | 无 | `QueuePage` -> `RunList` | 当前只显示运行/排队任务行，不显示图片。 |
| `/design-demos` | `失败` tab | 无 | `QueuePage` -> `RunList` | 当前只显示失败任务行和操作按钮，不显示图片。 |
| `/design-demos/runs` | `待审核` tab | `row.run.images.slice(0, 5)` | `QueuePage` -> `ImageThumbSmall` | 按项目分组展示 run 小图预览；行点击进入 run 审核页。 |
| `/design-demos/runs` | `队列` tab | 无 | `QueuePage` -> `RunList` | 当前只显示运行/排队任务行，不显示图片。 |
| `/design-demos/runs` | `失败` tab | 无 | `QueuePage` -> `RunList` | 当前只显示失败任务行和操作按钮，不显示图片。 |
| `/design-demos/runs/:runId` | `全部` tab | `filterImages(run.images, "all")` | `ReviewPage` -> `ReviewImageBoard` -> `ImageThumbMedium` -> `ImagePreviewLarge` | 单次 run 的完整审核网格。 |
| `/design-demos/runs/:runId` | `待审` tab | `run.images` 中 `status === "pending"` | `ReviewPage` -> `ReviewImageBoard` -> `ImageThumbMedium` -> `ImagePreviewLarge` | 待审图片审核；中图可勾选，默认不压“待审”状态 tag。 |
| `/design-demos/runs/:runId` | `已保留` tab | `run.images` 中 `status === "kept"` | `ReviewPage` -> `ReviewImageBoard` -> `ImageThumbMedium` -> `ImagePreviewLarge` | 已保留图片；中图显示“保留”状态 tag。 |
| `/design-demos/runs/:runId` | `p站` tab | `run.images` 中 `featured === true` | `ReviewPage` -> `ReviewImageBoard` -> `ImageThumbMedium` -> `ImagePreviewLarge` | p站标记图片；中图右上角显示“p站”。 |
| `/design-demos/runs/:runId` | `预览` tab | `run.images` 中 `featured2 === true` | `ReviewPage` -> `ReviewImageBoard` -> `ImageThumbMedium` -> `ImagePreviewLarge` | 预览标记图片；中图右上角显示“预览”。 |
| `/design-demos/runs/:runId` | `封面` tab | `run.images` 中 `cover === true` | `ReviewPage` -> `ReviewImageBoard` -> `ImageThumbMedium` -> `ImagePreviewLarge` | 封面图片；中图右上角显示“封面”。 |
| `/design-demos/projects` | 项目列表卡片 | `project.images` | `ProjectsPage` -> `ImageStrip` -> `ImageThumbSmall` | 只做概览预览；本页不打开大图。 |
| `/design-demos/projects/:projectId` | 小节卡片 | `section.images` | `ProjectDetailPage` -> `ProjectSectionCard` -> `ImageStrip` -> `ImageThumbSmall` | 小节概览预览；开启 compact 模式后隐藏。 |
| `/design-demos/projects/:projectId/results` | `全部` tab | `filterImages(section.images, "all")` | `ProjectDetailPage` -> `ProjectSectionResultCard` -> `ImageGrid` -> `ImageThumbMedium` -> `ImagePreviewLarge` | 项目结果页，按小节分组展示所有结果。 |
| `/design-demos/projects/:projectId/results` | `待审` tab | `section.images` 中 `status === "pending"` | 同上 | 项目级待审结果。 |
| `/design-demos/projects/:projectId/results` | `保留` tab | `section.images` 中 `status === "kept"` | 同上 | 项目级保留结果。 |
| `/design-demos/projects/:projectId/results` | `p站` tab | `section.images` 中 `featured === true` | 同上 | 项目级 p站标记结果。 |
| `/design-demos/projects/:projectId/results` | `预览` tab | `section.images` 中 `featured2 === true` | 同上 | 项目级预览标记结果。 |
| `/design-demos/projects/:projectId/results` | `封面` tab | `section.images` 中 `cover === true` | 同上 | 项目级封面结果。 |
| `/design-demos/projects/:projectId/sections/:sectionId` | 主 tab：`运行结果`；筛选：`全部` | 本地 `images` state 的全部图片，按 run 分组 | `SectionEditorPage` -> run group `ImageThumbMedium` -> `ImagePreviewLarge` | 中图支持勾选、保留/删除状态和快速操作槽位；点击打开大图，并按当前筛选结果上一张/下一张。 |
| `/design-demos/projects/:projectId/sections/:sectionId` | 主 tab：`运行结果`；筛选：`待审` | 本地 `images` 中 `status === "pending"` | 同上 | 小节编辑内待审结果。 |
| `/design-demos/projects/:projectId/sections/:sectionId` | 主 tab：`运行结果`；筛选：`保留` | 本地 `images` 中 `status === "kept"` | 同上 | 小节编辑内保留结果。 |
| `/design-demos/projects/:projectId/sections/:sectionId` | 主 tab：`运行结果`；筛选：`删除` | 本地 `images` 中 `status === "trashed"` | 同上 | 删除栏迁移后的目标展示面。 |
| `/design-demos/projects/:projectId/sections/:sectionId` | 主 tab：`运行结果`；筛选：`精选` | 本地 `images` 中 `featured === true` | 同上 | 小节编辑内精选结果。 |
| `/design-demos/projects/:projectId/sections/:sectionId/results` | `全部` tab | `filterImages(group.images, "all")` | `SectionResultsPage` -> `RunResultBlock` -> `ImageGrid` -> `ImageThumbMedium` -> `ImagePreviewLarge` | 独立小节结果页，按 run 分组展示所有结果。 |
| `/design-demos/projects/:projectId/sections/:sectionId/results` | `待审` tab | `group.images` 中 `status === "pending"` | 同上 | 小节结果待审图片。 |
| `/design-demos/projects/:projectId/sections/:sectionId/results` | `已保留` tab | `group.images` 中 `status === "kept"` | 同上 | 小节结果保留图片。 |
| `/design-demos/projects/:projectId/sections/:sectionId/results` | `p站` tab | `group.images` 中 `featured === true` | 同上 | 小节结果 p站标记图片。 |
| `/design-demos/projects/:projectId/sections/:sectionId/results` | `预览` tab | `group.images` 中 `featured2 === true` | 同上 | 小节结果预览标记图片。 |
| `/design-demos/projects/:projectId/sections/:sectionId/results` | `封面` tab | `group.images` 中 `cover === true` | 同上 | 小节结果封面图片。 |

## 当前不显示生成图片的 demo 页面

以下已挂路由的 demo 页面当前不渲染生成结果图片：

- 项目新建/编辑页、批量创建页。
- 预设库、预设详情、预设组、分类编辑和排序规则页。
- 模板列表、模板新建/编辑和模板小节页。
- 模型和 LoRA 浏览页。
- 设置、日志、监控、登录、loading 和未匹配页面。

## 保留但未渲染的旧图片代码

`project-pages.tsx` 里仍有一个旧的 `SectionEditorPage` 函数，用于迁移到
`section-editor-page.tsx` 期间保留参考。它的 `最新结果` aside 使用
`ImageStrip`，但 `design-demo-client.tsx` 不会选择这个函数，因此不属于当前
实际渲染的图片显示面。

## 后续替换原则

- 卡片级上下文预览只使用 `ImageThumbSmall` 或 `ImageStrip`。
- 所有需要勾选、状态标签或快速操作的结果/审核图片都使用 `ImageThumbMedium`。
- `ImagePreviewLarge` 只从中等缩略图打开。上一张/下一张、保留/删除/精选等大图行为都留在 lightbox 层处理。
- 新页面如果开始展示生成图片，先把它补进“已挂路由的图片显示面”表，再替换或扩展组件使用方式。
