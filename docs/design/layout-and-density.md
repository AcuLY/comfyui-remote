---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: layout-and-density
    kind: reference
  readWhen:
    - 修改页面外壳、路由页头、导航栏、内容宽度或工作台密度时
  sources:
    - src/app/layout.tsx
    - src/components/app-shell.tsx
    - src/components/persistent-bottom-nav.tsx
    - src/components/design-demo-shell/app-shell.tsx
    - src/components/design-demo-shell/app-shell.module.css
    - src/features/training/shell.tsx
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts src/app/design-demos/shell/app-shell.test.ts tests/test-training-prod-route-shell.test.ts
---

# 布局与密度

## 界面专用外壳

根布局会刻意跳过 `/training/**` 和 `/design-demos/**` 的常规 `AppShell`。因此，布局指引必须从路由实际使用的外壳出发：

- Generation 页面使用居中的 `max-w-5xl` 内容列、紧凑的垂直间距和固定的持久底部导航。
- Training 使用 `TrainingShell`：它以 `navigationChrome="none"` 组合 `DesignDemoShell`，并把生产环境的持久底部导航作为页脚。Training 页面拥有 `src/features/training/**` 下的路由内容。
- design-demo 界面使用完整的共享外壳。其桌面工作区包含可折叠侧栏和路由页头；移动端布局会把侧栏移到画布外，并提供独立的移动导航控件。

这些是当前组合方式，不代表每个界面都必须统一为左侧栏或相同内容宽度。

## 密度规则

- 优先采用单一清晰的页面层级以及紧凑的行、网格和工具栏，避免反复嵌套装饰性容器。
- 在图像网格、长标识符和元数据周围保留 `min-width: 0`、受限内容宽度和明确的滚动所有者。不得通过隐藏主要标签或操作来解决溢出。
- 当共享外壳提供操作挂载区时，应把路由身份和主要操作放在路由页头中。页面局部页头不应重复这套导航外观。
- 紧凑控件仍需明确区分悬停、聚焦、按下、待处理和禁用状态。移动端目标尺寸见[响应式设计与无障碍](responsive-and-accessibility.md)。

## 验证边界

外壳测试证明当前桌面端/移动端组合以及 Training 无导航变体。功能页面的布局变更仍需运行该页面的聚焦测试；本文件不是像素快照。

## 相关文档

- [设计文档](README.md)
- [组件模式](component-patterns.md)
