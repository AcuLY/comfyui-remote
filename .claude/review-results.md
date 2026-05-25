# 后端全面 Code Review 结果报告

> 审查时间：2026-05-25  
> 审查范围：**全部后端文件**（220+ 文件，~45,000 行）  
> 审查维度：代码逻辑 + 可扩展性 + 可维护性 + 超大文件拆分

---

## 第一部分：已修复的问题（17 个，commit c97c144）

这些问题在本次审查中已直接修复并提交：

| # | 严重度 | 问题 | 状态 |
|---|--------|------|------|
| 1 | Critical | Run 终态化可被静默丢弃 | ✅ 已修复 |
| 2 | High | 取消与持久化竞态 → 孤儿图片 | ✅ 已修复 |
| 3 | High | Recovery 无并发限制 | ✅ 已修复 |
| 4 | High | shouldContinue 竞态丢弃完成结果 | ✅ 已修复 |
| 5 | High | 无双重入队保护 | ✅ 已修复 |
| 6 | High | latestRunId 在入队时设置 | ✅ 已修复 |
| 7 | High | Windows NTFS 路径绕过 | ✅ 已修复 |
| 8 | High | sanitizePathSegment 去掉中文 | ✅ 已修复 |
| 9 | High | ComfyUI filename 未验证 | ✅ 已修复 |
| 10 | Medium | sharp 双重解码内存翻倍 | ✅ 已修复 |
| 11 | Medium | Debug 文件无条件写入 | ✅ 已修复 |
| 12 | Medium | .tmp 文件永不清理 | ✅ 已修复 |
| 13 | Medium | fetchJson 非 JSON 响应抛异常 | ✅ 已修复 |
| 14 | Medium | trashPath 无路径限制 | ✅ 已修复 |
| 15 | Medium | project.title 路径穿越 | ✅ 已修复 |
| 16 | Medium | 事务无显式 timeout | ✅ 已修复 |
| 17 | Medium | waitForPromptToStart 无取消 | ✅ 已修复 |

---

## 第二部分：认证问题（暂不修复）

| # | 严重度 | 问题 |
|---|--------|------|
| C1 | Critical | 所有 148 个 API 路由无认证保护（无 middleware.ts） |
| H8 | High | Auth Cookie 存储原始密钥 |

用户明确要求暂时忽略。

---

## 第三部分：超大文件拆分建议

### 3.1 `character-lora-training-repository.ts`（5,407 行）→ 拆为 14 个文件

| 新文件 | 内容 | 估计行数 |
|--------|------|----------|
| `types.ts` | SELECT 常量、Record 类型、Input/Summary 类型 | ~620 |
| `serializers.ts` | 16 个 `serialize*` 函数 | ~420 |
| `helpers.ts` | `ciContains`, slug 解析, JSON utils, 日期工具 | ~350 |
| `benchmark-helpers.ts` | benchmark matrix/template 构建函数 | ~350 |
| `job-repository.ts` | Job CRUD + template upsert | ~200 |
| `source-image-repository.ts` | Source image CRUD + artifact | ~300 |
| `canonical-repository.ts` | Canonical versions + prompt cards | ~350 |
| `section-repository.ts` | Section templates + job sections + candidates | ~450 |
| `dataset-repository.ts` | Dataset revision CRUD | ~250 |
| `training-run-repository.ts` | Training run CRUD + GPU lock | ~350 |
| `benchmark-repository.ts` | Benchmark runs + template ensure | ~600 |
| `promotion-repository.ts` | Promotion decisions + variant lookup | ~350 |
| `worker-task-repository.ts` | Worker 任务队列（lease/heartbeat/complete/fail） | ~700 |
| `index.ts` | 统一重导出 | ~50 |

**可复用工具函数提取：**
- `createJobArtifact(tx, input)` — 12 处重复
- `releaseGpuLock(tx, ownerType, ownerId)` — 4 处重复
- `assertLeaseOwner(task, leaseOwner)` — 6 处重复
- `resolveUniqueSlug(tx, finder, base)` — 4 处重复

---

### 3.2 Character-LoRA Training Services（9,495 行）→ 子服务拆分

| 当前文件 | 行数 | 拆分建议 |
|----------|------|----------|
| `report-service.ts` | 1700 | → `report-builder.ts` + `report-diagnostics.ts` + `report-renderer.ts` + 保留 thin API |
| `phase3-service.ts` | 1588 | → `dataset-freeze-service.ts` + `generation-run-service.ts` + `worker-task-service.ts` + thin orchestrator |
| `benchmark-promotion-service.ts` | 1355 | → `benchmark-service.ts` + `promotion-service.ts` + `benchmark-evidence.ts` |
| `training-service.ts` | 995 | → 提取 `training-config.ts`(250行) + `safetensors-validator.ts`(120行) |
| `canonical-service.ts` | 871 | → 提取 `canonical-payload-builder.ts`(150行) |

**共享工具提取：**
- `service-utils.ts`: `normalizeId`, `parseWithSchema`, `toInputJsonValue`, `statArtifactIfExists`
- `service-error.ts`: 统一 `CharacterLoraServiceError` 基类（替代 6 个重复 error class）
- `generation-defaults.ts`: 共享的 DEFAULT_PROVIDER/DEFAULT_IMAGE_MODEL 常量

---

### 3.3 `lib/actions/template.ts`（1,107 行）→ 拆为 3 个文件

| 新文件 | 内容 | 行数 |
|--------|------|------|
| `template-crud.ts` | CRUD actions（create/update/delete/copy） | ~350 |
| `template-import.ts` | `importTemplateToProject` + helpers | ~500 |
| `template-save.ts` | `saveProjectAsTemplate` | ~250 |

---

### 3.4 其他需拆分文件

| 文件 | 行数 | 建议 |
|------|------|------|
| `project-view-repository.ts` | 810 | → `project-list-view.ts` + `project-detail-view.ts` + `project-form-view.ts` |
| `preset-variant.ts` (actions) | 762 | → 提取 `preset-variant-resolve.ts`(250行) |
| `run.ts` (actions) | 756 | → 提取 `run-lifecycle.ts`（cancel/pause/resume 共享 helper） |
| `phase0-baseline.ts` | 1464 | → `phase0-types.ts` + `phase0-aggregation.ts` + `phase0-sqlite.ts` + `phase0-reports.ts` |

---

## 第四部分：架构与可维护性问题

### 4.1 层级边界违规

| 严重度 | 位置 | 问题 |
|--------|------|------|
| High | `src/lib/preset-binding-utils.ts` | lib/ 文件 import 了 `src/server/services/` — 循环依赖风险 |
| High | `src/lib/server-data.ts` | lib/ barrel 重导出 server/ repositories — 模糊模块边界 |
| Medium | `queue-data-repository.ts` | Repository 做文件系统 I/O (`existsSync`) — 应在 service 层 |
| Medium | `review-repository.ts` | Repository 包含文件移动+回滚逻辑 — 这是 service 层职责 |

### 4.2 代码重复

| 严重度 | 重复内容 | 出现次数 | 建议 |
|--------|----------|----------|------|
| High | `normalizeId`/`parseWithSchema`/`toInputJsonValue` | 4 个 service 文件 | 提取共享 `service-utils.ts` |
| High | `mapXxxError` Prisma→HTTP 映射 | 6 个文件 | 统一为一个泛型 `mapServiceError()` |
| Medium | 验证 boilerplate（`parseRequestBody`, `ensureSupportedFields`） | 3 个 service | 提取 `service-validation.ts` |
| Medium | preset member 名称解析（collect IDs→batch fetch→build map） | `preset-view-repository.ts` 3 处 | 提取 `resolveMemberNames()` |
| Medium | ComfyUI cancel 逻辑 | `run.ts` actions 3 处 | 提取 `cancelComfyPrompts()` helper |
| Medium | CSV 工具 (`serializeCsv`, `csvCell`) | phase0 + phase1 | 提取 `quality/csv-utils.ts` |
| Low | `normalizeCivitaiLinks` | 2 文件 | 提取到共享位置 |

### 4.3 命名与组织

| 问题 | 建议 |
|------|------|
| `db.ts` vs `prisma.ts` 双命名 | 废弃 `db.ts`，统一用 `prisma` |
| "View repositories" 实际是 read-model services | 重命名为 `*-query-service.ts` 或移到 service 层 |
| `queue-repository.ts` 55 行文件与 `queue-data-repository.ts` 功能重复 | 删除前者（dead code） |

### 4.4 错误处理不一致

| 模式 | 使用位置 | 问题 |
|------|----------|------|
| 返回 `{ ok, error }` | `run.ts` actions | ✅ 好模式 |
| 抛出字符串 Error | `template.ts`, `section.ts` | ❌ 无类型化 |
| catch → 返回 400 | 所有 `mapXxxError` | ❌ 掩盖真正的 500 |
| 魔法字符串 (`"JOB_NOT_FOUND"`) | 所有 repositories | ❌ 应用 typed error class |

### 4.5 缺失的基础设施

| 缺失项 | 影响 | 建议 |
|--------|------|------|
| 零 Zod 输入验证（actions 层） | 恶意输入直接打到 Prisma | 对公开 action 加 Zod schema |
| 无状态机守卫 | Job 生命周期转换靠散落检查 | 引入 `assertValidTransition()` |
| API routes 11 个缺少 try/catch | 未捕获异常成为 500 | 统一加 try/catch |
| `request.json()` 6 处无 catch | 格式错误的 body 变成 500 | 加 JSON parse guard |

---

## 第五部分：Dead Code

| 文件 | Dead export |
|------|------------|
| `lora-types.ts` | `createDefaultLoraBinding`, `bindingToEntry` — 0 外部引用 |
| `logger.ts` | `withErrorLogging`, `logHttpRequest`, `createRequestLogger`, `generateRequestId` — 0 使用 |
| `queue-repository.ts` | 整个文件 55 行与 `queue-data-repository.ts` 重复 |

---

## 第六部分：API Routes 模式评估

**整体一致性：~90%**

- ✅ 多数 route 使用 `ok()`/`fail()` helper + try/catch + 委托 service
- ✅ 中位大小 ~25 行，职责单一
- ❌ 5 个 route 绕过 `ok()`/`fail()`（`queue-data`, `auth/verify`, `apply-param` 等）
- ❌ 3 个 `comfy/` route 完全无 try/catch
- ❌ `featured` vs `featured2` 两个 route 完全是复制粘贴

**过大的 route 文件：**
- `logs/route.ts`（293行）→ 应提取 `log-service.ts`
- `agent/projects/[projectId]/update/route.ts`（144行）→ 逻辑下沉到 service
- `images/[...path]/route.ts`（127行）→ 提取 path validation

---

## 第七部分：正面评价

- **依赖流向健康**：services 之间无循环依赖，`phase3 → training → benchmark` 单向流动
- **ComfyUI 进程管理器**（830行）设计合理——单例 + 状态机 + RingBuffer，职责内聚
- **Project repository 已有子模块拆分先例**（`project-repository/helpers.ts`），方向正确
- **Audit service 和 logger** 设计得当——fire-and-forget 审计不阻塞业务
- **原子写入 + EBUSY retry** 体现了 Windows 平台意识
- **几乎无 `any` 使用**（仅 2 处，都有 eslint-disable 注释）
- **几乎无 TODO/FIXME**

---

## 总结：优先级排列

### 立即可做（高 ROI，低风险）
1. 删除 `queue-repository.ts` dead code
2. 删除 `logger.ts` 和 `lora-types.ts` 中未使用的 exports
3. 提取 `service-utils.ts` + `service-error.ts`（消除 character-lora 4 文件重复）
4. `template.ts` 拆为 3 个文件

### 短期（1-2 周）
5. `character-lora-training-repository.ts` 拆为 14 文件
6. 修复 lib/server 层级违规（`preset-binding-utils.ts`, `server-data.ts`）
7. API routes 补齐 try/catch + JSON parse guard
8. 提取 `cancelComfyPrompts()` 共享 helper

### 中期（1 个月）
9. Character-lora services 子拆分（5 个文件）
10. 引入 Zod 输入验证（从最危险的 routes 开始）
11. 统一错误处理（typed error classes）
12. View repositories 重命名/移动到 service 层
