---
version: 1
slug: "docs-design-prototypes-components-lists-index-html"
primary_target: "docs/design/prototypes/components/lists/index.html"
related_targets: ["docs/design/prototypes/src/lists.jsx","docs/design/prototypes/src/lists.css","docs/design/prototypes/src/use-prototype-preference.jsx"]
---

# 列表组合原型

范围：`R01-01`，`Operate` 模式。用户已确认基础规范，并同意从列表工具栏、数据表和分页开始。用户在长时间创作工作中需要读清内容、找出记录并明确操作范围；本稿使用固定虚构记录，独立于正式业务页面。

## 方向约定

主题：搜索、筛选、选择和分页围绕同一份列表展开；本页选择有明确数量和范围。

视觉：严格延续已确认的模块色、中性明暗表面、字体、密度与原生库控件。值源仍为 `tokens.css`，不增加色板或装饰性图像。

使用路径：搜索或筛选 → 单项／本页多选 → 复制名称或取消 → 翻页；切换范围清空选择。预览控制单独置于列表外。

首屏：基础原型导航和标题之后是状态／密度控制，下方单一表面容纳字段标签、工具栏、选择条、数据表和分页；移动端改为可选卡片。

形式：已确认方向内的代码组件组合，沿用 R01-01 的明确任务，不再进行概念选择。关键反馈是选择后工具栏显示本页数量，颜色与模块一致。

完成条件：检查真实桌面、中间宽度与手机的关键状态；独立收尾复核并记录发现；按实际范围更新审核记录，用户批准前保持待审核。无交付位图素材。
