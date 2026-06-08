# ComfyUI Manager 前端设计规范

> 基于简约现代风格，支持深色/浅色模式切换的设计系统

---

## 🎨 设计原则

### 核心理念
- **简约现代**：干净、清晰、专注内容
- **柔和优雅**：避免高饱和度，使用低对比度的柔和色彩
- **流畅动效**：微妙的过渡和动画，提升交互体验
- **响应式优先**：移动端优先，适配所有屏幕尺寸
- **系统标识不可感知**：slug、内部 id、自动生成键等系统字段由后端或业务层生成和维护，前端不提供填写、编辑、搜索占位或详情展示入口。用户只看到名称、分类、文件夹、状态、备注等业务语义。

### 视觉特征
- 毛玻璃效果（backdrop-filter）
- 柔和的阴影和圆角
- 微妙的动态背景
- 流畅的 hover 和过渡效果

---

## 🌈 色彩系统

### 浅色模式（Light Mode）
```css
:root[data-theme="light"] {
  /* 背景 */
  --bg-primary: #f5f7fa;           /* 主背景 */
  --bg-secondary: #ffffff;         /* 卡片背景 */
  --bg-tertiary: #e8ecf1;          /* 次级背景 */

  /* 文字 */
  --text-primary: #1a1a1a;         /* 主文字 */
  --text-secondary: #666666;       /* 次要文字 */
  --text-tertiary: #999999;        /* 辅助文字 */

  /* 强调色 - 青绿色 */
  --accent-primary: #10b981;       /* 主强调色（翠绿） */
  --accent-primary-hover: #059669; /* hover 状态 */
  --accent-primary-light: rgba(16, 185, 129, 0.08); /* 浅色背景 */

  /* 强调色 - 淡粉色 */
  --accent-secondary: #f472b6;     /* 次强调色（淡粉） */
  --accent-secondary-hover: #ec4899;
  --accent-secondary-light: rgba(244, 114, 182, 0.08);

  /* 边框 */
  --border-primary: rgba(0, 0, 0, 0.06);
  --border-secondary: rgba(0, 0, 0, 0.1);

  /* 阴影 */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);

  /* 毛玻璃 */
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(0, 0, 0, 0.06);
}
```

### 深色模式（Dark Mode）
```css
:root[data-theme="dark"] {
  /* 背景 */
  --bg-primary: #09090b;           /* 主背景 */
  --bg-secondary: #18181b;         /* 卡片背景 */
  --bg-tertiary: #27272a;          /* 次级背景 */

  /* 文字 */
  --text-primary: #fafafa;         /* 主文字 */
  --text-secondary: #a1a1aa;       /* 次要文字 */
  --text-tertiary: #71717a;        /* 辅助文字 */

  /* 强调色 - 青绿色 */
  --accent-primary: #34d399;       /* 主强调色（翠绿，深色模式下更亮） */
  --accent-primary-hover: #10b981;
  --accent-primary-light: rgba(52, 211, 153, 0.12);

  /* 强调色 - 淡粉色 */
  --accent-secondary: #f9a8d4;     /* 次强调色（淡粉，深色模式下更亮） */
  --accent-secondary-hover: #f472b6;
  --accent-secondary-light: rgba(249, 168, 212, 0.12);

  /* 边框 */
  --border-primary: rgba(255, 255, 255, 0.08);
  --border-secondary: rgba(255, 255, 255, 0.12);

  /* 阴影 */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

  /* 毛玻璃 */
  --glass-bg: rgba(24, 24, 27, 0.7);
  --glass-border: rgba(255, 255, 255, 0.08);
}
```

### 语义化颜色
```css
:root {
  /* 状态色 */
  --color-success: var(--accent-primary);
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* 功能色 */
  --color-link: var(--accent-primary);
  --color-link-hover: var(--accent-primary-hover);
}
```

---

## 📐 间距系统

使用 8px 基准网格：

```css
:root {
  --spacing-1: 4px;    /* 0.25rem */
  --spacing-2: 8px;    /* 0.5rem */
  --spacing-3: 12px;   /* 0.75rem */
  --spacing-4: 16px;   /* 1rem */
  --spacing-5: 20px;   /* 1.25rem */
  --spacing-6: 24px;   /* 1.5rem */
  --spacing-8: 32px;   /* 2rem */
  --spacing-10: 40px;  /* 2.5rem */
  --spacing-12: 48px;  /* 3rem */
  --spacing-16: 64px;  /* 4rem */
  --spacing-20: 80px;  /* 5rem */
}
```

---

## 🔤 字体系统

### 字体族
```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

### 字体大小
```css
:root {
  --text-xs: 12px;     /* 0.75rem */
  --text-sm: 13px;     /* 0.8125rem */
  --text-base: 15px;   /* 0.9375rem */
  --text-lg: 18px;     /* 1.125rem */
  --text-xl: 20px;     /* 1.25rem */
  --text-2xl: 24px;    /* 1.5rem */
  --text-3xl: 28px;    /* 1.75rem */
  --text-4xl: 36px;    /* 2.25rem */
  --text-5xl: 48px;    /* 3rem */
  --text-6xl: 56px;    /* 3.5rem */
}
```

### 字重
```css
:root {
  --font-light: 300;
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

---

## 🎯 圆角系统

```css
:root {
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;
}
```

---

## 🎭 组件规范

### 按钮（Button）

#### 主按钮（Primary）
```css
.btn-primary {
  padding: 12px 24px;
  background: var(--text-primary);
  color: var(--bg-primary);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
```

#### 次要按钮（Secondary）
```css
.btn-secondary {
  padding: 12px 24px;
  background: transparent;
  color: var(--text-primary);
  border: 2px solid var(--border-secondary);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--accent-primary);
  transform: translateY(-2px);
}
```

#### 强调按钮（Accent）
```css
.btn-accent {
  padding: 12px 24px;
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-accent:hover {
  background: var(--accent-primary-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
```

---

### 卡片（Card）

#### 基础卡片
```css
.card {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--spacing-6);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-primary);
}
```

#### 带顶部装饰的卡片
```css
.card-decorated {
  position: relative;
  overflow: hidden;
}

.card-decorated::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s ease;
}

.card-decorated:hover::before {
  transform: scaleX(1);
}
```

---

### 输入框（Input）

```css
.input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-primary-light);
}

.input::placeholder {
  color: var(--text-tertiary);
}
```

---

### 标签（Tag/Badge）

```css
.tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--accent-primary-light);
  color: var(--accent-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.tag-secondary {
  background: var(--accent-secondary-light);
  color: var(--accent-secondary);
}
```

---

## 🎬 动画规范

### 过渡时长
```css
:root {
  --transition-fast: 0.15s;
  --transition-base: 0.2s;
  --transition-slow: 0.3s;
  --transition-slower: 0.4s;
}
```

### 缓动函数
```css
:root {
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}
```

### 常用动画

#### 淡入上移
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s var(--ease-out);
}
```

#### 渐变背景动画
```css
@keyframes gradientShift {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

.animate-gradient {
  animation: gradientShift 15s ease infinite;
}
```

---

## 🚫 禁止使用的样式

### ❌ 高饱和度渐变
```css
/* 禁止 */
background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%);
background: linear-gradient(90deg, #ff0000, #00ff00);

/* 推荐：使用低饱和度、柔和的渐变 */
background: linear-gradient(135deg,
  var(--accent-primary-light) 0%,
  var(--accent-secondary-light) 100%
);
```

### ❌ 过度的阴影
```css
/* 禁止 */
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);

/* 推荐：使用柔和的阴影 */
box-shadow: var(--shadow-md);
```

### ❌ 过快的动画
```css
/* 禁止 */
transition: all 0.05s;

/* 推荐：使用合适的时长 */
transition: all var(--transition-base) var(--ease-in-out);
```

---

## 📱 响应式断点

```css
:root {
  --breakpoint-sm: 640px;   /* 手机 */
  --breakpoint-md: 768px;   /* 平板 */
  --breakpoint-lg: 1024px;  /* 笔记本 */
  --breakpoint-xl: 1280px;  /* 桌面 */
  --breakpoint-2xl: 1536px; /* 大屏 */
}
```

### 响应式策略

**桌面优先，移动端适配**：
- 默认样式为桌面端（宽度充足时展示多列）
- 使用 `max-width` 媒体查询向下适配
- 优先保证桌面端的多列展示效果

### 网格布局示例

#### 项目卡片（3列 → 2列 → 1列）
```css
.project-grid {
  display: grid;
  gap: 20px;
  /* 桌面端：3列 */
  grid-template-columns: repeat(3, 1fr);
}

/* 平板：2列 */
@media (max-width: 1024px) {
  .project-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 移动端：1列 */
@media (max-width: 640px) {
  .project-grid {
    grid-template-columns: 1fr;
  }
}
```

#### 图片网格（6列 → 4列 → 3列 → 2列）
```css
.image-grid {
  display: grid;
  gap: 12px;
  /* 桌面端：6列 */
  grid-template-columns: repeat(6, 1fr);
}

/* 桌面：4列 */
@media (max-width: 1399px) {
  .image-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* 平板：3列 */
@media (max-width: 1024px) {
  .image-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 移动端：2列 */
@media (max-width: 640px) {
  .image-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

#### 统计卡片（4列 → 2列）
```css
.stats-grid {
  display: grid;
  gap: 16px;
  /* 桌面端：4列 */
  grid-template-columns: repeat(4, 1fr);
}

/* 平板及移动端：2列 */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

## 🎨 背景装饰

### 动态渐变背景
```css
body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 30%, var(--accent-primary-light) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, var(--accent-secondary-light) 0%, transparent 50%);
  pointer-events: none;
  animation: gradientShift 15s ease infinite;
  z-index: 0;
}
```

---

## 🔗 导航性能约束

### 图片密集页面的跨页出口

项目详情、项目结果、小节结果、队列审核等页面会同时加载大量缩略图或原图。用户点击跨页出口时，优先级是立刻离开当前页面，而不是继续等待当前页面剩余图片下载。

- 图片密集页面的主要跨页出口使用 `src/components/hard-navigation-link.tsx`，或在事件处理里使用 `window.location.assign(href)`。
- 共享的上一项/下一项控件通过 `NeighborNavigation` 的 `hardNavigation` 参数启用硬导航。
- 保留 Next `Link` 给轻量页面、页内分页、筛选、设置类页面，或不会被当前页面大批图片请求拖慢的跳转。
- `loading.tsx`、Suspense 和 prefetch 只能改善目标路由加载观感；它们不会取消当前页面已经发出的图片请求，因此不能替代硬导航。
- 修改这类出口时同步维护 `tests/test-hard-navigation-for-image-heavy-pages.test.ts`，避免回退成软跳转。

---

## 🔧 主题切换实现

### HTML 结构
```html
<button id="theme-toggle" aria-label="切换主题">
  <svg class="sun-icon">...</svg>
  <svg class="moon-icon">...</svg>
</button>
```

### JavaScript 实现
```javascript
// 初始化主题
const theme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', theme);

// 切换主题
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
```

---

## 📋 检查清单

在实现新页面或组件时，请确保：

- [ ] 使用 CSS 变量而非硬编码颜色
- [ ] 同时支持深色和浅色模式
- [ ] 避免高饱和度渐变
- [ ] 使用合适的过渡时长（0.2s - 0.4s）
- [ ] 添加 hover 状态和过渡效果
- [ ] 响应式设计（移动端优先）
- [ ] 使用语义化的 HTML 标签
- [ ] 添加适当的 aria 标签（无障碍）
- [ ] 测试深色/浅色模式下的可读性
- [ ] 确保触摸目标至少 44x44px（移动端）

---

## 🎯 实战示例

详见 `design-demos/` 目录下的示例页面：
- `demo-projects-page.html` - 项目列表页
- `demo-queue-page.html` - 审核队列页
- `demo-review-page.html` - 宫格审图页
- `demo-settings-page.html` - 设置页

---

**最后更新**：2026-04-30
**版本**：v1.0
