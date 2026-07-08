# 设计系统迁移指南

Classification: historical record
Current source: start at `docs/index.md`, then use `DESIGN.md`, `docs/frontend-design-guide.md`, and `docs/ui/**` first. This file is retained only as an archived migration note.

> 从自定义样式迁移到 shadcn/ui + Tailwind CSS 4

---

## ✅ 已完成的工作

### 1. 更新 `globals.css`
- ✅ 添加浅色模式支持（`data-theme="light"`）
- ✅ 更新主色调为青绿色（`oklch(0.6 0.15 165)` / `oklch(0.7 0.15 165)`）
- ✅ 更新次要色为淡粉色（`oklch(0.65 0.12 340)` / `oklch(0.75 0.12 340)`）
- ✅ 添加浅色/深色模式的背景渐变
- ✅ 增大圆角（`--radius: 0.75rem` = 12px）

### 2. 创建主题切换组件
📄 `src/components/theme-toggle.tsx`
- 使用 shadcn Button 组件
- localStorage 持久化
- 平滑过渡动画

### 3. 创建设计系统文档
📄 `docs/shadcn-design-guide.md`
- shadcn 组件使用指南
- Tailwind 工具类参考
- 响应式设计模式
- 最佳实践

---

## 🎨 新的色彩系统

### 主色调（青绿色）
- **浅色模式**: `#10b981` (oklch(0.6 0.15 165))
- **深色模式**: `#34d399` (oklch(0.7 0.15 165))
- **使用**: `bg-primary`, `text-primary`, `border-primary`

### 次要色（淡粉色）
- **浅色模式**: `#f472b6` (oklch(0.65 0.12 340))
- **深色模式**: `#f9a8d4` (oklch(0.75 0.12 340))
- **使用**: `bg-secondary`, `text-secondary`, `border-secondary`

---

## 🚀 如何使用

### 1. 添加主题切换按钮

在任何页面或布局中添加：

```tsx
import { ThemeToggle } from "@/components/theme-toggle"

export default function Layout() {
  return (
    <header>
      <div>Logo</div>
      <ThemeToggle />
    </header>
  )
}
```

### 2. 使用 shadcn 组件

#### 按钮
```tsx
import { Button } from "@/components/ui/button"

// 主按钮（青绿色）
<Button>创建项目</Button>

// 次要按钮
<Button variant="outline">取消</Button>
<Button variant="secondary">保存草稿</Button>

// 危险按钮（淡粉色）
<Button variant="destructive">删除</Button>
```

#### 输入框
```tsx
import { Input } from "@/components/ui/input"

<Input
  type="text"
  placeholder="请输入项目名称"
  className="w-full"
/>
```

### 3. 使用 Tailwind 工具类

#### 卡片组件
```tsx
<div className="rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm">
  <h3 className="text-lg font-semibold text-foreground">标题</h3>
  <p className="mt-2 text-sm text-muted-foreground">描述</p>
</div>
```

#### 标签组件
```tsx
<span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
  进行中
</span>

<span className="inline-flex items-center rounded-lg bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary">
  待审核
</span>
```

#### 响应式网格
```tsx
// 项目卡片：桌面 3列 → 平板 2列 → 移动 1列
<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
  {projects.map(project => <ProjectCard key={project.id} {...project} />)}
</div>
```

---

## 📝 迁移步骤

### 第一步：更新现有页面的样式

#### 替换自定义类名为 Tailwind 工具类

**之前**：
```tsx
<div className="custom-card">
  <h3 className="custom-title">标题</h3>
</div>
```

**之后**：
```tsx
<div className="rounded-xl border border-border bg-card p-6">
  <h3 className="text-lg font-semibold text-foreground">标题</h3>
</div>
```

#### 替换自定义按钮为 shadcn Button

**之前**：
```tsx
<button className="btn-primary">创建</button>
```

**之后**：
```tsx
<Button>创建</Button>
```

### 第二步：添加主题切换功能

在 `src/components/app-shell.tsx` 或主布局中添加：

```tsx
import { ThemeToggle } from "@/components/theme-toggle"

export function AppShell({ children }) {
  return (
    <div>
      <header className="flex items-center justify-between p-4">
        <div>Logo</div>
        <ThemeToggle />
      </header>
      <main>{children}</main>
    </div>
  )
}
```

### 第三步：测试主题切换

1. 启动开发服务器：`npm run dev`
2. 打开浏览器，点击主题切换按钮
3. 验证浅色/深色模式切换正常
4. 验证 localStorage 持久化正常

---

## 🎯 设计原则

### ✅ 推荐做法

1. **UI 组件复用优先（最重要）**
   - 优先使用 shadcn 组件（Button, Input, Select 等）
   - 复用 `src/components/` 中的现有组件
   - 当同一个 UI 模式出现 2 次以上时，立即提取为独立组件
   - 通过组合现有组件创建新功能，而非从头编写

2. **组件复用检查流程**
   ```
   需要新 UI 组件？
   ↓
   1. shadcn/ui 有吗？ → 有 → 直接使用
   ↓ 没有
   2. src/components/ui/ 有吗？ → 有 → 直接使用
   ↓ 没有
   3. src/components/ 有类似的吗？ → 有 → 复用或扩展
   ↓ 没有
   4. 可以组合现有组件吗？ → 可以 → 组合使用
   ↓ 不可以
   5. 创建新组件（设计为可复用）
   ```

3. **使用语义化颜色**
   - 使用 `bg-primary` 而非 `bg-green-500`
   - 使用 `text-foreground` 而非 `text-gray-900`

4. **简化 hover 效果**
   - 轻微上移：`hover:-translate-y-0.5`
   - 边框变色：`hover:border-primary`
   - 轻微阴影：`hover:shadow-sm`

5. **响应式优先**
   - 桌面端优先展示多列
   - 使用 `md:` 和 `lg:` 前缀适配移动端

### ❌ 避免做法

1. **不要重复造轮子**
   - ❌ 创建自定义按钮组件（shadcn 已有 Button）
   - ❌ 重复创建相同功能的组件
   - ❌ 忽略现有组件库

2. **不要使用高饱和度渐变**
   - ❌ `bg-gradient-to-r from-purple-500 to-pink-500`
   - ✅ `bg-primary/10`

3. **不要硬编码颜色**
   - ❌ `bg-[#10b981]`
   - ✅ `bg-primary`

4. **不要过度动画**
   - ❌ `transition-all duration-1000`
   - ✅ `transition-all` (默认 200ms)

---

## 📚 参考文档

- [shadcn 设计指南](./shadcn-design-guide.md)
- [前端设计规范](./frontend-design-guide.md)
- [shadcn/ui 官方文档](https://ui.shadcn.com/)
- [Tailwind CSS 4 文档](https://tailwindcss.com/)

---

## 🔧 常见问题

### Q: 如何添加新的 shadcn 组件？

A: 使用 shadcn CLI：
```bash
npx shadcn@latest add [component-name]
```

例如：
```bash
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add tabs
```

### Q: 如何自定义主题颜色？

A: 修改 `src/app/globals.css` 中的 CSS 变量：
```css
:root[data-theme="light"] {
  --primary: oklch(0.6 0.15 165);  /* 修改这里 */
}
```

### Q: 如何禁用主题切换？

A: 移除 `ThemeToggle` 组件，并在 `globals.css` 中只保留一个主题的变量。

---

**最后更新**：2026-04-30
**版本**：v2.0 (shadcn)
