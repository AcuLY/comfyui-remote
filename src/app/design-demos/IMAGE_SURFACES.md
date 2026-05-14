# Design Demo 图片显示面清单

本文档整理当前 demo 中所有会显示生成图片的页面/面板。范围限定在
`src/app/design-demos/**`，不包含图标、空状态符号、模型文件符号或其他非结果图片。

## 组件层级

| 层级 | 组件 | 尺寸 / 行为 | 用途 |
| --- | --- | --- | --- |
| 小缩略图 | `ImageThumbSmall` | 桌面端固定 `80 x 120`；移动端固定 `60 x 90`；纵向 `2:3`，`object-fit: cover`。 | 卡片或队列行里的密集预览。 |
| 小图列表 | `ImageListSmall` / `ImageStrip` | 固定一行，可限制横向尺寸，超出后横向滚动；左右存在被裁切图片时用边缘渐隐提示；`ImageStrip` 是小图列表的项目行适配入口。 | 项目、小节和队列行概览预览。 |
| 中等缩略图 | `ImageThumbMedium` | 桌面端固定 `160 x 240`；移动端固定 `120 x 180`；纵向 `2:3`，`object-fit: cover`。 | 结果网格和审核网格。 |
| 中图列表 | `ImageListMedium` | flex-start 布局，固定 gap；可限制横向/纵向尺寸；纵向折叠时用渐变隐藏后续，并提供展开按钮；可选顶部快速选择和右侧操作按钮列；窄屏下操作列在列表范围内 sticky，并压缩为紧凑图标按钮。 | 结果、审核和组件审查页的统一中图列表容器。 |
| 中图网格 | `ImageGrid` | 使用 `ImageListMedium` 渲染 `ImageThumbMedium`，点击后打开 `ImagePreviewLarge`。 | 通用结果面板。 |
| 审核网格 | `ReviewImageBoard` | 使用 `ImageListMedium` 渲染可勾选的 `ImageThumbMedium`，并带批量选择和操作栏。 | 单次 run 的审核页面。 |
| 大图预览 | `ImagePreviewLarge` | 只作为 lightbox 弹窗使用。保留原图比例，支持上一张/下一张、滚轮缩放、放大后拖拽。 | 从中等缩略图打开；不应作为独立页面元素使用。 |

## 中图可选交互和状态层

`ImageThumbMedium` 是结果图和审核图的统一入口，组件本体支持以下可选层：

| 能力 | Prop / 来源 | UI 位置 | 当前行为 |
| --- | --- | --- | --- |
| 点击打开大图 | `onOpen` | 整张图片按钮 `imageThumbImageButton` | 有 `onOpen` 时点击进入 `ImagePreviewLarge`；大图层负责上一张/下一张、保留、删除、精选等操作。 |
| 勾选按钮 | `selectable`、`selected`、`onSelect` | 左上角 `imageThumbSelect` | `selectable` 为 true 时显示。桌面端 hover/focus 才出现；移动端常驻。`selected` 时显示勾选图标和选中边框。 |
| 审核状态 tag | `showStatus` + `image.status` | 底部叠层右侧 `StatusBadge` | `pending` 显示"待审"，`kept` 显示"保留"，`trashed` 显示"删除"。各页面可通过 `showStatus` 控制是否显示。 |
| 图片语义 tag | `tags` 或默认 `imageTagLabels(image)` | 右上角 `imageThumbTags` | 默认根据 `featured`/`featured2`/`cover` 显示"p站""预览""封面"；页面也可以传空数组隐藏。 |
| 快速操作槽 | `actionSlot` | 中下部 `imageThumbActions` | 可放"保留""删除""精选"等小按钮。桌面端 hover/focus 出现；移动端隐藏；当审核状态 tag 为空时贴近底部。 |
| 状态样式 | `selected`、hover/focus | 卡片边框和阴影 | 选中态使用绿色描边；hover/focus 提升边框强调。 |
| 顶部快速选择 | `ImageListMedium.selectPanel` | 列表顶部右侧 | 可放"全选""只选待审/待审""清空"等批量选择按钮；按钮支持 pressed/disabled 反馈。 |
| 右侧操作列 | `ImageListMedium.actionPanel` | 列表右侧，窄屏在列表范围内 sticky | 可放"保留""删除""p站""预览""封面""撤销"等批量按钮。审核列表未选择图片时，保留/删除改为"全部保留"/"全部删除"并作用于当前列表全部图片；选中图片后恢复为对选中项操作。 |

当前页面对中图层的使用差异：

| 使用方 | 勾选 | 状态 tag | 图片语义 tag | 快速操作槽 |
| --- | --- | --- | --- | --- |
| `ImageGrid` | 由 `selectable` 参数决定，默认关闭 | 默认显示所有 `status` | 传 `tags={[]}`，不显示 p站/预览/封面 | 无 |
| `ReviewImageBoard` | 常开 | 只对 `kept`、`trashed` 显示；`pending` 不额外压状态 tag | 使用默认 p站/预览/封面 | 无，批量操作在网格上下方 |
| 小节编辑页 `运行结果` tab | 常开；点击勾选切换保留状态 | 非 `pending` 时显示 | 使用默认 p站/预览/封面 | 保留、删除、精选 |

## 已挂路由的图片显示面

按缩略图尺寸分为两节，每节内按路由独立成表。

### 小图显示面（ImageThumbSmall / ImageListSmall）

#### `/design-demos/runs`

| Tab / 面板 | 组件路径 | 显示说明 |
| --- | --- | --- |
| `待审核` tab | `QueuePage` → `ImageListSmall` → `ImageThumbSmall` | 按项目分组展示 run 小图预览；行点击进入 run 审核页。 |

#### `/design-demos/projects`

| Tab / 面板 | 组件路径 | 显示说明 |
| --- | --- | --- |
| 项目列表卡片 | `ProjectsPage` → `ImageStrip` → `ImageListSmall` → `ImageThumbSmall` | 只做概览预览；本页不打开大图。 |

#### `/design-demos/projects/:projectId`

| Tab / 面板 | 组件路径 | 显示说明 |
| --- | --- | --- |
| 小节卡片 | `ProjectDetailPage` → `ProjectSectionCard` → `ImageStrip` → `ImageListSmall` → `ImageThumbSmall` | 小节概览预览；开启 compact 模式后隐藏。 |

#### `/design-demos/component-showcase-images`

| Tab / 面板 | 组件路径 | 显示说明 |
| --- | --- | --- |
| 图片结果与审核功能族（小图部分） | `ComponentShowcaseFamilyPage(images)` → `FamilySamples` → `ImageListSmall` | 用于检查小图列表的尺寸限制、滚动、折叠渐变、快速选择和操作区。 |

---

### 中图显示面（ImageThumbMedium / ImageListMedium）

#### `/design-demos/runs/:runId`

| Tab / 面板 | 组件路径 | 显示说明 |
| --- | --- | --- |
| `全部` tab | `ReviewPage` → `ReviewImageBoard` → `ImageListMedium` → `ImageThumbMedium` → `ImagePreviewLarge` | 单次 run 的完整审核网格。 |
| `待审` tab | 同上 | 待审图片审核；中图可勾选，默认不压"待审"状态 tag。 |
| `已保留` tab | 同上 | 已保留图片；中图显示"保留"状态 tag。 |
| `p站` tab | 同上 | p站标记图片；中图右上角显示"p站"。 |
| `预览` tab | 同上 | 预览标记图片；中图右上角显示"预览"。 |
| `封面` tab | 同上 | 封面图片；中图右上角显示"封面"。 |

#### `/design-demos/projects/:projectId/results`

| Tab / 面板 | 组件路径 | 显示说明 |
| --- | --- | --- |
| `全部` tab | `ProjectDetailPage` → `ProjectSectionResultCard` → `ImageGrid` → `ImageListMedium` → `ImageThumbMedium` → `ImagePreviewLarge` | 项目结果页，按小节分组展示所有结果。 |
| `待审` tab | 同上 | 项目级待审结果。 |
| `保留` tab | 同上 | 项目级保留结果。 |
| `p站` tab | 同上 | 项目级 p站标记结果。 |
| `预览` tab | 同上 | 项目级预览标记结果。 |
| `封面` tab | 同上 | 项目级封面结果。 |

#### `/design-demos/projects/:projectId/sections/:sectionId`

| Tab / 面板 | 组件路径 | 显示说明 |
| --- | --- | --- |
| 主 tab：`运行结果`；筛选：`全部` | `SectionEditorPageV2` → run group `ImageListMedium` → `ImageThumbMedium` → `ImagePreviewLarge` | 中图支持勾选、保留/删除状态和快速操作槽位；点击打开大图，并按当前筛选结果上一张/下一张。 |
| 主 tab：`运行结果`；筛选：`待审` | 同上 | 小节编辑内待审结果。 |
| 主 tab：`运行结果`；筛选：`保留` | 同上 | 小节编辑内保留结果。 |
| 主 tab：`运行结果`；筛选：`删除` | 同上 | 删除栏迁移后的目标展示面。 |
| 主 tab：`运行结果`；筛选：`精选` | 同上 | 小节编辑内精选结果。 |

#### `/design-demos/component-showcase-images`

| Tab / 面板 | 组件路径 | 显示说明 |
| --- | --- | --- |
| 图片结果与审核功能族（中图部分） | `ComponentShowcaseFamilyPage(images)` → `FamilySamples` → `ImageListMedium` | 用于检查中图列表的尺寸限制、滚动、折叠渐变、快速选择和操作区。 |

## 当前不显示生成图片的 demo 页面

以下已挂路由的 demo 页面当前不渲染生成结果图片：

- 项目新建/编辑页、批量创建页。
- 预设库、预设详情、预设组、分类编辑和排序规则页。
- 模板列表、模板新建/编辑和模板小节页。
- 模型和 LoRA 浏览页。
- 设置、日志、监控、登录、loading 和未匹配页面。

## 后续替换原则

- 卡片级上下文预览只使用 `ImageListSmall` / `ImageStrip`。
- 所有中图结果/审核列表都通过 `ImageListMedium` 承载，再渲染 `ImageThumbMedium`。
- `ImagePreviewLarge` 只从中等缩略图打开。上一张/下一张、保留/删除/精选等大图行为都留在 lightbox 层处理。
- 新页面如果开始展示生成图片，先把它补进"已挂路由的图片显示面"表，再替换或扩展组件使用方式。
