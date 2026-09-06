---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: ui-component-ownership
    kind: reference
  readWhen:
    - 添加、移动或复用界面基础组件或功能组件时
    - 判断 design-demo 组件是否适合用于生产环境时
  sources:
    - src/components/ui/button.tsx
    - src/components/ui/sidebar.tsx
    - src/components/design-demo-ui/primitives/button/index.tsx
    - src/components/design-demo-ui/primitives/floating-select/index.tsx
    - src/features/training/shell.tsx
    - src/app/projects/project-section-card-components.tsx
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-ui-component-boundaries.test.ts src/components/design-demo-ui/primitives/field/field.test.ts
---

# 组件模式

## 先确定所有者，再选择组件

| 层级 | 当前职责 | 变更规则 |
| --- | --- | --- |
| `src/components/ui/**` | 底层生产基础组件，例如 `button`、`input`、`select`、`separator`、`sheet`、`sidebar`、`skeleton` 和 `tooltip`。 | 保持通用、无障碍且不包含功能领域用语。基础组件需要产品行为时，使用职责集中的包装器。 |
| `src/components/**` | 跨功能生产包装器与交互辅助组件，例如应用外壳、持久导航、相邻导航和硬导航链接。 | 只有当多个生产所有者共享同一行为时才扩展。 |
| `src/components/design-demo-ui/**` | design-demo 组件系统，当前 Training 生产界面也会复用。 | 保留其明确 API、无障碍、反馈和展示覆盖。它不是无关 Generation 生产基础组件的默认命名空间。 |
| `src/app/**` 和 `src/features/training/**` | 路由或功能自有的界面与状态。 | 尚未建立复用关系时保持行为局部化；只提取稳定且经过测试的契约。 |

Training 外壳可以复用共享设计外壳和 design-demo 界面组件，但不能让 design-demo 路由或固件成为生产依赖。反过来，Generation 代码也不需要仅因视觉相似就迁移到 design-demo 命名空间。

## 控件契约

- 创建同一操作的另一种表现形式之前，应先复用距离当前功能最近的既有控件。
- 仅含图标的控件必须有无障碍名称。待处理控件应暴露忙碌状态并阻止重复触发；禁用控件需保持视觉可辨。
- 组合控件应保留键盘和 ARIA 行为。例如，`FloatingSelect` 是 combobox/listbox 契约，而不是“样式化按钮加无结构菜单”。
- 功能模块拥有文案、验证、数据加载和变更操作。底层基础组件不得接管这些职责。

运行时没有导入 `src/app/design-system.css`。其中的 token 清单不是组件注册表，不能覆盖实际组件源码和作用域样式。

## 相关文档

- [设计文档](README.md)
- [响应式设计与无障碍](responsive-and-accessibility.md)
- [Design-demo 治理](design-demo-governance.md)
