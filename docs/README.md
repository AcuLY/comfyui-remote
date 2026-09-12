---
schemaVersion: 1
document:
  type: router
  status: current
  owner: documentation-governance
  authority:
    subject: documentation-routing
    kind: router
  readWhen:
    - 查找仓库知识的当前维护入口时
    - 判断信息属于当前、已批准目标、生成产物、延期占位还是历史记录时
  sources:
    - README.md
    - docs/_meta/policy.yaml
    - openspec/README.md
  verifiedBy:
    - npm run docs:check
---

# 文档索引

本文件是维护中仓库文档的权威人工入口。它负责知识分类并指向最小权威文档，不重复机器范围、路由清单，也不复制 `docs/_meta/policy.yaml` 中的机械规则。

## 权威分类

| 分类 | 权威来源 | 使用规则 |
| --- | --- | --- |
| 当前 | 根契约、维护中的 `docs/**`、源码、schema、测试与所需运行证据 | 只描述已验证且已经实现的行为。 |
| 已批准目标 | 活跃且经用户批准的 OpenSpec 变更 | 在实现和验证完成、转为当前行为之前，负责提议中的行为。 |
| 生成的当前产物 | 已提交、声明生成器并提供无写入新鲜度检查的产物 | 从输入重新生成，不得手工维护派生事实。 |
| 延期占位 | 仅含元数据的占位文档 | 在激活变更获批前，不拥有任何指标、阈值、模型、发现或待办的决定权。 |
| 历史 | Git 历史与已归档 OpenSpec 变更 | 仅在需要时恢复上下文；未经重新验证，不得作为当前权威。 |

## 任务路由

| 任务 | 阅读入口 | 负责内容 |
| --- | --- | --- |
| 了解仓库 | [仓库入口](../README.md) | 稳定的人类简介与后续路由 |
| 修改跨领域技术边界 | [架构](../ARCHITECTURE.md)和[架构详情](architecture/README.md) | 系统、领域、数据、运行时与执行架构 |
| 修改产品行为或工作模式归属 | [产品](../PRODUCT.md)和[产品详情](product/README.md) | 生图、训练与共享资源 |
| 修改界面或交互 | [设计](../DESIGN.md)和[设计详情](design/README.md) | 当前视觉与交互指导 |
| 修改 HTTP、认证、响应、MCP 或工作流接口 | [API](api/README.md) | 稳定的 API 家族与契约来源 |
| 修改测试基础设施或质量评估 | [测试](testing/README.md) | 测试边界与质量分析契约 |
| 执行本地开发、部署或恢复 | [运行手册](runbooks/README.md) | 可执行运维流程 |
| 修改文档 schema、策略或模板 | [文档控制平面](_meta/README.md) | 仅负责机械治理 |
| 提议重大变更 | [OpenSpec](../openspec/README.md) | 提案、设计、任务、验证和归档生命周期 |

## 生成入口与延期入口

- [仓库清单](repo-inventory.md)由受版本控制的仓库内容和治理元数据生成。
- [Prisma schema 兼容性](prisma-schema-compatibility.md)由两套 provider schema 生成。
- [质量评分](QUALITY_SCORE.md)、[可靠性](RELIABILITY.md)和[安全](SECURITY.md)均为刻意保留的延期占位。它们的元数据只声明激活边界，不包含任何虚构的后续阶段内容。

当前证据与已批准目标冲突时，应保留两者的身份差异，并通过对应 OpenSpec 变更解决。历史材料与当前源码冲突时，以当前已验证行为为准，除非新的变更获得批准。
