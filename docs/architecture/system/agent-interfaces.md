---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: api-contracts
  authority:
    subject: agent-interfaces
    kind: reference
  readWhen:
    - 需要变更智能体工作流、身份验证、响应封装或 MCP 注册时
    - 需要判断某项操作属于 Generation HTTP、Training HTTP 还是 MCP 时
  sources:
    - src/proxy.ts
    - src/lib/api-response.ts
    - src/app/api/agent/projects/route.ts
    - src/app/api/agent/projects/sync-preset-variant-flow/route.ts
    - tests/test-api-request-json.test.ts
    - src/app/api/training/route.ts
    - src/app/api/mcp/route.ts
    - src/server/mcp/server.ts
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-proxy-dev-internal-paths.test.ts tests/test-global-api-routes.test.ts tests/test-training-api-boundary.test.ts
    - node --import tsx --test tests/test-api-request-json.test.ts tests/test-agent-preset-variant-flow-core.test.ts tests/test-agent-preset-variant-flow-service.test.ts
---

# 智能体接口

## 接口表面

| 接口 | 当前作用 |
| --- | --- |
| 通用 REST API | 为浏览器和程序化调用提供 Generation、审核、资产、运行时管理与 Training 操作。 |
| Generation 智能体 API | 在智能体路由树下提供工作流形式的项目上下文、更新、运行记录、审核与预设变体操作。 |
| Training HTTP 清单 | `GET /api/training` 描述 Training 所属资源、工作流、调度器操作与工作进程回调；链接到的 Training 路由负责实际操作。 |
| MCP | 暴露无状态 Streamable HTTP 传输。当前工具/资源封装 Generation 项目、运行记录、审核与提示词块能力。 |

Training 智能体工作流属于 HTTP 能力；当前 MCP 注册表不是第二套 Training 接口。精确的方法、载荷、例外与资源清单应写入 [API 文档](../../api/README.md)。

## 身份验证边界

受保护的浏览器请求、API 请求与 MCP 路由共用代理认证边界。具体凭据载体、公开例外和失败响应由[API 认证契约](../../api/README.md#认证边界)负责；本文件只维护智能体接口的架构关系。

身份验证基于令牌，而不是来源地址。路由或代理代码都没有把运行时生命周期路由限制为仅回环调用方可用。

## 响应与传输结构

普通 JSON 处理器共享响应封装，但身份验证、旧版原始队列数据、文件下载和 MCP 传输存在例外。精确结构与实现来源由[API 请求与响应契约](../../api/README.md#json-请求与响应边界)负责；智能体不能假设每个端点都采用同一封装。

MCP 为每个请求构建无状态传输，并将工具行为委托给 HTTP 侧 Generation 行为所使用的同一组服务与仓储。对于由智能体发起的变更操作，如果对应服务支持审计，则会传入智能体参与方类型。

## 安全边界

发现某项能力并不等于获得执行所有变更操作的授权。即使智能体可以发现对应路由，队列控制、进程生命周期、文件移动与产物写入仍必须满足其运行时和运维安全要求。

## 相关文档

- [系统架构](README.md)
- [系统上下文](context.md)
- [队列与工作进程执行](execution/queue-worker.md)
