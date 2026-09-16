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

不同设备上应保留同一套功能与操作语义，确保导航、表单、审核与错误反馈均可访问。本文件不规定断点、页面布局或控件外观。

根视口启用了 `viewport-fit=cover`。涉及屏幕边缘的控件应考虑 `env(safe-area-inset-top)` 与 `env(safe-area-inset-bottom)`，避免被设备安全区域遮挡。

触摸目标需足够大且避免误触；输入与编辑控件应支持触摸和屏幕键盘。是否可用必须通过对应设备与输入方式验证，不能仅凭样式声明确认。

## 无障碍控件与媒体

- 仅含图标及重复出现的媒体控件需要具体的无障碍名称，不能只依赖提示信息，也不能给每一项使用同一个通用标签。
- 组合选择器应保留 combobox/listbox 角色、展开状态与 active-descendant 状态、选项选中状态、方向键/Home/End 导航和 Escape 处理。
- 可复用的图像缩略图和预览框应包含有意义的 `alt` 文本以及固有宽高元数据；交互包装器应标明其打开的图像。
- 模态界面使用 `role="dialog"` 和 `aria-modal="true"`，并提供可用标签、明确关闭操作和 Escape 处理。修改时应保留所属组件的聚焦与背景交互契约。

这些规则用于标明持续维护的契约，并不证明所有旧页面都已符合要求。发现缺口时，应在所属功能及其聚焦测试中修复，而不是削弱共享规则。

## 相关文档

- [设计文档](README.md)
- [组件模式](component-patterns.md)
