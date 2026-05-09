# Demo 组件清单

> 本文档按**层级**（小组件 → 中组件 → 大组件 → 页面）整理 `design-demos` 中的全部组件，
> 包括导出名、所在文件、Props、功能描述和使用的 CSS 类。

---

## 1. 原子 / 小组件

### 1.1 Button

| 字段 | 值 |
|------|-----|
| 导出名 | `Button` |
| 文件 | `design-demo-ui.tsx` |
| Props | `children?`, `tone?: "default" \| "subtle" \| "primary" \| "pink" \| "danger"`, `icon?: RouteIcon`, `iconOnly?`, `ariaLabel?`, `onClick?`, `pressed?`, `pending?`, `disabled?`, `feedback?: DemoButtonFeedback`, `className?` |
| 功能 | 通用按钮，支持 5 种色调、图标、纯 icon、pending 旋转、点击后 toast 反馈 |
| CSS 类 | `.button`, `.buttonSubtle`, `.buttonPrimary`, `.buttonPink`, `.buttonDanger`, `.buttonIcon`, `.buttonIconOnly`, `.buttonPending`, `.buttonSpinner` |

### 1.2 ButtonLink

| 字段 | 值 |
|------|-----|
| 导出名 | `ButtonLink` |
| 文件 | `design-demo-ui.tsx` |
| Props | `href`, `children?`, `tone?`, `icon?`, `iconOnly?`, `ariaLabel?`, `className?` |
| 功能 | 按钮外观的 `<Link>`，色调与纯 icon 模式同 Button |
| CSS 类 | 同 Button |

### 1.3 StatusBadge

| 字段 | 值 |
|------|-----|
| 导出名 | `StatusBadge` |
| 文件 | `design-demo-ui.tsx` |
| Props | `status: string`, `label?: string` |
| 功能 | 状态标签，根据 status 自动着色（green / amber / red / sky） |
| CSS 类 | `.status`, `.statusGreen`, `.statusAmber`, `.statusRed`, `.statusSky` |

### 1.4 Field

| 字段 | 值 |
|------|-----|
| 导出名 | `Field` |
| 文件 | `design-demo-ui.tsx` |
| Props | `label`, `value: string \| number`, `disabled?` |
| 功能 | 只读文本输入字段 |
| CSS 类 | `.field`, `.input` |

### 1.5 TextAreaField

| 字段 | 值 |
|------|-----|
| 导出名 | `TextAreaField` |
| 文件 | `design-demo-ui.tsx` |
| Props | `label`, `value: string` |
| 功能 | 只读多行文本字段 |
| CSS 类 | `.textAreaField`, `.textarea` |

### 1.6 SelectLike

| 字段 | 值 |
|------|-----|
| 导出名 | `SelectLike` |
| 文件 | `design-demo-ui.tsx` |
| Props | `label`, `value: string` |
| 功能 | 只读下拉选择样式字段 |
| CSS 类 | `.field`, `.select` |

### 1.7 SwitchRow

| 字段 | 值 |
|------|-----|
| 导出名 | `SwitchRow` |
| 文件 | `design-demo-ui.tsx` |
| Props | `title`, `subtitle` |
| 功能 | 开关行（纯展示，无真实 toggle） |
| CSS 类 | `.switchRow`, `.switchText`, `.switch` |

### 1.8 DemoTabs

| 字段 | 值 |
|------|-----|
| 导出名 | `DemoTabs<T>` |
| 文件 | `design-demo-ui.tsx` |
| Props | `tabs: Array<{ key: T; label: string; count?: number }>`, `value: T`, `onChange: (next: T) => void` |
| 功能 | 通用 Tab 切换器，支持 count 徽章 |
| CSS 类 | `.tabs`, `.tab`, `.tabActive`, `.navCount` |

### 1.9 MetricCard

| 字段 | 值 |
|------|-----|
| 导出名 | `MetricCard` |
| 文件 | `design-demo-ui.tsx` |
| Props | `icon: RouteIcon`, `label`, `value: string \| number`, `meta: string`, `tone?` |
| 功能 | 指标卡片（图标 + 标签 + 数值 + 描述） |
| CSS 类 | `.metric`, `.metricLabel`, `.metricValue`, `.metricMeta` |

### 1.10 EmptyRows

| 字段 | 值 |
|------|-----|
| 导出名 | `EmptyRows` |
| 文件 | `design-demo-ui.tsx` |
| Props | `label: string` |
| 功能 | 空状态文字 |
| CSS 类 | `.empty` |

### 1.11 OperationStateStrip

| 字段 | 值 |
|------|-----|
| 导出名 | `OperationStateStrip` |
| 文件 | `design-demo-ui.tsx` |
| Props | `items: Array<{ label; value; tone? }>` |
| 功能 | 横向操作状态条（多 label + value + 色调指示） |
| CSS 类 | `.operationStateStrip`, `.operationStateItem`, `.operationStateSuccess/Warning/Error` |

### 1.12 SectionTabs

| 字段 | 值 |
|------|-----|
| 导出名 | `SectionTabs` |
| 文件 | `section-editor-controls.tsx` |
| Props | `tabs: TabDef[]`, `value: SectionTabValue`, `onChange` |
| 功能 | 小节编辑器的专用 Tab 栏 |
| CSS 类 | `.sectionTabs`, `.sectionTab`, `.sectionTabActive`, `.sectionTabCount` |

### 1.13 SectionNameEditor

| 字段 | 值 |
|------|-----|
| 导出名 | `SectionNameEditor` |
| 文件 | `section-editor-header.tsx` |
| Props | `initialName`, `onChange?`, `onSavingChange?` |
| 功能 | 点击编辑小节名（debounced save） |
| CSS 类 | `.sectionNameDisplay`, `.sectionNamePencil`, `.sectionNameInput` |

### 1.14 SaveStatusPill

| 字段 | 值 |
|------|-----|
| 导出名 | `SaveStatusPill` |
| 文件 | `section-editor-header.tsx` |
| Props | `status: SaveStatus` |
| 功能 | 保存状态指示（idle / saving / saved） |
| CSS 类 | `.savePill`, `.savePillSpinner` |

### 1.15 SpecSection / SpecRow

| 字段 | 值 |
|------|-----|
| 导出名 | `SpecSection`, `SpecRow` |
| 文件 | `section-editor-controls.tsx` |
| Props | `title`, `hint?`, `label`, `description?`, `children` |
| 功能 | 参数表单的分组和行布局 |
| CSS 类 | `.specSection`, `.specSectionHead`, `.specRows`, `.specRow`, `.specRowLabel`, `.specRowControl` |

### 1.16 CheckpointPicker

| 字段 | 值 |
|------|-----|
| 导出名 | `CheckpointPicker` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value`, `projectCheckpoint?`, `options: string[]`, `onChange?` |
| 功能 | Checkpoint 下拉选择器，支持"继承项目"标记 |
| CSS 类 | `.cpPicker`, `.cpPickerBtn`, `.cpPickerValue`, `.cpInheritTag`, `.cpPickerMenu`, `.cpPickerOption` |

### 1.17 AspectChips

| 字段 | 值 |
|------|-----|
| 导出名 | `AspectChips` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value: string`, `onChange: (v: string) => void` |
| 功能 | 画幅比例芯片组选择器（1:1, 2:3, 3:2 等） |
| CSS 类 | `.aspectChips`, `.aspectChip`, `.aspectChipActive` |

### 1.18 StepperInput

| 字段 | 值 |
|------|-----|
| 导出名 | `StepperInput` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value`, `onChange`, `min?`, `max?`, `step?`, `suffix?`, `width?` |
| 功能 | 步进数值输入 |
| CSS 类 | `.stepper`, `.stepperBtn`, `.stepperValue` |

### 1.19 DimensionsReadout

| 字段 | 值 |
|------|-----|
| 导出名 | `DimensionsReadout` |
| 文件 | `section-editor-controls.tsx` |
| Props | `aspect`, `shortSide`, `upscale` |
| 功能 | 图像尺寸计算与展示（基础尺寸 → 最终尺寸） |
| CSS 类 | `.dimReadout`, `.dimReadoutBase`, `.dimReadoutArrow`, `.dimReadoutFinal` |

### 1.20 UpscaleControl

| 字段 | 值 |
|------|-----|
| 导出名 | `UpscaleControl` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value: number`, `onChange: (v: number) => void` |
| 功能 | 放大倍数芯片组 + 1× 警告 |
| CSS 类 | `.upscaleControl`, `.upscaleChips`, `.upscaleWarning` |

### 1.21 KSamplerCard

| 字段 | 值 |
|------|-----|
| 导出名 | `KSamplerCard` |
| 文件 | `section-editor-controls.tsx` |
| Props | `label`, `hint?`, `params: KSamplerFull`, `disabled?`, `onChange?` |
| 功能 | KSampler 参数卡片（steps, cfg, denoise, sampler, scheduler, seed） |
| CSS 类 | `.ksCard`, `.ksCardHead`, `.ksGrid`, `.ksCardDisabled` |

### 1.22 SelectChip

| 字段 | 值 |
|------|-----|
| 导出名 | `SelectChip` |
| 文件 | `section-editor-controls.tsx` |
| Props | `value: string`, `options: string[]`, `onChange: (v: string) => void` |
| 功能 | 芯片式下拉选择器 |
| CSS 类 | `.selectChip`, `.selectChipBtn`, `.selectChipMenu`, `.selectChipOption` |

### 1.23 VariantSwitcher

| 字段 | 值 |
|------|-----|
| 导出名 | `VariantSwitcher` |
| 文件 | `section-editor-controls.tsx` |
| Props | `variants: Array<{ id; name }>`, `currentVariantId`, `onChange?` |
| 功能 | 变体切换下拉 |
| CSS 类 | `.variantSwitcher`, `.variantSwitcherBtn`, `.variantSwitcherMenu`, `.variantSwitcherOption` |

---

## 2. 中组件

### 2.1 PageHeader

| 字段 | 值 |
|------|-----|
| 导出名 | `PageHeader` |
| 文件 | `design-demo-ui.tsx` |
| Props | `back?: { href; label }`, `eyebrow`, `title`, `subtitle?`, `actions?`, `className?` |
| 功能 | 页面顶部标题栏（返回链接 + eyebrow + 标题 + 副标题 + 操作区） |
| CSS 类 | `.pageHeader`, `.pageTitleBlock`, `.pageBackLink`, `.eyebrow`, `.pageTitle`, `.pageSubtitle`, `.toolbar` |

### 2.2 Panel

| 字段 | 值 |
|------|-----|
| 导出名 | `Panel` |
| 文件 | `design-demo-ui.tsx` |
| Props | `title`, `subtitle?`, `actions?`, `children` |
| 功能 | 面板容器（标题 + 副标题 + 操作 + 内容） |
| CSS 类 | `.panel`, `.panelHeader`, `.panelBody`, `.inlineControls` |

### 2.3 RouteTable

| 字段 | 值 |
|------|-----|
| 导出名 | `RouteTable` |
| 文件 | `design-demo-ui.tsx` |
| Props | `data: DemoData` |
| 功能 | 完整页面路径表格 |
| CSS 类 | `.tableWrap`, `.table` |

### 2.4 DemoFeedbackProvider / DemoToastStack

| 字段 | 值 |
|------|-----|
| 导出名 | `DemoFeedbackProvider` (内部: `DemoToastStack`) |
| 文件 | `design-demo-ui.tsx` |
| Props | `children` |
| 功能 | Toast 提示的 Context Provider，最多 3 条 |
| CSS 类 | `.toastStack`, `.toast`, `.toastSuccess`, `.toastWarning`, `.toastError` |

### 2.5 EmptyPage

| 字段 | 值 |
|------|-----|
| 导出名 | `EmptyPage` |
| 文件 | `design-demo-ui.tsx` |
| Props | `title: string` |
| 功能 | 空状态页面 |
| CSS 类 | `.page`, `.empty` |

---

## 3. 图片组件

### 3.1 ImageThumbSmall

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageThumbSmall` |
| 文件 | `design-demo-ui.tsx` |
| Props | `image: DemoImage`, `priority?`, `wide?` |
| 功能 | 小缩略图（用于列表行内） |
| CSS 类 | `.imageThumbSmall`, `.imageThumbSmallWide` |

### 3.2 ImageThumbMedium

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageThumbMedium` |
| 文件 | `design-demo-ui.tsx` |
| Props | `image`, `actionSlot?`, `onOpen?`, `onSelect?`, `priority?`, `selectable?`, `selected?`, `showStatus?`, `tags?` |
| 功能 | 中缩略图（可选中、有标签、有操作区） |
| CSS 类 | `.imageThumbMedium`, `.imageThumbMediumSelected`, `.imageThumbSelect`, `.imageThumbTags`, `.imageThumbImageButton`, `.imageThumbOverlay`, `.imageThumbActions` |

### 3.3 ImageListSmall / ImageStrip

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageListSmall`, `ImageStrip` |
| 文件 | `design-demo-ui.tsx` |
| Props | `images`, `className?`, `limit?`, `maxWidth?`, `wide?` |
| 功能 | 横向滚动小图列表 |
| CSS 类 | `.imageListSmallFrame`, `.imageListSmall`, `.imageStrip` |

### 3.4 ImageListMedium

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageListMedium` |
| 文件 | `design-demo-ui.tsx` |
| Props | `actionPanel?`, `children`, `className?`, `defaultExpanded?`, `emptyLabel?`, `gap?`, `maxHeight?`, `maxWidth?`, `selectPanel?`, `summary?` |
| 功能 | 中图网格列表（可折叠、有摘要/选择/操作面板） |
| CSS 类 | `.imageListMedium`, `.imageListMediumMain`, `.imageListMediumHeader`, `.imageListMediumGrid`, `.imageListMediumViewport`, `.imageListMediumFade`, `.imageListMediumExpand`, `.imageListMediumActionTrack`, `.imageListMediumActionPanel` |

### 3.5 ImageGrid

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageGrid` |
| 文件 | `design-demo-ui.tsx` |
| Props | `images: DemoImage[]`, `showStatus?`, `selectable?` |
| 功能 | 图片网格 + Lightbox 预览 |
| CSS 类 | 复用 `ImageListMedium` + `ImagePreviewLarge` |

### 3.6 ReviewImageBoard

| 字段 | 值 |
|------|-----|
| 导出名 | `ReviewImageBoard` |
| 文件 | `design-demo-ui.tsx` |
| Props | `images: DemoImage[]` |
| 功能 | 审核图片面板（选择 + 批量操作 + Lightbox） |
| CSS 类 | `.reviewControlStrip` + 复用 `ImageListMedium` / `ImagePreviewLarge` |

### 3.7 ImagePreviewFrame (internal)

| 字段 | 值 |
|------|-----|
| 导出名 | `ImagePreviewFrame`（内部） |
| 文件 | `design-demo-ui.tsx` |
| Props | `image`, `interactive?`, `onOpen?`, `priority?` |
| 功能 | 图片预览帧（支持缩放、拖拽、双击重置） |
| CSS 类 | `.imagePreviewFrame`, `.imagePreviewFrameInteractive`, `.imagePreviewFrameZoomed`, `.imagePreviewFrameDragging`, `.imageFill`, `.imagePreviewInteractiveImage` |

### 3.8 ImagePreviewLarge (Lightbox)

| 字段 | 值 |
|------|-----|
| 导出名 | `ImagePreviewLarge` |
| 文件 | `design-demo-ui.tsx` |
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

### 5.2 PresetBindingRow

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetBindingRow` |
| 文件 | `section-editor-presets.tsx` |
| Props | `binding: PresetBinding`, `onVariantChange?`, `onCopyName?`, `onUnlink?`, `onDelete?` |
| 功能 | 预制绑定行（名称 + 分类色 + 变体切换 + 展开/折叠组内成员 + 操作） |
| CSS 类 | `.bindRow`, `.bindRowMain`, `.bindNameWrap`, `.bindName`, `.bindCategory`, `.bindGroupChip`, `.bindScopeChip`, `.bindMeta`, `.bindRowControls`, `.bindChevron`, `.bindList` |

### 5.3 PresetImportInline

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetImportInline` |
| 文件 | `section-editor-presets.tsx` |
| Props | `open`, `categories: ImportCategory[]`, `selected?`, `onSelect` |
| 功能 | 行内预制导入面板（分类选择 → 文件夹 → 预制/组选择） |
| CSS 类 | `.importPanel`, `.importCategoryColumn`, `.importCategoryItem`, `.importPresetColumn`, `.importHeaderActions` |

### 5.4 PromptBlockRow

| 字段 | 值 |
|------|-----|
| 导出名 | `PromptBlockRow` |
| 文件 | `section-editor-prompts.tsx` |
| Props | `block: PromptBlockRowData`, `expanded`, `onToggle`, `onLabelChange?`, `onPositiveChange?`, `onNegativeChange?`, `onUnlink?`, `onDelete?` |
| 功能 | 提示词块行（折叠/展开、分类色标记、预设来源标识、正负向文本） |
| CSS 类 | `.pbRow`, `.pbRowGrip`, `.pbCategory`, `.pbRowMain`, `.pbRowTitleLine`, `.pbRowPreview`, `.pbRowManualMark` |

### 5.5 CompiledPromptPreview

| 字段 | 值 |
|------|-----|
| 导出名 | `CompiledPromptPreview` |
| 文件 | `section-editor-prompts.tsx` |
| Props | `groups` |
| 功能 | 编译后的 Prompt 预览（按预制分组展示正负向） |

### 5.6 LoraRow

| 字段 | 值 |
|------|-----|
| 导出名 | `LoraRow` |
| 文件 | `section-editor-lora-history.tsx` |
| Props | `entry: LoraRowData`, `fileOptions: string[]`, `onWeightChange`, `onToggle`, `onPathChange`, `onUnlink?`, `onDelete` |
| 功能 | LoRA 行（来源标记 + 文件选择 + 权重步进 + 启用/禁用 + 触发词） |
| CSS 类 | `.loraRow`, `.sectionLoraRow`, `.loraRowGrip`, `.loraRowMain`, `.loraRowTopLine`, `.loraSourceBadge`, `.loraPresetName`, `.loraManualBadge`, `.loraTrigger` |

### 5.7 LoraColumn

| 字段 | 值 |
|------|-----|
| 导出名 | `LoraColumn` |
| 文件 | `section-editor-lora-column.tsx` |
| Props | `label`, `entries: LoraRowData[]`, `onAdd`, `onWeight`, `onToggle`, `onPath`, `onUnlink`, `onDelete` |
| 功能 | LoRA 列容器（头部 + 列表 + 新增按钮） |
| CSS 类 | `.loraColumn`, `.loraColumnHead`, `.loraList`, `.addRow`, `.bindEmpty` |

### 5.8 HistoryDiffRow

| 字段 | 值 |
|------|-----|
| 导出名 | `HistoryDiffRow` |
| 文件 | `section-editor-lora-history.tsx` |
| Props | `change: HistoryDiffChange` |
| 功能 | 变更记录 diff 行 |
| CSS 类 | `.diffList`, `.diffRow`, `.diffEmptyState` |

---

## 6. Project 组件

### 6.1 SectionEditorPage

| 字段 | 值 |
|------|-----|
| 导出名 | `SectionEditorPage` |
| 文件 | `section-editor-page.tsx` |
| Props | `data: DemoData`, `project?: DemoProject`, `section?: DemoSection` |
| 功能 | 小节编辑器完整页面（6 个 Tab：参数/预制/提示词/LoRA/历史/结果） |
| CSS 类 | `.page`, `.sectionTabBody`, `.promptTabBody`, `.promptTwoColumn`, `.loraPair`, `.resultsHead`, `.resultsFilter`, `.resultsFilterBtn`, `.resultsFilterBtnActive`, `.runGroup`, `.runGroupHead`, `.runGroupNumber`, `.runGroupTime`, `.runGroupStats`, `.runStatPill`, `.runStatKept`, `.runStatTrashed`, `.runGroupActions`, `.resultThumbAction` |

### 6.2 ProjectsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectsPage` |
| 文件 | `project-pages.tsx` |
| Props | `data: DemoData` |
| 功能 | 项目列表页（文件夹面包屑 + 文件夹行 + 项目卡片列表 + 批量操作） |
| CSS 类 | `.projectFolderWorkspace`, `.projectFolderTopbar`, `.projectFolderBreadcrumbs`, `.projectFolderActions`, `.projectBatchBar`, `.projectFolderSurface`, `.projectFolderGrid`, `.projectFolderRow`, `.projectFolderGrip`, `.projectFolderOpen`, `.projectFolderRowActions`, `.projectListGrid`, `.projectListCard`, `.projectListCardSelected`, `.projectSelectButton`, `.projectListOpenArea`, `.projectCardTitle`, `.projectCardStats`, `.projectItemActions`, `.projectMoveMenu`, `.projectMoveMenuList` |

### 6.3 ProjectDetailPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectDetailPage` |
| 文件 | `project-pages.tsx` |
| Props | `project?: DemoProject`, `initialView?: "sections" \| "results"` |
| 功能 | 项目详情页（小节视图 / 结果视图） |
| CSS 类 | `.projectDetailHeader`, `.projectHeaderTop`, `.projectTitleRow`, `.projectTitleEdit`, `.projectHeaderControls`, `.projectCommandBar`, `.projectCommandSecondary`, `.projectRunCluster` |

### 6.4 ProjectSectionCard

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectSectionCard`（内部） |
| 文件 | `project-pages.tsx` |
| Props | `compact`, `index`, `project`, `section`, `selected`, `onToggleSelection` |
| 功能 | 小节卡片（拖拽手柄 + 选中 + 标题 + 缩略图 + 运行/复制/删除操作） |
| CSS 类 | `.sectionCard`, `.sectionCardCompact`, `.sectionCardSelected`, `.sectionCardMain`, `.dragHandle`, `.sectionSelectButton`, `.sectionCardContent`, `.sectionCardHeader`, `.sectionCardTitle`, `.sectionCardTitleLine`, `.sectionCardBody`, `.sectionCardActions`, `.sectionRunControl` |

### 6.5 ProjectSectionShell / SectionRail

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectSectionShell`, `SectionRail` |
| 文件 | `project-pages.tsx` |
| Props | `project`, `activeSection?`, `mode`, `children`, `compact?`, `onToggleCompact?` |
| 功能 | 小节列表 + 右侧导航轨道（双滚动同步） |
| CSS 类 | `.projectSectionShell`, `.projectScrollPane`, `.sectionRail`, `.railHeading`, `.railItem`, `.railItemActive` |

### 6.6 ProjectFormPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectFormPage` |
| 文件 | `project-pages.tsx` |
| Props | `project?`, `mode: "new" \| "edit"` |
| 功能 | 项目创建/编辑表单 |
| CSS 类 | `.twoCol`, `.grid`, `.fieldGrid` |

### 6.7 BatchSizeSelector

| 字段 | 值 |
|------|-----|
| 导出名 | `BatchSizeSelector`（内部） |
| 文件 | `project-pages.tsx` |
| Props | `value`, `onChange`, `compact?` |
| 功能 | 批量张数选择器（1/2/4/8/16） |
| CSS 类 | `.batchSizeSelector`, `.batchSizeSelectorCompact` |

### 6.8 ProjectViewToggle

| 字段 | 值 |
|------|-----|
| 导出名 | `ProjectViewToggle`（内部） |
| 文件 | `project-pages.tsx` |
| Props | `projectId`, `value: ProjectCardView` |
| 功能 | 项目视图切换（小节/结果） |
| CSS 类 | `.segmented`, `.projectViewToggle`, `.segment`, `.segmentActive` |

---

## 7. Queue / Runs 组件

### 7.1 QueuePage

| 字段 | 值 |
|------|-----|
| 导出名 | `QueuePage` |
| 文件 | `runs-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 任务工作台（待审核/队列/失败 Tab + 进度卡片 + 分页） |
| CSS 类 | `.metricGrid`, `.currentRunSurface`, `.currentRunHeader`, `.currentRunList`, `.currentRunItem`, `.currentRunTitleBlock`, `.currentRunProgressBlock`, `.currentRunProgressTop`, `.currentRunProgressTrack`, `.currentRunProgressFill`, `.currentRunMeta`, `.queueSurfaceStack`, `.queueTabsBar`, `.queueSurface`, `.queueSurfaceHeader`, `.queueRunList`, `.queueProjectGroup`, `.queueProjectHeader`, `.queueProjectChevronCollapsed`, `.queueProjectRows`, `.queueRunRow`, `.queueRunMain`, `.queueRunDate`, `.queuePager`, `.pagerInfoFull`, `.pagerInfoCompact` |

### 7.2 RunList

| 字段 | 值 |
|------|-----|
| 导出名 | `RunList` |
| 文件 | `runs-page.tsx` |
| Props | `title`, `runs: DemoRun[]`, `empty`, `mode`, `collapsedGroups`, `onToggleGroup` |
| 功能 | 运行列表（全选/取消 + 批量操作） |
| CSS 类 | `.queueRunRowSelectable`, `.queueRunRowSelected`, `.queueRowCheck`, `.queueRunError`, `.queueRunErrorAction`, `.queueRunErrorCopy` |

### 7.3 ReviewPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ReviewPage` |
| 文件 | `runs-page.tsx` |
| Props | `data: DemoData`, `run?: DemoRun` |
| 功能 | 单次运行审核页（参数信息卡片 + 图片审核面板） |
| CSS 类 | `.reviewPageHeader`, `.reviewMetaSurface`, `.reviewMetaHeader`, `.reviewMetaSummary`, `.reviewMetaChevron`, `.reviewMetaBody`, `.reviewSamplerGrid`, `.reviewSamplerBlock`, `.reviewMetaLine`, `.reviewMetaStat`, `.reviewLoraGrid`, `.reviewLoraColumn`, `.reviewPromptGrid`, `.reviewSurface`, `.reviewSurfaceTabs` |

### 7.4 DemoPager

| 字段 | 值 |
|------|-----|
| 导出名 | `DemoPager` |
| 文件 | `runs-page.tsx` |
| Props | `currentPage`, `totalPages` |
| 功能 | 分页器 |
| CSS 类 | `.pagerControls`, `.pagerButton`, `.pagerButtonActive`, `.pagerChunk`, `.pagerEllipsis` |

---

## 8. Preset 组件

### 8.1 PresetsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetsPage` |
| 文件 | `preset-pages.tsx` |
| Props | `data: DemoData` |
| 功能 | 预设库页面（分类侧边栏 + 文件夹浏览 + 条目列表 + 批量移动） |
| CSS 类 | `.presetManagerLayout`, `.presetCategorySidebar`, `.presetCategoryHeader`, `.presetCategoryList`, `.presetCategoryItem`, `.presetCategoryItemActive`, `.presetCategoryRow`, `.presetCategorySelect`, `.categorySwatch`, `.presetCategoryText`, `.presetCategoryActions`, `.presetCategoryDragIcon`, `.presetWorkArea`, `.presetWorkspaceHeader`, `.presetContextBar`, `.presetBatchBar`, `.presetLibrarySurface`, `.presetFolderBar`, `.presetFolderBreadcrumbs`, `.presetFolderGrid`, `.presetFolderRow`, `.presetFolderDraft`, `.presetFolderBack`, `.presetItemList`, `.presetItemRow`, `.presetItemRowSelected`, `.presetItemCheck`, `.presetItemOpenArea`, `.presetItemMain`, `.presetItemMeta`, `.presetItemArrow` |

### 8.2 PresetCategoryFormPage

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetCategoryFormPage` |
| 文件 | `preset-pages.tsx` |
| Props | `data`, `category?`, `mode` |
| 功能 | 分类新建/编辑页 |
| CSS 类 | `.categoryFormLayout`, `.categoryFormSurface`, `.categoryEditor`, `.categoryEditorHeader`, `.categoryTypeSwitch`, `.categoryTypeButton`, `.categoryTypeButtonActive`, `.categoryEditorGrid`, `.hueControl`, `.hueSlider`, `.slotEditor`, `.slotEditorHeader`, `.slotRow`, `.categoryEditorFooter`, `.categoryDangerZone`, `.inlineNotice`, `.inlineNoticeWarn` |

### 8.3 PresetEditPage

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetEditPage` |
| 文件 | `preset-pages.tsx` |
| Props | `data`, `preset?` |
| 功能 | 预设编辑页（基础信息 + 变体编辑 + LoRA + 关联变体 + 变更历史 + 侧边栏） |
| CSS 类 | `.presetEditorShell`, `.editorSurface`, `.editorStickyHeader`, `.editorIdentity`, `.editorBlock`, `.editorBlockHeader`, `.editorAside`, `.presetVariantWorkbench`, `.presetVariantRail`, `.presetVariantButton`, `.presetVariantButtonActive`, `.presetVariantEditor`, `.promptColumns`, `.loraStageGrid`, `.loraStage`, `.loraRow`, `.presetLinkedList`, `.presetLinkedRow`, `.historyDiffList`, `.historyDiffRow`, `.editorStatusStrip`, `.presetCascadeState`, `.inlineToast` |

### 8.4 PresetGroupPage

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetGroupPage` |
| 文件 | `preset-pages.tsx` |
| Props | `data`, `group?` |
| 功能 | 预设组编辑页 |
| CSS 类 | `.presetGroupShell`, `.groupMemberList`, `.groupMemberRow`, `.groupPreviewList`, `.groupPreviewRow` |

### 8.5 SortRulesPage

| 字段 | 值 |
|------|-----|
| 导出名 | `SortRulesPage` |
| 文件 | `preset-pages.tsx` |
| Props | `data: DemoData` |
| 功能 | 排序规则页面（4 个维度的拖拽排序面板） |
| CSS 类 | `.sortRulesGrid`, `.sortRulePanel`, `.sortRuleHeader`, `.sortRuleList`, `.sortRuleRow`, `.sortRuleFooter` |

### 8.6 PresetMoveSheet

| 字段 | 值 |
|------|-----|
| 导出名 | `PresetMoveSheet`（内部） |
| 文件 | `preset-pages.tsx` |
| Props | `category`, `confirmFeedback?`, `onCancel`, `onConfirm`, `onSelect`, `selectedCount`, `selectedFolderId` |
| 功能 | 移动文件夹对话框 |
| CSS 类 | `.presetMoveBackdrop`, `.presetMoveSheet`, `.presetMoveHeader`, `.presetMoveBreadcrumbs`, `.presetMoveTargets`, `.presetMoveTarget`, `.presetMoveTargetActive`, `.presetMoveFooter` |

---

## 9. Template 组件

### 9.1 TemplatesPage

| 字段 | 值 |
|------|-----|
| 导出名 | `TemplatesPage` |
| 文件 | `template-pages.tsx` |
| Props | `data: DemoData` |
| 功能 | 模板列表页 |
| CSS 类 | `.rowList`, `.templateListItem`, `.templateListMain`, `.templateListTitle`, `.templateSectionSummary`, `.templateListMeta` |

### 9.2 TemplateFormPage

| 字段 | 值 |
|------|-----|
| 导出名 | `TemplateFormPage` |
| 文件 | `template-pages.tsx` |
| Props | `template?`, `mode: "new" \| "edit"` |
| 功能 | 模板创建/编辑页 |
| CSS 类 | 复用 `editorSurface`, `editorBlock` 等 |

### 9.3 TemplateSectionPage

| 字段 | 值 |
|------|-----|
| 导出名 | `TemplateSectionPage` |
| 文件 | `template-pages.tsx` |
| Props | `template?`, `sectionIndex?` |
| 功能 | 模板小节编辑页（运行参数 + 预设绑定 + Prompt + LoRA + 导入 + 历史） |
| CSS 类 | `.templateSectionRow`, `.templateSectionRowMain`, `.templateSectionTitleLine`, `.templateSectionRowActions`, `.templateSectionList`, `.sectionMetaGrid`, `.editorSplitBlock`, `.bindingList`, `.bindingRow`, `.promptBlockList`, `.promptBlockRow`, `.promptBlockContent`, `.promptBlockTitle`, `.importPresetLayout`, `.importCategoryColumn`, `.importCategoryActive`, `.importPresetColumn` |

### 9.4 TemplateSectionShell / TemplateSectionRail

| 字段 | 值 |
|------|-----|
| 导出名 | `TemplateSectionShell`, `TemplateSectionRail` |
| 文件 | `template-pages.tsx` |
| Props | `activeSection?`, `children`, `mode`, `template` |
| 功能 | 模板小节布局 + 右侧导航（双滚动同步） |
| CSS 类 | 复用 `projectSectionShell`, `sectionRail` 等 |

---

## 10. Model 组件

### 10.1 ModelsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ModelsPage` |
| 文件 | `model-pages.tsx` |
| Props | 无 |
| 功能 | 模型文件管理（LoRA/Checkpoint 切换 + 面包屑 + 搜索 + 文件列表 + 详情面板 + 移动对话框） |
| CSS 类 | `.modelsLayout`, `.modelsBrowser`, `.segmented`, `.segment`, `.segmentActive`, `.breadcrumb`, `.breadcrumbItem`, `.breadcrumbActive`, `.searchBar`, `.searchInput`, `.searchClear`, `.fileList`, `.fileRow`, `.fileRowActive`, `.fileIcon`, `.fileInfo`, `.fileName`, `.fileSize`, `.fileAction`, `.emptyState`, `.detailsPanel`, `.detailsHeader`, `.detailsTitle`, `.detailsContent`, `.detailsSection`, `.detailsLabel`, `.detailsValue`, `.detailsValueMuted`, `.detailsSectionHeader`, `.detailsActions`, `.dialogOverlay`, `.dialog`, `.dialogHeader`, `.dialogTitle`, `.dialogContent`, `.dialogDescription`, `.folderTree`, `.folderTreeItem`, `.dialogFooter` |

---

## 11. System 组件

### 11.1 SettingsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `SettingsPage` |
| 文件 | `system-pages.tsx` |
| Props | `data: DemoData` |
| 功能 | 设置页（链接列表 → 监控/日志） |
| CSS 类 | `.settingsLinkList`, `.settingsLinkRow`, `.settingsLinkMain`, `.settingsLinkText`, `.settingsLinkArrow` |

### 11.2 LogsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `LogsPage` |
| 文件 | `system-pages.tsx` |
| Props | `data: DemoData` |
| 功能 | 日志页（应用日志/控制台 + 级别筛选 + 模块芯片 + 日志查看器） |
| CSS 类 | `.logWorkbench`, `.logFilterBar`, `.logModuleChips`, `.logModuleChip`, `.logModuleChipActive`, `.logViewerPanel`, `.logViewerHeader`, `.logViewer`, `.logLine`, `.logLineWarn`, `.logLineError`, `.logEmpty` |

### 11.3 MonitorPage

| 字段 | 值 |
|------|-----|
| 导出名 | `MonitorPage` |
| 文件 | `system-pages.tsx` |
| Props | `data: DemoData` |
| 功能 | 监控页（托管/外部切换 + 状态网格 + 启停操作 + 进程日志 + 探测结果侧边栏） |
| CSS 类 | `.monitorWorkbench`, `.monitorMain`, `.monitorControlPanel`, `.monitorHeader`, `.monitorStatusGrid`, `.monitorStatusRow`, `.monitorActions`, `.monitorLogPanel`, `.monitorAside`, `.monitorProbeBox` |

### 11.4 LoginPage

| 字段 | 值 |
|------|-----|
| 导出名 | `LoginPage` |
| 文件 | `system-pages.tsx` |
| Props | 无 |
| 功能 | 登录页 |

### 11.5 NotFoundPage

| 字段 | 值 |
|------|-----|
| 导出名 | `NotFoundPage` |
| 文件 | `system-pages.tsx` |
| Props | `route: string` |
| 功能 | 404 页面 + 路由表 |

---

## 12. Batch Create 组件

### 12.1 BatchCreatePage

| 字段 | 值 |
|------|-----|
| 导出名 | `BatchCreatePage` |
| 文件 | `batch-create-page.tsx` |
| Props | `project?: DemoProject`, `data: DemoData` |
| 功能 | 批量创建小节（预设浏览器 + 导入列表 + 项目绑定 + 新小节参数 + 最近创建） |
| CSS 类 | `.batchCreateWorkspace`, `.batchBrowserPane`, `.batchPaneHeader`, `.batchCategoryTabs`, `.batchSearchBox`, `.batchFolderBar`, `.batchBreadcrumbs`, `.batchBrowserList`, `.batchFolderRow`, `.batchCandidateRow`, `.batchCandidateRowSelected`, `.batchCandidateMain`, `.batchCandidateMeta`, `.batchCandidateActions`, `.batchConfigPane`, `.batchConfigSection`, `.batchSectionHeader`, `.batchImportList`, `.batchImportRow`, `.batchBindingList`, `.batchBindingRow`, `.batchFormGrid`, `.batchRatioGrid`, `.batchCreatedList` |

---

## 13. 辅助 / 检查页

### 13.1 ImageListComponentsPage

| 字段 | 值 |
|------|-----|
| 导出名 | `ImageListComponentsPage` |
| 文件 | `image-list-components-page.tsx` |
| Props | `data: DemoData` |
| 功能 | 图片列表组件检查页（小图列表 / 中图列表 / 无操作区模式） |
| CSS 类 | `.imageListDemoSurface`, `.imageListDemoHeader` |

### 13.2 RootPage

| 字段 | 值 |
|------|-----|
| 导出名 | `RootPage` |
| 文件 | `project-pages.tsx` |
| Props | `data: DemoData` |
| 功能 | 根路由，重定向到 QueuePage |
