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
    - docs/design/prototypes/design-delivery-guide.md
    - DESIGN.md
    - docs/design/prototypes/README.md
    - docs/design/prototypes/design-foundations.md
    - docs/design/prototypes/ui-design-roadmap.md
    - docs/design/prototypes/reviews/R01.md
    - docs/design/prototypes/reviews/R01-02.md
    - docs/design/prototypes/reviews/R02-01.md
    - docs/design/prototypes/reviews/R02-02.md
    - docs/design/prototypes/reviews/F-responsive.md
    - docs/design/prototypes/reviews/F-theme.md
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts
    - npm run docs:check
---

# 设计文档

## 用途与权威性

本区域承载[根设计契约](../../DESIGN.md)之下、由源码支持的详细说明。它描述当前模式和归属边界；不会把原型、固件或未导入的样式表提升为生产环境的权威来源。

[HTML 设计原型](prototypes/README.md)与当前生产页面分开。R01-01已确认，R01-02保持暂停。用户于2026-09-12要求继续下一原型，本轮按已有台账制作 [R02-02 项目上下文与导航恢复](prototypes/reviews/R02-02.md)，复用R02-01外壳，业务内容仅占位；其余77项仍为草案。开始制作前必须有独立范围与验收，设计批准仍逐项记录。

## 路由

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| 开始新版设计、处理反复返工或准备设计交付 | [前端设计交付指导](prototypes/design-delivery-guide.md) | R02-01复盘、组件选择、完整交互验证与证据口径。 |
| 修改页面外壳、导航栏、内容框架或密度 | [布局与密度](layout-and-density.md) | 区分 Generation、Training 和 design-demo 界面的组成方式。 |
| 添加或复用控件或功能组件 | [组件模式](component-patterns.md) | 在生产基础组件、共享 demo/Training 组件和功能所有者之间选择。 |
| 修改导航、快捷键、乐观反馈、撤销或动画 | [交互与动效](interaction-and-motion.md) | 保持当前交互语义和减少动态效果行为。 |
| 修改移动端布局或无障碍行为 | [响应式设计与无障碍](responsive-and-accessibility.md) | 记录受支持的断点衔接、安全区域、目标尺寸、ARIA 和媒体契约。 |
| 修改队列或项目图像审核 | [审核工作台](review-workbench.md) | 涵盖筛选、选择、审核操作、灯箱、快捷键和撤销。 |
| 修改 `/design-demos/**` 路由、数据、页头或展示项 | [设计演示治理](design-demo-governance.md) | 标明生效中的注册表和生产/演示边界。 |
| 复用或调整新版基础规则 | [基础规范](prototypes/design-foundations.md)及[基础清单](prototypes/foundations/README.md) | 区分仍保留的规则和需要重新审核的设备呈现，不取消全部基础确认。 |
| 审核当前统一主题及全局配置 | [基础统一主题版](prototypes/reviews/F-theme.md) | 区分官方主题生成、公开配置和页面布局，查看本轮实际验证及迁移边界。 |
| 回查基础适配与局部修订历史 | [基础适配审计与审核](prototypes/reviews/F-responsive.md) | 保留批准基线、数值输入与章节浮层修订，不能代替新主题验证。 |
| 判断当前与后续组件设计范围 | [完整 UI 设计路线](prototypes/ui-design-roadmap.md) | R01-01已确认，R01-02暂停；先审核逐项任务说明，未登记子项不得制作。 |
| 回查列表工具栏、数据表与分页组合 | [R01 审核记录](prototypes/reviews/R01.md) | 查看用户确认的列表版本、适配要求和实际验证；历史结果不替代新组合验收。 |
| 回查已暂停的组织组合 | [R01-02 审核记录](prototypes/reviews/R01-02.md) | 查看偏差原因与历史产物；不作为其他业务页面的通用模板或前置。 |
| 审核本轮导航外壳 | [R02-01 审核记录](prototypes/reviews/R02-01.md) | 两模块四入口与全局工具、桌面收放和手机导航；业务内容仅占位。 |
| 审核项目页签、来源返回与恢复 | [R02-02审核记录](prototypes/reviews/R02-02.md) | 项目／任务来源、两模块页签、深链与失效父级回退。 |
| 启动和查看新版可运行设计稿 | [HTML 设计原型](prototypes/README.md) | 使用独立原型依赖与模拟数据，不作为当前生产实现入口。 |

## 上级路由

- [根设计契约](../../DESIGN.md)
