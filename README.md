---
schemaVersion: 1
document:
  type: router
  status: current
  owner: repository-maintainers
  authority:
    subject: repository-entrypoint
    kind: router
  readWhen:
    - 开始处理本仓库任务时
    - 查找当前的产品、架构、设计、API、测试或运维文档负责人时
  sources:
    - package.json
    - PRODUCT.md
    - ARCHITECTURE.md
    - DESIGN.md
    - docs/README.md
    - openspec/README.md
  verifiedBy:
    - node --import tsx --test tests/test-documentation-governance.test.ts
    - npm run docs:check
---

# ComfyUI Manager

ComfyUI Manager 是一个需要认证、通过浏览器使用的控制平面，服务于两个平级工作模式：常规 ComfyUI 生图与 LoRA 训练。生图模式负责项目、运行、预设、模板、队列、审核和导出流程；训练模式负责训练项目、数据集、生成任务、训练运行、预设和模板；模型与设置由两种模式共享。

自动化调用可以使用 HTTP 接口或仓库的 MCP 端点。本 README 不复制易变的路由、端点、工具或资源清单。需要精确行为时，请进入下方 API 文档，并以当前路由处理器和 MCP 注册源码为准。

## 从这里开始

维护本仓库（包括运行固定版本的 OpenSpec CLI）需要 Node.js **20.19 或更高版本**；较早的 Node 20 版本无法运行当前 OpenSpec。准确的软件包版本与命令由 `package.json` 和[仓库 OpenSpec 指南](openspec/README.md)维护。

在 Windows PowerShell 的新检出目录中安装依赖：

```powershell
Copy-Item .env.example .env
npm ci
```

在 `.env` 中选择 PostgreSQL 或 SQLite，并确保 `DB_PROVIDER` 与 `DATABASE_URL` 一致。数据库初始化和填充会修改状态，因此必须先阅读[本地数据库初始化](docs/runbooks/development/database-bootstrap.md)并取得精确目标授权；尤其不要把 `package.json` 脚本中的 POSIX 行内环境变量写法直接当作 PowerShell 命令。只有在所选数据库已经就绪后，才运行 `npm run dev`。服务验证与部署步骤由[运行手册索引](docs/runbooks/README.md)维护，不要从这段快速指引推断操作流程。

## 稳定入口

| 需求 | 阅读入口 | 权威范围 |
| --- | --- | --- |
| 理解产品模式与资源归属 | [产品](PRODUCT.md) | 产品边界的唯一权威入口 |
| 修改系统或领域边界 | [架构](ARCHITECTURE.md) | 架构地图的唯一权威入口 |
| 修改布局、组件、交互或无障碍行为 | [设计](DESIGN.md) | 当前设计方向的唯一权威入口 |
| 按任务查找维护中的文档 | [文档索引](docs/README.md) | 文档分类与路由 |
| 修改 HTTP、认证、响应封装、MCP 或工作流契约 | [API 文档](docs/api/README.md) | API 契约入口 |
| 修改测试基础设施或质量分析 | [测试文档](docs/testing/README.md) | 测试知识入口 |
| 执行本地、部署、恢复或目标机器操作 | [运行手册](docs/runbooks/README.md) | 可执行运维流程 |
| 查看生成的仓库清单 | [仓库清单](docs/repo-inventory.md) | 从源码生成的当前清单 |
| 提议重大变更 | [OpenSpec 流程](openspec/README.md) | 重大变更的完整生命周期 |

## 源码边界

- `src/app/**` 负责页面和 HTTP 路由处理器。
- `src/server/**` 负责服务、仓储、Worker、MCP 注册以及外部运行时适配器。
- `prisma/**` 负责 PostgreSQL 与 SQLite 的 schema 和迁移输入；`src/generated/**` 下的生成客户端不得手工修改。
- `config/**` 负责受版本控制的运行时配置与示例；本地密钥和机器专用配置必须保持忽略状态。
- `data/**`、`logs/**` 与 `metrics/**` 是本地运行数据，不得提交。

当前行为以源码、schema、聚焦测试和所需运行证据为准。已批准但尚未实现的行为属于活跃 OpenSpec 变更；历史意图保留在 Git 与已归档 OpenSpec 变更中。
