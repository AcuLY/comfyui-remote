---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: product-design-direction
    kind: canonical
  readWhen:
    - 修改用户可见的布局、组件、交互、响应式行为或无障碍能力时
    - 判断生产界面、Training 与 design-demo 界面能否共享实现时
  sources:
    - src/app/layout.tsx
    - src/app/globals.css
    - src/components/app-shell.tsx
    - src/components/design-demo-shell/app-shell.tsx
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-ui-component-boundaries.test.ts tests/test-design-demo-governance.test.ts
---

# 设计

ComfyUI Manager 是紧凑且以任务为导向的工作台。应保持清晰的页面身份、稳定的导航、可见的状态与反馈，以及紧凑但易读的行和网格。语义颜色用于辅助表达状态与操作层级，不能取代文本标签、无障碍名称、禁用状态或待处理状态。

## 界面边界

并不存在要求所有路由统一使用的单一外壳：

- 常规 Generation 页面使用生产环境的 `AppShell` 和持久底部导航；
- `/training/**` 是独立的生产界面，使用共享设计外壳以及由 Training 拥有的路由和页面组件；
- `/design-demos/**` 是组件实验室和视觉验证界面，不是另一套生产路由树。

不得把 design-demo 桌面侧栏变成“所有生产页面都必须有左侧导航栏”的规则。Training 与设计演示之间的复用必须保持明确，也不得让演示固件、模拟数据或演示路由成为生产环境的权威来源。

## 生效样式的权威来源

默认全局主题和两个独立外壳主题均为深色；浅色是明确支持的主题，但不是产品默认应迁移到的方向。运行时全局 token 位于 `src/app/globals.css`，独立外壳 token 位于 `src/components/design-demo-shell/app-shell.module.css`。应用没有导入 `src/app/design-system.css`，不得将其视为生效中的运行时注册表。

应使用距离当前变更最近的既有组件所有者，并把样式限制在所修改的界面中。不得从 design-demo 命名空间推导出通用组件强制规范：生产基础组件、design-demo/Training 共享组件和功能自有界面各有不同边界。

## 详细指引

### 新版已确认基础

2026-09-08 用户确认了[新版前端基础设计规范](docs/design/prototypes/design-foundations.md)，覆盖色彩、字体、尺寸、基础组件状态与通用交互；编号和确认范围见[基础设计清单](docs/design/prototypes/foundations/README.md)。新版原型及后续页面设计复用该基线。本文上方仍描述现有生产界面的生效样式与边界；基础定稿不替换现有生产实现，也不表示后续业务组合、完整页面或生产迁移已通过。

### 现有生产界面

- [布局与密度](docs/design/layout-and-density.md)
- [组件模式](docs/design/component-patterns.md)
- [交互与动效](docs/design/interaction-and-motion.md)
- [响应式设计与无障碍](docs/design/responsive-and-accessibility.md)
- [审核工作台](docs/design/review-workbench.md)
- [Design-demo 治理](docs/design/design-demo-governance.md)

拟议的视觉系统或迁移应写入已批准的 OpenSpec 变更。详细文档描述有证据支持的当前模式与验证边界。
