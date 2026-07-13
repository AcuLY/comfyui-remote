---
name: ui-ux-pro-max
description: 可搜索的 UI/UX 设计知识库，提供设计系统、体验准则与技术栈建议。
---
# ui-ux-pro-max

这是面向网页与移动应用的综合设计指南。知识库包含 67 种风格、96 组配色、57 组字体搭配、99 条 UX 准则、25 种图表类型，以及 13 个技术栈的实现建议；搜索结果会按优先级给出推荐。

## 前置条件与命令约定

先根据当前操作系统确认 Python 可用。

POSIX（macOS/Linux）必须使用 `python3`：

```bash
python3 --version
```

Windows PowerShell 必须使用 `python`：

```powershell
python --version
```

如果尚未安装 Python，可按操作系统安装：

```bash
# macOS
brew install python3

# Ubuntu/Debian
sudo apt update && sudo apt install python3
```

```powershell
# Windows
winget install Python.Python.3.12
```

所有命令都从仓库根目录执行。Codex Skill 的脚本路径固定为 `.codex/skills/ui-ux-pro-max/scripts/search.py`：

```bash
# POSIX
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "<查询>" --design-system
```

```powershell
# Windows
python .codex/skills/ui-ux-pro-max/scripts/search.py "<查询>" --design-system
```

后续示例使用 POSIX 写法；在 Windows 上执行时，仅将 `python3` 换成 `python`，脚本路径保持不变。

## 使用流程

当用户要求设计、构建、实现、评审、修复或改进 UI/UX 时，按以下流程执行。

### 第 1 步：分析需求

提取这些关键信息：

- 产品类型：SaaS、电商、作品集、仪表盘、落地页等。
- 风格关键词：简约、活泼、专业、优雅、深色模式等。
- 行业：医疗、金融科技、游戏、教育等。
- 技术栈：`React`、`Vue`、`Next.js` 等；未指定时默认使用 `html-tailwind`。

### 第 2 步：生成设计系统（必做）

始终先运行 `--design-system`，获得带推理依据的完整建议：

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "<产品类型> <行业> <关键词>" --design-system [-p "项目名称"]
```

该命令会：

1. 在单一进程中按配置顺序依次搜索产品、风格、配色、落地页和字体五个领域。
2. 使用 `ui-reasoning.csv` 中的规则选择最佳匹配。
3. 返回设计模式、风格、配色、字体和效果。
4. 同时列出应避免的反模式。

示例：

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "美容 水疗 健康 服务" --design-system -p "Serenity Spa"
```

### 第 2 步补充：持久化设计系统

需要跨会话复用分层设计系统时，添加 `--persist`：

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "<查询>" --design-system --persist -p "项目名称"
```

该命令会创建：

- `design-system/<project-slug>/MASTER.md`：保存该项目全局设计规则的唯一事实来源。
- `design-system/<project-slug>/pages/`：保存该项目的页面级覆盖规则。

`<project-slug>` 由项目名称转为小写并把空格替换为连字符；未提供 `-p` 时使用 `default`。

为特定页面生成覆盖规则：

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "<查询>" --design-system --persist -p "项目名称" --page "dashboard"
```

这会额外创建 `design-system/<project-slug>/pages/<page-slug>.md`，其中 `<page-slug>` 由页面名称转为小写并把空格替换为连字符。实现某个页面时，先检查该项目对应的页面文件；存在时由页面规则覆盖同一项目目录下的 `MASTER.md`，不存在时只使用该 `MASTER.md`。

### 第 3 步：按需补充详细搜索

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "<关键词>" --domain <领域> [-n <最大结果数>]
```

| 需求 | 领域 | 示例 |
| --- | --- | --- |
| 更多风格选择 | `style` | `--domain style "glassmorphism dark"` |
| 图表建议 | `chart` | `--domain chart "real-time dashboard"` |
| UX 最佳实践 | `ux` | `--domain ux "animation accessibility"` |
| 备选字体 | `typography` | `--domain typography "elegant luxury"` |
| 落地页结构 | `landing` | `--domain landing "hero social-proof"` |
| 图标选择 | `icons` | `--domain icons "navigation arrow"` |

### 第 4 步：获取技术栈准则

未指定技术栈时使用 `html-tailwind`：

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "<关键词>" --stack html-tailwind
```

可用技术栈（13 个）：`html-tailwind`、`react`、`nextjs`、`astro`、`vue`、`nuxtjs`、`nuxt-ui`、`svelte`、`swiftui`、`react-native`、`flutter`、`shadcn`、`jetpack-compose`。

## 搜索参考

### 可用领域

| 领域 | 用途 | 示例关键词 |
| --- | --- | --- |
| `style` | UI 风格、配色与效果 | `glassmorphism`、`minimalism`、`dark mode`、`brutalism` |
| `color` | 按产品类型选择配色 | `saas`、`ecommerce`、`healthcare`、`beauty`、`fintech`、`service` |
| `chart` | 图表类型与库建议 | `trend`、`comparison`、`timeline`、`funnel`、`pie` |
| `landing` | 页面结构与行动号召策略 | `hero`、`hero-centric`、`testimonial`、`pricing`、`social-proof` |
| `product` | 按产品类型给出建议 | `SaaS`、`e-commerce`、`portfolio`、`healthcare`、`beauty`、`service` |
| `ux` | 最佳实践与反模式 | `animation`、`accessibility`、`z-index`、`loading` |
| `typography` | 字体搭配与 `Google Fonts` | `elegant`、`playful`、`professional`、`modern` |
| `icons` | 图标名称、图标库与使用场景 | `icon`、`lucide`、`heroicons`、`symbol`、`svg icon` |
| `react` | `React`/`Next.js` 性能 | `waterfall`、`bundle`、`suspense`、`memo`、`rerender`、`cache` |
| `web` | 网页界面准则 | `aria`、`focus`、`keyboard`、`semantic`、`virtualize` |

### 可用技术栈

| 技术栈 | 关注点 |
| --- | --- |
| `html-tailwind` | Tailwind 工具类、响应式与无障碍；默认值 |
| `react` | 状态、`Hooks`、性能与组件模式 |
| `nextjs` | `SSR`、路由、图片与 `API` 路由 |
| `astro` | `Islands` 架构、内容集合、渲染与集成 |
| `vue` | `Composition API`、`Pinia` 与 `Vue Router` |
| `nuxtjs` | `Nuxt` 路由、数据获取、渲染与服务端能力 |
| `nuxt-ui` | `Nuxt UI` 组件、主题、表单与布局 |
| `svelte` | `Runes`、`Stores` 与 `SvelteKit` |
| `swiftui` | 视图、状态、导航与动画 |
| `react-native` | 组件、导航与列表 |
| `flutter` | 组件、状态、布局与主题 |
| `shadcn` | `shadcn/ui` 组件、主题、表单与模式 |
| `jetpack-compose` | 可组合函数、修饰符、状态提升与重组 |

## 示例流程

用户请求：“为专业护肤服务制作落地页”。

1. 提取需求：

   - 产品类型：美容与水疗服务。
   - 风格关键词：优雅、专业、柔和。
   - 行业：美容与健康。
   - 技术栈：`html-tailwind`（默认值）。

2. 生成设计系统：

   ```bash
   python3 .codex/skills/ui-ux-pro-max/scripts/search.py "美容 水疗 健康 服务 优雅" --design-system -p "Serenity Spa"
   ```

   输出应包含设计模式、风格、配色、字体、效果和反模式。

3. 按需补充 UX 与字体搜索：

   ```bash
   # 查询动画与无障碍准则
   python3 .codex/skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux

   # 查询备选字体
   python3 .codex/skills/ui-ux-pro-max/scripts/search.py "elegant luxury serif" --domain typography
   ```

4. 获取技术栈准则：

   ```bash
   python3 .codex/skills/ui-ux-pro-max/scripts/search.py "layout responsive form" --stack html-tailwind
   ```

最后综合设计系统、详细搜索结果和技术栈准则，再开始实现。

## 输出格式

`--design-system` 支持两种输出格式：

```bash
# ASCII 方框，适合终端显示，也是默认格式
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system

# Markdown，适合写入文档
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system -f markdown
```

## 提高搜索质量

1. 关键词要具体，例如 `healthcare SaaS dashboard` 优于 `app`。
2. 尝试多组关键词，不同表达可能得到不同洞察。
3. 组合风格、字体与配色领域，形成完整设计系统。
4. 始终搜索 `animation`、`z-index` 和 `accessibility`，检查常见 UX 问题。
5. 使用 `--stack` 获取实现层面的最佳实践。
6. 首次结果不匹配时继续迭代查询。

## 专业 UI 通用规则

### 图标与视觉元素

| 规则 | 推荐 | 避免 |
| --- | --- | --- |
| 不用表情符号充当图标 | 使用 `Heroicons`、`Lucide` 或 `Simple Icons` 的 `SVG` | 使用 🎨、🚀、⚙️ 等表情符号作为 UI 图标 |
| 保持悬停稳定 | 改变颜色或透明度 | 用缩放造成布局跳动 |
| 使用正确品牌标志 | 从 `Simple Icons` 核对官方 `SVG` | 猜测或使用错误路径 |
| 图标尺寸一致 | 固定 `viewBox="0 0 24 24"` 与 `w-6 h-6` | 随意混用尺寸 |

### 交互与光标

| 规则 | 推荐 | 避免 |
| --- | --- | --- |
| 可点击元素显示指针 | 添加 `cursor-pointer` | 交互元素保留默认光标 |
| 提供悬停反馈 | 改变颜色、阴影或边框 | 没有任何交互提示 |
| 过渡平滑 | 使用 `transition-colors duration-200` 等 150–300 毫秒过渡 | 瞬间变化或超过 500 毫秒 |

### 明暗模式对比度

| 规则 | 推荐 | 避免 |
| --- | --- | --- |
| 浅色模式玻璃卡片 | 使用 `bg-white/80` 或更高不透明度 | 使用过于透明的 `bg-white/10` |
| 浅色正文对比度 | 正文使用 `#0F172A`（slate-900）等深色 | 正文使用 `#94A3B8`（slate-400）等浅灰 |
| 浅色次要文字 | 至少使用 `#475569`（slate-600） | 使用 gray-400 或更浅颜色 |
| 边框可见 | 浅色模式使用 `border-gray-200` | 使用不可见的 `border-white/10` |

### 布局与间距

| 规则 | 推荐 | 避免 |
| --- | --- | --- |
| 浮动导航留边 | 使用 `top-4 left-4 right-4` | 使用 `top-0 left-0 right-0` 紧贴页面边缘 |
| 为固定导航留空间 | 内容内边距计入导航高度 | 内容被固定元素遮挡 |
| 容器宽度一致 | 统一使用 `max-w-6xl` 或 `max-w-7xl` | 混用不同最大宽度 |

## 交付前检查清单

### 视觉质量

- [ ] 未使用表情符号充当图标，全部改用 `SVG`。
- [ ] 所有图标来自同一套图标库，例如 `Heroicons` 或 `Lucide`。
- [ ] 品牌标志已通过 `Simple Icons` 核对。
- [ ] 悬停状态不会造成布局偏移。
- [ ] 直接使用 `bg-primary` 等主题颜色类，而不是额外包裹 `var()`。

### 交互

- [ ] 所有可点击元素都有 `cursor-pointer`。
- [ ] 悬停反馈清晰可见。
- [ ] 过渡时间约为 150–300 毫秒。
- [ ] 键盘焦点状态清晰可见。

### 明暗模式

- [ ] 浅色模式文字对比度至少为 4.5:1。
- [ ] 玻璃或透明元素在浅色模式下仍清晰可见。
- [ ] 两种模式下边框都清晰可见。
- [ ] 交付前已实际检查明暗两种模式。

### 布局

- [ ] 浮动元素与页面边缘之间留有合理间距。
- [ ] 固定导航不会遮挡内容。
- [ ] 已检查 375、768、1024 和 1440 px 宽度。
- [ ] 移动端没有横向滚动。

### 无障碍

- [ ] 所有图片都有替代文本。
- [ ] 所有表单控件都有标签。
- [ ] 没有只靠颜色传达信息。
- [ ] 已遵循 `prefers-reduced-motion`。
