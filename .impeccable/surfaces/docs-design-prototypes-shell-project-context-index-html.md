---
version: 1
slug: "docs-design-prototypes-shell-project-context-index-html"
primary_target: "docs/design/prototypes/shell/project-context/index.html"
related_targets: ["docs/design/prototypes/src/project-context.jsx","docs/design/prototypes/src/project-context.css","docs/design/prototypes/src/project-context-model.mjs"]
---

# 项目上下文与导航恢复

既有R02-02，2026-09-12用户明确要求继续下一原型；采用 `Operate` 模式，扩展R02-01外壳，沿用基础视觉与共享组件，非新视觉世界。范围和当前契约由 docs/design/prototypes/reviews/R02-02.md 维护。

原型从明确的项目来源样本开始；正式应用与模块切换的任务默认入口不变。生产项目页签为概览、小节、图片、任务；训练为概览、角色档案、参考图、构图、训练素材、任务。使用原生面包屑与页签组件；来源返回和层级返回分开，长名称有完整标题，手机六项页签全部可达。

仅静态模拟项目与任务来源，无真实业务数据和接口。列表搜索及状态筛选写入片段，展开和滚动按模块资源／地址保存到独立会话记录；深链、刷新、前后和返回列表保留状态与定位。无效页签、子项、项目逐级回到同模块最近父级，并就地说明。

项目内容保持明确占位，不设计参数、图片、素材或执行业务。复用 navigation-shell.jsx，避免复制另一套侧栏、底栏、主题和更多逻辑；本项不会使R02-01或其他业务任务自动获批。
