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
