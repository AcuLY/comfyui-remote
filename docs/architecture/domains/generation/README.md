---
schemaVersion: 1
document:
  type: router
  status: current
  owner: generation
  authority:
    subject: generation-architecture
    kind: router
  readWhen:
    - 需要变更 Generation 项目、分区、运行记录、审核、预设或模板时
    - 需要变更 Generation 运行记录如何转化为 ComfyUI prompt 与受管输出时
  sources:
    - src/lib/work-mode-resources.ts
    - src/server/repositories/generation-resource-boundary.ts
    - src/server/repositories/project-repository/enqueue.ts
    - src/server/services/run-executor.ts
    - src/server/services/comfyui-service.ts
    - config/workflows/standard-workflow.api.json
    - prisma/schema.prisma
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-worker-boundary-governance.test.ts tests/test-run-submission-deferral.test.ts tests/test-zero-redundancy-enqueue.test.ts
---

# Generation 架构

## 目标与边界

Generation 负责图片生成项目、分区、运行记录、审核、Generation 预设、预设组与项目模板。它在 Generation 工作模式下的主要界面资源是运行记录、项目、预设与模板；模型和设置来自共享边界。

Training 资源不是 Generation 的回退来源。即使两个领域使用同一个数据库，读取 Generation 项目、运行记录、预设与模板时也会过滤掉为 Training 保留的数据。

## 数据与流程

1. 项目及其有序分区引用规范化的预设绑定、提示词块、手动 LoRA 条目与运行时参数。
2. 入队操作在数据库事务中执行，并为每个 `Run` 写入解析后的配置快照。
3. Next.js Node 进程构建提示词草稿，将其提交到活动 ComfyUI 目标，并保存 prompt ID 与已提交的图。
4. 轮询流程将 ComfyUI 的队列/历史状态与运行记录进行协调，写入受管图片文件，并创建 `ImageResult` 记录。
5. 审核流程将结果标记为保留或移入回收站；可选的内容审查由其独立的进程内任务队列处理。

当前 ComfyUI API 提示词图的选择顺序如下：

1. 运行记录额外参数中显式提供的提示词图；
2. 否则使用配置所属的 `config/workflows/standard-workflow.api.json` 模板。

源码在标准解析器之后仍保留一个内置 SDXL 回退表达式，但该解析器当前始终启用，文件或解析错误也会向上传播。因此，标准模板缺失或无效会直接导致提交失败，而不会选用该回退。工作流配置不是文档内容，也不归本页面维护。

## 执行不变量

- 数据库中状态为 `queued` 的记录表示持久化意图，并不能证明 ComfyUI 已经接受提示词图。
- 已提交的提示词图在 ComfyUI 报告其运行之前，本地状态仍为 `queued`。
- 轮询归属位于进程内且可恢复；Generation 没有持久化工作进程租约。
- 收尾流程使用 prompt 身份与认领边界，避免重复持久化产物。
- 审核队列的语义与活动执行状态相互独立。

## 故障隔离

ComfyUI 不可访问时会推迟提交，但不会丢弃状态为 `queued` 的运行记录。进程重启后可以恢复已提交的提示词图，并重试数量受限的未提交运行记录。数据库完成状态、文件持久化、ComfyUI 执行与审核都可能独立失败，并各自保留证据。

## 相关文档

- [领域架构](../README.md)
- [队列与工作进程执行](../../system/execution/queue-worker.md)
- [应用数据模型](../../system/data-model.md)
- [Generation 产品文档](../../../product/generation/README.md)
