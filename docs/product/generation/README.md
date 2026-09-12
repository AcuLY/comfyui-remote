---
schemaVersion: 1
document:
  type: router
  status: current
  owner: product-generation
  authority:
    subject: generation-product
    kind: router
  readWhen:
    - 修改 Generation 运行、项目、预制、模板或相关导航时
    - 判断资源由 Generation 拥有还是共享时
  sources:
    - src/lib/work-mode.ts
    - src/lib/work-mode-resources.ts
    - src/app/queue/page.tsx
    - src/app/projects/page.tsx
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-work-mode-resource-boundary.test.ts
---

# Generation 产品

Generation 是常规图像生产工作模式。其模块自有导航目标包括：`/queue` 下的运行、`/projects` 下的项目、`/assets/presets` 下的预制（`/assets/preset-groups` 属于同一个由 Generation 拥有的预制系列），以及 `/assets/templates` 下的模板。相应 API 入口在 `src/lib/work-mode-resources.ts` 中定义，并与 `/api/training/**` 保持分离。

切换到 Training 时，工作模式开关会保留用户当前使用的资源类别，并在可能时恢复已记住的路由。路由本身也会推断当前模式，因此即使先前存储的是另一个模式，Generation URL 仍归 Generation 所有。

模型和设置不归 Generation 所有。`/assets/models` 及其兼容前缀 `/assets/loras` 属于共享模型资源；请阅读[共享资源路由](../shared-resources/README.md)。详细的运行时归属和数据流属于架构文档，而不是本产品路由文档。

## 任务导航

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| 导出或归档项目 | [项目导出与归档](project-archive.md) | 了解归档门槛、任务取消、受管文件与本地/远端 `ComfyUI` 顶层输出清理，以及非原子失败边界。 |
| 批量替换项目或模板小节中的普通预制 | [小节预制批量替换](preset-section-replacement.md) | 了解预演、阻塞、应用复查、预制组排除和手动 `LoRA` 分离不变量。 |

## 上级路由

- [产品文档](../README.md)
- [根产品契约](../../../PRODUCT.md)
