---
schemaVersion: 1
document:
  type: router
  status: current
  owner: operations
  authority:
    subject: operations/runbooks
    kind: router
  readWhen:
    - 交付仓库变更时
    - 启动或验证本地开发服务时
    - 为全新本地开发检出初始化数据库时
    - 手工运行会修改文件或数据库的维护脚本时
    - 部署或恢复生产服务时
    - 通过 SSH 在 mypc 上运行 PowerShell 时
  sources:
    - AGENTS.md
    - package.json
    - .gitignore
    - docs/runbooks/script-maintenance.md
    - src/app/api/auth/verify/route.ts
    - src/app/api/worker/status/route.ts
    - src/app/api/training/worker/status/route.ts
  verifiedBy:
    - npm run docs:check
---

# 运行手册

## 目的与权威边界

本区域负责可执行的仓库交付、维护脚本、本地开发、部署与 `mypc` 运维流程，并把操作者引导到负责该操作的最小流程。产品与架构事实留在各自文档中，重大变更提案继续由 OpenSpec 管理。

阅读运行手册不等于获得状态修改授权。执行 Git 交付、服务控制、数据库写入、队列控制或部署前，当前任务必须明确授权相应操作。

## 何时阅读

- 需要暂存、提交或推送已完成的变更。
- 需要手工运行会写入受跟踪文档、本地文件或数据库的维护入口。
- 需要启动、停止或验证本地 `next dev` 服务。
- 请求了生产构建、重启、部署或恢复。
- 复杂 PowerShell 命令需要通过 SSH 发送到 `mypc`。

## 导航

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| 暂存、提交或推送有边界的变更 | [Git 交付](./git-delivery.md) | 负责窄范围暂存、运行时排除项、推送行为和失败报告。 |
| 手工运行会写入文件或数据库的维护入口 | [维护脚本](./script-maintenance.md) | 负责目标选择、预演/只读模式、写入开关、退出语义与恢复边界。 |
| 初始化全新本地开发数据库 | [本地数据库初始化](./development/database-bootstrap.md) | 只负责新建或可丢弃目标，明确 Windows 命令、种子副作用和恢复边界。 |
| 启动或检查开发服务 | [开发环境](./development/README.md) | 将本地开发与只读验证和生产部署分开。 |
| 构建、部署、重启或恢复生产环境 | [生产部署](./deployment/README.md) | 负责锁、两类 worker 状态门、数据库同步、构建、重启和验证顺序。 |
| 通过 SSH 发送复杂 PowerShell | [`mypc`](./mypc/README.md) | 负责编码命令传输与远程引号边界。 |

故障归属不明确时，先按受影响表面选择上表入口，再进入对应页面的“故障处理与恢复”。本目录不建立脱离具体操作 owner 的通用恢复步骤，避免同一故障由两套权威给出冲突指令。

## 验证来源

当前 `verifiedBy` 只证明仓库静态合同、受控 PowerShell 控制流和确定性文档门禁；它不执行真实 Git 交付、服务控制、队列修改、数据库同步、构建、重启或公开验证。各操作型运行手册均以自己的 `verificationState` 和 `lastVerified` 声明实际演练状态；没有对应脱敏证据时不得从历史会话推断已经演练。

## 上级导航

- [返回文档入口](../README.md)
