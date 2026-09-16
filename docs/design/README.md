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
    - 查找功能规划、交互、无障碍、审核或组件职责时
  sources:
    - DESIGN.md
    - docs/design/planning/ui-design-roadmap.md
    - docs/design/planning/ui-design-coverage.md
    - docs/design/planning/ui-design-shared-plan.md
    - docs/design/planning/ui-design-production-plan.md
    - docs/design/planning/ui-design-training-plan.md
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts
    - npm run docs:check
---

# 设计文档

## 用途与权威性

本区域保留[根设计契约](../../DESIGN.md)之下的功能规划、交互语义、无障碍要求及运行时职责。应用新版原型已删除，原有风格与批准基线不再适用；目前没有已定的新版设计风格。

功能规划不表示已经实现或通过验收。生产能力由实际路由、组件与数据契约确定，演示数据不能成为生产状态依据。

## 功能规划

| 文档 | 内容 |
| --- | --- |
| [功能路线](planning/ui-design-roadmap.md) | 功能范围与任务组织。 |
| [功能覆盖](planning/ui-design-coverage.md) | 现有能力与规划范围的映射。 |
| [共享功能](planning/ui-design-shared-plan.md) | 跨模块资源、导航与公共操作。 |
| [生产模块](planning/ui-design-production-plan.md) | 项目、任务、队列与结果功能。 |
| [训练模块](planning/ui-design-training-plan.md) | 训练资源、任务与结果功能。 |

## 交互与运行时职责

| 任务 | 阅读 |
| --- | --- |
| 修改外壳或路由导航职责 | [界面与导航职责](layout-and-density.md) |
| 添加或复用控件与功能组件 | [组件模式](component-patterns.md) |
| 修改导航、快捷键、变更反馈或撤销 | [交互与动效](interaction-and-motion.md) |
| 修改触摸、键盘、媒体或对话框访问 | [响应式设计与无障碍](responsive-and-accessibility.md) |
| 修改队列或项目图像审核 | [审核工作台](review-workbench.md) |
| 修改组件实验室或 Training 复用关系 | [Design-demo 治理](design-demo-governance.md) |

## 上级路由

- [根设计契约](../../DESIGN.md)
