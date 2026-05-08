# Design Demo 图片显示面清单

本文档整理当前 demo 中所有会显示生成图片的页面/面板。范围限定在
`src/app/design-demos/**`，不包含图标、空状态符号、模型文件符号或其他非结果图片。

## 组件层级

| 层级 | 组件 | 尺寸 / 行为 | 用途 |
| --- | --- | --- | --- |
| 小缩略图 | `ImageThumbSmall` | 固定 `80 x 120`，纵向 `2:3`，`object-fit: cover`。 | 卡片或队列行里的密集预览。 |
| 小图列表 | `ImageStrip` | 最多渲染 10 个 `ImageThumbSmall`。 | 项目和小节概览预览。 |
| 中等缩略图 | `ImageThumbMedium` | 固定 `160 x 240`，纵向 `2:3`，`object-fit: cover`。支持勾选、状态/标签叠层和 `actionSlot`。 | 结果网格和审核网格。 |
| 中图网格 | `ImageGrid` | 渲染 `ImageThumbMedium`，点击后打开 `ImagePreviewLarge`。 | 通用结果面板。 |
| 审核网格 | `ReviewImageBoard` | 渲染可勾选的 `ImageThumbMedium`，并带批量操作栏。 | 单次 run 的审核页面。 |
| 大图预览 | `ImagePreviewLarge` | 只作为 lightbox 弹窗使用。保留原图比例，支持上一张/下一张、滚轮缩放、放大后拖拽。 | 从中等缩略图打开；不应作为独立页面元素使用。 |

## 已挂路由的图片显示面

| 路由 | 页面 / 面板 | 图片来源 | 组件路径 | 显示说明 |
| --- | --- | --- | --- | --- |
| `/design-demos` | 任务工作台首页，和 `/runs` 是同一个页面。待审核项目分组里显示 run 小图预览。 | `row.run.images.slice(0, 5)` | `QueuePage` -> `ImageThumbSmall` | 只显示小缩略图；行点击后进入 run 审核页。 |
| `/design-demos/runs` | 任务工作台。待审核项目分组里显示 run 小图预览。 | `row.run.images.slice(0, 5)` | `QueuePage` -> `ImageThumbSmall` | 当前运行中/最近失败列表不显示图片。 |
| `/design-demos/runs/:runId` | run 审核页，位于筛选 tabs 下方的审核面板。 | 过滤后的 `run.images` | `ReviewPage` -> `ReviewImageBoard` -> `ImageThumbMedium` -> `ImagePreviewLarge` | 主审核网格。中图支持勾选和状态展示；点击打开带审核操作的大图弹窗。 |
| `/design-demos/projects` | 项目列表卡片。 | `project.images` | `ProjectsPage` -> `ImageStrip` -> `ImageThumbSmall` | 只做概览预览；本页不打开大图。 |
| `/design-demos/projects/:projectId` | 项目详情里的小节卡片。 | `section.images` | `ProjectDetailPage` -> `ProjectSectionCard` -> `ImageStrip` -> `ImageThumbSmall` | 小节概览预览；开启 compact 模式后隐藏。 |
| `/design-demos/projects/:projectId/results` | 项目结果页，按小节分组。 | `filterImages(section.images, filter)` | `ProjectDetailPage` -> `ProjectSectionResultCard` -> `ImageGrid` -> `ImageThumbMedium` -> `ImagePreviewLarge` | 项目级筛选后的中图结果网格；点击打开大图弹窗。 |
| `/design-demos/projects/:projectId/sections/:sectionId` | 小节编辑页的 `运行结果` tab。 | 从 `section.images` 派生的本地 `images` state，按 run 分组。 | `SectionEditorPage` -> run group `ImageThumbMedium` -> `ImagePreviewLarge` | 中图支持勾选、保留/删除状态和快速操作槽位；点击打开大图，并按当前筛选结果上一张/下一张。 |
| `/design-demos/projects/:projectId/sections/:sectionId/results` | 独立小节结果页，按 run 分组。 | `filterImages(group.images, filter)` | `SectionResultsPage` -> `ResultRunPanel` -> `ImageGrid` -> `ImageThumbMedium` -> `ImagePreviewLarge` | run 面板内的中图结果网格；点击打开大图弹窗。 |

## 临时调节页面

| 路由 | 页面 / 面板 | 图片来源 | 组件路径 | 显示说明 |
| --- | --- | --- | --- | --- |
| `/design-demos/image-size-tuner` | 临时图片尺寸调节器。 | 页面内置 SVG 示例图。 | `ImageSizeTunerPage` -> `ImageThumbSmall` / `ImageThumbMedium` -> `ImagePreviewLarge` | 仅用于校准桌面端和移动端小图/中图尺寸；确认数值并写回正式样式后应删除。 |

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
