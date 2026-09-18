---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: system-architecture
  authority:
    subject: system-context
    kind: reference
  readWhen:
    - 需要变更身份验证、外部集成或文件系统信任边界时
    - 需要判断某个副作用归哪个进程或系统负责时
  sources:
    - .env.example
    - src/proxy.ts
    - src/server/services/comfy-target.ts
    - scripts/training/worker-common.ts
    - src/server/services/auto-censor-runner.ts
    - prisma/schema.prisma
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-proxy-dev-internal-paths.test.ts tests/test-comfy-target-config.test.ts tests/test-training-worker-entrypoints.test.ts tests/test-auto-censor-service-source.test.ts
---

# 系统上下文

## 参与方与系统

| 参与方 | 与应用的关系 |
| --- | --- |
| 人类用户 | 使用需要身份验证的网页和受保护的 API 操作。 |
| HTTP 智能体 | 使用受保护的 Generation 智能体路由，或使用 Training 能力清单及其链接的路由。 |
| MCP 客户端 | 使用 Next.js 应用暴露的无状态 MCP 传输。 |
| Next.js 应用 | 负责请求处理、UI 渲染、大部分 Generation 编排、启动恢复与运行时管理。 |
| PostgreSQL 或 SQLite | 保存通过 Prisma provider 边界选择的持久化业务状态与执行状态。 |
| ComfyUI 目标 | 执行 Generation 提示词图；它可以是已配置的本地目标，也可以是经本地隧道访问的 SSH 目标。 |
| Training 工作进程 | 轮询 Manager HTTP 生命周期，执行图片/数据集/训练工作，并上报进度或完成状态。 |
| 受管文件系统 | 保存关系型状态之外的生成图片、清单、模型文件、日志与训练产物。 |
| 子工具 | Python 图片/内容审查工具、训练运行器、SSH 与 SCP 使用从父进程继承的操作系统权限执行。 |

## 信任边界

Next.js 代理在浏览器、API 与公开例外之间形成统一认证边界。具体 cookie、请求头、公开路径和未授权响应由[API 认证契约](../../api/README.md#认证边界)负责；本架构文档不复制其精确枚举。

代理不强制执行回环来源地址策略。特别是，ComfyUI 启动、停止与重启路由和其他受保护 API 路由使用相同的身份验证边界；默认的 `localhost` 或 `127.0.0.1` URL 只是配置，并不构成访问控制保证。

Training 工作进程生命周期调用使用 `x-api-token`，但这并不等于完整的进程隔离：当前图片工作进程还会在自身进程中通过 Prisma 读取 Training 任务细节。因此，文件系统与运行器配置仍是受信任的运行时输入。

ComfyUI 由活动目标解析器选择。本地目标使用已配置的 API URL 与模型目录；SSH 目标使用远程进程命令和模型根目录，而 HTTP 则经已配置的隧道端点传输。

## 故障边界

数据库可用性、文件系统写入、ComfyUI 可达性、工作进程、SSH 传输与子工具都可能独立失败。请求成功或本地状态转换成功，本身不能证明后续外部副作用已经完成。

## 相关文档

- [系统架构](README.md)
- [运行时拓扑](runtime-topology.md)
- [智能体接口](agent-interfaces.md)
