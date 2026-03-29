# Plan: 适配简化后的 workflow.api.json

## 变更分析

新版 `workflow.api.json` 大幅简化了 LoRA 链路：

**删除的节点**: 9 (PreviewImage), 24, 25 (重复 LoRA Loader), 428 (VAEDecode), 429 (PreviewImage), 482 (character lora), 524 (重复 LoRA Loader)

**新链路**（从 7 个 LoRA 相关节点简化为 2 个）：
```
KS1: Checkpoint(1) → 522(lora1) → KSampler1(3),  CLIP from 522
KS2: Checkpoint(1) → 36(lora2)  → KSampler2(427), CLIP from 36
```

核心变化：
- **Character LoRA 节点(482) 已移除** — 不再有角色专属 LoRA 节点
- **lora1(522) 仅服务 KS1**，lora2(36) 仅服务 KS2 — 不再需要填充重复节点
- 两条链路都直接从 Checkpoint(1) 出发，不再经过 482

## 需要改动的文件

### 1. `src/server/services/workflow-prompt-builder.ts`
- 删除 characterLora 填充逻辑（原填节点 482，该节点已不存在）
- 删除 lora1 填 24 节点的逻辑（只保留填 522）
- 删除 lora2 填 524、25 节点的逻辑（只保留填 36）
- 处理 characterLora 兼容：将 characterLora 条目合并到 lora1 前面填入 522（这样数据库中已有的 characterLora 数据仍会生效）
- 更新文件头部的节点映射注释

### 2. `docs/design-v0.3-workflow-integration.md`
- 更新 §2 节点映射表（删除已移除的节点，更新连接关系）
- 更新 LoRA 链路分析图
- 更新 §3 填充策略说明

### 3. `src/server/services/comfyui-service.ts`（可选，小改动）
- `cachedStandardWorkflow` 在文件变更后需清缓存 → 实际上重启服务会自动清，无需代码改动
- 无需改动，`resolveStandardWorkflowPrompt` 中 characterLora 的合并逻辑移到 builder 层

### 不需要改的
- `lora-types.ts` — PositionLoraConfig 结构保持不变（characterLora/lora1/lora2 三分区在 UI/数据层仍有意义）
- 前端 UI — 三栏 LoRA 编辑器保持不变
- Prisma schema — 无需改动
- `comfyui-service.ts` — resolveStandardWorkflowPrompt 的 loraConfig 解析无需改动

## 实施步骤

1. **更新 `workflow-prompt-builder.ts`**：修改 `buildWorkflowPrompt` 函数
2. **更新设计文档**：同步 node mapping 到新的简化链路
3. **验证 build 通过**：`npm run build`
