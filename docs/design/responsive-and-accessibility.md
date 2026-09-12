---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: responsive-accessibility
    kind: reference
  readWhen:
    - 修改移动端布局、触摸目标、控件、图像、对话框或键盘访问时
  sources:
    - src/app/layout.tsx
    - src/components/persistent-bottom-nav.tsx
    - src/components/design-demo-shell/app-shell.module.css
    - src/components/design-demo-ui/primitives/floating-select/index.tsx
    - src/components/design-demo-ui/media/image-preview-large/index.tsx
    - src/components/design-demo-ui/media/image-thumb-medium/index.tsx
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts src/app/design-demos/shell/app-shell.test.ts src/components/design-demo-ui/media/image-accessibility.test.ts tests/text-editor-mobile-height.test.ts tests/test-ui-component-boundaries.test.ts
---

# 响应式设计与无障碍

## 响应式衔接与安全区域

共享 design/Training 外壳在移动端组合中使用 `max-width: 639px`，下一档布局从 `min-width: 640px` 开始。修改导航、侧栏、页头或页面网格时，必须保持该衔接点两侧一致。功能样式可以有其他断点；不得把 639/640 描述为全仓库所有局部布局决策的统一替代方案。

根视口启用了 `viewport-fit=cover`。因此，固定和粘滞的移动端导航外观必须保留 `env(safe-area-inset-top)` 与 `env(safe-area-inset-bottom)`。持久底部导航和共享外壳内容内边距已经计入底部安全区域。

共享外壳的移动端顶栏、图标和工具菜单控件目前采用 44px 最小目标尺寸。源码中仍有一个已知缺口：`app-shell.module.css` 内的 `.mobileNavDrawerButton` 为 42×42px。该主要抽屉控件的目标下限应为 44×44px，但不得把当前实现描述为已经达标。弥合缺口需要明确修改运行时界面并进行聚焦验证；本次文档变更只记录缺口，不修改界面。多行编辑器会在 640px 以下刻意增高，而不是继续使用单行输入框高度。

## 无障碍控件与媒体

- 仅含图标及重复出现的媒体控件需要具体的无障碍名称，不能只依赖提示信息，也不能给每一项使用同一个通用标签。
- 组合选择器应保留 combobox/listbox 角色、展开状态与 active-descendant 状态、选项选中状态、方向键/Home/End 导航和 Escape 处理。
- 可复用的图像缩略图和预览框应包含有意义的 `alt` 文本以及固有宽高元数据；交互包装器应标明其打开的图像。
- 模态界面使用 `role="dialog"` 和 `aria-modal="true"`，并提供可用标签、明确关闭操作和 Escape 处理。修改时应保留所属组件的聚焦与背景交互契约。

这些规则用于标明持续维护的契约，并不证明所有旧页面都已符合要求。发现缺口时，应在所属功能及其聚焦测试中修复，而不是削弱共享规则。

## 相关文档

- [设计文档](README.md)
- [组件模式](component-patterns.md)
