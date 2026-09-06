---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: interaction-and-motion
    kind: reference
  readWhen:
    - 修改导航、键盘快捷键、乐观变更、撤销或动效时
  sources:
    - src/components/hard-navigation-link.tsx
    - src/components/neighbor-navigation.tsx
    - src/components/design-demo-ui/primitives/page-header/index.tsx
    - src/app/design-demos/features/runs/queue-page.tsx
    - src/app/design-demos/features/runs/review-page.tsx
    - src/lib/review-lightbox-state.ts
    - src/lib/review-undo-state.ts
    - src/components/design-demo-shell/app-shell.module.css
    - src/components/design-demo-ui/feedback/feedback.module.css
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-section-detail-shortcuts.test.ts
---

# 交互与动效

## 导航与键盘行为

图像密集型 Generation 路由刻意对主要离开操作和相邻项切换使用文档导航。`HardNavigationLink` 和 `NeighborNavigation` 上的 `hardNavigation` 选项属于明确契约；改用软导航可能会保留大量路由状态，必须有聚焦证据支持。

键盘快捷键只是对可见控件的补充。快捷键必须忽略可编辑目标，保留对应按钮或链接，并与指针交互使用相同的变更或导航路径。审核专用按键见[审核工作台](review-workbench.md)。

## Design-demo 返回位置

design-demo 中的列表与详情页使用路由专用的 `sessionStorage` 键保存来源实体。详情页写入实体标识，列表页只读取一次并立即清除，然后在目标元素出现后把它滚动到视口中部。返回控件同时设置 `scroll={false}`，避免框架先把页面滚到顶部。新增同类流程时应复用这一消费一次的语义，但具体键名、目标选择器和所属列表仍由功能源码负责，文档不维护易漂移的路由矩阵。

## 变更反馈与撤销

审核中的保留/丢弃操作会在后台变更前更新本地状态，使灯箱无需等待即可前进。刷新后的服务端属性会与该乐观状态协调，失败的变更会移除乐观记录。丢弃操作维护有序撤销条目；直接按 `Z` 会恢复最新条目，且不会与浏览器或编辑器的修饰键快捷键冲突。

乐观更新不代表可以隐藏失败。应保留可见的待处理/忙碌状态，报告失败的变更，并按照所属辅助模块恢复或协调本地状态。

## 动效

使用短暂过渡来明确悬停、聚焦、展开、路由页头和反馈状态。共享外壳、页头、加载界面和反馈样式都会在 `prefers-reduced-motion: reduce` 下禁用非必要动画与过渡。这些界面中的新动效必须继续受同一减少动态效果边界约束。

## 相关文档

- [设计文档](README.md)
- [审核工作台](review-workbench.md)
