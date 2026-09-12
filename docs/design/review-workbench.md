---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: image-review-workbench
    kind: reference
  readWhen:
    - 修改队列审核、项目结果、小节结果、灯箱或审核快捷键时
  sources:
    - src/lib/review-lightbox-state.ts
    - src/lib/review-undo-state.ts
    - tests/test-queue-review-grid-split.test.ts
    - tests/test-project-results-lightbox-parity.test.ts
    - tests/test-review-lightbox-optimistic-navigation.test.ts
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-queue-review-grid-split.test.ts tests/test-project-results-lightbox-parity.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts
---

# 审核工作台

## 当前审核界面

队列审核、项目汇总结果和小节结果彼此相关，但仍由不同功能所有者负责。它们共享的工作台概念包括状态筛选、图像选择、批量保留/丢弃、单图审核、主要与次要精选标记、项目封面选择、打码、灯箱导航和撤销。修改一个界面时，不得假定其他界面共享同一个组件或变更所有者。

选择与筛选控件应在其影响的网格旁保持可见。批量操作只作用于已选择或明确说明的可见集合；破坏性操作不得静默扩大范围。标记状态必须与审核状态区分：`featured`、`featured2` 和 `cover` 不等于 `kept`。

## 灯箱行为

- 打开灯箱时，应保留当前图像序列及其筛选上下文。
- 上一项/下一项操作根据所属界面循环或停止；在支持的界面中，“下一个待审核项”是独立操作。
- 保留操作会乐观前进。丢弃操作移除当前图像并前进，同时保留撤销条目。后台变更失败时必须显示并协调状态。
- 只有当前项会立即加载完整图像；相邻项预加载保持有界，避免请求整个结果集。
- 打码视图和快速打码模式属于明确状态，并在切换图像时重置。

## 键盘契约

可见控件是主要入口，按键只是加速方式。当前审核界面使用 `S`/左方向键和 `F`/右方向键切换上一项/下一项，使用 `I` 或 `D` 与 Escape 处理灯箱打开/关闭上下文，使用 `J`/`W` 保留，使用 `K`/`E` 丢弃，使用 `L`/`R` 标记 `featured`，使用 `;`/`T` 标记 `featured2`，使用单引号设为封面，直接按 `Z` 撤销，并在支持时使用 `H` 切换打码图/原图。队列和小节页面还提供各自可见的导航与运行快捷操作。快捷键处理器应忽略文本输入框和编辑器。

## 相关文档

- [设计文档](README.md)
- [交互与动效](interaction-and-motion.md)
