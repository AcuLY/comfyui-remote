---
schemaVersion: 1
document:
  type: router
  status: current
  owner: training
  authority:
    subject: training-architecture
    kind: router
  readWhen:
    - 需要变更 Training 项目、分区、生成任务、数据集或训练运行记录时
    - 需要变更 Training 提供方策略、调度器、工作进程或产物行为时
  sources:
    - src/lib/work-mode-resources.ts
    - src/app/api/training/route.ts
    - src/lib/training/provider-policy.ts
    - src/server/repositories/training/projects.ts
    - src/server/worker/training/leasing.ts
    - src/server/worker/training/completion.ts
    - scripts/training/worker-common.ts
    - scripts/training/image-worker-runtime.ts
    - prisma/schema.prisma
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-training-api-boundary.test.ts tests/test-training-worker-entrypoints.test.ts tests/test-training-generation-task-prisma-service.test.ts
    - node --import tsx --test --test-name-pattern "managed training project can enqueue generation, freeze dataset, and start training through /api/training|POST /api/training/training-runs/:trainingRunId/create-preset creates a training preset from a completed training run" tests/test-training-api-routes.test.ts
---

# Training 架构

## 目标与边界

Training 是一等工作模式，拥有独立的生产路由、API 树、实体、预设、模板、调度器与工作进程生命周期。即使界面复用导航或展示基础组件，其运行记录、项目、预设与模板仍与 Generation 分离。模型与设置来自共享边界。

Training 路由加载器与服务读取 Training 所属的 Prisma 资源。顶层 Training API 为智能体返回能力清单，具体路由分别负责变更操作与资源读取。

## 领域模型与主流程

Training 项目负责角色档案、分区与场景块、参考产物、生成任务及其输出、已审核图片结果、数据集版本与训练运行记录。

主流程如下：

1. 创建项目/档案并附加参考资料；
2. 编排 Training 分区并将图片生成任务入队；
3. 审核结果并维护说明文字；
4. 冻结一个数据集版本；
5. 将 Training 运行记录入队并执行，持久化最终产物，并可选择创建 Training 场景描述预设。

Training 图片生成遵循 `codex_gpt_image2`/`gpt-image-2` 的提供方策略，不使用普通 ComfyUI 工作流或 Generation 队列。

## 数据集版本边界

主冻结端点是同步的。它写入 JSONL 清单，创建状态为 `ready` 的版本与条目记录，并对当前文件路径与说明文字生成快照。当前条目记录通过 `snapshotArtifactId` 复用源产物；图片字节不会复制到版本专属产物中。缺失的说明文字会被计数，但不会阻止版本创建。

独立的 `dataset_freeze` 工作进程是一条面向既有草稿版本的单独路径。它将该记录依次改为 `freezing` 和 `ready`，并不实现负责构建清单的主冻结流程。

## 工作进程边界

独立的图片、数据集冻结与训练进程通过 Manager HTTP 完成任务选择、心跳、完成与失败上报。当前具有租约外形的协议不会持久化到期时间或尝试次数，因此它不是持久化租约。心跳用于持久化进度，而不是强制执行归属到期。

图片工作进程在执行已配置的提供方之前，仍会直接通过 Prisma 读取 Training 生成任务细节与输入产物引用。Manager HTTP 生命周期尚未使工作进程运行时脱离数据库依赖。

## 当前限制与故障隔离

- 工作进程可能在目标被标记为 `running` 后退出，而系统没有基于到期时间的回收机制。
- 数据集版本引用既有产物字节，因此后续文件系统完整性与版本记录仍是两个独立问题。
- Training 提供方执行、Manager 回调、数据库写入与产物写入可能独立失败。
- 说明文字生成包含确定性的本地行为；它并不是通用的异步说明文字模型工作进程。

## 相关文档

- [领域架构](../README.md)
- [队列与工作进程执行](../../system/execution/queue-worker.md)
- [应用数据模型](../../system/data-model.md)
- [Training 产品文档](../../../product/training/README.md)
