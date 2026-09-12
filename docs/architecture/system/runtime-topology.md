---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: runtime-architecture
  authority:
    subject: runtime-topology
    kind: reference
  readWhen:
    - 需要变更启动副作用、进程边界或外部目标时
    - 需要同时运行多个检出，或在本地与 SSH 支持的运行时之间迁移工作时
  sources:
    - src/proxy.ts
    - src/instrumentation.node.ts
    - src/server/services/comfy-target.ts
    - src/server/services/comfy-ssh.ts
    - src/server/services/comfy-process-manager.ts
    - scripts/training/worker-queue-runtime.ts
    - scripts/training/worker-common.ts
    - src/server/services/censoring-executor.ts
    - src/server/services/runtime-data-path.ts
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-instrumentation-boundary.test.ts tests/test-comfy-target-config.test.ts tests/test-comfy-target-process.test.ts tests/test-training-worker-entrypoints.test.ts tests/test-runtime-data-path-source.test.ts
---

# 运行时拓扑

## 运行时节点

| 节点 | 当前职责 |
| --- | --- |
| Next.js 进程 | 网页、API 路由、代理身份验证、服务器操作、Generation 提交/轮询/恢复、内容审查处理器与 ComfyUI 进程管理器。 |
| PostgreSQL 或 SQLite | 持久化应用记录。选定的数据库提供方可以是检出本地数据库，也可以是外部/共享数据库。 |
| ComfyUI | 外部 Generation 执行器。本地目标可以由应用启动，也可以视为外部管理；SSH 目标可以使用远程生命周期命令与受管隧道。 |
| Training 监督进程 | 独立 Node 进程，负责启动和重启图片、数据集冻结与训练子工作进程。 |
| Training 子工作进程 | 轮询 Manager HTTP 任务路由，执行提供方/运行器工作，并上报生命周期回调。 |
| Python 与运行器进程 | 自动内容审查、GPT-Image 桥接执行与 LoRA 训练均在 Next.js 进程之外运行。 |
| 受管文件系统 | 保存项目相对路径下的运行时数据，以及已配置的本地或远程模型/产物根目录。 |

## Next.js 启动边界

通用 instrumentation 入口只会在 `NEXT_RUNTIME` 为 `nodejs` 时导入仅限 Node 的启动逻辑。随后 Node 启动流程会：

- 将处于 `running` 状态且超过固定孤儿阈值的 Generation 运行记录标记为失败；
- 为已提交与未提交的 Generation 运行记录启动并发受限的恢复；
- 初始化 ComfyUI 健康监控与可选的进程管理；
- 启动进程内内容审查队列处理器；
- 默认让已暂停运行记录保持空闲，除非显式崩溃恢复配置启用了自动恢复。

信号处理器会尝试在进程退出前暂停活动 Generation 运行记录。由于关机取消只提供尽力而为的保证，部署级暂停/恢复仍依赖显式队列控制工作流。

## 地址与部署位置语义

Application、Manager 与 ComfyUI URL 都有回环默认值，但所有实际端点都来自运行时或目标配置。这些默认值不能证明服务仅限回环访问，API 代理也没有为 ComfyUI 生命周期操作添加来源地址限制。

SSH 目标通过已配置的本地隧道端点暴露 ComfyUI HTTP，进程与模型文件操作则通过 SSH 或 SCP 执行。本地模式与 SSH 模式共用活动目标抽象，但进程与文件系统的权威来源不同。

## 工作树身份

项目相对路径从进程工作目录解析。数据库 URL、端口、目标配置、模型根目录与外部运行器路径仍可能让多个检出指向同一批资源。因此，除非显式隔离这些值，否则第二个工作树并不构成隔离的运行时。

## 相关文档

- [系统架构](README.md)
- [系统上下文](context.md)
- [队列与工作进程执行](execution/queue-worker.md)
