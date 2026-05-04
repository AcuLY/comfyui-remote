# `/design-demos` 与原前端页面对照

更新时间：2026-05-03

本文只核对用户可见前端，不包含 `src/app/api/**`。原前端以 `src/app/**` 和共享组件 `src/components/**` 为准；当前实现范围保持隔离：只通过 `src/app/design-demos/**` 和本文档维护页面壳，不通过 `src/app/globals.css` 或真实前端代码修复视觉问题。

当前产品态路径：原 `/queue/**` 在 `/design-demos` 中对应 `/design-demos/runs/**`，原 `/assets/**` 在 `/design-demos` 中去掉 `assets` 前缀。这是设计壳的信息架构调整，不代表真实前端路由已经同步迁移。

## 设计基线

- 背景与材质：淡渐变背景、磨砂玻璃 surface、柔和边界和低圆角。
- 结构语言：少卡片，多分隔行；每个工作台保留一个主 surface，内部使用 row、divider、toolbar、inline notice 和 action strip。
- 交互语义：列表项整行可点击，独立小控件阻止冒泡；没有真实工作流意义的按钮不出现在界面里。
- 导航职责：桌面为固定可收起左侧全局导航；项目/模板相关页的小节 rail 放右侧；移动端底部只保留 `任务 / 项目 / 更多`。
- 文案标准：产品 UI 不暴露实现说明、调试术语或页面壳说明。

## 本轮完成状态

- P0 导航壳：完成。桌面侧栏固定、可收起；侧栏里只保留主题切换和导航；移动端只保留底部三项。
- P0 Surface 层级：完成。任务、预设、项目、模板、模型、设置页改成单层 glass surface + 行式内容，去掉卡片套卡片。
- P0 列表行为：完成。预设、预设组、项目小节、模板小节、任务行按整行进入详情；冗余 `打开 / 定位` 按钮已移除。
- P0 文案审计：完成。可见页面标题、说明和操作文案收成产品态中文；英文/internal 文案只保留在日志级别、文件名、API 名称等必要上下文。
- P0 响应式：完成。新增 1080/820/520 收敛规则，重点覆盖项目列表、项目详情、小节列表、模板编辑、预设库和模型页。
- P1 项目/模板 rail：完成。右侧 rail 只负责小节导航和滚动同步；项目详情与项目结果合并为同一项目壳，通过小节/结果 toggle 切换卡片状态；项目级操作进入页面 action strip；批量张数为 `1 / 2 / 4 / 8 / 16`。
- P1 真实功能语义：静态壳完成。任务分页有页码/省略号，预设组分类编辑有默认槽位，删除保护靠近删除动作，操作按钮有统一 toast/状态反馈。
- P1 模板编辑：完成。模板编辑页只保留模板信息和小节列表；binding、导入策略、历史等进入模板小节详情。
- P2 边界状态：完成。统一 toast、operation state strip、lightbox 键盘切图、路由 loading skeleton、空/错/加载态样式已覆盖。

## 仍不接入的范围

- 真实 API 提交：取消/重试/恢复、审核处理、预设移动、分类保存、模板 autosave、模型移动等仍为静态表现。
- 真实 DnD：项目小节、模板小节、预设分类、预设文件夹和排序规则只表达拖拽外观，不提交排序。
- 真实 URL 恢复：query/hash 回到原位置不作为按钮暴露，后续接真实路由状态时再恢复。
- 真实服务状态：日志轮询、ComfyUI 启停、probe 错误和权限登录仍由真实前端实现。

## 路由页面对照

| 原前端路由 | `/design-demos` 路由 | 当前状态 | 已覆盖 | 非壳范围 |
| --- | --- | --- | --- | --- |
| `/` | `/design-demos` | 静态对齐 | 进入任务工作台语义。 | 真实根路由跳转。 |
| `/login` | `/design-demos/login` | 静态对齐 | token 输入、状态条、登录/清除反馈。 | 真实认证提交。 |
| `/queue` | `/design-demos/runs` | 静态对齐 | pending/running/failed/trash、行式列表、页码分页、恢复/重试/删除反馈。 | 真实轮询和提交。 |
| `/queue/[runId]` | `/design-demos/runs/[runId]` | 静态对齐 | 审核宫格、筛选、多选、保留/精选/废弃、撤销、lightbox 和键盘切图。 | 真实审核提交和跳转下一组。 |
| `/projects` | `/design-demos/projects` | 静态对齐 | 行式项目列表、缩略图、状态、更新时间、窄屏布局。 | 删除确认和真实 pending。 |
| `/projects/new` | `/design-demos/projects/new` | 静态对齐 | 新建表单壳、基础字段、主要动作反馈。 | checkpoint cascade、绑定选择和提交。 |
| `/projects/[projectId]` | `/design-demos/projects/[projectId]` | 静态对齐 | 右侧小节 rail、滚动同步、整行小节入口、批量选择、单节动作、批量张数，并可用 toggle 切到结果卡片态。 | 真实 DnD 和批量提交。 |
| `/projects/[projectId]/edit` | `/design-demos/projects/[projectId]/edit` | 静态对齐 | 编辑表单壳、默认参数摘要、保存反馈。 | 完整 KSampler 和真实保存。 |
| `/projects/[projectId]/results` | `/design-demos/projects/[projectId]/results` | 静态对齐 | 保留深链入口，但复用项目详情同一页面壳；toggle 默认进入结果卡片态，包含筛选、选择/保留/精选/废弃、撤销、lightbox。 | 真实结果状态写入。 |
| `/projects/[projectId]/batch-create` | `/design-demos/projects/[projectId]/batch-create` | 静态对齐 | 预设/预设组浏览、分类、文件夹、搜索、导入列表、variant override、小节参数。 | 真实创建和校验。 |
| `/projects/[projectId]/sections/[sectionId]` | `/design-demos/projects/[projectId]/sections/[sectionId]` | 静态对齐 | 连续编辑流、上一节/下一节、参数、binding、Prompt、LoRA、导入预设、历史 diff。 | 真实 autosave、级联删除、完整 KSampler。 |
| `/projects/[projectId]/sections/[sectionId]/results` | `/design-demos/projects/[projectId]/sections/[sectionId]/results` | 静态对齐 | run 分组、动作条、精选/撤销、lightbox 和键盘切图。 | 真实多选提交和状态写入。 |
| `/assets/models` | `/design-demos/models` | 静态对齐 | kind 切换、目录、面包屑、文件行、上传位置、备注/触发词、移动 sheet、空/错/加载态。 | 真实文件操作。 |
| `/assets/loras` | `/design-demos/loras` | 兼容入口 | 提示 LoRA 已并入模型文件管理。 | 后续可改成直接跳转。 |
| `/assets/presets` | `/design-demos/presets` | 静态对齐 | 分类栏、文件夹面包屑、文件夹行、整行预设/组入口、批量选择、移动 sheet。 | 真实移动、删除、新建和 DnD。 |
| `/assets/presets/categories/new` | `/design-demos/presets/categories/new` | 静态对齐 | 独立创建页、类型切换、名称/slug/色相、保存反馈。 | 真实字段联动和提交。 |
| `/assets/presets/categories/[categoryId]/edit` | `/design-demos/presets/categories/[categoryId]/edit` | 静态对齐 | 独立编辑页、类型锁定、删除保护、预设组默认槽位。 | 真实槽位来源和删除确认。 |
| `/assets/presets/[presetId]` | `/design-demos/presets/[presetId]` | 静态对齐 | 连续 PresetForm、variant、prompt、LoRA、linked variants、级联/删除保护、历史 diff、操作反馈。 | 真实保存和 picker 写入。 |
| `/assets/preset-groups/[groupId]` | `/design-demos/preset-groups/[groupId]` | 静态对齐 | 组信息、成员行、variant、成员删除、flatten 预览、历史 diff、操作反馈。 | 添加成员和 reorder/delete 提交。 |
| `/assets/presets/sort-rules` | `/design-demos/presets/sort-rules` | 静态对齐 | 正向、反向、LoRA1、LoRA2 四个排序面板和保存反馈。 | 真实 DnD 提交。 |
| `/assets/templates` | `/design-demos/templates` | 静态对齐 | 行式模板列表、section 摘要、整行入口、删除按钮外观。 | 真实删除和 pending。 |
| `/assets/templates/new` | `/design-demos/templates/new` | 静态对齐 | 新建态、模板信息、初始小节区域、创建反馈。 | 创建提交和校验。 |
| `/assets/templates/[templateId]/edit` | `/design-demos/templates/[templateId]/edit` | 静态对齐 | 模板信息、小节列表、右侧 section rail、整行小节入口、复制/删除反馈。 | 真实 autosave 和 DnD。 |
| `/assets/templates/[templateId]/sections/[sectionIndex]` | `/design-demos/templates/[templateId]/sections/[sectionIndex]` | 静态对齐 | 连续小节编辑、上下节、参数、binding、Prompt、LoRA、导入预设、历史 diff。 | 真实 autosave、级联 picker、variant 切换。 |
| `/settings` | `/design-demos/settings` | 静态对齐 | SFW Mode、ComfyUI 监控、后端日志入口。 | 真实 SFW toggle。 |
| `/settings/logs` | `/design-demos/settings/logs` | 静态对齐 | source/module/level 筛选、monospaced viewer、tail/auto-scroll、空筛选态、刷新反馈。 | 真实日志读取和轮询。 |
| `/settings/monitor` | `/design-demos/settings/monitor` | 静态对齐 | managed/external、start/stop/restart/probe、Worker/API/积压、probe 结果、进程日志、操作反馈。 | 真实进程控制。 |
| 路由 loading | `/design-demos/**/loading` | 静态对齐 | 统一 skeleton/loading 页面状态。 | 真实慢请求分段加载。 |

## 非路由子界面对照

| 模块 | 原前端语义 | 当前表达 | 非壳范围 |
| --- | --- | --- | --- |
| 全局导航 | `AppShell`、移动底栏、toast provider。 | 桌面固定可收起左栏，移动 `任务 / 项目 / 更多`，全局 toast。 | 记住用户折叠偏好。 |
| 小节导航同步 | 主内容滚动驱动 section nav，高亮并点击定位。 | 项目/模板相关页使用右侧 rail 和同一 scroll container；项目详情/结果共用同一 rail 和卡片列表。 | 真实路由 hash 恢复。 |
| 项目小节卡片 | DnD、紧凑模式、批量选择、run/copy/delete、最新状态。 | 排序手柄、整行入口、紧凑/标准、批量选择和动作反馈。 | 真实 DnD/提交。 |
| 结果 lightbox | 图片打开、左右切图、键盘、状态动作。 | 任务/项目/小节结果复用 lightbox，支持 Esc/左右键和精选/撤销入口。 | 真实状态更新。 |
| 预设分类管理 | 分类选择、颜色、计数、编辑/删除、group 槽位、DnD。 | 列表页分类栏 + 独立分类编辑页，group 槽位已表达。 | 真实保存/删除/DnD。 |
| 预设文件夹 | 面包屑、新建/重命名/删除、排序。 | 文件夹行、面包屑、移动目标 sheet 和反馈。 | 真实文件夹操作。 |
| 模型文件 | kind、目录、上传、移动、备注、LoRA 触发词。 | 文件管理器壳、右侧 inspector、移动 sheet、空/错/加载态。 | 真实文件系统写入。 |
| 模板编辑 | blur autosave、section sidebar、复制/删除/排序。 | 模板信息 + 小节列表 + 右侧 rail + 操作反馈。 | 真实 autosave 和 DnD。 |
| 日志/监控 | source/filter/auto-scroll、进程控制。 | 单层工作台、日志 viewer、进程控制反馈。 | 真实轮询和进程命令。 |

## 验收清单

1. `/design-demos/runs`：侧栏固定可收起，任务分页有页码和省略号，无无意义按钮。
2. `/design-demos/projects`：840px 窄屏项目行不裁切，长 checkpoint 不压缩主要标题。
3. `/design-demos/projects/[projectId]` 与 `/design-demos/projects/[projectId]/results`：同一项目壳，toggle 可切换小节/结果卡片状态，右侧 rail 同步滚动，移动/窄屏无横向挤压。
4. `/design-demos/presets`：预设/组行整行可点，无 `打开 / 定位` 按钮，分类栏不挤占内容。
5. `/design-demos/presets/categories/[categoryId]/edit`：无卡片套卡片，大块状态说明已移除，删除保护只靠近删除动作。
6. `/design-demos/templates/[templateId]/edit`：只保留模板信息和小节列表，窄屏不挤字。
7. 操作按钮：非导航按钮有 disabled/pending/hover/focus 基础状态，并通过 toast 或状态条表达结果。
8. 路由加载：`loading.tsx` 使用同一 glass skeleton，且不依赖真实前端样式。

## 验收命令

```powershell
cmd /c npx tsc --noEmit
cmd /c npx eslint src/app/design-demos
git diff -- src/app/globals.css
```

`git diff -- src/app/globals.css` 必须为空。
