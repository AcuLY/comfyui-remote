---
schemaVersion: 1
document:
  type: router
  status: current
  owner: development-operations
  authority:
    subject: operations/development
    kind: router
  readWhen:
    - 为全新本地开发检出初始化数据库时
    - 启动、停止或检查本地开发服务时
    - 不部署而验证本地路由、认证或 worker 状态时
  sources:
    - AGENTS.md
    - package.json
    - prisma.config.ts
    - src/app/api/auth/verify/route.ts
    - src/app/api/worker/status/route.ts
    - src/app/api/training/worker/status/route.ts
  verifiedBy:
    - npm run docs:check
---

# 开发环境运行手册

## 目的与权威边界

本区域负责全新本地开发数据库的受控初始化、`next dev` 服务控制与不修改应用数据的本地验证，不负责生产构建、生产重启、公开验证、已有数据库修改或队列控制流程。Generation worker 状态 GET 在 SSH 自动隧道目标下可能创建操作系统进程，必须遵循本地验证手册的事前授权门禁。

## 何时阅读

- 启动、停止、重启或定位当前仓库的开发服务。
- 为全新或明确可丢弃的本地开发数据库执行首次初始化。
- 在不修改应用数据、数据库或队列状态的前提下检查本地认证、受保护页面、两个 worker 子系统或 ComfyUI 连接，并事前处理可能的 SSH 隧道进程副作用。

## 导航

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| 初始化全新本地开发数据库 | [数据库初始化](./database-bootstrap.md) | 验证精确目标、使用 PowerShell 安全命令，并披露迁移与种子副作用。 |
| 管理 `next dev` | [开发服务](./dev-service.md) | 查找仓库与端口精确对应的进程，并避开生产服务。 |
| 探测运行中的应用 | [本地验证](./local-verification.md) | 使用真实监听、POST 认证与 GET 探测，并在 Generation worker 状态检查前授权可能的 SSH 隧道进程副作用。 |

## 上级导航

- [返回运行手册](../README.md)
