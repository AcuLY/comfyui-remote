# 后端全面 Code Review 计划

## 概述

对 comfyui-remote 项目后端代码进行系统性审查。项目是一个 ComfyUI 生成任务管理系统，技术栈为 Next.js 16 + Prisma 7 + sharp，部署在 Windows 11 笔记本上。

**代码规模：**
- `src/server/` — 16,828 行（services 19个 + repositories 9个 + worker 4个）
- `src/lib/actions/` — 6,435 行（18 个 server action 文件）
- `src/app/api/` — ~120+ 个 API route 文件
- `prisma/` — 两套 schema（PostgreSQL 977行 + SQLite 873行）
- 测试文件 — 11 个，全部在项目根目录

---

## Phase 1: 核心执行路径（最高优先级）

运行时最关键的代码路径，bug 在此处会导致任务丢失或数据损坏。

### 1.1 Run 执行器 — `src/server/services/run-executor.ts`（519行）

**审查重点：**
- `activePolls` Map 的并发安全性（Node.js 单线程但有 async 竞态）
- `claimRunFinalization` 的 optimistic locking 是否有 ABA 问题
- `FINALIZING_CLAIM_TTL_MS`（30分钟）是否合理
- poll 被 supersede 时的清理是否完备（prompt 替换场景）
- `pollRunCompletion` 中 error 分支是否有漏洞（如：completeWorkerRun 成功但 audit 失败）
- recovery 逻辑（`recoverStaleRuns`）与正常 poll 的竞争条件

### 1.2 ComfyUI 通信 — `src/server/services/comfyui-service.ts`（928行）

**审查重点：**
- HTTP 请求超时处理（`env.comfyRequestTimeoutMs` = 10s）
- `pollComfyPromptHistory` 的 max attempts（300次 × 2s = 10分钟上限）对长任务是否够
- `submitComfyPrompt` 的错误分类（网络失败 vs 验证失败 vs ComfyUI 内部错误）
- `waitForPromptToStart` 的退出条件
- `getComfyQueuePosition` 返回的状态与实际队列的一致性
- `extractOutputImages` / `extractOutputDir` 对非标准 ComfyUI 输出的鲁棒性

### 1.3 图片持久化 — `src/server/services/image-result-service.ts`（357行）

**审查重点：**
- JPEG 压缩流程的内存占用（多张大图并行时 sharp buffer 累积）
- `retryOnEBUSY` 的重试策略（5次，指数退避 200ms-3.2s）是否覆盖 Windows 典型锁时间
- `atomicWriteFile`（write tmp → rename）在 Windows NTFS 上的原子性保证
- `removeManagedRunOutput` 失败时是否有数据不一致（DB 记录指向已删文件）
- thumbnail 生成失败是否会阻塞整个 run 完成
- 路径构建（`sanitizePathSegment`、`normalizeSubfolder`）对中文字符的处理

### 1.4 Worker Repository — `src/server/worker/repository.ts`（266行）

**审查重点：**
- `completeWorkerRun` 事务内 `updateMany` + `deleteMany` + `createMany` 的顺序依赖
- `updateProjectStatus` 逻辑：latestRunId 聚合是否正确反映项目状态
- 事务失败时 `throw new Error("WORKER_RUN_NOT_RUNNING")` 的上游处理
- `images` 字段的 `deleteMany` + `createMany` 是否应该用 upsert 避免中间状态

### 1.5 入队逻辑 — `src/server/repositories/project-repository/enqueue.ts`

**审查重点：**
- 事务内的查询+写入是否有 TOCTOU 问题
- `overrideBatchSize` 的边界校验
- 项目状态转换：从任意状态入队的前置条件
- `createQueuedRunsForPositions`（helpers.ts）的 runIndex 分配逻辑

---

## Phase 2: 数据完整性与安全

### 2.1 Schema 一致性 — `prisma/schema.prisma` + `prisma/schema.sqlite.prisma`

**审查重点：**
- 两套 schema 的字段、关系、索引是否完全同步
- Cascade 删除行为是否合理（特别是 Project → Section → Run → ImageResult 链）
- JSON 字段（`submittedPrompt`、`executionMeta`、`resolvedConfigSnapshot`）的类型安全
- 缺失的索引（频繁查询条件：`status`、`projectId + status`、`reviewStatus`）
- `bigint` 字段（`fileSize`）在 SQLite provider 下的兼容性

### 2.2 认证机制 — `src/app/api/auth/verify/route.ts`

**审查重点：**
- 是否所有 API route 都受认证保护（无 middleware.ts 文件！）
- timing-safe compare 实现是否正确
- Cookie 安全属性（httpOnly、sameSite、secure）
- AUTH_TOKEN 缺失时的降级行为（当前返回 500，是否合理）
- 无 middleware 意味着所有 API 路由默认无鉴权 — 这是最大安全隐患

### 2.3 路径安全

**审查文件：**
- `src/app/api/images/[...path]/route.ts` — 路径穿越防护
- `src/server/services/project-archive-service.ts` — `rm -rf` 安全检查
- `src/server/services/image-result-service.ts` — 输出路径构建

**关注点：**
- `isSafePathSegment` 是否覆盖所有 traversal 向量（Unicode normalization、null bytes）
- archive service 的 `safePrefix` 检查是否抵抗 symlink 攻击
- `resolve()` + `startsWith` 检查在 Windows 上的行为（大小写不敏感文件系统）

### 2.4 DB 客户端 — `src/lib/prisma.ts` + `src/lib/db.ts`

**审查重点：**
- `db.ts` 是 `prisma.ts` 的重导出（legacy），是否有循环引用
- 双 provider 架构：PostgreSQL 和 SQLite client 的结构兼容性
- global singleton 在 Next.js hot-reload 时是否正确复用
- 连接池配置（当前无显式配置，依赖 Prisma 默认）

---

## Phase 3: 架构质量

### 3.1 Server Actions vs API Routes 职责划分

**审查文件：**
- `src/lib/actions/*.ts`（Server Actions）
- `src/app/api/**`（API Routes）

**关注点：**
- 是否存在同一操作同时有 action 和 route 实现
- Server Actions 中是否有不应该放在 `lib/` 下的服务端逻辑
- `"use server"` 声明是否正确
- revalidation 策略（`revalidatePath` / `revalidateTag`）的一致性

### 3.2 超大文件拆分 — `character-lora-training-repository.ts`（5407行）

**审查重点：**
- 是否可按功能域拆分（job管理、dataset管理、training run、benchmark、source image）
- 34 个 `$transaction` 调用 — 事务边界是否合理
- 是否有可提取为独立 service 的业务逻辑混在 repository 中

### 3.3 错误处理一致性

**审查样本：**
- 选取 10-15 个 API route 检查 error handling 模式
- `ok()` / `fail()` 的使用统一性
- HTTP 状态码选择（400 vs 404 vs 409 vs 500）
- Service 层抛出的错误字符串（`"JOB_NOT_FOUND"` 等）是否有统一枚举

### 3.4 日志与审计

**审查文件：**
- `src/lib/logger.ts`
- `src/server/services/audit-service.ts`

**关注点：**
- 日志级别使用是否合理（debug/info/warn/error 边界）
- audit 的覆盖率：哪些关键操作缺少审计
- file rotation 在 Windows 上的可靠性
- fire-and-forget audit 失败是否有降级记录

---

## Phase 4: 运维与可靠性

### 4.1 启动与恢复 — `src/instrumentation.node.ts`

**审查重点：**
- `cleanupOrphanedRuns`（30分钟阈值）与 ComfyUI 长任务的冲突
- `recoverStaleRuns` 与 `cleanupOrphanedRuns` 的执行顺序和竞争
- Graceful shutdown 的 SIGTERM 处理是否覆盖所有活跃状态
- `resumePausedRunsIfHealthy` 的串行 submit 对大量暂停任务的性能影响

### 4.2 ComfyUI 进程管理 — `src/server/services/comfy-process-manager.ts`（830行）

**审查重点：**
- 进程启动/停止/重启的状态机
- Health check 间隔（10s）和 startup grace（300s）的合理性
- Max restarts（3次/5分钟窗口）是否足够且不过度
- Windows 进程管理的兼容性（spawn vs exec、信号处理）

### 4.3 队列数据 — `src/server/repositories/queue-data-repository.ts`（438行）

**审查重点：**
- `comfyQueueSnapshotCacheMs`（2s 缓存）的实现
- 暂停/恢复批次的幂等性
- 多 tab 同时操作的并发安全

### 4.4 导出/归档 — `project-export-service.ts` + `project-archive-service.ts`

**审查重点：**
- `exportProjectImages` 中间失败时的清理（当前 `rm exportDir` 只在 cover 失败时）
- 归档操作的幂等性（当前检查 `archivedAt !== null`）
- ZIP 创建时的内存占用（archiver streaming vs 全量加载）
- archive 中 trash 文件删除与 TrashRecord 删除的事务性

---

## Phase 5: 代码质量与可维护性

### 5.1 TypeScript 类型安全

**审查重点：**
- 198 处 `any` 使用 — 抽样检查是否有安全隐患
- `as Record<string, unknown>` 类型断言的合理性（特别是 Prisma JSON 字段）
- `Prisma.InputJsonObject` 与运行时实际类型的一致性
- 函数返回类型是否都有显式声明

### 5.2 环境配置 — `src/lib/env.ts`

**审查重点：**
- `assertEnv` 只检查 `DATABASE_URL`，其他必填项（如 `COMFY_API_URL`）无校验
- `env` 对象在模块加载时求值 — 如果环境变量后续变更，值不会更新
- dev/prod 差异是否有文档化

### 5.3 测试

**审查重点：**
- 11 个测试文件全在根目录（非 `__tests__/` 或 `test/`），不符合惯例
- 无 test runner 配置（package.json 中无 jest/vitest）
- 核心路径（run-executor、image-result-service）零测试覆盖
- 测试文件是否是手动运行还是 CI 集成

### 5.4 混用 `prisma` 和 `db`

**审查重点：**
- `db` 是 `prisma` 的别名（legacy），但代码中混用两个名字
- 确认是否有潜在的双实例问题（`import { db }` vs `import { prisma }`）
- 统一导入路径的必要性评估

---

## 执行方式

每个 Phase 由独立的 Review 子代理执行，产出：
1. **发现清单**（按严重度：Critical / High / Medium / Low）
2. **具体建议**（附代码行号和修复方向）
3. **可跳过项**（已足够好，无需改动的部分）

Review 不产出修复代码 — 只产出发现和建议。修复将在 review 完成后按优先级分批处理。

---

## 预期产出

| Phase | 审查范围 | 预估发现数 |
|-------|----------|-----------|
| 1 | 核心执行路径（5个文件，~2500行）| 5-15 个 |
| 2 | 安全与数据完整性（schema + auth + paths）| 3-8 个 |
| 3 | 架构质量（Actions vs Routes、大文件、错误处理）| 5-10 个 |
| 4 | 运维与可靠性（startup、process manager、queue）| 3-8 个 |
| 5 | 代码质量（类型安全、env、测试、命名）| 5-10 个 |

总计预估 **20-50 个 Review 发现**，其中 Critical/High 级别约 5-10 个。
