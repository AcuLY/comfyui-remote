---
schemaVersion: 1
document:
  type: router
  status: current
  owner: product-shared-resources
  authority:
    subject: shared-resource-product
    kind: router
  readWhen:
    - 修改刻意同时对 Generation 和 Training 可见的资源时
    - 编辑持续维护的体位提示词参考资料时
  sources:
    - src/lib/work-mode-resources.ts
    - src/lib/preset-resource-scope.ts
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-work-mode-resource-boundary.test.ts
---

# 共享资源

## 运行时共享资源

模型和设置是目前仅有的、明确在 Generation 与 Training 之间共享的导航资源。模型通过 `/assets/models` 路由；生效中的前缀列表还将 `/assets/loras` 视为同一共享模型资源的 LoRA 兼容路径。设置通过 `/settings` 路由。即使标签相同，运行、项目、预制、预制组和模板仍归各自模式所有。

## 持续维护的参考资料

- [体位预制](position-presets.md)是人工维护的提示词目录。将其放在这里是为了便于发现，并不证明应用会加载该目录，也不表示其中条目是跨模式运行时资源。目录文件本身是其提示词内容经过审核的编辑权威；运行时预制范围代码既不提供也不验证这些提示词条目。

## 上级路由

- [产品文档](../README.md)
- [根产品契约](../../../PRODUCT.md)
