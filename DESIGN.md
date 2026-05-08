# ComfyUI Manager Design System

Updated: 2026-05-05

This product UI uses a calm dual-theme workspace aesthetic: soft gradient atmosphere, translucent glass surfaces, compact data density, and restrained green actions. Light mode is the primary reference tone; dark mode should feel like the same product translated to dark surfaces, not a separate visual identity.

Reference baseline: the `/design-demos/runs/[runId]` review page. If this document conflicts with that page, follow the page first: fixed left navigation, useful content on the first screen, compact run metadata, a parameter information strip, and a focused review board for image decisions.

## 1. Visual Direction

- Base atmosphere: pale gray-blue canvas with slow, low-contrast emerald and rose radial gradients. Dark mode keeps the same shape, spacing, and accent logic with zinc-like dark surfaces.
- Material: frosted glass surfaces using translucent fills, fine borders, and `backdrop-filter: blur(20px) saturate(140%)`. The glass should read as quiet utility, not decorative shine.
- Depth: mostly border and blur; shadows are soft and shallow, used only to separate floating surfaces from the gradient background.
- Shape: low-to-medium radius. Small controls use 6-10px; major surfaces use 10-16px; badges can be pill-shaped.
- Density: workbench pages stay compact. Use rows, dividers, tool strips, inspectors, and collapsible metadata before adding more cards.
- Accent: green is the primary action/active color; rose is a secondary categorization color. Do not introduce broad decorative hue families.
- Tone: production tool, not showcase. The UI should sound and look direct: real product nouns, current state, next action, no demo language.

## 2. Color Tokens

### Light Theme

- Canvas: `#f7f9fb`
- Surface glass: `rgba(255, 255, 255, 0.68-0.78)`
- Surface hover: `rgba(255, 255, 255, 0.84-0.92)`
- Primary text: `#16181d`
- Secondary text: `#59616d`
- Tertiary text: `#7f8792`
- Border: `rgba(19, 24, 32, 0.075-0.18)`
- Border strong: `rgba(19, 24, 32, 0.18)`
- Primary green: `#047857` for text on light surfaces, with `rgba(4, 120, 87, 0.10)` backgrounds.
- Secondary rose: `#f472b6` / `rgba(244, 114, 182, 0.08)` for non-primary categories.
- Amber (warning): `#a16207` / `rgba(161, 98, 7, 0.10)` — used for warning states such as pager info.
- Sky (cover marker): `#0369a1` / `rgba(3, 105, 161, 0.10)` — used for cover/front-page markers.
- Red (danger): `#be123c` / `rgba(190, 18, 60, 0.10)` — used for destructive actions and error states.
- Panel-2: `rgba(238, 242, 245, 0.78)` — nested panel / alternate surface.
- Panel-3: `rgba(228, 234, 240, 0.74)` — deeper nested panel.
- Surface (generic): `rgba(255, 255, 255, 0.78)` — generic surface variant.
- Surface soft: `rgba(255, 255, 255, 0.66)` — low-emphasis surface.
- Surface hover: `rgba(255, 255, 255, 0.92)` — surface hover state.
- Field background: `rgba(255, 255, 255, 0.72)` — input / field background.
- Code background: `rgba(15, 23, 42, 0.055)` — code block background (e.g. logs page).
- Code text: `#263241` — code block text color.
- Image label border: `rgba(255, 255, 255, 0.45)` — border for image status labels.
- Image label background: `rgba(15, 23, 42, 0.58)` — background for image status labels.
- Image label text: `#ffffff`
- Lightbox image background: `#ffffff` — background behind the image inside the lightbox.
- Lightbox image border: `rgba(15, 23, 42, 0.12)` — border of the image container in the lightbox.

### Dark Theme

- Canvas: `#09090b`
- Surface glass: `rgba(24, 24, 27, 0.52-0.72)`
- Surface hover: `rgba(39, 39, 42, 0.78-0.82)`
- Primary text: `#fafafa`
- Secondary text: `#a1a1aa`
- Tertiary text: `#71717a`
- Border: `rgba(255, 255, 255, 0.08-0.14)`
- Border strong: `rgba(255, 255, 255, 0.14)`
- Primary green: `#34d399`
- Secondary rose: `#f9a8d4`
- Amber (warning): `#fbbf24` / `rgba(251, 191, 36, 0.12)` — used for warning states.
- Sky (cover marker): `#93c5fd` / `rgba(147, 197, 253, 0.12)` — used for cover/front-page markers.
- Red (danger): `#fb565b` / `rgba(251, 86, 91, 0.12)` — used for destructive actions and error states.
- Panel-2: `rgba(39, 39, 42, 0.72)` — nested panel / alternate surface.
- Panel-3: `rgba(63, 63, 70, 0.58)` — deeper nested panel.
- Surface (generic): `rgba(24, 24, 27, 0.76)` — generic surface variant.
- Surface soft: `rgba(24, 24, 27, 0.52)` — low-emphasis surface.
- Surface hover: `rgba(39, 39, 42, 0.82)` — surface hover state.
- Field background: `rgba(255, 255, 255, 0.055)` — input / field background.
- Code background: `rgba(0, 0, 0, 0.24)` — code block background (e.g. logs page).
- Code text: `#d4d4d8` — code block text color.
- Image label border: `rgba(255, 255, 255, 0.14)` — border for image status labels.
- Image label background: `rgba(0, 0, 0, 0.52)` — background for image status labels.
- Image label text: `#ffffff`
- Lightbox image background: `#050507` — background behind the image inside the lightbox.
- Lightbox image border: `rgba(255, 255, 255, 0.16)` — border of the image container in the lightbox.

Dark mode exists for operator comfort. It should preserve the light-mode hierarchy and information density; do not turn it into a terminal, cyber, or high-glow style.

## 3. Background And Material

Use a real background system instead of flat page color:

```css
background:
  linear-gradient(180deg, rgba(255,255,255,.9), transparent 24rem),
  radial-gradient(circle at 20% 30%, rgba(16,185,129,.12), transparent 50%),
  radial-gradient(circle at 80% 70%, rgba(244,114,182,.08), transparent 52%);
```

Primary surfaces should be glass:

```css
background: rgba(255, 255, 255, 0.68);
border: 1px solid rgba(15, 23, 42, 0.075);
backdrop-filter: blur(20px) saturate(140%);
box-shadow: 0 18px 54px rgba(15, 23, 42, 0.10);
```

On dark theme, keep the same material model but swap the fill to translucent zinc, not solid black.

For review pages, the main surface should stay readable as one work area: header, metadata strip, tab/filter row, image board, and action strip. Avoid splitting every small group into standalone floating cards.

## 4. Typography

- Use the app's existing sans stack. Do not add a new web font for the routed shell.
- Demo pages use an explicit font stack defined via CSS variables:
  - `--demo-font-cjk: "HarmonyOS Sans SC"` — CJK glyphs (优先)
  - `--demo-font-geist: "geistSans"` — Latin / UI letters
  - `--demo-font-sans: var(--demo-font-geist), var(--demo-font-cjk), system-ui, sans-serif` — final sans stack
  - `--demo-font-mono: var(--font-demo-maple-mono), "Cascadia Code", ui-monospace, monospace` — monospace stack for code/logs
- Page titles: 18-24px, 560-620 weight. Avoid oversized hero typography inside tools.
- Panel and row titles: 12-14px, 540-600 weight.
- Metadata and helper text: 10-12px, normal or medium weight.
- Letter spacing should stay near zero. Avoid heavy bold labels in dense work areas.

## 5. Layout Rules

- The app is a workbench, not a landing page. The first screen should be useful content.
- Desktop keeps global navigation on the left, fixed for the full viewport height. The selected nav item uses a soft green fill/border and stays visually calmer than the page content.
- Desktop global tools should live inside the left navigation or the current page header; avoid a separate floating topbar over every page.
- Project and template work pages can add a context rail on the right for section navigation.
- Mobile keeps only bottom navigation for `任务 / 项目 / 更多`; avoid duplicate global menu buttons.
- Prefer one main surface per work area. Inside it, use rows, strips, lists, and dividers.
- Do not put cards inside cards. If content already lives in a surface, inner items should be row-like.
- On mobile, preserve the two-column preset workflow only when it improves scanning; otherwise collapse the editor to a dedicated page.

### Review Page Pattern

- Page header: back link first, then a small status eyebrow, compact title, one-line state summary, and right-aligned outline actions.
- Parameter information: place directly below the page header. Collapsed state should show run id, title, section/date, and key generation facts such as ratio, size, batch, and upscale. Expanded state can use dense internal grids for KSampler, checkpoint/workflow, LoRA, prompt, and negative prompt.
- Review board: one main glass surface with tabs at the top, selection controls near the grid, thumbnails in stable aspect-ratio tiles, and batch actions in a bottom action strip.
- Keep image review decisions obvious but light: keep, p站, preview, cover, delete, and undo use soft semantic color, icon, and border treatment rather than large filled blocks.

## 6. Components

### 6.1 小组件（UI 原语）

| 组件 | CSS 类 | 用途 | 规范要点 |
|--------|----------|------|----------|
| `Button` | `.button`, `.buttonPrimary`, `.buttonSubtle`, `.buttonPink`, `.buttonDanger` | 通用按钮 | glass/透明表面、1px border、36px 最小高度；Primary 用软绿色填充而非实色；hover 有 `translateY(-1px)` |
| `ButtonLink` | `.buttonLink` | 链接样式按钮 | 复用 `.button` 样式体系 |
| `StatusBadge` | `.status`, `.statusGreen`, `.statusPink`, `.statusAmber`, `.statusSky`, `.statusRed` | 状态徽章 | 药丸形状、半透明填充、小号文字；按语义用色 |
| `OperationStateStrip` | `.operationStateStrip`, `.operationStateItem` | 操作状态条 | 行内状态展示 |
| `DemoToast` / `DemoToastStack` | `.toast`, `.toastStack` | Toast 通知 | 顶部右侧浮现、自动消失 |
| `DemoFeedbackProvider` | — | Toast 上下文提供者 | 管理全局消息提示 |

### 6.2 图片组件

| 组件 | CSS 类 | 用途 | 规范要点 |
|--------|----------|------|----------|
| `ImageThumbSmall` | `.imageThumbSmall`, `.imageThumbImageButton` | 小缩略图 | 桌面 80×120、移动端 60×90；`object-fit: cover`；hover 有 `translateY(-1px)` |
| `ImageThumbMedium` | `.imageThumbMedium`, `.imageThumbSelect`, `.imageThumbTags` | 中缩略图 | 桌面 160×240、移动端 120×180；支持勾选、状态 tag、快速操作；hover 有 `translateY(-1px)` |
| `ImagePreviewLarge` | `.imagePreviewFrame`, `.imagePreviewFrameInteractive`, `.imagePreviewFrameZoomed` | 大图预览灯箱 | 只作为 lightbox 弹窗使用；保持原图比例；支持上一张/下一张、滚轮缩放 |
| `ImageListSmall` / `ImageStrip` | `.imageListSmall`, `.imageStrip` | 小图列表 | 固定一行、横向滚动；超出后横向滚动；边缘渐隐提示 |
| `ImageListMedium` | `.imageListMedium` | 中图列表 | flex-start 布局；可限制纵向尺寸；纵向折叠时渐变隐藏并提供展开按钮 |
| `ImageGrid` | `.imageGrid` | 图片网格 | 使用 `ImageListMedium` 渲染 `ImageThumbMedium`；点击后打开 `ImagePreviewLarge` |
| `ReviewImageBoard` | `.reviewImageBoard`, `.reviewTile`, `.reviewSelectButton`, `.reviewMarkers`, `.reviewTileStatus` | 审核网格 | 使用 `ImageListMedium` 渲染可勾选的 `ImageThumbMedium`；带批量选择和操作栏 |

### 6.3 表单组件

| 组件 | CSS 类 | 用途 | 规范要点 |
|--------|----------|------|----------|
| `Field` | `.field` | 表单字段 | 1px border、glass 背景；符合 DESIGN.md 规范 |
| `TextAreaField` | `.textarea` | 文本域 | 复用 `.field` 样式体系 |
| `SelectLike` | `.select` | 类下拉选择 | 复用 `.field` 样式体系 |
| `DemoTabs` | `.tabs`, `.tab` | 标签页 | compact segmented rows 带 count pill；active 用绿色 token 柔和展示 |
| `SwitchRow` | `.switchRow`, `.switch` | 开关行 | 行内开关控件 |

### 6.4 数据展示组件

| 组件 | CSS 类 | 用途 | 规范要点 |
|--------|----------|------|----------|
| `MetricCard` | `.metric` | 指标卡片 | 展示图标、标签、数值、元数据；hover 无 `transform: none`（有意禁用浮动） |
| `RouteTable` | `.routeTable` | 路由表格 | 展示所有页面路径；使用 Panel 组件 |
| `EmptyRows` | `.emptyRows` | 空状态 | 列表空状态提示 |
| `EmptyPage` | `.emptyPage` | 空页面 | 包含页面头部和空状态 |

### 6.5 导航与 Shell 组件

| 组件 | CSS 类 | 用途 | 规范要点 |
|--------|----------|------|----------|
| `PageHeader` | `.pageHeader` | 页面头部 | 返回链接、标题、副标题、操作区 |
| `Panel` | `.panel`, `.panelHeader`, `.panelBody` | 面板 | 一个 glass surface 带紧凑 header 和 row-based body；参数面板可折叠 |
| `ProjectSectionShell` | `.projectSectionShell`, `.projectScrollPane` | 项目小节外壳 | 包含可滚动内容区和侧边导航栏 |
| `SectionRail` | `.sectionRail`, `.railHeading`, `.railItem`, `.railItemActive` | 小节导航栏 | 支持滚动同步和高亮当前小节 |

### 6.6 Section Editor 组件

| 组件 | CSS 类 | 用途 | 规范要点 |
|--------|----------|------|----------|
| `SectionTabs` | `.sectionTabs`, `.sectionTab`, `.sectionTabActive`, `.sectionTabCount` | 选项卡切换栏 | Params/Presets/Prompts/LoRA/History/Results |
| `SpecSection` / `SpecRow` | `.specSection`, `.specRow`, `.specRowLabel`, `.specRowControl` | 参数分区/行 | 标签 + 控件 |
| `CheckpointPicker` | `.cpPicker`, `.cpPickerBtn`, `.cpPickerOption` | Checkpoint 选择器 | 下拉菜单 |
| `AspectChips` | `.aspectChips`, `.aspectChip`, `.aspectChipActive` | 宽高比选择芯片组 | 芯片式选择 |
| `StepperInput` | `.stepper`, `.stepperBtn`, `.stepperValue` | 数字步进输入器 | 带 +/- 按钮 |
| `DimensionsReadout` | `.dimReadout`, `.dimReadoutBase`, `.dimReadoutFinal` | 图像尺寸读取 | 基础→最终 |
| `UpscaleControl` | `.upscaleControl`, `.upscaleChips` | 放大倍数控制 | 芯片选择 + 警告 |
| `SamplerCard` | `.ksCard`, `.ksGrid` | KSampler 参数卡片 | Steps/CFG/Denoise/Sampler 等 |
| `SelectChip` | `.selectChip`, `.selectChipBtn`, `.selectChipOption` | 下拉选择芯片 | 通用 |
| `VariantSwitcher` | `.variantSwitcher`, `.variantSwitcherBtn`, `.variantSwitcherOption` | 变体切换器 | 下拉菜单 |
| `PresetBindingRow` | `.bindRow`, `.bindRowMain`, `.bindNameWrap`, `.bindCategory`, `.bindGroupChip` | 预设绑定行 | 显示绑定信息、展开成员 |
| `PresetImportInline` / `PresetImportInlineBody` | `.importInline`, `.importHeader`, `.importTabs`, `.importTab`, `.importItem` | 预设导入面板/内容 | 搜索、分类、选择 |
| `PromptBlockRow` | `.pbRow`, `.pbRowGrip`, `.pbRowMain`, `.pbRowTitleLine`, `.pbRowActions` | 提示词块行 | 可展开编辑；支持 drag handle |
| `CompiledPromptPreview` | `.compiledPanel`, `.compiledGroup`, `.compiledLine` | 编译后提示词预览 | 按预设分组 |
| `LoraColumn` / `LoraRow` | `.loraColumn`, `.loraRow`, `.loraList` | LoRA 列/行 | 文件选择、权重、开关、删除 |
| `HistoryDiffRow` | `.diffRow`, `.diffMain`, `.diffTitle` | 历史变更记录行 | 展示参数/Prompt/LoRA 变更 |

### 6.7 页面级组件

| 组件 | CSS 类 | 用途 | 规范要点 |
|--------|----------|------|----------|
| `RootPage` | `.page` | 根页面入口 | 实际渲染 QueuePage |
| `QueuePage` | `.page`, `.queueSurfaceStack`, `.queueSurface` | 任务队列主页面 | 包含待审核/队列/失败三个标签页 |
| `QueueMetrics` | `.metricGrid` | 队列指标卡片网格 | 展示待审/队列/失败数量统计 |
| `CurrentRunningProgressCard` | `.currentRunSurface` | 当前运行中任务进度卡片 | 展示采样进度条和元信息 |
| `RunList` | `.queueRunList`, `.queueRunRow`, `.queueRowSelectable` | 运行任务列表 | 用于展示运行中和失败的任务 |
| `DemoPager` | `.pagerControls`, `.pagerButton`, `.pagerButtonActive` | 演示用分页控件 | 支持页码跳转和省略号显示 |
| `ReviewPage` | `.page`, `.reviewPageHeader`, `.reviewSurface` | 图片审核页面 | 支持按状态筛选和全屏预览 |
| `ProjectsPage` | `.page`, `.projectListGrid`, `.card`, `.projectListCard` | 项目列表页面 | 展示所有项目的卡片网格 |
| `ProjectDetailPage` | `.page` | 项目详情页面 | 支持小节视图和结果视图切换 |
| `ProjectSectionCard` | `.sectionCard`, `.sectionCardCompact` | 项目小节卡片 | 展示小节信息、图片预览和运行控制 |
| `ProjectFormPage` | `.page`, `.twoCol`, `.grid`, `.fieldGrid` | 项目创建/编辑表单 | 表单页面 |
| `SectionEditorPage` | `.page` | 小节编辑器主页面 | 包含所有 Section Editor 组件 |
| `SectionResultsPage` | — | 小节结果页面 | 按 run 分组展示所有结果 |
| `ModelsPage` | — | 模型/ LoRA 浏览页面 | |
| `PresetsPage` | — | 预设库页面 | |
| `TemplatesPage` | — | 模板列表页面 | |
| `SettingsPage` / `LogsPage` / `MonitorPage` | — | 设置/日志/监控页面 | |

### 6.8 反馈与弹窗组件

| 组件 | CSS 类 | 用途 | 规范要点 |
|--------|----------|------|----------|
| `ImagePreviewLarge` | `.imagePreviewFrame`, `.imagePreviewFrameInteractive` | 大图预览 lightbox | Modals/sheets 类型；使用更强的 glass 背景和阴影 |
| `DemoToast` / `DemoToastStack` | `.toast`, `.toastStack` | Toast 通知 | 顶部右侧浮现、自动消失 |

## 7. Motion

- Hover: subtle translate up by 1-2px, border-color shift, slightly stronger shadow.
- Theme/background movement: slow and low contrast.
- Avoid aggressive scale, glow, or animated gradients on every component.
- Respect reduced-motion by disabling nonessential transitions.

## 8. Do And Do Not

Do:

- Treat the current run review page as the tone reference for `/design-demos`.
- Use frosted surfaces consistently across navigation, panels, sheets, and controls.
- Keep green and rose accents soft and sparse.
- Maintain compact workbench density with clear row hierarchy.
- Use real product nouns in UI copy; avoid demo/mock/explanatory language.
- Keep styles scoped to the relevant module when building prototypes.

Do not:

- Let dark mode become a different product style from light mode.
- Return to pure near-black solid panels as the main product look.
- Use card-inside-card hierarchy for workbench content.
- Use large decorative hero sections for tool pages.
- Use heavy borders or solid accent fills everywhere.
- Modify `src/app/globals.css` for `/design-demos` visual experiments.

## 9. Implementation Notes For `/design-demos`

- The routed demo shell should use this glass system while keeping all CSS inside `src/app/design-demos/**`.
- Existing parity work should stay intact: `/runs`, `/projects`, `/presets`, `/models`, `/templates`, and settings routes remain routeable.
- The shell can use mock data, but visible UI should read as final product state.
- Validation should include TypeScript, targeted ESLint, in-app browser checks on desktop/mobile widths, and a clean `git diff -- src/app/globals.css`.
- For visual validation, include `/design-demos/runs` and `/design-demos/runs/[runId]`; check both theme states when a change touches shared shell tokens.
