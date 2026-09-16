---
schemaVersion: 1
document:
  type: router
  status: current
  owner: product-design
  authority:
    subject: new-app-prototype-contract
    kind: router
  readWhen:
    - 启动或审核新版应用原型时
    - 判断组件库、非侵入式定制与生产实现的边界时
  sources:
    - docs/design/prototypes/design-foundations.md
    - docs/design/prototypes/design-delivery-guide.md
    - docs/design/prototypes/reviews/F-theme.md
    - docs/design/prototypes/reviews/F-responsive.md
    - docs/design/prototypes/reviews/production-rebuild.md
    - prototypes/app/README.md
  verifiedBy:
    - npm --prefix prototypes/app run build
    - npm run docs:check
---

# 新版应用原型契约

本目录保存新版前端的组件库、定制边界、主题行为与交付口径。2026-09-16 从被删除的历史提交恢复，已去掉颜色、字体、尺寸等视觉风格内容，只保留组件与技术行为契约。

原型代码位于 [`prototypes/app/`](../../../prototypes/app/README.md)，是独立入口：拥有自己的 `package.json`、依赖与开发服务，不 `import` 应用本体，也不经过应用的登录与路由外壳。

## 入口

| 文档 | 内容 |
| --- | --- |
| [新版前端基础规范](design-foundations.md) | 组件库版本、非侵入式定制边界、主题与导航行为契约 |
| [前端设计交付指导](design-delivery-guide.md) | 组件选择顺序、操作链验证与证据口径 |
| [统一主题审核记录](reviews/F-theme.md) | 统一主题职责边界与“非必要不侵入”要求的来源 |
| [响应式适配审核记录](reviews/F-responsive.md) | 原生结构、触控目标与多视口验证的历史 |
| [生产模块重做记录](reviews/production-rebuild.md) | 生产原型的组件与适配契约 |

## 技术基线

组件运行库为 `PrimeReact` `10.9.9` `Styled` 与 `PrimeIcons` `7.0.0`，基础组件全部来自组件库，不手写基础组件，也不维护独立的基础组件演示页。

## 边界

原型使用手工编写的演示数据，操作只更新浏览器内存；不调用生产 `API`、数据库、队列或真实生成服务。交付状态按“本地完成、提交、推送、部署、设计批准”分别说明，原型构建通过不代表应用测试、生产构建或部署完成。

## 上级路由

- [设计文档](../README.md)
