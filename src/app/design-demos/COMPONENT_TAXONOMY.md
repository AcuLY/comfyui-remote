# Design Demos Component Taxonomy

本文档是 `/design-demos` 组件拆分和功能族归属的长期上下文。后续如果发现分类或组件不合预期，先改这份文档和 `showcase/registry.ts`，再让 agent 按它们实施。

## 目标

- `/design-demos` 是未来替换老前端的候选实现，不是一次性 demo。
- Showcase 按功能族审核组件，不按页面或代码层级审核。
- 每个 showcase 条目必须有中文审查名、英文组件名、功能解释、所属功能族、路径、覆盖页面、迁移状态和真实预览。
- 新抽组件采用槽位壳组件，不直接耦合 `DemoProject`、`DemoPreset`、`DemoTemplate` 等业务类型。

## 目录归属

```text
src/app/design-demos/
  routing/      demo 内部路由、href、header spec 的迁移入口
  shell/        设计 demo 外壳、导航、主题、loading 壳
  data/         数据类型、fixture、sqlite/source 读取入口
  shared/
    primitives/  最底层控件：按钮、字段、tab、badge、switch
    patterns/    跨业务槽位壳：unit row、folder、batch bar、workbench、rail
    media/       图片缩略图、图片列表、审核面板、lightbox
    feedback/    toast、operation strip、保存状态
  features/     按新版 IA 的业务适配：runs/projects/presets/templates/models/settings/auth
  showcase/     registry、功能族页面、展示容器和样例
```

`routing`、`shell`、`data`、`shared`、`features`、`showcase` 是正式入口，不再使用下划线前缀。此前的 `component-showcase/*` 和 `image-list-components` 内容已由 `showcase/registry.ts` 驱动的新功能族页面替代；后续组件路径必须指向这些正式入口下的真实文件或目录。

## 命名规范

- 中文审查名描述功能，例如“通用按钮”“通用文件夹行”“预设绑定行”。
- 英文组件名描述代码实体，例如 `Button`、`FolderRow`、`PresetBindingRow`。
- 跨业务结构使用中性名：`UnitRowShell`、`ToolbarCluster`、`SelectionBatchBar`。
- 业务适配组件保留业务名：`ProjectListItem`、`PresetLibraryItemRow`、`TemplateSectionRow`。
- 页面内模式进入 registry 前必须先抽成真实复用组件或 feature 适配组件，不能再用占位状态登记。

## 迁移状态

| 状态 | 含义 |
| --- | --- |
| `implemented` | 已经存在真实复用组件或本轮新增的槽位壳组件。 |
| `adapter` | feature 组件存在，负责把业务数据映射到共享结构。 |
| `specialty` | Headers 或 Icons 这类专项，不参与普通功能族混排。 |

## 功能族准入规则

### 基础操作控件

准入：按钮、链接按钮、勾选框、开关、状态徽标、tab、segmented control、字段、文本域、数字步进、简单选择器。

排除：KSampler、画幅、尺寸、checkpoint 等生成语义控件，它们归入“生成参数与小节配置”。

### 页面骨架、容器与空状态

准入：页面标题栏、连续工作区、编辑区块、右侧详情栏、通用面板、空页面、空行、加载骨架。

排除：具体业务列表行，归入“单元行项”。

### 单元行项 / List Item 家族

准入：项目行、小节行、结果小节、预设条目、模板条目、模板小节、导入项、运行任务行、设置入口行。

排除：文件夹行归入“文件夹、路径与移动目标”，因为它们承担路径导航和移动目标语义。

### 文件夹、路径与移动目标

准入：路径面包屑、文件夹行、返回上级、移动菜单、移动弹层、移动目标行、文件浏览器路径结构。

排除：已选 N 项后的批量移动命令归入“批量选择、工具栏与操作反馈”。

### 批量选择、工具栏与操作反馈

准入：批量栏、工具栏、结果操作组、toast、operation strip、保存状态、撤销/删除/确认反馈。

排除：移动目标树和文件夹列表归入“文件夹、路径与移动目标”。

### 生成参数与小节配置

准入：画幅、短边、放大、尺寸读数、checkpoint、KSampler、batch size、小节生成参数。

排除：普通文本字段归入“基础操作控件”。

### 预设、Prompt 与 LoRA 编辑

准入：预设绑定、导入面板、Prompt 块、编译预览、LoRA 行、两阶段 LoRA、预设组成员、关联变体、flatten 预览。

排除：分类列表、排序规则、历史 diff 归入“分类、排序、历史与差异”。

### 分类、排序、历史与差异

准入：分类侧栏、分类行、分类编辑、槽位编辑、排序面板、可拖拽排序行、历史 diff、变体 rail、小节 rail。

排除：预设成员的业务内容归入“预设、Prompt 与 LoRA 编辑”；排序壳可复用在本族。

### 图片结果与审核面

准入：小图、中图、图片列表、图片网格、审核面板、图片统计、Lightbox、结果筛选、图片审核动作组。

排除：任务运行列表和审核分组归入“任务运行、队列与进度”。

### 任务运行、队列与进度

准入：队列指标、当前运行进度、运行/失败列表、待审核分组、分页器、审核元信息、执行参数摘要。

排除：生成出来的图片网格归入“图片结果与审核面”。

### 系统、日志、监控与模型文件

准入：日志筛选、日志行、日志查看器、监控状态、探测结果、模型文件浏览器、文件详情、登录 token、404 路由辅助。

排除：模型文件夹行和路径结构复用“文件夹、路径与移动目标”；系统页面只拥有业务适配。

### Headers 专项

准入：`RouteHeaderSurface`、路由 header 卡、展开/折叠/移动端 header 规则。

排除：普通 `PageHeader` 属于“页面骨架、容器与空状态”。

### Icons 专项

准入：Lucide 图标表、自定义 SVG 图标、图标语义说明。

排除：按钮里的图标状态归入“基础操作控件”。

## 现有组件迁移表

| 中文名 | 英文名 | 归属族 | 新路径 / 入口 | 状态 |
| --- | --- | --- | --- | --- |
| 通用按钮 | `Button` | 基础操作控件 | `shared/primitives` | implemented |
| 状态徽标 | `StatusBadge` | 基础操作控件 | `shared/primitives` | implemented |
| 浮层下拉选择器 | `FloatingSelect / SelectLike` | 基础操作控件 | `shared/primitives` | implemented |
| 页面标题栏 | `PageHeader` | 页面骨架 | `shared/primitives` | implemented |
| 连续工作区 | `WorkbenchSurface` | 页面骨架 | `shared/patterns` | implemented |
| 通用单元行壳 | `UnitRowShell` | 单元行项 | `shared/patterns` | implemented |
| 项目列表项 | `ProjectListItem` | 单元行项 | `features/projects` | adapter |
| 项目小节项 | `ProjectSectionCard` | 单元行项 | `features/projects` | adapter |
| 预设库条目 | `PresetLibraryItemRow` | 单元行项 | `features/presets` | adapter |
| 模板小节项 | `TemplateSectionRow` | 单元行项 | `features/templates` | adapter |
| 通用路径面包屑 | `FolderBreadcrumb` | 文件夹与移动目标 | `shared/patterns` | implemented |
| 通用文件夹行 | `FolderRow` | 文件夹与移动目标 | `shared/patterns` | implemented |
| 移动目标选择器 | `MoveTargetPicker` | 文件夹与移动目标 | `shared/patterns` | implemented |
| 模型文件行 | `ModelFileRow` | 文件夹与移动目标 | `features/models` | adapter |
| 通用批量栏 | `SelectionBatchBar` | 批量选择与反馈 | `shared/patterns` | implemented |
| 操作状态条 | `OperationStateStrip` | 批量选择与反馈 | `shared/feedback` | implemented |
| KSampler 参数卡 | `KSamplerCard` | 生成参数 | `editor-controls` | implemented |
| 图片尺寸参数组 | `ImageSizeControlGroup` | 生成参数 | `editor-controls` | implemented |
| 预设绑定行 | `PresetBindingRow` | 预设/Prompt/LoRA | `editor-presets` | implemented |
| Prompt 块行 | `PromptBlockRow` | 预设/Prompt/LoRA | `editor-prompts` | implemented |
| LoRA 行 | `LoraRow` | 预设/Prompt/LoRA | `editor-lora-history` | implemented |
| 预设成员行 | `PresetMemberRow` | 预设/Prompt/LoRA | `features/presets` | adapter |
| 可拖拽排序行 | `SortableRowShell` | 分类/排序/历史 | `shared/patterns` | implemented |
| 历史差异行 | `HistoryDiffRow` | 分类/排序/历史 | `editor-lora-history` | implemented |
| 分类侧栏和分类行 | `PresetCategorySidebar / PresetCategoryRow` | 分类/排序/历史 | `features/presets` | adapter |
| 中图列表 | `ImageListMedium` | 图片结果与审核 | `shared/media` | implemented |
| 审核图片面板 | `ReviewImageBoard` | 图片结果与审核 | `shared/media` | implemented |
| 队列指标 | `QueueMetrics` | 任务运行与队列 | `features/runs` | implemented |
| 审核元信息卡 | `ReviewMetaCard` | 任务运行与队列 | `features/runs` | implemented |
| 日志筛选和日志行 | `LogFilterBar / LogLine` | 系统/日志/模型文件 | `features/settings` | adapter |
| 监控状态行 | `MonitorStatusRow` | 系统/日志/模型文件 | `features/settings` | adapter |
| 模型文件浏览器 | `ModelFileBrowser / ModelFileInspector` | 系统/日志/模型文件 | `features/models` | adapter |
| 登录令牌面板 | `LoginTokenPanel` | 系统/日志/模型文件 | `features/auth` | adapter |
| 固定顶栏设计稿 | `RouteHeaderSurface` | Headers 专项 | `header-surface` | specialty |
| Lucide 图标列表 | `IconList` | Icons 专项 | `showcase-icons/icon-list` | specialty |
| 图标语义表 | `IconMeaningTable` | Icons 专项 | `showcase/pages` | specialty |

## 高混淆边界

- 基础控件 vs 参数控件：没有生成语义的是基础控件；会影响生成参数的是生成参数族。
- 单元行项 vs 文件夹行：普通对象摘要是单元行项；能进入路径层级或作为移动目标的是文件夹族。
- 文件夹移动 vs 批量操作：目标选择器属于文件夹族；“已选 N 项并执行移动”属于批量操作族。
- 图片结果 vs 任务运行：图片缩略图、网格和审核动作属于图片族；run 进度、队列和执行元信息属于任务族。
- 系统文件浏览 vs 通用文件夹组件：模型文件页面归系统族，但路径、文件夹行和移动目标应复用文件夹族。

## Showcase 覆盖要求

- `src/app/design-demos/showcase/registry.ts` 是 showcase 目录真相。
- 每个功能族至少有一个真实样例和一个组件清单。
- 每个 registry 条目必须在 `showcase/preview-keys.ts` 和 `showcase/pages/component-previews.tsx` 中有对应真实预览。
- 总览页、功能族页、计数和状态说明必须从 registry 读取。
- `atoms/mid/editor/projects/image-list-components` 入口不再出现在路由表和总览页。
- 新组件必须先登记功能族，再进入 showcase。
- `Headers` 和 `Icons` 是专项页：可以使用完整展示布局，不强制放进普通 family card 框架。
