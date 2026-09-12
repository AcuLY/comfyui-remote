---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: design-demo-governance
    kind: reference
  readWhen:
    - 修改 design-demo 路由、页头、数据加载、展示项或 Training 复用时
    - 判断 design-demo 产物是否属于生产权威来源时
  sources:
    - src/app/design-demos/routing/routes.ts
    - src/app/design-demos/routing/header-specs.ts
    - src/app/design-demos/data/load-demo-data.ts
    - src/app/design-demos/routing/showcase-routes.ts
    - src/app/design-demos/showcase/registry.ts
    - src/app/design-demos/features/lora-training/index.ts
    - src/components/design-demo-ui/primitives/button/index.tsx
    - src/components/design-demo-shell/app-shell.module.css
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts src/app/design-demos/routing/routes.test.ts tests/test-design-demo-governance.test.ts
---

# Design-demo 治理

`/design-demos/**` 是生效中的组件实验室和视觉验证界面。它不是产品路由的权威来源，不保证生产数据，也不用于保留静态 HTML 原型。

## 生效中的所有者

| 关注点 | 所有者 |
| --- | --- |
| 路由模式、匹配、工作模式导航和示例路由清单 | `src/app/design-demos/routing/routes.ts` |
| 路由身份、返回链接、元数据和页头操作 | `src/app/design-demos/routing/header-specs.ts` |
| 只读本地 SQLite 加载与回退选择 | `src/app/design-demos/data/load-demo-data.ts` 及其职责集中的数据辅助模块 |
| 展示系列路由 | `src/app/design-demos/routing/showcase-routes.ts` |
| 展示系列、组件条目、用法和状态 | `src/app/design-demos/showcase/registry.ts` |

不得在文档中维护人工复制的路由一致性表。针对这些注册表和生产路由所有者的测试能提供更新鲜的契约。

本文件列出的聚焦验证器会检查已发布的路由、页头、数据、展示项和 Training 适配器入口。它刻意不声称完整 showcase-registry 测试套件已经全绿：更广的套件当前仍存在一个独立的组件样式归属失败，该问题不在本次文档变更范围内，仍保持开放。

## 样式与组件清单边界

当前 design-demo 页面把布局样式放在功能自有的 CSS Module 中，共享视觉与交互组件位于 `src/components/design-demo-ui/**` 和 `src/components/design-demo-shell/**`。演示界面修复不得通过修改 `src/app/globals.css`、从功能样式覆盖共享组件内部选择器，或重新引入 Tailwind、`tailwind-merge`、`class-variance-authority` 依赖来绕过这些所有权边界。视觉差异应通过所属组件的明确属性或所属功能的 CSS Module 表达。

组件系列、条目、示例状态和源码路径只由展示注册表维护。不得恢复源码旁的人工组件清单、迁移表或完成度表；新增展示项时，应同时更新注册表、真实预览和对应聚焦测试。

## 生产环境与 Training 边界

生产环境的 Generation 仍位于其常规路由下。生产环境的 Training 仍位于 `/training/**` 和 `src/features/training/**` 下。design-demo Training 适配器刻意保持为生产 Training 界面的窄范围重新导出；它们不得分叉出第二套 Training 实现，也不得把演示路由变成产品入口。

数据加载器可以用只读模式读取本地 SQLite 数据库；否则会使用回退数据和图像辅助模块。该回退内容只属于演示证据。变更不得把固件内容、静态回退记录或 design-demo 来源摘要呈现为生产状态。

生效样式来自路由实际使用的 React/CSS 模块外壳与组件源码。已归档的静态演示、原型以及未导入的 `src/app/design-system.css` 都不是运行时样式权威来源。

## 相关文档

- [设计文档](README.md)
- [组件模式](component-patterns.md)
- [Training 产品路由](../product/training/README.md)
