# 集成测试计划 (Integration Test Plan)

> 测试策略：小块集成测试，直接调用 Server Actions / Services，操作真实测试数据库，验证数据库状态和行为结果。
> 不测试 UI 渲染，不测试 ComfyUI API（Mock 外部依赖）。

## 测试工具

- **Vitest** — 测试运行器
- **@prisma/client** — 直接操作测试数据库
- **测试数据库** — 使用独立的 PostgreSQL 数据库（`comfyui_remote_test`）
- **setup** — 每个测试前清理相关表（`beforeEach` 中 `DELETE` 所有表）

---

## 模块 1：项目管理（`/projects/*`）

### 1.1 创建项目

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| PROJ-001 | 创建项目时生成唯一 slug | slug 重复时自动加 `-1` `-2`；基础 slug 为 title 小写 + 替换特殊字符 |
| PROJ-002 | 创建项目时指定 checkpoint | checkpointName 正确存储；为空时使用 DEFAULT_CHECKPOINT_NAME |
| PROJ-003 | 创建项目时传入 presetBindings | presetBindings JSON 正确存储到 Project 记录 |
| PROJ-004 | 创建项目时传入 notes | notes 字段正确存储 |

### 1.2 更新项目

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| PROJ-005 | 更新项目 title | slug **不随** title 自动更新（需验证当前行为是否符合预期） |
| PROJ-006 | 更新 checkpointName | checkpointName 正确更新 |
| PROJ-007 | 更新 presetBindings | presetBindings JSON 正确更新 |
| PROJ-008 | 更新 projectLevelOverrides | projectLevelOverrides JSON 正确存储（defaultAspectRatio/defaultBatchSize 等） |
| PROJ-009 | 传入 sections 数组 | **删除**所有旧 sections 后**重建**（验证 deleteMany + createMany 行为） |

### 1.3 复制项目

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| PROJ-010 | 复制项目 | 新项目有新的 id 和 slug；sections 被复制；promptBlocks 被复制；loraConfig 被复制；**不复制** runs/images |
| PROJ-011 | 复制项目时原项目有 preset 引用 | 新项目的 promptBlocks 保留 sourceId/variantId 引用（快照内容也被复制） |

### 1.4 删除项目

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| PROJ-012 | 删除项目 | sections、promptBlocks、runs、imageResults **级联删除**（Prisma onDelete: Cascade） |
| PROJ-013 | 删除有图片的项目 | ImageResult 删除后，关联的 TrashRecord 也级联删除 |

---

## 模块 2：预设系统（`/assets/presets/*`）

### 2.1 预设分类（PresetCategory）

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| PRED-001 | 创建分类 | name/slug/icon/color/type 正确存储；sortOrder 默认 0 |
| PRED-002 | 分类 type="group" 时 slotTemplate | slotTemplate JSON 正确存储 |
| PRED-003 | 删除分类（有 presets） | onDelete: Restrict — 拒绝删除，抛出异常 |

### 2.2 预设（Preset）

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| PRED-004 | 创建预设 | 关联 categoryId；唯一约束 `[categoryId, slug]` 生效 |
| PRED-005 | 更新预设元数据 | name/slug 更新后，调用 `syncPresetMetadataToImportedSections` 同步到引用方 |
| PRED-006 | **更新预设内容（变体）** | **不自动同步**到已导入的小节（需手动调用 sync） |
| PRED-007 | 软删除预设 | `isActive = false`；不物理删除 |
| PRED-008 | 级联删除预设 | `deletePresetCascade`：删除预设时，**移除**所有引用该预设的 PromptBlocks + 对应 LoRA |

### 2.3 预设变体（PresetVariant）

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| PRED-009 | 创建变体 | prompt/negativePrompt/lora1/lora2 正确存储 |
| PRED-010 | 变体 linkedVariants | linkedVariants JSON 正确存储；`resolveVariantContent` 能正确解析嵌套引用 |
| PRED-011 | 切换变体（switchBindingVariant） | PromptBlock 的 label/positive/negative 更新；section loraConfig 中对应 bindingId 的 LoRA 条目更新 |

### 2.4 同步预设到小节

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| PRED-012 | 同步预设内容 | 所有引用该预设的 PromptBlocks 的 positive/negative 更新；loraConfig 同步更新 |
| PRED-013 | 同步后更新 section 的 positivePrompt/negativePrompt | 同步后，section 的拼接提示词（所有 blocks 的 positive 用 ` BREAK ` 连接）正确更新 |

---

## 模块 3：小节编辑器（`/projects/[id]/sections/[sid]`）

### 3.1 提示词块 CRUD

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| SECT-001 | 添加 custom 块 | type="custom"；positive/negative 正确存储；sortOrder 正确 |
| SECT-002 | 更新提示词块 | label/positive/negative 正确更新；变更日志记录 |
| SECT-003 | 删除提示词块 | block 删除后，section 的 positivePrompt/negativePrompt 重新拼接 |
| SECT-004 | 重新排序提示词块 | sortOrder 更新；变更日志记录顺序调整 |

### 3.2 导入预设到小节

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| SECT-005 | 导入预设（单变体） | 创建 PromptBlock；sourceId/variantId 正确设置；positive/negative **快照**变体内容；LoRA 条目添加到 section loraConfig |
| SECT-006 | 导入预设（多变体） | label 格式为 `预设名 / 变体名` |
| SECT-007 | 导入预设时 sortOrder | 根据 category.positivePromptOrder 插入到正确位置；后续 blocks 的 sortOrder +1 |
| SECT-008 | 导入预设（带 linkedVariants） | `resolveVariantContent` 正确解析；快照的是解析后的内容 |

### 3.3 切换变体

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| SECT-009 | 切换变体 | PromptBlock 的 variantId/label/positive/negative 更新；loraConfig 中对应 bindingId 的 LoRA 更新 |
| SECT-010 | 切换变体后 loraConfig 排序 | LoRA 条目按 category lora1Order/lora2Order 重新排序 |

### 3.4 移除导入的预设

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| SECT-011 | 移除导入的预设（by bindingId） | 删除所有该 bindingId 的 PromptBlocks；从 loraConfig 移除对应 bindingId 的 LoRA 条目 |
| SECT-012 | 移除后重新拼接提示词 | section.positivePrompt/negativePrompt 正确更新 |

### 3.5 小节参数

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| SECT-013 | 更新小节参数 | aspectRatio/batchSize/seedPolicy1/ksampler1 等正确更新；变更日志记录 |
| SECT-014 | 小节 enabled 切换 | enabled 字段正确更新 |
| SECT-015 | 删除小节 | 级联删除 promptBlocks；级联删除 changeLogs |

---

## 模块 4：任务执行（`/queue/*`）

### 4.1 创建任务（Run）

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| RUN-001 | 运行整个项目 | 为每个 enabled section 创建 Run 记录；status="queued"；project.status 更新为对应状态 |
| RUN-002 | 运行单个小节 | 为该 section 创建 Run 记录；status="queued" |
| RUN-003 | 创建 Run 时 resolvedConfigSnapshot | snapshot 包含完整的生成参数（合并项目级覆盖 + 小节参数 + promptBlocks 拼接） |

### 4.2 取消任务

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| RUN-004 | 取消 queued 任务 | status 更新为 "cancelled"；finishedAt 设置；如果 comfyPromptId 在 ComfyUI 队列中，调用 deleteComfyQueueItems |
| RUN-005 | 取消 running 任务 | 调用 interruptComfyPrompt（全局中断） |
| RUN-006 | 取消后更新项目状态 | 如果项目没有活跃的 queued/running runs，project.status 回退到 "draft" |
| RUN-007 | 取消不存在的任务 | 返回错误 "任务不存在" |
| RUN-008 | 取消已完成任务 | 返回错误 "任务状态为「done」，无法取消" |

### 4.3 清空队列

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| RUN-009 | 清空已完成任务 | 删除 status in ["done", "failed", "cancelled"] 的 runs |
| RUN-010 | 清空活跃任务（跨项目） | 所有 queued/running runs 状态改为 cancelled；项目状态正确回退 |

---

## 模块 5：图片审核（`/queue/[runId]`）

### 5.1 保留图片

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| REV-001 | 保留图片 | imageResults.reviewStatus = "kept"；reviewedAt 设置 |
| REV-002 | 保留回收站中的图片 | 文件从 trashPath 移回 originalPath；filePath 更新；trashRecord.restoredAt 设置 |

### 5.2 删除图片（移入回收站）

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| REV-003 | 删除图片 | imageResults.reviewStatus = "trashed"；文件移动到 trashPath；trashRecord 创建 |
| REV-004 | 重复删除同一图片 | trashRecord 更新（upsert）；deletedAt 刷新 |

### 5.3 恢复图片

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| REV-005 | 恢复图片 | filePath 移回 originalPath；reviewStatus = "pending"；reviewedAt = null；trashRecord.restoredAt 设置 |
| REV-006 | 恢复已恢复的图片 | 幂等操作，不报错 |

### 5.4 精选标记

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| REV-007 | 切换 featured 标记 | featured = true ↔ false |
| REV-008 | 切换 featured2 标记 | featured2 = true ↔ false |

---

## 模块 6：项目模板（`/assets/templates/*`）

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| TPL-001 | 创建模板 | name/description/presetBindings 正确存储 |
| TPL-002 | 模板包含 sections | ProjectTemplateSection 正确存储；promptBlocks JSON 字段正确存储 |
| TPL-003 | 从模板创建项目 | 根据模板重建 project + sections + promptBlocks（待确认是否有此功能） |

---

## 模块 7：LoRA 资产管理（`/assets/loras`）

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| LORA-001 | 上传 LoRA 文件 | LoraAsset 记录创建；absolutePath/relativePath 正确 |
| LORA-002 | 更新 LoRA 备注/触发词 | notes/triggerWords 正确更新 |
| LORA-003 | 删除 LoRA 资产 | 记录删除；**不删除**文件（待确认行为） |

---

## 模块 8：变更日志

### 8.1 Section 变更日志

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| CHG-001 | 修改提示词块记录 | dimension="prompt"；before/after JSON 正确 |
| CHG-002 | 修改 LoRA 配置记录 | dimension="lora"；before/after JSON 正确 |
| CHG-003 | 修改运行参数记录 | dimension="runParams"；before/after JSON 正确 |

### 8.2 Preset 变更日志

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| CHG-004 | 修改预设变体记录 | PresetChangeLog.dimension="variants"；before/after JSON 正确 |
| CHG-005 | 修改预设内容记录 | PresetChangeLog.dimension="content" |

### 8.3 审计日志（AuditLog）

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| CHG-006 | 所有写操作记录审计日志 | entityType/entityId/action/actorType 正确记录 |

---

## 模块 9：Worker 引擎（后台任务处理）

> 注：Worker 引擎涉及 ComfyUI API 调用，部分测试需 Mock 外部依赖。

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| WORK-001 | Worker 领取任务 | claim task 逻辑；状态从 queued → running |
| WORK-002 | Worker 下载图片 | 图片下载后创建 ImageResult 记录；filePath/thumbPath 正确 |
| WORK-003 | Worker 处理失败 | 状态更新为 failed；errorMessage 正确记录 |
| WORK-004 | Worker 处理完成 | 状态更新为 done；finishedAt 设置 |

---

## 模块 10：AI Agent API / MCP Server

> 注：这些是需要集成测试的重要接口，验证 Agent 能否正确操作项目。

| 用例 ID | 用例描述 | 验证点 |
|---------|---------|---------|
| AGENT-001 | Agent API: 获取项目列表 | 返回正确的项目数据 |
| AGENT-002 | Agent API: 获取项目详情 | 返回 sections/blocks 详情 |
| AGENT-003 | Agent API: 修改项目参数 | 通过 API 修改后，数据库正确更新 |
| AGENT-004 | Agent API: 触发运行 | 创建 Run 记录 |
| AGENT-005 | MCP Server: tools 列表 | 返回 11 个 tools |
| AGENT-006 | MCP Server: resources 列表 | 返回 3 个 resources |

---

## 附录：测试数据库 Setup

```typescript
// tests/setup.ts
import { prisma } from '@/lib/prisma';
import { beforeEach, afterAll } from 'vitest';

const tables = [
  'AuditLog',
  'LoraAsset',
  'TrashRecord',
  'ImageResult',
  'Run',
  'PromptBlock',
  'SectionChangeLog',
  'ProjectSection',
  'Project',
  'PresetChangeLog',
  'PresetVariant',
  'Preset',
  'PresetGroupMember',
  'PresetGroup',
  'PresetFolder',
  'PresetCategory',
  'ProjectTemplateSection',
  'ProjectTemplate',
];

beforeEach(async () => {
  // Clean up in correct order (respecting foreign keys)
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

---

## 优先级排序

| 优先级 | 模块 | 理由 |
|--------|------|------|
| 🔴 高 | 模块 2（预设系统） | 业务逻辑复杂，快照 vs 同步行为容易出错 |
| 🔴 高 | 模块 3（小节编辑器） | 核心用户操作，涉及多表联动 |
| 🔴 高 | 模块 5（图片审核） | 文件操作 + 数据库操作，容易不一致 |
| 🟡 中 | 模块 1（项目管理） | 基础 CRUD，但复制/删除逻辑需验证级联 |
| 🟡 中 | 模块 4（任务执行） | 需 Mock ComfyUI API，测试复杂度中等 |
| 🟡 中 | 模块 8（变更日志） | 验证审计是否完整 |
| 🟢 低 | 模块 6（模板） | 使用频率较低 |
| 🟢 低 | 模块 7（LoRA 资产） | 主要是文件管理 |
| 🟢 低 | 模块 9（Worker） | 需大量 Mock |
| 🟢 低 | 模块 10（Agent API） | 接口测试，可在 E2E 中覆盖 |
