---
schemaVersion: 1
document:
  type: router
  status: current
  owner: deployment-operations
  authority:
    subject: operations/deployment
    kind: router
  readWhen:
    - 构建、重启、部署或恢复生产服务时
    - 确定必要的部署安全顺序时
  sources:
    - AGENTS.md
    - package.json
    - .gitignore
    - src/app/api/worker/status/route.ts
    - src/app/api/training/worker/status/route.ts
    - src/app/api/queue/pause-active/route.ts
    - src/app/api/queue/resume-paused/route.ts
  verifiedBy:
    - npm run docs:check
---

# 生产部署运行手册

## 目的与权威边界

本区域负责生产部署与恢复。一次正常部署是一个有序事务：

1. 交付 Git 变更；
2. 选择真实目标环境与精确目标检出；
3. 获取该目标检出的部署锁；
4. 同时读取 Generation 与 Training worker 状态；
5. Training 活跃时停止，否则仅在必要时暂停 Generation；
6. 仅当 schema 变化时同步真实数据库 provider；
7. 依次构建、重启、验证；
8. 只恢复本次部署暂停的 Generation 批次；
9. 释放锁。

绝不重排 `构建 → 重启 → 验证`。Git 操作发生在锁外；必须先确定精确目标检出，再接触该检出的锁。获取锁后发生任何失败，都必须保留锁，直到受影响状态已查明且本次部署暂停的 Generation 工作已恢复。

## 入口门与目标选择

- 纯文档、文案、原型或其他可证明不影响运行时的变更属于轻量变更，默认跳过构建、重启、部署和公开验证；除非用户要求 `no-commit`、`no-push` 或 `local-only`，仍需遵循 [Git 交付](../git-delivery.md)。
- 修改运行时行为的代码后，检查仓库范围内的服务。如果该检出只有 `next dev`，默认保持本地验证并跳过生产部署；如果存在 `next start`，就在该检出部署，不要通过 SSH 转到其他位置。
- 已在 `mypc` 检出中操作时保持原位。如果当前检出没有服务，且任务不是 `local-only`/`no-deploy`，则检查 `mypc`；生产服务在那里运行时，进入对应检出并在目标拉取或任何其他目标修改前获取其锁。
- 显式 `no-deploy` 或 `push-only` 会跳过生产部署，但不会跳过默认的有边界提交与推送。显式 `local-only` 会跳过生产部署，同时跳过暂存、提交与推送。
- 生产与开发服务混合任务中，先完成生产构建、重启与验证，再管理开发服务；开发操作不得清理生产工件，也不得获取第二把部署锁。

## 何时阅读

- 请求了生产构建、部署拉取、服务重启、数据库同步或公开验证。
- 需要在不扩大进程或队列影响的前提下恢复失败部署。

## 导航

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| 获取、等待、保留或释放互斥锁 | [部署锁](./lock.md) | 负责原子目录锁与失败状态。 |
| 根据 Generation 与 Training 活动设置门禁 | [队列安全](./queue-safety.md) | Training 没有部署暂停/恢复路径；只允许恢复已记录的 Generation 批次。 |
| 同步发生变化的 Prisma schema | [数据库同步](./database-sync.md) | 从真实目标选择 SQLite 或 PostgreSQL，不改写 `.env`。 |
| 生成 Next.js 工件 | [Next.js 构建](./next-build.md) | 防止竞争构建并保留 `.next/cache`。 |
| 替换生产进程 | [服务重启](./service-restart.md) | 只停止本仓库的 `next start` 进程。 |
| 证明已部署服务可用 | [部署验证](./verification.md) | 发现监听端口，并检查本地/公开路由、静态资源、认证、worker 与 ComfyUI。 |

## 验证状态

当前 `verifiedBy` 只证明源码合同、运行手册路由、受控 PowerShell 控制流和确定性文档门禁；它不执行锁操作、队列写入、数据库同步、构建、重启、部署拉取、公开 HTTPS 验证或队列恢复。完成一次真实部署并保存获授权的脱敏证据前，本区域不得声称已经实际演练。

## 上级导航

- [返回运行手册](../README.md)
