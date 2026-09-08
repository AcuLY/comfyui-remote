---
schemaVersion: 1
document:
  type: router
  status: current
  owner: product-design
  authority:
    subject: product-design-documentation
    kind: router
  readWhen:
    - 查找当前界面布局、组件、交互、响应式、审核或 design-demo 指引时
    - 查找新版 HTML 设计原型、已确认基础规范与前端设计路线时
  sources:
    - DESIGN.md
    - docs/design/prototypes/README.md
    - docs/design/prototypes/design-foundations.md
    - docs/design/prototypes/ui-design-roadmap.md
    - docs/design/prototypes/reviews/R01.md
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts
    - npm run docs:check
---

# 设计文档

## 用途与权威性

本区域承载[根设计契约](../../DESIGN.md)之下、由源码支持的详细说明。它描述当前模式和归属边界；不会把原型、固件或未导入的样式表提升为生产环境的权威来源。

[HTML 设计原型](prototypes/README.md)单独承载新版的可运行审核稿。它使用自己的依赖、模拟数据和样式，与当前生产页面及 `/design-demos/**` 分开。[新版前端基础设计规范](prototypes/design-foundations.md)已于 2026-09-08 获用户确认，是后续新版设计复用的基础；[完整 UI 设计路线](prototypes/ui-design-roadmap.md)按更新后的业务决策安排全部 64 个覆盖项，用户已同意按路线开始。当前 `R01-01` 列表组合首稿已完成，待用户审核，范围和验证状态见 [R01 审核记录](prototypes/reviews/R01.md)，完整业务页面尚未开始。这些设计产物不表示当前生产样式已经迁移。

## 路由

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| 修改页面外壳、导航栏、内容框架或密度 | [布局与密度](layout-and-density.md) | 区分 Generation、Training 和 design-demo 界面的组成方式。 |
| 添加或复用控件或功能组件 | [组件模式](component-patterns.md) | 在生产基础组件、共享 demo/Training 组件和功能所有者之间选择。 |
| 修改导航、快捷键、乐观反馈、撤销或动画 | [交互与动效](interaction-and-motion.md) | 保持当前交互语义和减少动态效果行为。 |
| 修改移动端布局或无障碍行为 | [响应式设计与无障碍](responsive-and-accessibility.md) | 记录受支持的断点衔接、安全区域、目标尺寸、ARIA 和媒体契约。 |
| 修改队列或项目图像审核 | [审核工作台](review-workbench.md) | 涵盖筛选、选择、审核操作、灯箱、快捷键和撤销。 |
| 修改 `/design-demos/**` 路由、数据、页头或展示项 | [设计演示治理](design-demo-governance.md) | 标明生效中的注册表和生产/演示边界。 |
| 复用或调整新版色彩、字体、间距和基础组件 | [新版前端基础设计规范](prototypes/design-foundations.md)及[确认清单](prototypes/foundations/README.md) | F-01～F-14 已确认；修改按原编号记录和审核。 |
| 选择下一项新版组件、页面或流程设计 | [完整 UI 设计路线](prototypes/ui-design-roadmap.md) | 按组件依赖逐项推进，查阅页面／浮层覆盖、业务来源、状态及审核记录。 |
| 审核当前列表工具栏、数据表与分页组合 | [R01 审核记录](prototypes/reviews/R01.md) | 只覆盖 `R01-01` 与 `C03` 列表部分；跟踪实际验证和用户反馈，不视为整个批次或页面通过。 |
| 启动和查看新版可运行设计稿 | [HTML 设计原型](prototypes/README.md) | 使用独立原型依赖与模拟数据，不作为当前生产实现入口。 |

## 上级路由

- [根设计契约](../../DESIGN.md)
