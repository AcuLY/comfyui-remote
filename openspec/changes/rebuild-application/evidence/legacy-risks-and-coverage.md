# 旧实现风险与扫描覆盖

以下是扫描来源的风险和覆盖附录，不是新增功能或新版运行事实；新版裁决见 [最终口径](../decisions/00-final-decisions.md)。

## E. 当前已确认的半成品、冲突和删除陷阱

这些不是额外功能，而是做“保留/移除”决策时必须同时处理的约束。

| 风险 ID | 当前事实 | 影响 |
| --- | --- | --- |
| `RISK-001` | 认证只有全能单 token，没有注销、角色或运维权限分级 | 保留高风险 API 时应先决定权限模型 |
| `RISK-002` | `/api/queue-data` 的 GET 会调用 `recoverStaleRuns()` | 不能把它当纯只读查询重建轮询 |
| `RISK-003` | Generation 审核逻辑分别存在于队列、小节结果、项目结果三套 UI | 简化 UI 时要先统一状态机和快捷键/撤销差异 |
| `RISK-004` | Generation 项目归档是跨 DB/文件/ComfyUI 的尽力清理，非事务，且无反归档 | “移除归档”与“保留历史项目”必须一起决策 |
| `RISK-005` | Generation 预制绑定包含继承、detach、抑制 tombstone、组级联 | 不能直接降级成单个 JSON 文本框 |
| `RISK-006` | Generation/Training 共库，依赖资源边界过滤保留资源 | 重构 repository 时容易跨模式泄漏 |
| `RISK-007` | Training text_generation 任务可以入队，但没有 worker 消费 | UI 入口目前会制造永久 queued 任务 |
| `RISK-008` | 默认 Training supervisor image provider 与真实 worker 不匹配 | 默认命令无法完成真实图片任务 |
| `RISK-009` | Dataset readiness 要求无缺 caption，但同步 freeze 允许空 caption | 同一按钮链路有矛盾门槛 |
| `RISK-010` | Dataset-freeze worker 不生成 manifest/items，与主同步冻结不等价 | 建议只保留一个权威冻结路径 |
| `RISK-011` | Training lease 没有持久过期、owner 强制或真实 attempt 语义 | 崩溃恢复与并发不能依赖“lease”名称 |
| `RISK-012` | Training cancel 不终止外部 runner，只把 DB 标 failed | 新版取消按钮不能沿用当前承诺 |
| `RISK-013` | Training 项目/参考图/结果/运行删除普遍不清文件 | 数据库删除会留下孤儿资产 |
| `RISK-014` | 归档 Training 项目的写保护不完整 | “归档”不是可靠只读状态 |
| `RISK-015` | Training preset GET 会写默认预制并覆盖文本 | 读取接口存在隐藏 DB 写入 |
| `RISK-016` | Training preset usage/cascade 多为软停用或硬编码，并非真实绑定关系 | 删除确认不能信任当前 usage 数字 |
| `RISK-017` | Training template 更新整树删除重建；删除无恢复 | 模板 ID/历史/引用稳定性差 |
| `RISK-018` | Caption “生成”是同步固定字符串，不是 AI/worker | 新版应改名或接真实 provider |
| `RISK-019` | Training run poll 是读取别名，cleanup 永远 no-op | 属于占位接口，不应迁移为产品功能 |
| `RISK-020` | Training completion 信任外部 Artifact 路径，不验证文件存在/大小/hash | 保留训练必须补产物验收 |
| `RISK-021` | Training 新建表单有多项不进入执行的参数 | 新版应删掉或真正接线 |
| `RISK-022` | “从 TrainingRun 创建预制”实际创建场景描述预制，不注册 LoRA 模型 | 需要重新定义产物晋升流程 |
| `RISK-023` | Training 真实使用 `/api/images`，但资源边界文档把它视为 Generation 入口 | 新版需把媒体 route 明确为共享或拆分 |
| `RISK-024` | Training 旧 UI 深度依赖 design-demo shell/UI/types | 按 MIG-01 全新建设，不导入旧代码；该旧依赖关系不再阻塞新版实现，只在整理旧目录时确保业务数据与文件已保全 |
| `RISK-025` | 通用 route fallback 会把失效深链静默导向父页面或 `/queue` | 删除功能时应显式选择 redirect/tombstone/404 |
| `RISK-026` | 模型上传/移动同时修改文件系统和 DB，但非单一事务 | 新版需设计失败恢复 |
| `RISK-027` | 图片 route 使用 immutable 缓存且处于认证代理后 | 新版反向代理/CDN 策略要重新验证 |

---

## F. 覆盖附录

### F1. 生产页面覆盖

扫描到 27 个非 Demo `page.tsx`：

- 根与认证：`/`（转 `/queue`）、`/login`。
- Generation 运行：`/queue`、`/queue/[runId]`。
- Generation 项目：`/projects`、`/projects/new`、`/projects/new/from-existing`、`/projects/[projectId]`、`edit`、`batch-create`、section 编辑、section 结果、项目结果。
- Generation 预制：`/assets/presets`、preset detail、sort-rules、preset-group detail。
- Generation 模板：`/assets/templates`、new、edit、template section。
- 共享：`/assets/models`、`/assets/loras` 兼容跳转、`/settings`、`/settings/monitor`、`/settings/logs`。
- Training：一个 catch-all `page.tsx` 分派 23 条实际 `/training/**` 路由。

### F2. API route 分组覆盖

总计 194 个 route 文件。下表按第一级/第二级前缀分组，所有组都已映射到上方功能项或兼容项。

| API 组 | Route 数 | API 组 | Route 数 |
| --- | ---: | --- | ---: |
| `agent` | 10 | `audit-logs` | 1 |
| `auth` | 1 | `comfy` | 5 |
| `health` | 1 | `image-review` | 1 |
| `images` | 6 | `logs` | 1 |
| `loras` | 4 | `mcp` | 1 |
| `models` | 5 | `path-maps` | 1 |
| `preset-library` | 25 | `presets` | 1 |
| `project-create-options` | 1 | `project-folders` | 4 |
| `projects` | 23 | `queue` | 5 |
| `queue-data` | 1 | `runs` | 5 |
| `sections` | 1 | `templates` | 6 |
| `training/blocks` | 2 | `training/dataset-revisions` | 1 |
| `training/generation-inputs` | 1 | `training/generation-outputs` | 1 |
| `training/generation-tasks` | 7 | `training/image-results` | 3 |
| `training/presets` | 3 | `training/projects` | 19 |
| `training/reference-images` | 2 | `training` 能力清单 | 1 |
| `training/runs` | 1 | `training/scene-description` | 8 |
| `training/scheduler` | 2 | `training/section-runs` | 2 |
| `training/sections` | 5 | `training/templates` | 10 |
| `training/text-revisions` | 1 | `training/training-runs` | 5 |
| `training/worker` | 10 | `worker` | 1 |

### F3. MCP 覆盖

11 个工具：

1. `list_projects`
2. `update_project`
3. `update_project_section`
4. `run_all_sections`
5. `run_section`
6. `review_images`
7. `list_prompt_blocks`
8. `add_prompt_block`
9. `update_prompt_block`
10. `remove_prompt_block`
11. `reorder_prompt_blocks`

3 个资源：`project-context`、`run-context`、`section-blocks`。

### F4. 数据模型覆盖

- Generation 预制：`PresetCategory`、`Preset`、`PresetVariant`、`PresetVariantLink`、`PresetGroup`、成员、slot、folder、两类 change log。
- Generation 项目/模板：`Project`、`ProjectFolder`、`ProjectSection`、section folder、project/template preset binding、prompt block、manual LoRA、`ProjectTemplate` 及其 section/folder/binding/block/LoRA。
- Generation 执行/审核：`Run`、`ImageResult`、`TrashRecord`、`CensoringTask`。
- Training：scene preset category/folder/preset、template/section/block、project/profile/reference image/artifact、section/block/run、image result、generation task/input/output、dataset revision/item、training run、text revision。
- 共享/平台：`LoraAsset`、`AuditLog`、`GpuTaskLock`。

### F5. 明确排除的非生产表面

- `/design-demos/**` 的 63 个演示路由、演示夹具和展示注册表不计为产品功能；按 IA-15 和 MIG-01 从新版全新工程中排除。
- `src/features/training/build.ts` 的样例数据只作为 Demo/兼容 fallback，不计为生产数据能力。
- 测试、fixture、文档生成器、Harness、CI 和 GitHub 工作流不计入新产品功能。
- Training 对 design-demo shell/UI/types 的旧代码依赖由 ARCH-001/002 记录为历史事实；新版从零实现，不承担该代码迁移依赖。
