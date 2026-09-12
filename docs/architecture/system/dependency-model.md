---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: system-architecture
  authority:
    subject: dependency-model
    kind: reference
  readWhen:
    - 需要添加跨 app、feature、lib、server、worker 或 Prisma 边界的 import 时
    - 需要判断代码应归属编排、payload 构造还是持久化时
  sources:
    - src/lib/work-mode-resources.ts
    - src/lib/server-data.ts
    - src/server/services/run-executor.ts
    - src/server/worker/payload-builder.ts
    - src/server/worker/repository.ts
    - src/lib/prisma.ts
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-worker-boundary-governance.test.ts tests/test-training-api-boundary.test.ts
---

# 依赖模型

## 当前依赖图

| 区域 | 当前职责与允许方向 |
| --- | --- |
| `src/app` | Next.js 页面、布局、路由处理器与应用本地服务器数据。它是编排层，当前会导入组件、功能界面、共享工具、服务与部分仓储。 |
| `src/components` | 共享展示与交互组件。客户端组件不得以值导入的方式引入仅限服务器的模块。 |
| `src/features/training` | Training 路由匹配、DTO 与生产界面。它使用共享组件和客户端安全工具；服务器数据通过服务器所属加载器进入。 |
| `src/lib` | 共享类型与工具，以及少量服务器/操作入口；该目录并非全部对客户端安全。 |
| `src/server/services` | 业务编排与外部适配器。服务通常调用仓储，但部分当前服务与操作会直接使用 Prisma。 |
| `src/server/repositories` | 可复用的持久化查询、领域过滤器与由事务负责的写入。仓储依赖数据库边界，不依赖界面或工作进程载荷构造器。 |
| `src/server/worker` | Generation 载荷规范化/持久化辅助逻辑，以及 Training 工作进程生命周期处理。外部执行仍由服务或独立脚本组合。 |
| Prisma schema 与客户端 | 数据库提供方专属的存储契约，也是应用最低层的持久化边界。 |

本仓库不是严格的“路由—服务—仓储”三层架构。路由处理器通常保持精简，但确实存在直接使用仓储与 Prisma 的调用方。`src/lib/server-data.ts` 是一个明确的过渡门面：它为 RSC 调用方重新导出服务器仓储，尽管这反转了首选的 `lib` 到 `server` 依赖方向。

## 强制边界

- 客户端模块可以导入服务器数据类型，但值导入只能出现在 RSC 页面、路由处理器、服务器操作或仅限服务器的服务中。
- Generation 与 Training 路由不会把对方的项目、运行记录、预设或模板服务作为回退。
- Generation 持久化过滤器会排除为 Training 保留的资源；相似的表结构并不代表共享归属。
- 对于持久化与 ComfyUI，Generation 提示词草稿规范化是纯操作。工作进程仓储负责运行记录的读写，运行执行器则将二者与外部提交和轮询组合起来。
- PostgreSQL 与 SQLite 客户端共用一个应用导入接口；数据库提供方检测负责选择运行时适配器与生成的客户端。

## 变更规则

新行为应放在当前范围最小的责任方中。如果一项变更会收紧或替换过渡层，应通过 OpenSpec 提出该架构变更，而不是把期望方向记录成已经完成的事实。

## 相关文档

- [系统架构](README.md)
- [核心原则](../core-beliefs.md)
- [应用数据模型](data-model.md)
