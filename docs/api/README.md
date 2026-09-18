---
schemaVersion: 1
document:
  type: router
  status: current
  owner: api-contracts
  authority:
    subject: http-and-agent-interfaces
    kind: router
  readWhen:
    - 修改 HTTP 路由家族、认证规则、JSON 响应封装、MCP 传输或工作流模板归属时
    - 选择自动化接口的事实来源时
  sources:
    - src/app/api
    - src/proxy.ts
    - src/lib/api-response.ts
    - src/server/http/request-json.ts
    - src/server/mcp/server.ts
    - src/server/services/comfyui-service.ts
    - config/workflows/standard-workflow.api.json
  verifiedBy:
    - node --import tsx --test tests/test-documentation-governance.test.ts
    - npm run docs:check
---

# API 文档

本目录负责稳定的路由家族、认证边界、响应封装、MCP 传输和工作流配置契约，不提供穷尽式端点清单。精确的方法、参数、schema、MCP 注册与兼容行为，以当前路由处理器、共享辅助函数、服务和聚焦测试为准。

## 接口家族

| 家族 | 稳定用途 | 精确来源 |
| --- | --- | --- |
| `/api/agent/**` | 面向自动化的高层项目、运行、审核与预设操作 | `src/app/api/agent/**/route.ts` |
| `/api/projects/**` | 生图项目与小节操作 | `src/app/api/projects/**/route.ts` |
| `/api/training/**` | 训练模式负责的项目、数据集、任务、运行、预设与模板 | `src/app/api/training/**/route.ts` |
| `/api/preset-library/**` | 生图预设库资源 | `src/app/api/preset-library/**/route.ts` |
| `/api/queue/**` 与 `/api/worker/**` | 队列变更与 Worker 状态接口 | `src/app/api` 下对应的路由处理器 |
| `/api/mcp` | MCP Streamable HTTP 传输，与普通 JSON 路由不同 | `src/app/api/mcp/route.ts` 与 `src/server/mcp/server.ts` |

以上内容只是由源码支持的稳定子集，并不表示已经列出所有公开或内部路由。其他接口应从 `src/app/api/**/route.ts` 发现；修改兼容行为前，还要验证最近的实际调用方。

## 认证边界

`src/proxy.ts` 是请求边界的事实来源。`/login` 页面与 `/api/auth/**` 路由公开可访问；其他浏览器页面均为受保护页面。未携带有效 cookie 的受保护页面请求会重定向到 `/login`，并通过 `from` 查询参数保留原路径。

除 `/api/auth/**` 外，API 请求必须满足以下任一条件：携带与 `AUTH_TOKEN` 匹配的 `auth_token` cookie，或通过 `Bearer token`、`x-api-token`、`x-auth-token` 之一提交有效的 `AUTH_TOKEN`。未授权 API 请求返回 JSON 格式的 `401` 响应。单个路由文档不得重新定义这项全局策略。

## JSON 请求与响应边界

新增或迁移的普通 JSON 处理器应使用 `src/server/http/request-json.ts` 解析请求体，并使用 `src/lib/api-response.ts` 返回响应：

- `ok(data)` 生成 `{ "ok": true, "data": ... }`；
- `fail(message, status, details)` 生成 `{ "ok": false, "error": { "message": ... } }`；只有调用方实际提供 `details` 时，序列化后的响应才包含可选成员 `"details": ...`；
- `failFromError(...)` 保留受控错误携带的状态码和 `details`。

这只是普通 JSON 处理器的默认契约，不代表所有旧接口或流式响应都具有相同结构。兼容例外仍由其源码与调用方共同约束。实现方式见[路由处理器模板](route-handler-template.md)。

## MCP 传输

`/api/mcp` 将 `GET`、`POST` 与 `DELETE` 请求交给 SDK 的 Web Standard Streamable HTTP 传输实现。路由会为每个请求创建无状态传输实例。工具与资源注册只由 `src/server/mcp/server.ts` 负责；本文档不复制它们的名称或数量。

## 工作流配置归属

受版本控制的标准 ComfyUI 提示词图位于 `config/workflows/standard-workflow.api.json`。`src/server/services/comfyui-service.ts` 读取该文件，并把深拷贝交给 `src/server/services/workflow-prompt-builder.ts`，由后者替换单次运行所需的提示词、尺寸、LoRA、采样器与输出路径。运行时配置不属于文档目录。

## 上级入口

- [文档索引](../README.md)
