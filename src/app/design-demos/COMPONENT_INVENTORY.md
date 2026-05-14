# Demo 组件清单

> 本文档按**层级**（小组件 → 中组件 → 大组件 → 页面）整理 `design-demos` 中的全部组件，
> 包括导出名、所在文件、Props、功能描述和使用的 CSS 类。

---

## 1. 原子 / 小组件

### 1.1 Button

| 字段 | 值 |
|------|-----|
| 导出名 | `Button` |
| 文件 | `ui/button/index.tsx` |
| Props | `children?`, `tone?: "default" \| "subtle" \| "primary" \| "pink" \| "danger"`, `icon?: RouteIcon`, `iconOnly?`, `ariaLabel?`, `onClick?`, `pressed?`, `pending?`, `disabled?`, `feedback?: DemoButtonFeedback`, `className?`, `size?: "sm" \| "md"` |
| 功能 | 通用按钮，支持 5 种色调、图标、纯 icon、pending 旋转、点击后 toast 反馈 |
| CSS 类 | `Button` 自有模块类，feature CSS 不直接选择内部类 |

### 1.2 ButtonLink

| 字段 | 值 |
|------|-----|
| 导出名 | `ButtonLink` |
| 文件 | `ui/button/index.tsx` |
| Props | `href`, `children?`, `tone?`, `icon?`, `iconOnly?`, `ariaLabel?`, `className?` |
| 功能 | 按钮外观的 `<Link>`，色调与纯 icon 模式同 Button |
| CSS 类 | 同 Button |

### 1.3 StatusBadge

| 字段 | 值 |
|------|-----|
| 导出名 | `StatusBadge` |
| 文件 | `ui/status-badge/index.tsx` |
| Props | `status: string`, `label?: string` |
| 功能 | 状态标签，根据 status 自动着色（green / amber / red / sky） |
| CSS 类 | `.status`, `.statusGreen`, `.statusAmber`, `.statusRed`, `.statusSky` |

### 1.4 Field

| 字段 | 值 |
|------|-----|
| 导出名 | `Field` |
| 文件 | `ui/field/index.tsx` |
| Props | `label`, `value: string \| number`, `disabled?` |
| 功能 | 只读文本输入字段 |
| CSS 类 | `.field`, `.input` |

### 1.5 TextAreaField

| 字段 | 值 |
|------|-----|
| 导出名 | `TextAreaField` |
| 文件 | `ui/text-area-field.tsx` |
| Props | `label`, `value: string` |
| 功能 | 只读多行文本字段 |
| CSS 类 | `.textAreaField`, `.textarea` |

### 1.6 SelectLike

| 字段 | 值 |
|------|-----|
| 导出名 | `SelectLike` |
| 文件 | `ui/select-like.tsx` |
| Props | `label`, `value: string` |
| 功能 | 自绘只读下拉选择样式字段，底层为原生 `<select>` + Lucide chevron overlay |
| CSS 类 | `.field`, `.selectShell`, `.select`, `.selectIcon` |

### 1.7 Switch

| 字段 | 值 |
|------|-----|
| 导出名 | `Switch` |
| 文件 | `ui/switch.tsx` |
| Props | `checked?`, `defaultChecked?`, `ariaLabel?`, `className?`, `onCheckedChange?`, `size?: "sm" \| "md"` |
| 功能 | 可交互开关（受控/非受控） |
| CSS 类 | `.switch`, `.switchThumb` |

### 1.8 SwitchRow

| 字段 | 值 |
|------|-----|
| 导出名 | `SwitchRow` |
| 文件 | `ui/switch-row.tsx` |
| Props | `title`, `subtitle` |
| 功能 | 开关行（纯展示，无真实 toggle） |
| CSS 类 | `.switchRow`, `.switchText`, `.switch`, `.switchThumb` |

### 1.9 SegmentedControl

| 字段 | 值 |
|------|-----|
| 导出名 | `SegmentedControl<T>` |
| 文件 | `ui/segmented-control.tsx` |
| Props | `items: Array<SegmentedControlItem<T>>`, `value: T`, `onChange`, `ariaLabel?`, `role?: "tablist" \| "radiogroup"`, `panel?`, `compact?`, `className?` |
| 功能 | 通用分段控制器，支持 tab/radio 角色、面板模式、紧凑模式 |
| CSS 类 | `.segmentedControl`, `.segmentedControlPanel`, `.segmentedControlCompact`, `.segmentedItem`, `.segmentedItemActive`, `.segmentedCount` |

### 1.10 DemoTabs

| 字段 | 值 |
|------|-----|
| 导出名 | `DemoTabs<T>` |
| 文件 | `ui/demo-tabs.tsx` |
| Props | `tabs: Array<{ key: T; label: string; count?: number }>`, `value: T`, `onChange: (next: T) => void` |
| 功能 | 通用 Tab 切换器，基于 SegmentedControl，支持 count 徽章 |
| CSS 类 | 同 SegmentedControl |

### 1.11 MetricCard

| 字段 | 值 |
|------|-----|
| 导出名 | `MetricCard` |
| 文件 | `ui/metric-card.tsx` |
| Props | `icon: RouteIcon`, `label`, `value: string \| number`, `meta: string`, `tone?` |
| 功能 | 指标卡片（图标 + 标签 + 数值 + 描述） |
| CSS 类 | `.metric`, `.metricLabel`, `.metricValue`, `.metricMeta` |

### 1.12 EmptyRows

| 字段 | 值 |
|------|-----|
| 导出名 | `EmptyRows` |
| 文件 | `ui/empty-rows.tsx` |
| Props | `label: string` |
| 功能 | 空状态文字 |
| CSS 类 | `.empty` |

### 1.13 OperationStateStrip

| 字段 | 值 |
|------|-----|
| 导出名 | `OperationStateStrip` |
| 文件 | `ui/operation-state-strip.tsx` |
| Props | `items: Array<{ label; value; tone? }>` |
| 功能 | 横向操作状态条（多 label + value + 色调指示） |
| CSS 类 | `.operationStateStrip`, `.operationStateItem`, `.operationStateSuccess/Warning/Error` |

### 1.14 SectionTabs

| 字段 | 值 |
|------|-----|
| 导出名 | `SectionTabs` |
| 文件 | `section-editor-controls.tsx` |
| Props | `tabs: TabDef[]`, `value: SectionTabValue`, `onChange` |
| 功能 | 小节编辑器的专用 Tab 栏 |
| CSS 类 | `.sectionTabs`, `.sectionTab`, `.sectionTabActive`, `.sectionTabCount` |

### 1.15 SectionNameEditor

| 字段 | 值 |
|------|-----|
| 导出名 | `SectionNameEditor` |
| 文件 | `section-editor-header.tsx` |
| Props | `initialName`, `onChange?`, `onSavingChange?` |
| 功能 | 点击编辑小节名（debounced save） |
| CSS 类 | `.sectionNameDisplay`, `.sectionNamePencil`, `.sectionNameInput` |

### 1.16 SaveStatusPill

| 字段 | 值 |
|------|-----|
| 导出名 | `SaveStatusPill` |
| 文件 | `section-editor-header.tsx` |
| Props | `status: SaveStatus` |
| 功能 | 保存状态指示（idle / saving / saved） |
| CSS 类 | `.savePill`, `.savePillSpinner` |

### 1.17 SpecSection / SpecRow

| 字段 | 值 |
|------|-----|
| 导出名 | `SpecSection`, `SpecRow` |
| 文件 | `section-editor-controls.tsx` |
| Props | `title`, `hint?`, `label`, `description?`, `children` |
| 功能 | 参数表单的分组和行布局 |
| CSS 类 | `.specSection`, `.specSectionHead`, `.specRows`, `.specRow`, `.specRowLabel`, `.specRowControl` |

### 1.18 CheckpointPicker

| 字段 | 值 |
|------|-----|
| 导出名 | `CheckpointPicker` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value`, `projectCheckpoint?`, `options: string[]`, `onChange?` |
| 功能 | Checkpoint 下拉选择器，支持"继承项目"标记 |
| CSS 类 | `.cpPicker`, `.cpPickerBtn`, `.cpPickerValue`, `.cpInheritTag`, `.cpPickerMenu`, `.cpPickerOption` |

### 1.19 AspectChips

| 字段 | 值 |
|------|-----|
| 导出名 | `AspectChips` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value: string`, `onChange: (v: string) => void` |
| 功能 | 画幅比例芯片组选择器（1:1, 2:3, 3:2 等） |
| CSS 类 | `.aspectChips`, `.aspectChip`, `.aspectChipActive` |

### 1.20 StepperInput

| 字段 | 值 |
|------|-----|
| 导出名 | `StepperInput` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value`, `onChange`, `min?`, `max?`, `step?`, `width?`, `decrementSteps?`, `incrementSteps?`, `ariaLabel?` |
| 功能 | 可手动输入的步进数值输入，支持两侧配置多个固定增减按钮 |
| CSS 类 | `.stepper`, `.stepperControls`, `.stepperBtn`, `.stepperInput` |

### 1.21 DimensionsReadout

| 字段 | 值 |
|------|-----|
| 导出名 | `DimensionsReadout` |
| 文件 | `section-editor-controls.tsx` |
| Props | `aspect`, `shortSide`, `upscale` |
| 功能 | 图像尺寸计算与展示（基础尺寸 → 最终尺寸） |
| CSS 类 | `.dimReadout`, `.dimReadoutBase`, `.dimReadoutArrow`, `.dimReadoutFinal` |

### 1.22 UpscaleControl

| 字段 | 值 |
|------|-----|
| 导出名 | `UpscaleControl` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value: number`, `onChange: (v: number) => void` |
| 功能 | 放大倍数芯片组 + 1× 警告 |
| CSS 类 | `.upscaleControl`, `.upscaleChips`, `.upscaleWarning` |

### 1.23 KSamplerCard

| 字段 | 值 |
|------|-----|
| 导出名 | `KSamplerCard` |
| 文件 | `section-editor-controls.tsx` |
| Props | `label`, `hint?`, `params: KSamplerFull`, `disabled?`, `onChange?` |
| 功能 | KSampler 参数卡片（steps, cfg, denoise, sampler, scheduler, seed） |
| CSS 类 | `.ksCard`, `.ksCardHead`, `.ksGrid`, `.ksCardDisabled` |

### 1.24 SelectChip

| 字段 | 值 |
|------|-----|
| 导出名 | `SelectChip` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value: string`, `options: string[]`, `onChange: (v: string) => void` |
| 功能 | 芯片式下拉选择器 |
| CSS 类 | `.selectChip`, `.selectChipBtn`, `.selectChipMenu`, `.selectChipOption` |

### 1.25 VariantSwitcher

| 字段 | 值 |
|------|-----|
| 导出名 | `VariantSwitcher` |
| 文件 | `section-editor-controls.tsx` |
| Props | `variants: Array<{ id; name }>`, `currentVariantId`, `onChange?` |
| 功能 | 变体切换下拉 |
| CSS 类 | `.variantSwitcher`, `.variantSwitcherBtn`, `.variantSwitcherMenu`, `.variantSwitcherOption` |

### 1.26 SvgIcon / createSvgIcon / createSvgIconFromString / createSvgIconFromUrl

| 字段 | 值 |
|------|-----|
| 导出名 | `SvgIcon`, `createSvgIcon`, `createSvgIconFromString`, `createSvgIconFromUrl` |
| 文件 | `svg-icon.tsx` |
| Props | `SvgIcon`: `viewBox?`, `fill?`, `children`, `className?`, `size?`, `color?`, `strokeWidth?`, `style?`；`createSvgIcon`: `displayName?`, `viewBox?`, `fill?`, `defaultStrokeWidth?`, `children`；`createSvgIconFromString`: `displayName?`, `svg`, `defaultStrokeWidth?`；`createSvgIconFromUrl`: `displayName?`, `href`, `viewBox?` |
| 功能 | 自定义 SVG 图标系统，与 Lucide 图标完全兼容。`SvgIcon` 为基础组件，`createSvgIcon` 从 JSX 子元素创建，`createSvgIconFromString` 从原始 SVG 字符串创建，`createSvgIconFromUrl` 从 SVG 文件 URL 创建 |
| CSS 类 | 无自定义 CSS 类，通过 `className` / `style` 透传 |

---

## 2. 中组件

### 2.1 PageHeader

| 字段 | 值 |
|------|-----|
| 导出名 | `PageHeader` |
| 文件 | `ui/page-header.tsx` |
| Props | `back?: { href; label }`, `eyebrow`, `title`, `subtitle?`, `actions?`, `className?` |
| 功能 | 页面顶部标题栏（返回链接 + eyebrow + 标题 + 副标题 + 操作区），被所有页面复用 |
| CSS 类 | `.pageHeader`, `.pageTitleBlock`, `.pageBackLink`, `.eyebrow`, `.pageTitle`, `.pageSubtitle`, `.toolbar` |

### 2.2 Panel

| 字段 | 值 |
|------|-----|
| 导出名 | `Panel` |
| 文件 | `ui/panel.tsx` |
| Props | `title`, `subtitle?`, `actions?`, `children` |
| 功能 | 面板容器（标题 + 副标题 + 操作 + 内容） |
| CSS 类 | `.panel`, `.panelHeader`, `.panelBody`, `.inlineControls` |

### 2.3 RouteTable

| 字段 | 值 |
|------|-----|
| 导出名 | `RouteTable` |
| 文件 | `ui/route-table.tsx` |
| Props | `data: DemoData` |
| 功能 | 完整页面路径表格 |
| CSS 类 | `.tableWrap`, `.table` |

### 2.4 DemoFeedbackProvider / DemoToastStack

| 字段 | 值 |
|------|-----|
| 导出名 | `DemoFeedbackProvider` (内部: `DemoToastStack`) |
| 文件 | `ui/feedback/index.tsx` |
| Props | `children` |
| 功能 | Toast 提示的 Context Provider，最多 3 条 |
| CSS 类 | `.toastStack`, `.toast`, `.toastSuccess`, `.toastWarning`, `.toastError` |

### 2.5 EmptyPage

| 字段 | 值 |
|------|-----|
| 导出名 | `EmptyPage` |
| 文件 | `ui/empty-page.tsx` |
| Props | `title: string` |
| 功能 | 空状态页面 |
| CSS 类 | `.page`, `.empty` |

### 2.6 ProjectDetailHeader

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectDetailHeader` |
| 文件 | `projects/project-detail-header.tsx` |
| Props | `isResultView`, `project: DemoProject`, `subtitle`, `view: ProjectCardView` |
| 功能 | 项目详情页头部（返回链接 + 标题 + 视图切换 + 命令栏 + 运行控制） |
| CSS 类 | `.projectDetailHeader`, `.projectHeaderTop`, `.projectTitleRow`, `.projectTitleEdit`, `.projectHeaderControls`, `.projectCommandBar`, `.projectCommandSecondary`, `.projectRunCluster` |

### 2.7 ProjectBatchBar

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectBatchBar` |
| 文件 | `projects/project-folders.tsx` |
| Props | `folders`, `selectedCount`, `totalCount`, `onClear`, `onMove`, `onSelectAll` |
| 功能 | 项目批量操作栏（已选计数 + 移动菜单 + 全选/清除） |
| CSS 类 | `.projectBatchBar` |

### 2.8 ProjectMoveMenu

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectMoveMenu` |
| 文件 | `projects/project-folders.tsx` |
| Props | `currentFolderId`, `folders`, `label?`, `onMove` |
| 功能 | 项目移动到文件夹的下拉菜单 |
| CSS 类 | `.projectMoveMenu`, `.projectMoveMenuList` |

### 2.9 ProjectFolderBreadcrumb

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectFolderBreadcrumb` |
| 文件 | `projects/project-folders.tsx` |
| Props | `breadcrumb: DemoProjectFolder[]`, `onNavigate` |
| 功能 | 项目文件夹面包屑导航 |
| CSS 类 | `.projectFolderBreadcrumbs` |

### 2.10 QueueMetrics

| 字段 | 值 |
|------|-----|
| 导出名 | `QueueMetrics` |
| 文件 | `runs/queue-metrics.tsx` |
| Props | `pendingImages`, `reviewGroups`, `runningCount`, `failedCount` |
| 功能 | 队列指标卡片区（待审/队列/失败） |
| CSS 类 | `.metricGrid` |

### 2.11 CurrentRunningProgressCard

| 字段 | 值 |
|------|-----|
| 导出名 | `CurrentRunningProgressCard` |
| 文件 | `runs/current-running-progress-card.tsx` |
| Props | `runs: DemoCurrentRun[]` |
| 功能 | 当前运行任务的进度卡片列表（项目名 + 小节 + 进度条 + 已用/剩余时间） |
| CSS 类 | `.currentRunSurface`, `.currentRunHeader`, `.currentRunList`, `.currentRunItem`, `.currentRunTitleBlock`, `.currentRunProgressBlock`, `.currentRunProgressTop`, `.currentRunProgressTrack`, `.currentRunProgressFill`, `.currentRunMeta` |

### 2.12 ReviewMetaCard

| 字段 | 值 |
|------|-----|
| 导出名 | `ReviewMetaCard` |
| 文件 | `runs/review-meta-card.tsx` |
| Props | `section`, `run: DemoRun`, `meta: Record<string, unknown> \| null` |
| 功能 | 审核元数据卡片（可展开/折叠，展示 KSampler/LoRA/Prompt 等参数） |
| CSS 类 | `.reviewMetaSurface`, `.reviewMetaHeader`, `.reviewMetaSummary`, `.reviewMetaChevron` |

### 2.13 PendingReviewGroups

| 字段 | 值 |
|------|-----|
| 导出名 | `PendingReviewGroups` |
| 文件 | `runs/pending-review-groups.tsx` |
| Props | `data: DemoData` |
| 功能 | 待审核分组（按项目分组展示待审任务） |
| CSS 类 | 复用 ReviewImageBoard 等 |

### 2.14 PresetCategorySidebar（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetCategorySidebar`（内部） |
| 文件 | `presets/library-page.tsx` |
| Props | `categories: DemoCategory[]`, `selectedCategory: DemoCategory`, `onSelect` |
| 功能 | 预设分类侧边栏（新建 + 分类列表 + 拖拽 + 编辑/删除） |
| CSS 类 | `.presetCategorySidebar`, `.presetCategoryHeader`, `.presetCategoryList`, `.presetCategoryItem`, `.presetCategoryItemActive`, `.presetCategoryRow`, `.presetCategorySelect`, `.categorySwatch`, `.presetCategoryText`, `.presetCategoryActions` |

### 2.15 PresetCategoryEditor（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetCategoryEditor`（内部） |
| 文件 | `presets/category-form-page.tsx` |
| Props | `category: DemoCategory \| null`, `categories: DemoCategory[]` |
| 功能 | 分类编辑器（类型切换 + 名称 + 色相 + 插槽预览 + 危险区） |
| CSS 类 | `.categoryEditor`, `.categoryEditorHeader`, `.categoryTypeSwitch`, `.categoryTypeButton`, `.categoryTypeButtonActive`, `.categoryEditorGrid`, `.hueControl`, `.hueSlider`, `.slotEditor`, `.slotEditorHeader`, `.slotRow`, `.categoryEditorFooter`, `.categoryDangerZone`, `.inlineNotice`, `.inlineNoticeWarn` |

### 2.16 PresetFolderBrowser（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetFolderBrowser`（内部） |
| 文件 | `presets/library-page.tsx` |
| Props | `category`, `selectedFolderId`, `onSelectFolder` |
| 功能 | 预设文件夹浏览器（面包屑 + 文件夹行列表） |
| CSS 类 | `.presetFolderBar`, `.presetFolderBreadcrumbs`, `.presetFolderGrid`, `.presetFolderRow` |

### 2.17 SortRulePanel（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `SortRulePanel`（内部） |
| 文件 | `presets/sort-rules-page.tsx` |
| Props | `title: string`, `rules: SortRule[]` |
| 功能 | 单维度排序规则面板（标题 + 可拖拽规则列表 + 新增按钮） |
| CSS 类 | `.sortRulePanel`, `.sortRuleHeader`, `.sortRuleList`, `.sortRuleRow`, `.sortRuleFooter` |

---

## 3. 图片组件

### 3.1 ImageThumbSmall

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageThumbSmall` |
| 文件 | `ui/image-thumb-small.tsx` |
| Props | `image: DemoImage`, `priority?`, `wide?` |
| 功能 | 小缩略图（用于列表行内） |
| CSS 类 | `.imageThumbSmall`, `.imageThumbSmallWide` |

### 3.2 ImageThumbMedium

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageThumbMedium` |
| 文件 | `ui/image-thumb-medium.tsx` |
| Props | `image`, `actionSlot?`, `onOpen?`, `onSelect?`, `priority?`, `selectable?`, `selected?`, `showStatus?`, `tags?` |
| 功能 | 中缩略图（可选中、有标签、有操作区） |
| CSS 类 | `.imageThumbMedium`, `.imageThumbMediumSelected`, `.imageThumbSelect`, `.imageThumbTags`, `.imageThumbImageButton`, `.imageThumbOverlay`, `.imageThumbActions` |

### 3.3 ImageStrip

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageStrip` |
| 文件 | `ui/image-strip.tsx` |
| Props | `images: DemoImage[]`, `wide?` |
| 功能 | 横向滚动图片条（紧凑型） |
| CSS 类 | `.imageStrip` |

### 3.4 ImageListSmall

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageListSmall` |
| 文件 | `ui/image-list-small.tsx` |
| Props | `images`, `className?`, `limit?`, `maxWidth?`, `wide?` |
| 功能 | 横向滚动小图列表 |
| CSS 类 | `.imageListSmallFrame`, `.imageListSmall` |

### 3.5 ImageListMedium

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageListMedium` |
| 文件 | `ui/image-list-medium.tsx` |
| Props | `actionPanel?`, `children`, `className?`, `defaultExpanded?`, `emptyLabel?`, `gap?`, `maxHeight?`, `maxWidth?`, `selectPanel?`, `summary?` |
| 功能 | 中图网格列表（可折叠、有摘要/选择/操作面板） |
| CSS 类 | `.imageListMedium`, `.imageListMediumMain`, `.imageListMediumHeader`, `.imageListMediumGrid`, `.imageListMediumViewport`, `.imageListMediumFade`, `.imageListMediumExpand`, `.imageListMediumActionTrack`, `.imageListMediumActionPanel` |

### 3.6 ImageGrid

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageGrid` |
| 文件 | `ui/image-grid.tsx` |
| Props | `images: DemoImage[]`, `showStatus?`, `selectable?` |
| 功能 | 图片网格 + Lightbox 预览 |
| CSS 类 | 复用 `ImageListMedium` + `ImagePreviewLarge` |

### 3.7 ReviewImageBoard

| 字段 | 值 |
|------|-----|
| 导出名 | `ReviewImageBoard` |
| 文件 | `ui/review-image-board.tsx` |
| Props | `images: DemoImage[]` |
| 功能 | 审核图片面板（选择 + 批量操作 + Lightbox） |
| CSS 类 | `.reviewControlStrip` + 复用 `ImageListMedium` / `ImagePreviewLarge` |

### 3.8 ImagePreviewFrame (internal)

| 字段 | 值 |
|------|-----|
| 导出名 | `ImagePreviewFrame`（内部） |
| 文件 | `ui/image-preview-frame.tsx` |
| Props | `image`, `interactive?`, `onOpen?`, `priority?` |
| 功能 | 图片预览帧（支持缩放、拖拽、双击重置） |
| CSS 类 | `.imagePreviewFrame`, `.imagePreviewFrameInteractive`, `.imagePreviewFrameZoomed`, `.imagePreviewFrameDragging`, `.imageFill`, `.imagePreviewInteractiveImage` |

### 3.9 ImagePreviewLarge (Lightbox)

| 字段 | 值 |
|------|-----|
| 导出名 | `ImagePreviewLarge` |
| 文件 | `ui/image-preview-large.tsx` |
| Props | `actions?`, `image`, `meta?`, `onClose`, `onNext?`, `onPrevious?`, `nextDisabled?`, `previousDisabled?`, `title?` |
| 功能 | 全屏 Lightbox 预览 |
| CSS 类 | `.lightboxOverlay`, `.lightboxPanel`, `.lightboxChrome`, `.lightboxImage`, `.lightboxFooter`, `.lightboxNavigation`, `.lightboxActions` |

---

## 4. Shell / 布局组件

### 4.1 DesignDemoShell

| 字段 | 值 |
|------|-----|
| 导出名 | `DesignDemoShell` |
| 文件 | `design-demo-shell.tsx` |
| Props | `children`, `currentRoute`, `data: DemoData` |
| 功能 | Demo 全局 Shell（主题切换、SFW 模式、侧边栏折叠、移动端顶栏/底栏） |
| CSS 类 | `.shell`, `.shellLight`, `.workspace`, `.workspaceCollapsed`, `.main` |

### 4.2 Sidebar (internal)

| 字段 | 值 |
|------|-----|
| 导出名 | `Sidebar`（内部） |
| 文件 | `design-demo-shell.tsx` |
| Props | `collapsed`, `data`, `currentRoute`, `open`, `onClose`, `onToggleCollapsed`, `theme`, `onToggleTheme`, `sfwMode`, `onToggleSfwMode` |
| 功能 | 侧边栏（品牌 + 导航分组 + 主题/SFW 切换） |
| CSS 类 | `.sidebar`, `.sidebarCollapsed`, `.sidebarOpen`, `.brand`, `.brandTop`, `.brandIdentity`, `.brandName`, `.brandMark`, `.navSection`, `.navTitle`, `.navLink`, `.navLinkActive`, `.navCount`, `.sidebarTools`, `.sidebarToggle`, `.sidebarToggleSwitch`, `.sidebarToggleActive`, `.sidebarCollapseButton` |

### 4.3 MobileTopbar (internal)

| 字段 | 值 |
|------|-----|
| 导出名 | `MobileTopbar`（内部） |
| 文件 | `design-demo-shell.tsx` |
| Props | `activeLabel`, `menuOpen`, `onOpenMenu`, `toolsOpen`, `onToggleTools`, `theme`, `onToggleTheme`, `sfwMode`, `onToggleSfwMode` |
| 功能 | 移动端顶部栏 |
| CSS 类 | `.mobileTopbar`, `.mobileTopbarTitle`, `.mobileTopbarTools`, `.mobileTopbarButton`, `.mobileToolsMenu`, `.mobileToolsItem`, `.mobileToolsItemActive` |

### 4.4 MobileBottomNav (internal)

| 字段 | 值 |
|------|-----|
| 导出名 | `MobileBottomNav`（内部） |
| 文件 | `design-demo-shell.tsx` |
| Props | `data`, `currentRoute`, `moreOpen`, `onMore` |
| 功能 | 移动端底部导航栏 |
| CSS 类 | `.mobileBottomNav`, `.mobileBottomItem`, `.mobileBottomItemActive` |

### 4.5 DesignDemoApp

| 字段 | 值 |
|------|-----|
| 导出名 | `DesignDemoApp` |
| 文件 | `design-demo-client.tsx` |
| Props | `initialRouteSegments: string[]`, `data: DemoData` |
| 功能 | 路由根组件，根据 pathname 渲染对应页面 |

---

## 5. Section Editor 组件

### 5.1 SectionHeader

| 字段 | 值 |
|------|-----|
| 导出名 | `SectionHeader` |
| 文件 | `section-editor-header.tsx` |
| Props | `backHref`, `backLabel`, `prev/next`, `workflowDownloadHref`, `initialName`, `saveStatus`, `onSavingChange`, `onRename`, `batchSize`, `onBatchSizeChange`, `onRun` |
| 功能 | 小节编辑器顶部（返回 + 名称编辑 + 保存状态 + 前后导航 + workflow 下载 + 运行控制） |
| CSS 类 | `.sectionHeader`, `.sectionHeaderTop`, `.sectionHeaderBack`, `.sectionHeaderEyebrow`, `.sectionHeaderSpacer`, `.sectionHeaderNav`, `.sectionHeaderNavBtn`, `.sectionHeaderNavBtnDisabled`, `.sectionHeaderNavLabel`, `.sectionHeaderGhostBtn`, `.sectionRunDock`, `.sectionRunStepper`, `.sectionRunBatchOption`, `.sectionRunBatchOptionActive`, `.sectionRunBatchLabel`, `.sectionRunButton` |

### 5.2 SectionEditorShell

| 字段 | 值 |
|------|-----|
| 导出名 | `SectionEditorShell` |
| 文件 | `section-editor/section-editor-shell.tsx` |
| Props | `SectionEditorLoadedProps` |
| 功能 | 小节编辑器 Shell（Tab 栏 + 内容面板 + 空状态） |
| CSS 类 | `.page`, `.sectionTabBody` |

### 5.3 ParamsPanel

| 字段 | 值 |
|------|-----|
| 导出名 | `ParamsPanel` |
| 文件 | `section-editor/params-panel.tsx` |
| Props | `editor: SectionEditorModel` |
| 功能 | 参数 Tab 面板（Checkpoint / 画幅 / 步数 / CFG 等） |
| CSS 类 | 复用 SpecSection / SpecRow / StepperInput 等 |

### 5.4 PresetsPanel

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetsPanel` |
| 文件 | `section-editor/presets-panel.tsx` |
| Props | `editor: SectionEditorModel` |
| 功能 | 预制 Tab 面板（绑定列表 + 导入面板） |
| CSS 类 | 复用 PresetBindingRow / PresetImportInline 等 |

### 5.5 PromptsPanel

| 字段 | 值 |
|------|-----|
| 导出名 | `PromptsPanel` |
| 文件 | `section-editor/prompts-panel.tsx` |
| Props | `editor: SectionEditorModel` |
| 功能 | 提示词 Tab 面板（两列布局 + 编译预览） |
| CSS 类 | `.promptTabBody`, `.promptTwoColumn` |

### 5.6 LoraPanel

| 字段 | 值 |
|------|-----|
| 导出名 | `LoraPanel` |
| 文件 | `section-editor/lora-panel.tsx` |
| Props | `editor: SectionEditorModel` |
| 功能 | LoRA Tab 面板（双列 LoRA + 历史 diff） |
| CSS 类 | `.loraPair` |

### 5.7 HistoryPanel

| 字段 | 值 |
|------|-----|
| 导出名 | `HistoryPanel` |
| 文件 | `section-editor/history-panel.tsx` |
| Props | `editor: SectionEditorModel` |
| 功能 | 历史 Tab 面板 |
| CSS 类 | 复用 HistoryDiffRow |

### 5.8 ResultsPanel

| 字段 | 值 |
|------|-----|
| 导出名 | `ResultsPanel` |
| 文件 | `section-editor/results-panel.tsx` |
| Props | `editor: SectionEditorModel` |
| 功能 | 结果 Tab 面板（筛选 + 分组 + 缩略图网格） |
| CSS 类 | `.resultsHead`, `.resultsFilter`, `.resultsFilterBtn`, `.resultsFilterBtnActive`, `.runGroup`, `.runGroupHead`, `.runGroupNumber`, `.runGroupTime`, `.runGroupStats`, `.runStatPill`, `.runStatKept`, `.runStatTrashed`, `.runGroupActions`, `.resultThumbAction` |

### 5.9 LightboxPreview

| 字段 | 值 |
|------|-----|
| 导出名 | `LightboxPreview` |
| 文件 | `section-editor/lightbox-preview.tsx` |
| Props | `editor: SectionEditorModel` |
| 功能 | 编辑器内 Lightbox 预览面板 |
| CSS 类 | 复用 ImagePreviewLarge |

### 5.10 MissingSectionState

| 字段 | 值 |
|------|-----|
| 导出名 | `MissingSectionState` |
| 文件 | `section-editor/missing-section-state.tsx` |
| Props | 无 |
| 功能 | 未选择小节时的空状态 |
| CSS 类 | 复用 EmptyPage |

### 5.11 PresetBindingRow

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetBindingRow` |
| 文件 | `section-editor-presets.tsx` |
| Props | `binding: PresetBinding`, `onVariantChange?`, `onCopyName?`, `onUnlink?`, `onDelete?` |
| 功能 | 预制绑定行（名称 + 分类色 + 变体切换 + 展开/折叠组内成员 + 操作） |
| CSS 类 | `.bindRow`, `.bindRowMain`, `.bindNameWrap`, `.bindName`, `.bindCategory`, `.bindGroupChip`, `.bindScopeChip`, `.bindMeta`, `.bindRowControls`, `.bindChevron`, `.bindList` |

### 5.12 PresetImportInline

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetImportInline` |
| 文件 | `section-editor-presets.tsx` |
| Props | `open`, `categories: ImportCategory[]`, `selected?`, `onSelect` |
| 功能 | 行内预制导入面板（分类选择 → 文件夹 → 预制/组选择） |
| CSS 类 | `.importPanel`, `.importCategoryColumn`, `.importPresetColumn`, `.importHeaderActions` |

### 5.13 PromptBlockRow

| 字段 | 值 |
|------|-----|
| 导出名 | `PromptBlockRow` |
| 文件 | `section-editor-prompts.tsx` |
| Props | `block: PromptBlockRowData`, `expanded`, `onToggle`, `onLabelChange?`, `onPositiveChange?`, `onNegativeChange?`, `onUnlink?`, `onDelete?` |
| 功能 | 提示词块行（折叠/展开、分类色标记、预设来源标识、正负向文本） |
| CSS 类 | `.pbRow`, `.pbRowGrip`, `.pbCategory`, `.pbRowMain`, `.pbRowTitleLine`, `.pbRowPreview`, `.pbRowManualMark` |

### 5.14 CompiledPromptPreview

| 字段 | 值 |
|------|-----|
| 导出名 | `CompiledPromptPreview` |
| 文件 | `section-editor-prompts.tsx` |
| Props | `groups` |
| 功能 | 编译后的 Prompt 预览（按预制分组展示正负向） |

### 5.15 LoraRow

| 字段 | 值 |
|------|-----|
| 导出名 | `LoraRow` |
| 文件 | `section-editor-lora-history.tsx` |
| Props | `entry: LoraRowData`, `fileOptions: string[]`, `onWeightChange`, `onToggle`, `onPathChange`, `onUnlink?`, `onDelete` |
| 功能 | LoRA 行（来源标记 + 文件选择 + 权重步进 + 启用/禁用 + 触发词） |
| CSS 类 | `.loraRow`, `.sectionLoraRow`, `.loraRowGrip`, `.loraRowMain`, `.loraRowTopLine`, `.loraSourceBadge`, `.loraPresetName`, `.loraManualBadge`, `.loraTrigger` |

### 5.16 LoraColumn

| 字段 | 值 |
|------|-----|
| 导出名 | `LoraColumn` |
| 文件 | `section-editor-lora-column.tsx` |
| Props | `label`, `entries: LoraRowData[]`, `onAdd`, `onWeight`, `onToggle`, `onPath`, `onUnlink`, `onDelete` |
| 功能 | LoRA 列容器（头部 + 列表 + 新增按钮） |
| CSS 类 | `.loraColumn`, `.loraColumnHead`, `.loraList`, `.addRow`, `.bindEmpty` |

### 5.17 HistoryDiffRow

| 字段 | 值 |
|------|-----|
| 导出名 | `HistoryDiffRow` |
| 文件 | `section-editor-lora-history.tsx` |
| Props | `change: HistoryDiffChange` |
| 功能 | 变更记录 diff 行 |
| CSS 类 | `.diffList`, `.diffRow`, `.diffEmptyState` |

---

## 6. Project 组件

### 6.1 ProjectsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectsPage` |
| 文件 | `projects/project-list-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 项目列表页（文件夹面包屑 + 文件夹行 + 项目卡片列表 + 批量操作） |
| CSS 类 | `.projectFolderWorkspace`, `.projectFolderTopbar`, `.projectFolderActions`, `.projectFolderSurface`, `.projectFolderGrid`, `.projectListGrid` |

### 6.2 ProjectDetailPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectDetailPage` |
| 文件 | `projects/project-detail-page.tsx` |
| Props | `project?: DemoProject`, `initialView?: "sections" \| "results"` |
| 功能 | 项目详情页（小节视图 / 结果视图） |
| CSS 类 | 复用 `ProjectDetailHeader` 等 |

### 6.3 ProjectSectionCard

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectSectionCard` |
| 文件 | `projects/project-section-card.tsx` |
| Props | `compact`, `index`, `project`, `section`, `selected`, `onToggleSelection` |
| 功能 | 小节卡片（拖拽手柄 + 选中 + 标题 + 缩略图 + 运行/复制/删除操作） |
| CSS 类 | `.sectionCard`, `.sectionCardCompact`, `.sectionCardSelected`, `.sectionCardMain`, `.dragHandle`, `.sectionSelectButton`, `.sectionCardContent`, `.sectionCardHeader`, `.sectionCardTitle`, `.sectionCardTitleLine`, `.sectionCardBody`, `.sectionCardActions`, `.sectionRunControl` |

### 6.4 ProjectSectionResultCard

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectSectionResultCard` |
| 文件 | `projects/project-result-card.tsx` |
| Props | `collapsed`, `images`, `index`, `onToggleCollapsed`, `section` |
| 功能 | 小节结果卡片（标题 + 状态标签 + 操作栏 + 图片列表） |
| CSS 类 | `.resultSectionBlock`, `.resultSectionHeader`, `.resultSectionTitle`, `.sectionCardTitleLine`, `.resultSectionActions`, `.resultActionBar` |

### 6.5 ProjectResultsToolbar

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectResultsToolbar` |
| 文件 | `projects/project-result-card.tsx` |
| Props | `results` |
| 功能 | 结果视图顶部工具栏（批量选择 + 保留/p站操作） |
| CSS 类 | `.resultActionBar` |

### 6.6 ProjectListItem

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectListItem` |
| 文件 | `projects/project-list-item.tsx` |
| Props | `folders`, `project: DemoProject`, `selected`, `onMove`, `onToggleSelected` |
| 功能 | 项目卡片（选中框 + 缩略图条 + 标题/状态 + 统计 + 更新时间 + 移动/删除操作） |
| CSS 类 | `.projectListCard`, `.projectListCardSelected`, `.projectSelectButton`, `.projectListOpenArea`, `.cardHeader`, `.projectCardTitle`, `.projectCardStats`, `.badge`, `.projectItemActions` |

### 6.7 ProjectFolderRow

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectFolderRow` |
| 文件 | `projects/project-folders.tsx` |
| Props | `folder: DemoProjectFolder`, `itemCount`, `onEnter` |
| 功能 | 文件夹行（拖拽手柄 + 文件夹图标 + 名称 + 条目数 + 进入/重命名/删除操作） |
| CSS 类 | `.projectFolderRow`, `.projectFolderGrip`, `.projectFolderOpen`, `.projectFolderRowActions` |

### 6.8 ProjectSectionShell / SectionRail

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectSectionShell` / `SectionRail` |
| 文件 | `projects/project-section-shell.tsx` / `projects/section-rail.tsx` |
| Props | `project`, `activeSection?`, `mode`, `children`, `compact?`, `onToggleCompact?` |
| 功能 | 小节列表 + 右侧导航轨道（双滚动同步） |
| CSS 类 | `.projectSectionShell`, `.projectScrollPane`, `.sectionRail`, `.railHeading`, `.railItem`, `.railItemActive` |

### 6.9 ProjectFormPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectFormPage` |
| 文件 | `projects/project-form-page.tsx` |
| Props | `project?`, `mode: "new" \| "edit"` |
| 功能 | 项目创建/编辑表单 |
| CSS 类 | `.twoCol`, `.contentGrid`, `.fieldGrid` |

---

## 7. Queue / Runs 组件

### 7.1 QueuePage

| 字段 | 值 |
|------|-----|
| 导出名 | `QueuePage` |
| 文件 | `runs/queue-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 任务工作台（待审核/队列/失败 Tab + 进度卡片 + 分页） |
| CSS 类 | `.metricGrid`, `.currentRunSurface`, `.currentRunHeader`, `.currentRunList`, `.currentRunItem`, `.currentRunTitleBlock`, `.currentRunProgressBlock`, `.currentRunProgressTop`, `.currentRunProgressTrack`, `.currentRunProgressFill`, `.currentRunMeta`, `.queueSurfaceStack`, `.queueTabsBar`, `.queueSurface`, `.queueSurfaceHeader`, `.queueRunList`, `.queueProjectGroup`, `.queueProjectHeader`, `.queueProjectChevronCollapsed`, `.queueProjectRows`, `.queueRunRow`, `.queueRunMain`, `.queueRunDate`, `.queuePager`, `.pagerInfoFull`, `.pagerInfoCompact` |

### 7.2 RunList

| 字段 | 值 |
|------|-----|
| 导出名 | `RunList` |
| 文件 | `runs/run-list.tsx` |
| Props | `title`, `runs: DemoRun[]`, `empty`, `mode`, `collapsedGroups`, `onToggleGroup` |
| 功能 | 运行列表（全选/取消 + 批量操作） |
| CSS 类 | `.queueRunRowSelectable`, `.queueRunRowSelected`, `.queueRowCheck`, `.queueRunError`, `.queueRunErrorAction`, `.queueRunErrorCopy` |

### 7.3 ReviewPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ReviewPage` |
| 文件 | `runs/review-page.tsx` |
| Props | `data: DemoData`, `run?: DemoRun` |
| 功能 | 单次运行审核页（参数信息卡片 + 图片审核面板） |
| CSS 类 | `.reviewPageHeader`, `.reviewMetaSurface`, `.reviewMetaHeader`, `.reviewMetaSummary`, `.reviewMetaChevron`, `.reviewMetaBody`, `.reviewSamplerGrid`, `.reviewSamplerBlock`, `.reviewMetaLine`, `.reviewMetaStat`, `.reviewLoraGrid`, `.reviewLoraColumn`, `.reviewPromptGrid`, `.reviewSurface` |

### 7.4 DemoPager

| 字段 | 值 |
|------|-----|
| 导出名 | `DemoPager` |
| 文件 | `runs/demo-pager.tsx` |
| Props | `currentPage`, `totalPages` |
| 功能 | 分页器 |
| CSS 类 | `.pagerControls`, `.pagerButton`, `.pagerButtonActive`, `.pagerChunk`, `.pagerEllipsis` |

### 7.5 SamplerMetaBlock（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `SamplerMetaBlock`（内部） |
| 文件 | `runs/review-meta-card.tsx` |
| Props | `meta: Record<string, unknown>`, `stage: 1 \| 2` |
| 功能 | KSampler 参数展示块（seed/steps/cfg/denoise/sampler） |
| CSS 类 | `.reviewSamplerBlock` |

### 7.6 MetaStat（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `MetaStat`（内部） |
| 文件 | `runs/review-meta-card.tsx` |
| Props | `label: string`, `value: React.ReactNode` |
| 功能 | 元数据标签-值行 |
| CSS 类 | `.reviewMetaStat` |

### 7.7 ReviewExecutionMeta（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `ReviewExecutionMeta`（内部） |
| 文件 | `runs/review-meta-card.tsx` |
| Props | `meta: Record<string, unknown>` |
| 功能 | 执行元数据展示（KSampler 网格 + LoRA 网格 + Prompt 预览） |
| CSS 类 | `.reviewMetaBody`, `.reviewSamplerGrid`, `.reviewMetaLine`, `.reviewLoraGrid`, `.reviewLoraColumn`, `.reviewPromptGrid` |

---

## 8. Preset 组件

### 8.1 PresetsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetsPage` |
| 文件 | `presets/library-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 预设库页面（分类侧边栏 + 文件夹浏览 + 条目列表 + 批量移动） |
| CSS 类 | `.presetManagerLayout`, `.presetWorkArea`, `.presetWorkspaceHeader`, `.presetContextBar`, `.presetBatchBar`, `.presetLibrarySurface`, `.presetItemList`, `.presetItemRow`, `.presetItemRowSelected`, `.presetItemCheck`, `.presetItemOpenArea`, `.presetItemMain`, `.presetItemMeta`, `.presetItemArrow` |

### 8.2 PresetCategoryFormPage

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetCategoryFormPage` |
| 文件 | `presets/category-form-page.tsx` |
| Props | `data`, `category?`, `mode` |
| 功能 | 分类新建/编辑页 |
| CSS 类 | `.categoryFormLayout`, `.categoryFormSurface` |

### 8.3 PresetEditPage

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetEditPage` |
| 文件 | `presets/preset-edit-page.tsx` |
| Props | `data`, `preset?` |
| 功能 | 预设编辑页（基础信息 + 变体编辑 + LoRA + 关联变体 + 变更历史 + 侧边栏） |
| CSS 类 | `.presetEditorShell`, `.editorSurface`, `.editorStickyHeader`, `.editorIdentity`, `.editorBlock`, `.editorBlockHeader`, `.editorAside`, `.presetVariantWorkbench`, `.presetVariantRail`, `.presetVariantButton`, `.presetVariantButtonActive`, `.presetVariantEditor`, `.promptColumns`, `.loraStageGrid`, `.loraStage`, `.loraRow`, `.presetLinkedList`, `.presetLinkedRow`, `.historyDiffList`, `.historyDiffRow`, `.editorStatusStrip`, `.presetCascadeState`, `.inlineToast` |

### 8.4 PresetGroupPage

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetGroupPage` |
| 文件 | `presets/group-page.tsx` |
| Props | `data`, `group?` |
| 功能 | 预设组编辑页 |
| CSS 类 | `.presetGroupShell`, `.groupMemberList`, `.groupMemberRow`, `.groupPreviewList`, `.groupPreviewRow` |

### 8.5 SortRulesPage

| 字段 | 值 |
|------|-----|
| 导出名 | `SortRulesPage` |
| 文件 | `presets/sort-rules-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 排序规则页面（4 个维度的拖拽排序面板） |
| CSS 类 | `.sortRulesGrid`, `.sortRulePanel`, `.sortRuleHeader`, `.sortRuleList`, `.sortRuleRow`, `.sortRuleFooter` |

### 8.6 PresetMoveSheet（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetMoveSheet`（内部） |
| 文件 | `presets/library-page.tsx` |
| Props | `category`, `confirmFeedback?`, `onCancel`, `onConfirm`, `onSelect`, `selectedCount`, `selectedFolderId` |
| 功能 | 移动文件夹对话框 |
| CSS 类 | `.presetMoveBackdrop`, `.presetMoveSheet`, `.presetMoveHeader`, `.presetMoveBreadcrumbs`, `.presetMoveTargets`, `.presetMoveTarget`, `.presetMoveTargetActive`, `.presetMoveFooter` |

### 8.7 PresetFolderRows（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetFolderRows`（内部） |
| 文件 | `presets/library-page.tsx` |
| Props | `category`, `selectedFolderId`, `onSelectFolder` |
| 功能 | 预设文件夹行列表（拖拽 + 编辑 + 删除） |
| CSS 类 | `.presetFolderGrid`, `.presetFolderRow` |

### 8.8 PresetItemRows（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetItemRows`（内部） |
| 文件 | `presets/library-page.tsx` |
| Props | `items`, `selectedIds`, `onToggle` |
| 功能 | 预设条目行列表（选中 + 打开 + 元数据） |
| CSS 类 | `.presetItemList`, `.presetItemRow`, `.presetItemRowSelected`, `.presetItemCheck`, `.presetItemOpenArea`, `.presetItemMain`, `.presetItemMeta`, `.presetItemArrow` |

### 8.9 PresetLoraStage（内部）

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetLoraStage`（内部） |
| 文件 | `presets/preset-edit-page.tsx` |
| Props | `title`, `preset`, `variant`, `stage` |
| 功能 | LoRA 阶段展示（名称 + 权重 + 触发词） |
| CSS 类 | `.loraStage`, `.loraRow` |

---

## 9. Template 组件

### 9.1 TemplatesPage

| 字段 | 值 |
|------|-----|
| 导出名 | `TemplatesPage` |
| 文件 | `templates/templates-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 模板列表页 |
| CSS 类 | `.rowList`, `.templateListItem`, `.templateListMain`, `.templateListTitle`, `.templateSectionSummary`, `.templateListMeta` |

### 9.2 TemplateFormPage

| 字段 | 值 |
|------|-----|
| 导出名 | `TemplateFormPage` |
| 文件 | `templates/template-form-page.tsx` |
| Props | `template?`, `mode: "new" \| "edit"` |
| 功能 | 模板创建/编辑页 |
| CSS 类 | 复用 `editorSurface`, `editorBlock` 等 |

### 9.3 TemplateSectionPage

| 字段 | 值 |
|------|-----|
| 导出名 | `TemplateSectionPage` |
| 文件 | `templates/template-section-page.tsx` |
| Props | `template?`, `sectionIndex?` |
| 功能 | 模板小节编辑页（运行参数 + 预设绑定 + Prompt + LoRA + 导入 + 历史） |
| CSS 类 | `.templateSectionRow`, `.templateSectionRowMain`, `.templateSectionTitleLine`, `.templateSectionRowActions`, `.templateSectionList`, `.sectionMetaGrid`, `.editorSplitBlock`, `.bindingList`, `.bindingRow`, `.promptBlockList`, `.promptBlockRow`, `.promptBlockContent`, `.promptBlockTitle`, `.importPresetLayout`, `.importCategoryColumn`, `.importCategoryActive`, `.importPresetColumn` |

### 9.4 TemplateSectionShell / TemplateSectionRail

| 字段 | 值 |
|------|-----|
| 导出名 | `TemplateSectionShell`, `TemplateSectionRail` |
| 文件 | `templates/template-section-shell.tsx` |
| Props | `activeSection?`, `children`, `mode`, `template` |
| 功能 | 模板小节布局 + 右侧导航（双滚动同步） |
| CSS 类 | 复用 `projectSectionShell`, `sectionRail` 等 |

---

## 10. Model 组件

### 10.1 ModelsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ModelsPage` |
| 文件 | `models/models-page.tsx` |
| Props | 无 |
| 功能 | 模型文件管理（LoRA/Checkpoint 切换 + 面包屑 + 搜索 + 文件列表 + 详情面板 + 移动对话框） |
| CSS 类 | `.modelsLayout`, `.modelsBrowser`, `.segmented`, `.segment`, `.segmentActive`, `.breadcrumb`, `.breadcrumbItem`, `.breadcrumbActive`, `.searchBar`, `.searchInput`, `.searchClear`, `.fileList`, `.fileRow`, `.fileRowActive`, `.fileIcon`, `.fileInfo`, `.fileName`, `.fileSize`, `.fileAction`, `.emptyState`, `.detailsPanel`, `.detailsHeader`, `.detailsTitle`, `.detailsContent`, `.detailsSection`, `.detailsLabel`, `.detailsValue`, `.detailsValueMuted`, `.detailsSectionHeader`, `.detailsActions`, `.dialogOverlay`, `.dialog`, `.dialogHeader`, `.dialogTitle`, `.dialogContent`, `.dialogDescription`, `.folderTree`, `.folderTreeItem`, `.dialogFooter` |

---

## 11. System 组件

### 11.1 SettingsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `SettingsPage` |
| 文件 | `system/settings-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 设置页（链接列表 → 监控/日志） |
| CSS 类 | `.settingsLinkList`, `.settingsLinkRow`, `.settingsLinkMain`, `.settingsLinkText`, `.settingsLinkArrow` |

### 11.2 LogsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `LogsPage` |
| 文件 | `system/logs-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 日志页（应用日志/控制台 + 级别筛选 + 模块芯片 + 日志查看器） |
| CSS 类 | `.logWorkbench`, `.logFilterBar`, `.logModuleChips`, `.logModuleChip`, `.logModuleChipActive`, `.logViewerPanel`, `.logViewerHeader`, `.logViewer`, `.logLine`, `.logLineWarn`, `.logLineError`, `.logEmpty` |

### 11.3 MonitorPage

| 字段 | 值 |
|------|-----|
| 导出名 | `MonitorPage` |
| 文件 | `system/monitor-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 监控页（托管/外部切换 + 状态网格 + 启停操作 + 进程日志 + 探测结果侧边栏） |
| CSS 类 | `.monitorWorkbench`, `.monitorMain`, `.monitorControlPanel`, `.monitorHeader`, `.monitorStatusGrid`, `.monitorStatusRow`, `.monitorActions`, `.monitorLogPanel`, `.monitorAside`, `.monitorProbeBox` |

### 11.4 LoginPage

| 字段 | 值 |
|------|-----|
| 导出名 | `LoginPage` |
| 文件 | `system/login-page.tsx` |
| Props | 无 |
| 功能 | 登录页 |

### 11.5 NotFoundPage

| 字段 | 值 |
|------|-----|
| 导成名 | `NotFoundPage` |
| 文件 | `system/not-found-page.tsx` |
| Props | `route: string` |
| 功能 | 404 页面 + 路由表 |

---

## 12. Batch Create 组件

### 12.1 BatchCreatePage

| 字段 | 值 |
|------|-----|
| 导出名 | `BatchCreatePage` |
| 文件 | `batch-create/batch-create-page.tsx` |
| Props | `project?: DemoProject`, `data: DemoData` |
| 功能 | 批量创建小节（预设浏览器 + 导入列表 + 项目绑定 + 新小节参数 + 最近创建） |
| CSS 类 | `.batchCreateWorkspace`, `.batchBrowserPane`, `.batchPaneHeader`, `.batchCategoryTabs`, `.batchSearchBox`, `.batchFolderBar`, `.batchBreadcrumbs`, `.batchBrowserList`, `.batchFolderRow`, `.batchCandidateRow`, `.batchCandidateRowSelected`, `.batchCandidateMain`, `.batchCandidateMeta`, `.batchCandidateActions`, `.batchConfigPane`, `.batchConfigSection`, `.batchSectionHeader`, `.batchImportList`, `.batchImportRow`, `.batchBindingList`, `.batchBindingRow`, `.batchFormGrid`, `.batchRatioGrid`, `.batchCreatedList` |

---

## 13. 辅助 / 检查页

### 13.1 ComponentShowcaseFamilyPage(images)

| 字段 | 值 |
|------|-----|
| 导出名 | `ComponentShowcaseFamilyPage` |
| 文件 | `showcase/pages/family-page.tsx` + `showcase/pages/family-samples.tsx` |
| Props | `data: DemoData` |
| 功能 | 图片结果与审核功能族检查页（小图列表 / 中图列表 / 审核面板 / Lightbox 相关入口） |
| CSS 类 | `showcase/pages/showcase-pages.module.css` |

### 13.2 RootPage

| 字段 | 值 |
|------|-----|
| 导出名 | `RootPage` |
| 文件 | `projects/root-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 根路由，重定向到 QueuePage |

### 13.3 IconShowcasePage

| 字段 | 值 |
|------|-----|
| 导出名 | `IconShowcasePage` |
| 文件 | `icon-showcase-page.tsx` |
| Props | 无 |
| 功能 | 图标展示页（Lucide 图标全览 + 自定义 SVG 图标演示） |
| CSS 类 | `.iconListContainer`, `.iconListRow`, `.iconListHeader`, `.iconListColIcon`, `.iconListColName`, `.iconListColDesc`, `.iconListColUsage`, `.iconListTag`, `.iconListCategory` |
