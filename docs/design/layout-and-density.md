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
    - 修改页面外壳、路由导航或界面所有者时
  sources:
    - src/app/layout.tsx
    - src/components/app-shell.tsx
    - src/components/persistent-bottom-nav.tsx
    - src/components/design-demo-shell/app-shell.tsx
    - src/features/training/shell.tsx
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts src/app/design-demos/shell/app-shell.test.ts tests/test-training-prod-route-shell.test.ts
---

# 布局与密度

本文件保留现有界面的组合与职责说明，不再规定布局风格或密度。

## 界面专用外壳

根布局会刻意跳过 `/training/**`、`/design-demos/**` 和 `/prototype/**` 的常规 `AppShell`。因此，布局指引必须从路由实际使用的外壳出发：

- Generation 页面使用生产 `AppShell` 和持久导航组件。
- Training 使用 `TrainingShell`：它以 `navigationChrome="none"` 组合 `DesignDemoShell`，并把生产环境的持久底部导航作为页脚。Training 页面拥有 `src/features/training/**` 下的路由内容。
- design-demo 界面使用共享外壳，外壳负责路由导航与路由身份。
- `/prototype/**` 是待评审的新版应用完整原型：复用共享 `DesignDemoShell` 与 `design-demo-ui` 组件库，路由与页面由 `src/app/prototype/**` 拥有。

这些是当前实现职责，不构成新版原型的布局要求。

## 导航与操作职责

- 路由身份、返回目标和页面操作应由对应的路由或功能所有者提供。
- 不得因设备尺寸或内容溢出而移除主要标签与操作。
- 控件必须保留聚焦、待处理和禁用状态的可辨识反馈。键盘与触摸访问要求见[响应式设计与无障碍](responsive-and-accessibility.md)。

## 验证边界

外壳测试覆盖当前组合以及 Training 无导航变体。功能页面的行为变更仍需运行该页面的聚焦测试；这些测试不代表新版外观已经确认。

## 相关文档

- [设计文档](README.md)
- [组件模式](component-patterns.md)
