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
    - docs/design/README.md
    - src/app/layout.tsx
    - src/app/globals.css
    - src/components/app-shell.tsx
    - src/components/design-demo-shell/app-shell.tsx
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-ui-component-boundaries.test.ts tests/test-design-demo-governance.test.ts
---

# 设计

本文件只保留功能、交互、无障碍与运行时职责边界。上一轮应用原型已删除，原有设计风格及其确认记录不再作为后续设计依据。2026-09-16 按用户要求沿用 `design-demos` 风格重新制作[新版应用完整原型](prototypes/app/README.md)（应用侧栏与任务页），当前待用户评审；这不代表正式界面已获批准或实施。功能规划保留在 [设计文档](docs/design/README.md) 中。

## 界面边界

并不存在要求所有路由统一使用的单一外壳：

- 常规 Generation 页面使用生产环境的 `AppShell` 与持久导航组件；
- `/training/**` 是独立的生产界面，使用共享设计外壳以及由 Training 拥有的路由和页面组件；
- `/design-demos/**` 是组件实验室，不是另一套生产路由树。

Training 与设计演示之间的复用必须保持明确，不得让演示固件、模拟数据或演示路由成为生产环境的权威来源。上述关系仅描述现有运行时职责，不约束新版界面的外观或布局。

## 组件与行为职责

生产基础组件、design-demo/Training 共享组件和功能自有界面各有不同所有者。组件复用应依据稳定的功能契约，不能仅凭命名空间决定生产依赖。状态与操作必须保留文本标签、无障碍名称、禁用状态和待处理反馈。

## 详细指引

- [界面与导航职责](docs/design/layout-and-density.md)
- [组件模式](docs/design/component-patterns.md)
- [交互与动效](docs/design/interaction-and-motion.md)
- [响应式设计与无障碍](docs/design/responsive-and-accessibility.md)
- [审核工作台](docs/design/review-workbench.md)
- [Design-demo 治理](docs/design/design-demo-governance.md)

详细文档描述当前功能契约和验证边界，不提供配色、字体、尺寸、密度或布局风格基线。
