# ComfyUI Manager 设计系统（基于 shadcn/ui）

> 使用 Tailwind CSS 4 + shadcn/ui + @base-ui/react 的设计系统

---

## 🎨 技术栈

- **UI 框架**: React 19 + Next.js 16
- **样式系统**: Tailwind CSS 4
- **组件库**: shadcn/ui (基于 @base-ui/react)
- **工具库**: class-variance-authority, clsx, tailwind-merge
- **图标**: lucide-react

---

## 🌈 色彩系统

### 主题切换
项目支持深色/浅色模式切换，通过 `data-theme` 属性控制：

```html
<html data-theme="light">  <!-- 浅色模式 -->
<html data-theme="dark">   <!-- 深色模式 -->
```

### 色彩变量（globals.css）

#### 深色模式
```css
:root[data-theme="dark"] {
  /* 背景 */
  --bg: #09090b;
  --fg: #f4f4f5;
  --panel: #111217;
  --panel-soft: #171923;

  /* shadcn 语义化颜色 */
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);

  /* 主色调 - 青绿色 */
  --primary: oklch(0.7 0.15 165);           /* #34d399 */
  --primary-foreground: oklch(0.985 0 0);

  /* 次要色 - 淡粉色 */
  --secondary: oklch(0.75 0.12 340);        /* #f9a8d4 */
  --secondary-foreground: oklch(0.985 0 0);

  /* 边框和输入 */
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.7 0.15 165);              /* 聚焦环：青绿色 */

  /* 圆角 */
  --radius: 0.75rem;  /* 12px */
}
```

#### 浅色模式
```css
:root[data-theme="light"] {
  /* 背景 */
  --bg: #f5f7fa;
  --fg: #1a1a1a;
  --panel: #ffffff;
  --panel-soft: #e8ecf1;

  /* shadcn 语义化颜色 */
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.15 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.15 0 0);

  /* 主色调 - 青绿色 */
  --primary: oklch(0.6 0.15 165);           /* #10b981 */
  --primary-foreground: oklch(0.985 0 0);

  /* 次要色 - 淡粉色 */
  --secondary: oklch(0.65 0.12 340);        /* #f472b6 */
  --secondary-foreground: oklch(0.985 0 0);

  /* 边框和输入 */
  --border: oklch(0 0 0 / 8%);
  --input: oklch(0 0 0 / 10%);
  --ring: oklch(0.6 0.15 165);              /* 聚焦环：青绿色 */
}
```

---

## 🧩 shadcn 组件使用

### Button 按钮

```tsx
import { Button } from "@/components/ui/button"

// 主按钮（青绿色）
<Button variant="default">创建项目</Button>

// 次要按钮（边框）
<Button variant="outline">取消</Button>

// 次要按钮（灰色背景）
<Button variant="secondary">保存草稿</Button>

// 幽灵按钮
<Button variant="ghost">更多</Button>

// 危险按钮（淡粉色）
<Button variant="destructive">删除</Button>

// 尺寸
<Button size="xs">超小</Button>
<Button size="sm">小</Button>
<Button size="default">默认</Button>
<Button size="lg">大</Button>

// 图标按钮
<Button size="icon">
  <Plus className="size-4" />
</Button>
```

### Input 输入框

```tsx
import { Input } from "@/components/ui/input"

<Input
  type="text"
  placeholder="请输入项目名称"
  className="w-full"
/>

// 带错误状态
<Input
  type="email"
  aria-invalid="true"
  placeholder="邮箱格式错误"
/>
```

### Select 下拉选择

```tsx
import { Select } from "@/components/ui/select"

<Select>
  <option value="sdxl">SDXL</option>
  <option value="sd15">SD 1.5</option>
</Select>
```

### Tooltip 提示

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

<Tooltip>
  <TooltipTrigger>
    <Button variant="ghost" size="icon">
      <HelpCircle className="size-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>这是帮助提示</p>
  </TooltipContent>
</Tooltip>
```

### Sidebar 侧边栏

```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarProvider
} from "@/components/ui/sidebar"

<SidebarProvider>
  <Sidebar>
    <SidebarContent>
      {/* 侧边栏内容 */}
    </SidebarContent>
  </Sidebar>
</SidebarProvider>
```

---

## 📐 Tailwind 工具类

### 常用类名

#### 背景和文字
```tsx
// 背景
className="bg-background"      // 主背景
className="bg-card"            // 卡片背景
className="bg-muted"           // 柔和背景
className="bg-primary"         // 主色（青绿色）
className="bg-secondary"       // 次要色（淡粉色）

// 文字
className="text-foreground"    // 主文字
className="text-muted-foreground" // 次要文字
className="text-primary"       // 主色文字
className="text-secondary"     // 次要色文字
```

#### 边框和圆角
```tsx
className="border border-border"  // 边框
className="rounded-lg"            // 圆角 (12px)
className="rounded-xl"            // 大圆角 (16px)
className="rounded-2xl"           // 超大圆角 (20px)
```

#### 阴影
```tsx
className="shadow-sm"   // 小阴影
className="shadow-md"   // 中阴影
className="shadow-lg"   // 大阴影
```

#### 毛玻璃效果
```tsx
className="backdrop-blur-xl bg-card/70"
```

---

## 🎯 组件模式

### 卡片组件

```tsx
function ProjectCard({ project }) {
  return (
    <div className="group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm">
      <h3 className="text-lg font-semibold text-foreground">
        {project.title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {project.description}
      </p>
      <div className="mt-4 flex gap-2">
        <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          {project.status}
        </span>
      </div>
    </div>
  )
}
```

### 统计卡片

```tsx
function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold text-foreground">{value}</div>
    </div>
  )
}
```

### 标签组件

```tsx
function Tag({ children, variant = "primary" }) {
  const variants = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    neutral: "bg-muted text-muted-foreground"
  }

  return (
    <span className={cn(
      "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium",
      variants[variant]
    )}>
      {children}
    </span>
  )
}
```

---

## 🎬 动画和过渡

### Hover 效果（简化版）

```tsx
// 卡片 hover
className="transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"

// 按钮 hover（shadcn 内置）
<Button>自动包含 hover 效果</Button>

// 图片 hover
className="transition-transform hover:scale-105"
```

### 过渡时长
```tsx
className="transition-all"           // 200ms (默认)
className="transition-all duration-300"  // 300ms
className="transition-all duration-500"  // 500ms
```

---

## 📱 响应式设计

### 断点
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### 网格布局

```tsx
// 项目卡片：桌面 3列 → 平板 2列 → 移动 1列
<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
  {projects.map(project => <ProjectCard key={project.id} {...project} />)}
</div>

// 图片网格：桌面 6列 → 平板 3列 → 移动 2列
<div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
  {images.map(image => <ImageItem key={image.id} {...image} />)}
</div>

// 统计卡片：桌面 4列 → 移动 2列
<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
  {stats.map(stat => <StatCard key={stat.label} {...stat} />)}
</div>
```

---

## 🔧 工具函数

### cn() - 类名合并

```tsx
import { cn } from "@/lib/utils"

// 合并类名，自动处理冲突
<div className={cn(
  "rounded-lg bg-card p-4",
  isActive && "border-primary",
  className
)} />
```

### cva() - 变体管理

```tsx
import { cva } from "class-variance-authority"

const cardVariants = cva(
  "rounded-lg border p-4 transition-all",
  {
    variants: {
      variant: {
        default: "border-border bg-card",
        primary: "border-primary bg-primary/5",
        secondary: "border-secondary bg-secondary/5"
      },
      size: {
        sm: "p-3 text-sm",
        md: "p-4",
        lg: "p-6 text-lg"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "md"
    }
  }
)

// 使用
<div className={cardVariants({ variant: "primary", size: "lg" })} />
```

---

## 📋 最佳实践

### ✅ 推荐

#### 1. **UI 组件复用优先**
- **优先使用 shadcn 组件**：不要重复造轮子，shadcn 已提供高质量组件
- **复用现有组件**：在创建新组件前，先检查 `src/components/` 是否已有类似组件
- **提取可复用组件**：当同一个 UI 模式出现 2 次以上时，立即提取为独立组件
- **组件组合优于重写**：通过组合现有组件创建新功能，而非从头编写

#### 2. **组件复用检查清单**
在创建新组件前，按顺序检查：
1. ✅ shadcn/ui 是否有现成组件？
2. ✅ `src/components/ui/` 是否有可用组件？
3. ✅ `src/components/` 是否有类似的业务组件？
4. ✅ 是否可以通过组合现有组件实现？
5. ✅ 如果必须创建，是否可以设计为可复用？

#### 3. **其他最佳实践**
- 使用 Tailwind 工具类而非自定义 CSS
- 使用 `cn()` 合并类名
- 使用语义化颜色变量（`bg-primary` 而非 `bg-green-500`）
- 简化 hover 效果（轻微上移 + 边框变色）

### ❌ 避免
- ❌ 不要重复创建相同功能的组件
- ❌ 不要使用高饱和度渐变
- ❌ 不要使用过度的阴影和动画
- ❌ 不要硬编码颜色值
- ❌ 不要忽略现有组件库（shadcn）

---

**最后更新**：2026-04-30
**版本**：v2.0 (shadcn)
