---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: queue-runtime
  authority:
    subject: queue-worker-execution
    kind: reference
  readWhen:
    - 需要变更 Generation 提交、轮询、暂停、恢复或故障恢复时
    - 需要变更 Training 任务选择、心跳、完成处理或工作进程时
    - 需要变更进程内内容审查执行时
  sources:
    - src/server/services/run-executor.ts
    - src/server/services/comfy-queue-cancellation.ts
    - src/lib/actions/run-lifecycle.ts
    - src/server/worker/repository.ts
    - src/server/worker/training/leasing.ts
    - src/server/worker/training/task-serialization.ts
    - src/server/worker/training/target-discovery.ts
    - src/server/worker/training/heartbeat.ts
    - src/server/worker/training/completion.ts
    - src/server/repositories/training/projects.ts
    - scripts/training/worker-common.ts
    - src/server/services/censoring-executor.ts
    - src/instrumentation.node.ts
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-run-submission-deferral.test.ts tests/test-run-recovery-poller-cap.test.ts tests/test-comfy-queue-cancellation.test.ts tests/test-training-worker-entrypoints.test.ts tests/test-queue-control-progress-stream.test.ts
    - node --import tsx --test tests/test-worker-boundary-governance.test.ts tests/test-auto-censor-service-source.test.ts
    - node --import tsx --test --test-name-pattern "managed training project can enqueue generation, freeze dataset, and start training through /api/training" tests/test-training-api-routes.test.ts
---

# 队列与工作进程执行

仓库包含三种不同的执行机制。它们共享部分生命周期术语，但不共享同一个工作进程实现或同一个队列权威来源。

## Generation 执行

Generation 入队会写入持久化 `Run` 记录与解析后的配置快照。随后，Next.js Node 进程将状态为 `queued` 的工作提交到已配置的 ComfyUI 目标，保存返回的 prompt ID，轮询队列/历史状态，持久化输出文件，并完成数据库记录。本地入队后会异步调度提交；如果 ComfyUI 目标不可达，运行记录会保持 `queued`，留待后续恢复。

Generation 不由独立的 Manager 工作进程消费，也没有持久化租约或心跳记录。进程内轮询归属、条件数据库状态转换、prompt 身份与收尾认领能减少重复工作；启动恢复与请求驱动恢复会在并发上限内重启缺失的轮询器。

持久化运行记录与 ComfyUI 实时队列/历史是互补的权威来源。`/api/worker/status` 组合 Generation 计数与 ComfyUI 可达性。`/api/queue` 是图片审核队列，不是活动执行状态的事实来源。

暂停/恢复适用于 Generation 运行记录。暂停操作会区分本地 `queued` 记录与已提交或正在运行的 ComfyUI prompt，为已提交工作确认远程取消，并记录批次/来源标记。恢复操作只通过新的 ComfyUI 提交重放已标记批次；不得宽泛恢复无关的手动暂停工作。

## Training 工作进程

Training 使用独立的图片、数据集冻结与训练工作进程。监督进程负责启动和重启这些进程。工作进程携带责任方与轮询时长轮询 Manager HTTP 任务路由，发送心跳进度，并上报完成或失败。

HTTP 接口将任务选择称为租约，但当前持久化并不构成持久化租约：

- 客户端会解析并传递 `leaseDurationSeconds`，但不会由此产生到期状态转换；
- 序列化任务始终报告 `leaseExpiresAt: null` 与 `attemptCount: 1`；
- 目标领域记录会转为 `running` 状态，租约归属只嵌入部分进度/响应数据；
- 心跳会更新进度元数据，但不会延长可强制执行的到期时间。

不得基于这些类似租约的字段构建并发或崩溃恢复保证。由于没有强制校验租约 owner，后续调用方可能收到已经 `running` 的目标。图片工作进程使用 Manager HTTP 完成生命周期调用，但目前会在调用提供方前直接通过 Prisma 读取 Training 生成任务输入。

主同步数据集冻结与 `dataset_freeze` 工作进程相互独立。该工作进程选择既有草稿版本，将其推进到 `freezing`，再标记为 `ready`；它不会创建主冻结端点所使用的清单与条目快照。

## 内容审查执行

Next.js Node 进程还负责一个进程内内容审查循环。它按条件认领状态为 `queued` 的 `CensoringTask` 记录，运行 Python 批处理适配器，并将每个任务标记为 `done` 或 `failed`。启动流程会把过期的运行中内容审查任务恢复为 `queued` 状态。该队列与 ComfyUI prompt、Training 工作进程任务都相互独立。

## 失败与恢复边界

- Generation 恢复流程会协调数据库状态、prompt 身份与 ComfyUI 状态；仅凭本地状态并不充分。
- Training 工作进程重启无法回收过期租约，因为当前根本不存在这类到期机制；任务选择反而可能把已经 `running` 的领域目标交给下一个调用方。
- Node 启动流程可以在超过孤儿阈值后将旧 Generation 记录标记为失败，并恢复活动工作；已暂停记录默认仍需手动处理。
- 外部工作完成后，文件系统持久化仍可能失败；完成逻辑必须明确区分数据库结果与产物结果。

## 相关文档

- [执行架构](README.md)
- [运行时拓扑](../runtime-topology.md)
- [Generation 架构](../../domains/generation/README.md)
- [Training 架构](../../domains/training/README.md)
