---
schemaVersion: 1
document:
  type: router
  status: current
  owner: product
  authority:
    subject: product-documentation
    kind: router
  readWhen:
    - 查找当前 Generation、Training 或共享资源的产品知识时
  sources:
    - PRODUCT.md
    - src/lib/work-mode-resources.ts
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts
---

# 产品文档

## 用途与权威性

本区域描述经过验证的当前产品行为。[根产品契约](../../PRODUCT.md)负责平级模式与资源归属边界；这些路由文档为具体任务提供下一步阅读入口。拟议行为仍应保留在 OpenSpec 中。

## 路由

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| 修改常规图像生产行为 | [Generation](generation/README.md) | 路由到 Generation 拥有的运行、项目、预制和模板。 |
| 修改 LoRA 数据集或训练行为 | [Training](training/README.md) | 路由到 Training 拥有的项目、任务、数据集、运行、预制和模板。 |
| 修改模型、设置或持续维护的跨领域参考资料 | [共享资源](shared-resources/README.md) | 区分运行时共享资源与文档拥有的参考资料。 |

## 上级路由

- [产品契约](../../PRODUCT.md)
