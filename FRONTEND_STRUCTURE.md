# ComfyUI Manager 前端目录结构

> 快速定位样式/组件的参考手册。改样式时，先找到页面路由 → 定位 client 组件 → 修改 Tailwind 类名。

## 目录总览

```
src/
├── app/            # Next.js App Router：页面 + API 路由
├── components/     # 共享 React 组件
├── generated/      # Prisma 生成代码（勿手动改）
├── lib/            # 工具函数、类型、Server Actions、数据查询
├── server/         # 后端业务逻辑（改样式一般不碰）
├── instrumentation.ts  # 服务启动钩子
└── proxy.ts        # 认证中间件
```

## 页面路由 (`app/`)

| 路由 | 文件 | 说明 |
|------|------|------|
| `/` | `app/page.tsx` | 重定向到 `/queue` |
| `/login` | `app/login/page.tsx` | 登录页 |
| `/queue` | `app/queue/page.tsx` → `queue-page-client.tsx` | 审核队列（完成/运行中/失败/回收站） |
| `/queue/[runId]` | `app/queue/[runId]/page.tsx` | 单次运行图片审核 |
| `/projects` | `app/projects/page.tsx` | 项目列表 |
| `/projects/new` | `app/projects/new/page.tsx` | 新建项目 |
| `/projects/[id]` | `app/projects/[id]/page.tsx` + `section-list.tsx` | **项目详情（小节列表 + 操作）** |
| `/projects/[id]/edit` | `app/projects/[id]/edit/page.tsx` | 编辑项目参数 |
| `/projects/[id]/batch-create` | `app/projects/[id]/batch-create/page.tsx` | 批量创建小节 |
| `/projects/[id]/sections/[sid]` | `app/projects/[id]/sections/[sid]/page.tsx` → `section-editor.tsx` | **小节编辑器** |
| `/projects/[id]/sections/[sid]/results` | `.../results/page.tsx` | 小节结果图片 |
| `/assets/presets` | `app/assets/presets/page.tsx` → `preset-manager.tsx` | **预制库管理** |
| `/assets/presets/[presetId]` | `app/assets/presets/[presetId]/page.tsx` | 编辑单个预制 |
| `/assets/presets/sort-rules` | `app/assets/presets/sort-rules/page.tsx` | 预制排序规则 |
| `/assets/preset-groups/[groupId]` | `app/assets/preset-groups/[groupId]/page.tsx` | 编辑预制组 |
| `/assets/templates` | `app/assets/templates/page.tsx` | 项目模板列表 |
| `/assets/templates/new` | `app/assets/templates/new/page.tsx` | 新建模板 |
| `/assets/templates/[id]/edit` | `app/assets/templates/[id]/edit/page.tsx` | 编辑模板 |
| `/assets/loras` | `app/assets/loras/page.tsx` | LoRA 文件管理 |
| `/settings` | `app/settings/page.tsx` | 设置入口 |
| `/settings/monitor` | `app/settings/monitor/page.tsx` | ComfyUI 进程监控 |
| `/settings/logs` | `app/settings/logs/page.tsx` | 后端日志查看 |

> **规律**：`page.tsx` 通常是 Server Component 负责数据获取，同名 `*-client.tsx` 或对应 `components/` 下组件负责渲染。

## 页面级功能需求

> 仅整理页面级功能需求；不调整上面的路由表和目录结构说明。下面的“主要依赖”用于后续定位实现，不表示本次要改代码。

### `/`
- **页面职责**：应用默认入口，负责把用户带到主要工作台。
- **功能需求**：访问根路径时立即进入 `/queue`；不展示独立首页、落地页或过渡页面。
- **状态/边界**：不保留根路径页面状态；如果后续需要默认入口变更，应只调整重定向目标。
- **主要依赖**：`redirect("/queue")`。

### `/login`
- **页面职责**：本地访问令牌登录页，用于建立受保护页面的访问会话。
- **登录表单**：展示应用名称、access token 密码输入框和提交按钮；输入框自动聚焦；提交时读取 `from` 查询参数作为登录后回跳目标，缺省回到 `/queue`。
- **校验流程**：空 token 不请求后端并提示 `Please enter a token`；非空 token 通过 `POST /api/auth/verify` 校验；成功后使用浏览器跳转到目标页面。
- **错误/加载状态**：请求中按钮置为 `Verifying...` 且禁用；后端返回错误时展示错误文本；网络失败时展示 `Request failed`。
- **主要依赖**：`/api/auth/verify`、`useSearchParams`。

### `/queue`
- **页面职责**：生成结果的总审核台，同时覆盖待审核、运行中、失败和回收站四类状态。
- **Tab 与统计**：展示“待审核”“运行中”“失败”“回收站”四个 Tab；每个 Tab 显示对应数量徽标；待审核区额外展示待审核图片数和待处理组数。
- **待审核列表**：按最新 run 分组展示项目名、小节名、完成时间、缩略图、总图数、待审图数；点击卡片进入 `/queue/[runId]` 宫格审核；支持分页、上一页/下一页、页码跳转，并保留 `page` 查询参数。
- **运行中列表**：展示 running/queued 状态、项目名、小节名、开始时间；支持取消单个任务；支持清空运行中队列。
- **失败列表**：展示最近失败任务、错误信息、失败时间；支持按小节重试并刷新队列状态。
- **回收站**：展示已删除图片缩略图、标题、删除时间、原始路径；支持恢复单张图片到原位置。
- **全局操作**：支持手动刷新；支持清空已完成、失败和已取消的历史运行记录；清空前必须确认。
- **自动刷新/提示**：每 5 秒轮询 `/api/queue-data`；新完成任务显示成功 Toast 并提示图片数量；新失败任务显示错误 Toast；从审核页返回时按 `#run-{runId}` 定位卡片。
- **主要依赖**：`getQueueRunsPage`、`getRunningRuns`、`getFailedRuns`、`getTrashItems`、`cancelRun`、`runSection`、`clearRuns`、`clearActiveRuns`、`restoreImage`、`/api/queue-data`。

### `/queue/[runId]`
- **页面职责**：单次 run 的图片审核页，用于集中查看参数、逐张审核、批量处理和进入下一组。
- **顶部导航**：支持返回队列并带回 `#run-{runId}`；支持跳转所属小节；支持跳转所属小节结果页；支持下载本次 run workflow；支持上一组/下一组 run 切换。
- **运行信息**：展示标题、预制名称、小节名、创建时间、待审核数、总张数；展开执行参数，包括 `KSampler1`/`KSampler2` 的 seed、steps、cfg、sampler、denoise，画幅比例、短边像素、batch size、放大倍数、checkpoint、workflow id。
- **Prompt/LoRA 信息**：展示 LoRA1/LoRA2 文件名、权重、启用状态；支持展开正向 Prompt 和 Negative Prompt 文本查看。
- **宫格审核**：展示本 run 全部图片；每张图片显示序号/标签、审核状态、p站/预览/封面标记；支持单张勾选、全选、只选待审核。
- **批量处理**：对已选图片批量保留或批量删除；处理后刷新页面数据；批量处理后提供“保留剩余/删除剩余”并跳到下一组或回到队列。
- **图片放大**：点击图片打开 Lightbox；Lightbox 支持上一张/下一张、保留、删除、标记/取消 p站、标记/取消预览、设为封面、关闭。
- **快捷键**：Lightbox 内支持 `Esc` 关闭，方向键切图，`f` 切换 p站，`2` 切换预览，`c` 设封面，`k` 保留，`Delete/Backspace` 删除。
- **主要依赖**：`getReviewGroup`、`getReviewGroupIds`、`keepImages`、`trashImages`、`/api/runs/[runId]/workflow`、`/api/images/[imageId]/featured`、`/api/images/[imageId]/featured2`、`/api/images/[imageId]/cover`。

### `/projects`
- **页面职责**：项目总入口，用项目卡片承载进入、浏览和删除项目的工作流。
- **项目列表**：展示项目标题、状态、预制名称、小节数量、更新时间、最近运行时间；点击卡片进入项目详情。
- **最近结果预览**：每个项目展示最多 6 张最近结果缩略图；图片边框区分 kept/trashed/普通状态；超过 6 张时显示剩余数量。
- **空态**：没有最近结果时显示“暂无最近结果”；项目列表为空时页面仍保留创建入口。
- **项目操作**：提供“创建新项目”入口；支持删除项目，删除前确认，删除后刷新列表。
- **主要依赖**：`listProjects`、`ProjectDeleteButton`、`deleteProject`。

### `/projects/new`
- **页面职责**：新建项目表单，定义项目级基础配置和初始预制绑定。
- **基础信息**：填写项目标题、Checkpoint、备注；标题和 Checkpoint 为必填。
- **预制绑定**：按预制分类展示选择器；每个分类可选择一个预制或不选择；选择预制后自动选中首个变体。
- **变体选择**：当预制包含多个变体时展示变体下拉框；选择变体后展示该变体的提示词摘要。
- **创建流程**：点击创建后提交标题、checkpoint、预制绑定和备注；创建成功后跳转新项目详情页。
- **状态/错误**：创建中按钮显示加载状态并禁用；创建失败通过 Toast 展示错误。
- **主要依赖**：`getProjectFormOptions`、`createProject`、`CheckpointCascadePicker`。

### `/projects/[projectId]`
- **页面职责**：项目详情和小节管理主页面，承担项目级操作、小节列表、导航和运行入口。
- **项目级操作**：左侧 Sidebar 支持返回项目列表、上一项目/下一项目、运行整组、编辑项目参数、进入项目结果、图片整合导出、保存为模板。
- **运行整组**：运行前可用快捷按钮覆盖 batch size，也可清空覆盖值；提交后显示成功/失败 Toast。
- **小节管理**：顶部工具栏支持添加小节、导入模板、进入项目结果、进入批量创建；空项目显示“暂无小节”引导。
- **小节卡片**：展示小节序号、名称、最近结果缩略图、总图片数、待审数、最新运行状态；点击进入小节编辑；有最近 run 时可进入小节结果或 run 审核。
- **单节操作**：每个展开卡片支持运行本节、复制小节、删除小节；删除前确认；操作成功后刷新或更新本地列表。
- **排序/视图**：小节支持拖拽排序；支持展开视图和紧凑视图切换；紧凑视图支持多选、全选、批量删除。
- **导航体验**：Sidebar 小节导航跟随滚动高亮；点击小节导航平滑滚动；从小节页返回时按 hash 回到原小节；页面会记住项目详情的滚动锚点。
- **主要依赖**：`getProjectDetail`、`runProject`、`runSection`、`addSection`、`copySection`、`deleteSection`、`deleteSections`、`reorderSections`、`importTemplateToProject`、`saveProjectAsTemplate`、`exportProjectImages`。

### `/projects/[projectId]/edit`
- **页面职责**：项目基础信息和新建小节默认参数编辑页。
- **基础信息**：编辑项目标题、Checkpoint、备注；按分类调整项目级预制绑定；标题和 Checkpoint 必填。
- **新建小节默认值**：配置默认画幅比例、默认短边像素、默认 Batch Size、默认放大倍数、默认 Seed 策略。
- **快捷填充**：Batch Size 使用 `1/2/4/8/16` 快捷按钮；放大倍数使用快捷填充按钮。
- **KSampler 默认参数**：分别配置 `KSampler1（第一阶段）` 和 `KSampler2（高清修复）` 的 steps、cfg、sampler、scheduler、denoise。
- **保存流程**：点击保存后提交项目基本信息、预制绑定和默认运行参数；保存成功回到项目详情页；失败显示 Toast。
- **主要依赖**：`getProjectEditData`、`getProjectFormOptions`、`updateProject`、`CheckpointCascadePicker`、`BatchSizeQuickFill`、`UpscaleFactorQuickFill`。

### `/projects/[projectId]/batch-create`
- **页面职责**：基于预制库批量创建项目小节，适合从预制/预制组快速铺开多个小节。
- **预制浏览器**：左侧按分类、文件夹浏览预制和预制组；支持搜索；支持进入/返回文件夹；组分类展示成员数。
- **导入列表**：点击预制或预制组加入右侧导入列表；重复预制不重复加入；导入项可移除，可在浏览器中定位，可用预制名/组名填充小节名。
- **覆盖添加**：当同分类已有项目绑定或导入项时，提供覆盖添加；覆盖会清除同分类导入项和对应项目绑定变体覆盖。
- **变体处理**：导入项有多个变体时可切换变体；项目已有绑定也可在右侧临时切换变体作为创建小节时的覆盖值。
- **画幅配置**：为即将创建的小节选择画幅比例和短边像素，并实时展示解析后的最终宽高。
- **创建流程**：填写或留空小节名；点击创建后把项目绑定、额外导入项、变体覆盖、画幅参数一起用于创建小节；成功后清空小节名并在“最近创建”中保留跳转入口。
- **主要依赖**：`getPresetLibraryV2`、`getProjectEditData`、`createSectionFromTemplate`、`flattenGroup`、`resolveResolution`。

### `/projects/[projectId]/results`
- **页面职责**：项目级结果总览页，用于跨小节查看图片、标记精选用途和设置封面。
- **项目导航**：左侧 Sidebar 支持返回项目详情、上一项目/下一项目结果页、小节结果锚点导航；滚动时高亮当前小节。
- **汇总信息**：顶部展示项目名、小节数、总图片数、p站数量、预览数量、封面状态。
- **小节结果块**：按小节聚合 run 和图片；展示运行次数、图片数、待审数、p站数、预览数、封面状态；可进入对应小节审核页。
- **图片展示**：按响应式列数展示图片；图片底部显示 run index 和标记；大量图片默认折叠两行，可展开/收起。
- **图片操作**：可打开 Lightbox 放大；可设为项目封面；可标记/取消 p站；可标记/取消预览。
- **状态处理**：标记操作采用乐观更新；失败时回滚并 Toast；Lightbox 支持 `Esc` 关闭和左右方向键切图。
- **主要依赖**：`getProjectResults`、`/api/images/[imageId]/featured`、`/api/images/[imageId]/featured2`、`/api/images/[imageId]/cover`。

### `/projects/[projectId]/sections/[sectionId]`
- **页面职责**：单个项目小节编辑器，集中编辑小节名称、运行参数、预制、提示词、LoRA、变更记录和最近结果。
- **顶部区域**：支持返回项目详情并定位当前小节；支持上一节/下一节轻量导航；支持小节名编辑；支持选择/保存 Batch Size 并运行本节；支持下载当前小节 workflow。
- **最近结果**：展示最新完成 run 的缩略图、run index 和图片总数；缩略图状态区分 kept/trashed/普通；可进入小节结果页；无结果时显示空态。
- **Checkpoint 设置**：可单独选择小节 checkpoint；可清除并继承项目 checkpoint；保存时自动提交。
- **画幅与尺寸**：可选择画幅比例、短边像素；实时显示最终生成尺寸；参数变更后自动保存。
- **放大倍数**：可设置放大倍数并用快捷按钮填充；`1x` 模式提示会跳过 Upscale Latent 和 `KSampler2`。
- **KSampler 参数**：分别编辑 `KSampler1（第一阶段）` 和 `KSampler2（高清修复）` 的 steps、cfg、sampler、scheduler、denoise、seed 策略；select 类字段立即保存，数字字段 blur 后保存。
- **预制列表**：展示已导入预制/预制组及所属分类；展示组标记、提示词块数量、LoRA 数量；支持导入预制/预制组、切换已导入预制变体、跳转预制管理定位页、用预制/组名作为小节名。
- **预制删除**：支持级联删除某个预制绑定，删除其提示词块和 LoRA；组导入内容级联删除时会删除同组所有成员；也支持独立删除某个组内预制，只移除该预制对应内容。
- **导入面板**：按分类展示可导入预制和预制组；支持文件夹浏览、返回上级、搜索预制、查看预制 prompt 摘要；预制组导入会先 flatten 后逐个导入。
- **提示词块列表**：正向和负向两列展示；卡片显示块名称、所属分类标签、内容缩略；支持拖拽排序、编辑单块内容、添加自定义正向/负向块。
- **提示词删除**：普通块可直接删除；绑定块删除前提示会级联删除同绑定提示词块和 LoRA；也可独立删除单个提示词块而不影响同绑定其他内容。
- **合成提示词预览**：按当前排序展示最终拼接效果，正向以 `+ [label] content` 形式展示，负向以 `- [label] content` 形式展示。
- **LoRA 列表**：分 LoRA1 和 LoRA2 两列；展示来源分类/自定义标签、预制名或文件名、触发词提示、文件选择器、启用开关、权重输入和 `-.5/-.1/+.1/+.5` 调整按钮。
- **LoRA 排序/删除**：支持拖拽排序；支持手动添加 LoRA；绑定 LoRA 的删除默认级联删除同预制的提示词块和 LoRA，也支持独立删除单条 LoRA。
- **变更记录**：按“运行参数”“提示词”“LoRA”三个维度展示最近 10 条；每条显示标题、摘要、时间和 before/after diff；无记录时显示对应空态。
- **保存状态**：运行参数自动保存显示“保存中/已保存”；LoRA 和提示词更新失败通过 Toast 或错误文本提示。
- **主要依赖**：`prisma.projectSection`、`getPresetLibraryV2`、`getSectionChangeHistory`、`SectionParamsForm`、`SectionNameEditor`、`SectionRunButton`、`SectionEditor`、`PromptBlockEditor`、`LoraListEditor`、`renameSection`、`importPresetToSection`、`switchBindingVariant`、`flattenGroup`、`deleteSectionBlock`。

### `/projects/[projectId]/sections/[sectionId]/results`
- **页面职责**：单个小节的历史运行结果审核页，按 run 分组处理图片。
- **页面导航**：支持返回项目详情/小节编辑；支持进入项目结果总览；支持上一节/下一节结果切换；支持跳转某个 run 到 `/queue/[runId]` 审核。
- **结果概览**：展示小节名称、运行次数、图片总数、待审数；无结果时显示空态。
- **Run 分组**：每个 run 展示 run index、创建时间、状态、待审数；支持整组全选/取消全选。
- **图片审核**：每张图支持选择、打开 Lightbox、查看状态、显示 p站/预览/封面标记；支持单张或已选图片保留/删除。
- **快捷批量**：如果当前 run 没有选择图片，保留/删除按钮默认处理该 run 的所有 pending 图片；如果已有选择，则处理所选图片。
- **Lightbox**：通过 `ResultsGalleryProvider` 共享全页图片列表和标记状态，支持放大查看与前后切换。
- **主要依赖**：`getSectionResults`、`keepImages`、`trashImages`、`ResultsGrid`、`ResultsGalleryProvider`。

### `/assets/presets`
- **页面职责**：预制库管理主页面，统一管理分类、文件夹、预制、预制组和排序入口。
- **分类管理**：左侧展示可拖拽排序的分类；支持新建、编辑、删除分类；分类可配置名称、颜色、图标、类型和插槽模板；slug 由系统生成，前端不暴露填写或编辑入口；删除分类前要求分类下无预制/预制组。
- **排序规则入口**：分类区提供进入 `/assets/presets/sort-rules` 的入口，用于调整导入顺序。
- **预制文件夹**：普通预制分类下支持多级文件夹；可新建、重命名、删除、拖拽排序；面包屑可返回任意上级；删除文件夹前确认。
- **预制列表**：按当前分类/文件夹展示预制卡片；卡片展示名称、变体数、LoRA 数；支持拖拽排序、进入独立预制详情页、移动到文件夹、删除。
- **批量移动**：支持多选当前文件夹下的预制、全选/清除选择、批量移动到目标文件夹。
- **新建预制**：在当前分类/文件夹下创建预制；编辑名称、备注、变体、正负提示词、LoRA1/LoRA2、关联变体；slug 由系统生成。
- **删除预制**：删除前查询使用位置；如果已有小节引用，确认文案需要列出项目/小节和提示词块数量；删除后级联移除相关提示词块和 LoRA。
- **同步预制**：预制保存后同步到所有引用该预制的小节，包含变体和关联变体内容。
- **预制组入口**：组类型分类展示预制组列表；可创建组、进入组详情、管理组文件夹和排序。
- **URL 状态**：用 `category`、`folder`、`preset`、`variant` query 维护定位；旧 `#preset-*` hash 自动跳转到独立预制编辑页。
- **主要依赖**：`getPresetCategoriesWithPresets`、`createPresetCategory`、`updatePresetCategory`、`deletePresetCategory`、`reorderPresetCategories`、`createPresetFolder`、`renamePresetFolder`、`deletePresetFolder`、`moveToFolder`、`reorderPresetFolders`、`createPreset`、`updatePreset`、`createPresetVariant`、`updatePresetVariant`、`upsertPresetVariantBySlug`、`deletePresetCascade`、`syncPresetToSections`、`reorderPresets`。

### `/assets/presets/[presetId]`
- **页面职责**：单个预制的独立编辑页，用于完整编辑预制及其变体内容。
- **基础信息**：编辑预制名称、备注、所属分类/文件夹和启用状态；返回时带回原分类、文件夹、预制和变体定位。
- **变体管理**：展示可拖拽排序的变体列表；支持选择变体、新增变体、删除变体和编辑变体名称；变体 slug 由系统生成。
- **提示词内容**：为当前变体编辑正面提示词和负面提示词；字段 blur 后自动保存。
- **LoRA 配置**：分别维护 LoRA1 和 LoRA2；每条 LoRA 可选择文件、调整权重、启停、删除、排序。
- **关联变体**：可从其他预制中选择关联变体；已关联项可展开预览其正负提示词和 LoRA；支持移除关联。
- **变更历史**：展示预制维度的变更记录，辅助回溯提示词、LoRA、变体等变化。
- **保存/同步**：保存后更新预制和变体；同步到已引用小节；保存中禁用相关操作，失败 Toast。
- **主要依赖**：`getPresetCategoriesWithPresets`、`PresetForm`、`updatePreset`、`updatePresetVariant`、`upsertPresetVariantBySlug`、`deletePresetVariant`、`reorderPresetVariants`、`syncPresetToSections`。

### `/assets/presets/sort-rules`
- **页面职责**：预制导入顺序规则编辑页，控制分类内容导入到小节时的排序。
- **排序维度**：分别配置正向提示词、负向提示词、LoRA1、LoRA2 的分类顺序。
- **拖拽交互**：每个维度独立拖拽排序；拖拽后立即保存对应维度；保存中显示状态，成功后短暂显示已保存。
- **空态**：没有分类时展示空态；返回入口回到 `/assets/presets`。
- **主要依赖**：`prisma.presetCategory.findMany`、`SortRulesEditor`、`updateCategorySortOrders`、`@dnd-kit`。

### `/assets/preset-groups/[groupId]`
- **页面职责**：单个预制组编辑页，用于组合多个预制或子组，供小节一次性导入。
- **基础信息**：编辑预制组名称；保存前名称不可为空；预制组 slug 由系统生成；支持返回预制列表并保留分类、文件夹、组定位。
- **成员管理**：展示组成员；成员可以是预制变体或子组；成员行显示预制名/子组名、变体名或默认变体；预制成员可跳转到对应预制详情。
- **添加/移除成员**：通过成员表单从分类预制或可选子组中添加成员；可移除单个成员；操作后刷新页面。
- **内容预览**：按成员所属预制分类顺序分组预览；展示每个成员的正面提示词、负面提示词、启用 LoRA 文件名和权重。
- **变更历史**：展示预制组维度的变更记录。
- **删除组**：删除前确认；成功后回到对应分类/文件夹的预制列表。
- **主要依赖**：`getPresetCategoriesWithPresets`、`updatePresetGroup`、`deletePresetGroup`、`addGroupMember`、`removeGroupMember`、`AddGroupMemberForm`、`PresetChangeHistoryPanel`。

### `/assets/templates`
- **页面职责**：项目模板列表页，用于浏览、进入编辑、新建和删除模板。
- **模板卡片**：展示模板名称、描述、小节数量、更新时间；点击卡片进入编辑页。
- **模板操作**：提供新建模板入口；支持删除模板，删除前确认，删除后刷新列表。
- **空态**：没有模板时显示空态，引导创建模板。
- **主要依赖**：`listProjectTemplates`、`TemplatesListClient`、`deleteProjectTemplate`。

### `/assets/templates/new`
- **页面职责**：新建项目模板页，先定义模板元信息，再添加可复用小节。
- **模板元信息**：填写模板名称和描述；名称必填。
- **小节草稿**：创建前可添加模板小节；小节默认带画幅、短边、batch、seed、checkpoint、放大倍数和空提示词/LoRA 配置。
- **创建流程**：点击创建模板后保存模板和当前小节配置；成功后跳转到 `/assets/templates/[templateId]/edit`。
- **状态/边界**：创建态保留显式提交按钮；小节尚未持久化时不暴露无法解析的详情路由。
- **主要依赖**：`TemplateFormClient`、`createProjectTemplate`。

### `/assets/templates/[templateId]/edit`
- **页面职责**：项目模板元信息和模板小节结构编辑页。
- **模板信息**：编辑模板名称和描述；编辑态 blur 后自动保存；名称为空时阻止保存并提示。
- **小节列表**：展示模板小节卡片；卡片显示序号、名称、备注摘要、画幅、最终尺寸、batch、放大倍数、checkpoint、prompt 数、LoRA 数。
- **小节操作**：支持添加小节、复制已持久化小节、删除小节、拖拽重排小节；操作后保存到模板。
- **详情入口**：点击已持久化小节进入 `/assets/templates/[templateId]/sections/[sectionIndex]`；未持久化小节不提供详情跳转。
- **左侧导航**：编辑态展示模板小节 Sidebar；支持返回模板列表、小节锚点导航、滚动高亮。
- **空态**：无小节时显示“暂无小节”，保留添加入口。
- **主要依赖**：`getProjectTemplateDetail`、`TemplateFormClient`、`updateProjectTemplate`、`copyProjectTemplateSection`。

### `/assets/templates/[templateId]/sections/[sectionIndex]`
- **页面职责**：单个模板小节详情编辑页，用于配置导入项目时可复用的小节内容。
- **顶部导航**：支持返回模板编辑页；支持上一节/下一节；展示当前小节序号；保存中显示“保存中...”。
- **基础字段**：编辑模板小节名称和备注；blur 或状态变更后自动保存。
- **可选运行参数**：Checkpoint、画幅比例、短边像素、Batch Size、放大倍数、`KSampler1`、`KSampler2` 都可单独“点击设置”或“清除”；空值表示导入项目时不覆盖项目设置。
- **画幅和放大**：画幅控件展示最终宽高；放大倍数支持快捷填充；`1x` 模式提示跳过高清修复。
- **KSampler 参数**：每个 KSampler 可独立启用/清除；启用后编辑 steps、cfg、sampler、scheduler、denoise、seed 策略。
- **预制绑定**：展示已导入预制/预制组、分类、组标记、提示词块数量、LoRA 数；支持导入预制/组、切换变体、跳转预制详情、用预制名作为模板小节名。
- **预制删除**：支持独立删除单个预制绑定；支持级联删除，同组导入会移除整组内容；删除同步清理提示词块和 LoRA。
- **Prompt Blocks**：维护模板小节的正负提示词块；支持添加、编辑、删除、拖拽排序；分类标签用于识别来源。
- **LoRA 配置**：分 LoRA1/LoRA2 维护；支持启停、文件选择、权重调整、触发词查看、拖拽排序、自定义添加、独立/级联删除。
- **保存策略**：所有字段改动以 600ms debounce 或 blur 方式保存到当前模板小节；保存失败 Toast。
- **主要依赖**：`getProjectTemplateDetail`、`getPresetLibraryV2`、`TemplateSectionDetailClient`、`updateProjectTemplateSection`、`resolveTemplatePresetImports`、`flattenGroup`、`ImportPresetPanel`、`TemplatePromptBlockEditor`、`LoraListEditor`。

### `/assets/models`
- **页面职责**：ComfyUI 模型文件统一管理页，覆盖 LoRA 和 checkpoints 的浏览、上传、移动、备注维护。
- **目录浏览**：默认进入 LoRA 根目录；根目录提供 checkpoints 入口；面包屑支持返回模型根、LoRA 根、checkpoints 根和任意上级目录。
- **文件/文件夹列表**：展示文件夹、文件名、文件大小、备注、LoRA 触发词；文件夹可进入；空目录显示空态。
- **上传文件**：支持上传文件到当前目录；LoRA 目录接受 `.safetensors/.ckpt/.pt/.pth`，checkpoint 目录接受 `.safetensors`；上传成功刷新当前目录。
- **移动文件**：文件行提供移动入口；底部弹层选择目标目录；支持浏览目录、返回上级、移动到当前目标；`Esc` 或遮罩关闭。
- **备注/触发词**：文件可编辑备注；LoRA 文件额外编辑触发词；保存成功更新列表并 Toast。
- **状态处理**：加载、错误、空目录、上传成功/失败、移动成功/失败、备注保存中都有明确状态。
- **主要依赖**：`ModelFileManager`、`/api/models/browse`、`/api/models`、`/api/models/move`、`/api/models/notes`。

### `/assets/loras`
- **页面职责**：旧 LoRA 管理入口兼容页。
- **功能需求**：访问后直接重定向到 `/assets/models`，统一由模型文件管理页处理 LoRA。
- **状态/边界**：不展示独立 UI，不保留旧 LoRA 页面状态。
- **主要依赖**：`redirect("/assets/models")`。

### `/settings`
- **页面职责**：系统设置入口页。
- **SFW 模式**：展示 `SfwModeToggle`，支持查看并切换当前 SFW 模式。
- **设置入口**：以卡片形式进入 `ComfyUI 监控` 和 `后端日志`；每个入口展示图标、标题和简短说明。
- **边界说明**：预制管理和项目模板不在设置页内编辑，仅从页面文案提示到对应导航模块。
- **主要依赖**：`SfwModeToggle`、`SectionCard`。

### `/settings/monitor`
- **页面职责**：ComfyUI 进程和健康状态控制台。
- **状态总览**：展示状态徽标、运行时长、PID、重启次数、API 地址、上次健康检查、自动重启状态、错误信息。
- **托管模式操作**：托管模式下支持启动、停止、重启、健康探测；按钮根据当前状态启用/禁用。
- **外部管理模式**：外部管理模式只展示健康探测，不提供启停/重启。
- **健康探测**：手动探测显示成功/失败、延迟和错误信息；探测后刷新状态。
- **日志查看**：展示进程日志；stderr 中真实错误和常见无害信息用不同颜色区分；日志区域可滚动。
- **自动刷新/滚动**：每 5 秒轮询状态；日志默认自动滚到底部，用户上滑后暂停自动滚动，接近底部恢复。
- **异常状态**：加载中显示获取状态提示；无法获取状态时显示 API 连接失败说明。
- **主要依赖**：`/api/comfy/status`、`/api/comfy/start`、`/api/comfy/stop`、`/api/comfy/restart`、`/api/comfy/health-probe`。

### `/settings/logs`
- **页面职责**：后端运行日志查看页。
- **日志来源**：支持切换“应用日志”和“控制台输出”；应用日志来自结构化日志，控制台输出来自 `server.log`。
- **筛选能力**：应用日志支持按模块过滤（`run-executor`、`comfyui-service`、`image-result-service`）和按级别过滤（INFO+、WARN+、ERROR）；控制台输出不展示模块/级别过滤。
- **日志内容**：展示时间、级别、模块、消息、上下文摘要、错误信息；控制台输出根据关键词识别错误行。
- **刷新机制**：默认每 5 秒拉取最新 300 行；支持手动刷新。
- **滚动体验**：默认自动滚动到底部；用户上滑查看历史时暂停自动滚动。
- **空态提示**：应用日志为空时提示需要 `LOG_ENABLE_FILE=true`；控制台输出为空时提示需要用 `npm run start > server.log 2>&1` 方式启动。
- **主要依赖**：`/api/logs`。

### `/design-demos/[[...route]]`
- **页面职责**：前端视觉和交互改版的隔离验证沙箱，不承担真实业务写操作。
- **路由镜像**：内部路由映射真实业务路径，可覆盖队列、审核、项目、项目结果、小节编辑、模型、预制、模板、设置、日志、监控等视图。
- **数据来源**：优先从本地 SQLite、环境变量和文件系统派生 demo 数据；读取失败时使用文件夹图片和静态样例兜底。
- **设计验证**：用于验证新布局、导航、响应式和视觉风格；所有交互应模拟真实页面流程，但不执行真实写入。
- **样式隔离**：样式集中在 `design-demo.module.css` 和 demo 组件内，不依赖修改主应用共享样式。
- **主要依赖**：`loadDesignDemoData`、`DesignDemoApp`、`design-demo.module.css`。

## 核心布局 & Shell

| 文件 | 说明 |
|------|------|
| `app/layout.tsx` | 根布局：字体、metadata、viewport、包裹 `<AppShell>` |
| `components/app-shell.tsx` | **全局 Shell**：`<Toaster>` + `<CustomScrollContainer>` + `<PersistentBottomNav>`，控制页面 padding (`px-4`) |
| `components/persistent-bottom-nav.tsx` | 底部 6 Tab 导航栏 |
| `components/section-card.tsx` | **通用卡片容器**：标题 + 副标题 + 操作区 + 子内容，移动端用 `-mx-4` 撑满宽度 |

## 共享组件 (`components/`)

### 小节/项目编辑

| 组件 | 说明 |
|------|------|
| `section-editor.tsx` | 小节编辑器主组件（提示词块、LoRA、预制导入、变体切换） |
| `prompt-block-editor.tsx` | 提示词块拖拽编辑器 |
| `template-prompt-block-editor.tsx` | 模板场景的提示词块编辑器 |
| `ksampler-panel.tsx` | KSampler 参数面板 |
| `stat-chip.tsx` | 小型统计标签 |

### LoRA 相关

| 组件 | 说明 |
|------|------|
| `lora-cascade-picker.tsx` | 级联 LoRA 浏览器（文件夹 → 文件） |
| `lora-list-editor.tsx` | LoRA 列表拖拽编辑（权重/启停） |
| `lora-binding-editor.tsx` | 单条 LoRA 绑定行编辑器 |

### 预制选择

| 组件 | 说明 |
|------|------|
| `preset-cascade-picker.tsx` | 级联预制选择器（分类 → 文件夹 → 预制） |

### 快速填充

| 组件 | 说明 |
|------|------|
| `batch-size-quick-fill.tsx` | 批量数快捷按钮（1/2/4/8/16） |
| `upscale-factor-quick-fill.tsx` | 放大倍率快捷按钮 |
| `aspect-ratio-picker.tsx` | 宽高比选择器 + 分辨率预览 |

### UI 原语 (`components/ui/`)

| 组件 | 说明 |
|------|------|
| `ui/select.tsx` | 自定义下拉选择器 |
| `ui/custom-scroll-container.tsx` | 自定义滚动条容器（隐藏原生滚动条，JS 渲染） |

## 样式体系

| 文件 | 说明 |
|------|------|
| `app/globals.css` | **唯一 CSS 文件**：引入 Tailwind v4、定义 CSS 变量（`--bg`/`--fg`/`--panel`/`--panel-soft`）、`@theme inline` 配置、自定义滚动条样式 |
| `app/fonts/` | Geist Sans + Geist Mono 字体文件 |
| `postcss.config.mjs` | PostCSS 配置 |

**技术栈**：Tailwind CSS **v4**（CSS-based `@theme` 配置，无 `tailwind.config.js`）、纯暗色主题、无 shadcn/ui、所有样式通过 Tailwind 类名内联。

**关键 CSS 变量**：
- `--bg` — 页面背景色
- `--fg` — 前景文字色
- `--panel` — 卡片/面板背景色
- `--panel-soft` — 次级面板背景色

## 项目详情页文件拆解（最常改）

```
app/projects/[projectId]/
├── page.tsx                 # Server Component：数据获取 + 页面骨架
├── project-detail-actions.tsx  # 项目级操作按钮（运行全部、复制、存模板）
├── section-list.tsx         # ⭐ 小节列表：卡片渲染、拖拽排序、紧凑/展开视图、左侧锚点导航
├── section-actions.tsx      # 小节操作按钮（复制、删除）
└── sections/[sectionId]/
    └── page.tsx             # → 引用 components/section-editor.tsx
```

## 第三方 UI 库

| 库 | 用途 |
|----|------|
| **Sonner** v2.0.7 | Toast 通知 |
| **Lucide React** | 图标（全局使用） |
| **@dnd-kit** | 拖拽排序（提示词块、LoRA 列表、小节列表） |
| **Zod** | Schema 校验 |

## 数据层速查

| 文件 | 说明 |
|------|------|
| `lib/server-data.ts` | **只读查询**：getQueueRuns、getProjectDetail、getSectionResults 等 |
| `lib/actions.ts` | **Server Actions（写操作）**：keepImages、cancelRun、deleteSection 等 |
| `lib/types.ts` | 前端共享类型定义 |
| `lib/db-enums.ts` | 枚举常量（JobStatus、RunStatus 等） |
| `lib/prisma.ts` | Prisma 客户端单例 |
