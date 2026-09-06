---
schemaVersion: 1
document:
  type: product
  status: current
  owner: product
  authority:
    subject: product-direction
    kind: canonical
  readWhen:
    - 判断变更属于 Generation、Training 还是共享资源时
    - 修改产品工作模式导航或模块归属时
  sources:
    - src/lib/work-mode.ts
    - src/lib/work-mode-resources.ts
    - src/components/persistent-bottom-nav.tsx
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-work-mode-resource-boundary.test.ts
---

# 产品

ComfyUI Manager 在同一个本地管理界面中提供两个平级工作模式：Generation 用于常规图像生产，Training 用于 LoRA 数据集制作与训练。持久导航中的模式控件用于在二者之间切换；任何一个模式都不是另一个模式的子功能。

每个模式分别拥有自己的运行、项目、预制和模板。Generation 使用常规的 `/queue`、`/projects`、`/assets/presets`、`/assets/preset-groups` 和 `/assets/templates` 界面；Training 使用 `/training/**` 和 `/api/training/**`。任何模式都不得静默回退到另一个模式拥有的路由或 API。模型和设置是刻意共享的导航资源：模型导航使用 `/assets/models`，并保留 `/assets/loras` 作为兼容前缀，因此这两个路径都不由 Generation 独占。

本文件只负责产品层边界。当前工作流和资源细节通过[产品文档](docs/product/README.md)继续路由；实现与依赖边界归[架构文档](docs/architecture/README.md)所有。

## 产品领域

- [Generation](docs/product/generation/README.md)——图像生成运行、项目、预制和模板。
- [Training](docs/product/training/README.md)——LoRA 训练项目、数据集、生成任务、训练运行、预制和模板。
- [共享资源](docs/product/shared-resources/README.md)——刻意向两个工作模式开放的资源，以及持续维护的产品参考资料。

## 变更边界

拟议的产品行为应写入已批准的 OpenSpec 变更。本文件及其子文档描述经过验证的当前行为；它们不会把原型、历史计划或 design-demo 固件转化为产品承诺。
