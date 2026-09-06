---
schemaVersion: 1
document:
  type: router
  status: current
  owner: agent-policy
  authority:
    subject: agent-workflow
    kind: canonical
  readWhen:
    - 开始处理本仓库中的任何任务时
    - 判断 Git 交付、开发服务或生产部署边界时
    - 手工运行会写入文件或数据库的维护脚本时
  sources:
    - docs/README.md
    - docs/runbooks/README.md
    - docs/runbooks/git-delivery.md
    - docs/runbooks/script-maintenance.md
    - docs/runbooks/development/README.md
    - docs/runbooks/deployment/README.md
    - docs/runbooks/mypc/README.md
  verifiedBy:
    - node --import tsx --test tests/test-agent-policy-runbooks.test.ts
    - npm run docs:check
---

# 智能体规则入口

本文件是普通开发工作流硬策略的唯一权威，也是操作运行手册的触发路由。阅读运行手册只是在确定边界；执行 Git、服务、数据库、队列或部署修改仍需当前任务授权。

## 始终遵守的硬策略

- 保留无关工作树改动，只处理并暂存当前任务的明确文件；范围无法安全区分时停止并报告，绝不能使用 `git add -A` 扩大范围。
- 运行时文件、日志、数据库、`.next/`、`.deploy.lock/`、生成缓存、本地配置和秘密不得提交，除非用户明确批准该精确范围。
- 完成受跟踪变更后，默认进行有边界的提交与推送。`不部署`、`先不部署`、`no-deploy`、`push-only` 或 `只推送` 只跳过构建、重启、部署和公开验证；它们不跳过默认提交与推送。`local-only` 跳过全部 Git 交付；`no-commit` 同时跳过提交与推送；`no-push` 只跳过推送。
- Git 暂存、提交和推送不受 `.deploy.lock` 保护，也不得因已有锁而等待；目标机器 `git pull` 只有作为部署或其他运行时修改的一部分时才受锁保护。
- 代码变更结束前检查本仓库真实运行状态。只有本地 `next dev` 时默认留在开发验证；当前检出或 `mypc` 存在 `next start` 时，除非任务明确为 `local-only`、`no-deploy` 或 `push-only`，否则进入正常生产部署流程。纯文档、文案或原型等可证明不影响运行时的轻量变更默认不部署。
- 纯开发服务操作不是生产部署：不得获取 `.deploy.lock`，不得同步 Prisma、清理 `.next`、生产构建、控制队列、重启生产服务或公开验证，也不自动触发 Git 操作。
- 绝不能停止所有 `node.exe`。禁止使用 `Stop-Process -Name node -Force`；只能停止运行手册精确识别的当前仓库目标进程树。
- 如果任务在纯开发与生产部署之间有歧义，先完成分类，再接触 `.deploy.lock`、队列、数据库、构建产物或运行时服务。
- 本仓库使用的 Next.js 与常见训练数据可能不同。编写 Next.js 代码前，先阅读 `node_modules/next/dist/docs/` 中与任务相关的指南和弃用说明。
- 本地 UI 验证需要登录时，只从项目根 `.env` 读取 token；不得硬编码、输出、记录或提交 token。
- 已有计划包含可独立执行的模块时，优先交给子代理。主代理必须划清文件边界和验收标准，并在合并结果前检查冲突、遗漏、遗留兼容路径与临时绕过。

## 触发路由

| 任务触发条件 | 必读入口 |
| --- | --- |
| 暂存、提交、推送或任何 Git 交付，包括明确不部署 | [Git 交付](docs/runbooks/git-delivery.md) |
| 启动、停止、重启或定位 `next dev` | [开发服务](docs/runbooks/development/dev-service.md) |
| 为全新本地开发检出初始化数据库 | [本地数据库初始化](docs/runbooks/development/database-bootstrap.md) |
| 本地登录、认证、受保护页面、worker 状态或 ComfyUI 验证（含 SSH 隧道副作用预检） | [本地验证](docs/runbooks/development/local-verification.md) |
| 手工运行会写入仓库文件、本地文件或数据库的维护脚本 | [维护脚本](docs/runbooks/script-maintenance.md) |
| 生产构建、部署拉取、`next start` 重启、`Prisma` 同步、队列暂停/恢复、`.next` 清理或公开验证 | [生产部署](docs/runbooks/deployment/README.md) |
| 同时涉及生产与开发服务 | 先读[生产部署](docs/runbooks/deployment/README.md)，完成生产流程后再读[开发服务](docs/runbooks/development/dev-service.md) |
| 从 `macOS` 或 `zsh` 通过 `SSH` 向 `mypc` 发送复杂 `PowerShell` | [`mypc` PowerShell](docs/runbooks/mypc/powershell-over-ssh.md) |

仓库知识与责任方导航见[文档索引](docs/README.md)；各操作的授权边界见[运行手册入口](docs/runbooks/README.md)。
