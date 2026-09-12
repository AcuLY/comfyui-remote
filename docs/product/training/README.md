---
schemaVersion: 1
document:
  type: router
  status: current
  owner: product-training
  authority:
    subject: training-product
    kind: router
  readWhen:
    - 修改 LoRA Training 项目、数据集、任务、运行、预制或模板时
    - 判断 Training 是否可以复用 Generation 路由或 API 时
  sources:
    - src/lib/work-mode-resources.ts
    - src/features/training/app.tsx
    - src/features/training/routes.ts
    - src/app/api/training/route.ts
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-training-prod-route-shell.test.ts tests/test-work-mode-resource-boundary.test.ts
---

# Training 产品

Training 是与 Generation 平级的工作模式，用于构建 LoRA 数据集和执行训练任务。生产界面位于 `/training/**`；`src/features/training/routes.ts` 拥有其路由模式，`src/features/training/app.tsx` 负责将路由分派到生产页面。

Training 拥有自己的运行、项目、预制和模板，并使用 `/api/training/**`。当前项目流程包括档案与小节编辑、生成任务、结果、数据集与数据集修订版，以及项目范围内的生成运行和训练运行。这些是当前存在的路由系列，并不承诺所有可能的工作流都已完成。

Generation 路由和 API 不是 Training 的回退路径。只有 `src/lib/work-mode-resources.ts` 声明为共享的资源才能跨越模式边界。对应的 `/design-demos/training/**` 是设计验证界面，不能取代 `/training/**` 作为产品入口。

## 上级路由

- [产品文档](../README.md)
- [根产品契约](../../../PRODUCT.md)
