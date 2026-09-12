---
schemaVersion: 1
document:
  type: router
  status: current
  owner: test-infrastructure
  authority:
    subject: testing-knowledge
    kind: router
  readWhen:
    - 为变更选择最小且有说服力的测试时
    - 修改共享测试 fixture、源码契约约定或质量评估时
    - 修改文档治理 CI 或受保护合并门禁时
  sources:
    - tests/README.md
    - tests/fixtures
    - package.json
    - .github/workflows/documentation-governance.yml
  verifiedBy:
    - node --import tsx --test tests/test-documentation-governance.test.ts
    - node --import tsx --test tests/test-documentation-ci.test.ts
    - npm run docs:check
---

# 测试文档

本目录负责独立且当前有效的测试知识。可执行测试文件是行为事实来源，`tests/README.md` 负责源码级 fixture 与测试约定；依赖具体环境的操作步骤属于[运行手册](../runbooks/README.md)。

## 当前契约

- 优先运行能够证明变更边界的最小聚焦测试，再按风险扩大范围。
- 源码契约测试保护稳定接口与架构接缝；应验证由源码支持的子集和不变量，不得复制易变清单或实现格式。
- 比较 Git 或文件系统输出前，把仓库路径统一为 `/`，保证同一断言可在 Windows 与 POSIX 环境运行。
- 共享 fixture 位于 `tests/fixtures/**`；本地运行数据库、日志、指标、生成缓存和密钥都不是 fixture。
- 宽范围测试套件存在基线失败时，必须明确报告；不得削弱无关测试，也不得用新增跳过项隐藏失败。
- 文档治理 CI 在每次推送和拉取请求上运行，不使用仅文档路径过滤；它从完整 Git 历史解析显式比较基线，以完整模式执行非写入检查，并在结束时证明工作树仍然干净。

## 路由

| 任务 | 阅读入口 | 负责人 |
| --- | --- | --- |
| 新增或复用测试 fixture 与辅助函数 | [`tests/README.md`](../../tests/README.md) | 测试套件源码约定 |
| 运行或修改 Phase 0/1 质量评估 | [质量分析](quality-analysis.md) | 质量 fixture、报告与重生成契约 |
| 修改文档治理 CI | [工作流源码](../../.github/workflows/documentation-governance.yml) | 固定依赖、完整比较基线、聚焦测试与非写入证明 |
| 验证本地认证、服务、数据库或 ComfyUI 状态 | [运行手册](../runbooks/README.md) | 环境专用操作流程 |

## 上级入口

- [文档索引](../README.md)
