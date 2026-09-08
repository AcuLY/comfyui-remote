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
    - docs/design/prototypes/reviews/F-responsive.md
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts
    - npm run docs:check
---

# 设计文档

## 用途与权威性

本区域承载[根设计契约](../../DESIGN.md)之下、由源码支持的详细说明。它描述当前模式和归属边界；不会把原型、固件或未导入的样式表提升为生产环境的权威来源。

[HTML 设计原型](prototypes/README.md)单独承载新版可运行稿，与当前生产页面及 `/design-demos/**` 分开。当前[基础页各视口适配](prototypes/reviews/F-responsive.md)修订稿已具备，`F-07`、`F-08`～`F-12` 设备呈现及 `F-14` 待用户复审，已明确的色相、字体和标准密度保留。本轮使用基础专属样式层，实际矩阵、交互验证、独立审查结论及限制分别记录。[完整 UI 设计路线](prototypes/ui-design-roadmap.md)仍暂停后续推进；[R01 列表稿](prototypes/reviews/R01.md)和历史成果保留，待基础适配获用户确认后恢复。

## 路由

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| 修改页面外壳、导航栏、内容框架或密度 | [布局与密度](layout-and-density.md) | 区分 Generation、Training 和 design-demo 界面的组成方式。 |
| 添加或复用控件或功能组件 | [组件模式](component-patterns.md) | 在生产基础组件、共享 demo/Training 组件和功能所有者之间选择。 |
| 修改导航、快捷键、乐观反馈、撤销或动画 | [交互与动效](interaction-and-motion.md) | 保持当前交互语义和减少动态效果行为。 |
| 修改移动端布局或无障碍行为 | [响应式设计与无障碍](responsive-and-accessibility.md) | 记录受支持的断点衔接、安全区域、目标尺寸、ARIA 和媒体契约。 |
| 修改队列或项目图像审核 | [审核工作台](review-workbench.md) | 涵盖筛选、选择、审核操作、灯箱、快捷键和撤销。 |
| 修改 `/design-demos/**` 路由、数据、页头或展示项 | [设计演示治理](design-demo-governance.md) | 标明生效中的注册表和生产/演示边界。 |
| 复用或调整新版基础规则 | [基础规范](prototypes/design-foundations.md)及[基础清单](prototypes/foundations/README.md) | 区分仍保留的规则和需要重新审核的设备呈现，不取消全部基础确认。 |
| 完成当前基础页各视口适配 | [基础适配审计与审核](prototypes/reviews/F-responsive.md) | 从本轮截图记录问题，按同轮代码与证据检查桌面／中间宽度／手机，待用户确认。 |
| 判断后续组件与页面何时恢复设计 | [完整 UI 设计路线](prototypes/ui-design-roadmap.md) | 当前暂停推进，基础适配获用户确认后按依赖恢复。 |
| 回查已做列表工具栏、数据表与分页组合 | [R01 审核记录](prototypes/reviews/R01.md) | 已有稿与历史验证保留，暂停继续扩展，不以旧验证批准本轮基础适配。 |
| 启动和查看新版可运行设计稿 | [HTML 设计原型](prototypes/README.md) | 使用独立原型依赖与模拟数据，不作为当前生产实现入口。 |

## 上级路由

- [根设计契约](../../DESIGN.md)
