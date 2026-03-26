# Development Todo

## Completed (v0.1 → v0.2)

All planned features for v0.1 and v0.2 have been implemented:

- **数据库基础设施** — PostgreSQL + Prisma schema (12 模型 + 4 枚举)
- **页面真实数据** — 所有页面从 mock-data 迁移到真实 Prisma 查询
- **交互接线** — Server Actions 全部接通真实后端
- **核心页面** — Job 创建/编辑、参数编辑、LoRA 上传
- **Worker / ComfyUI 对接** — Worker 执行引擎 + ComfyUI API
- **配置管理** — Character / Scene / Style / PositionTemplate CRUD
- **REST API + Agent API** — Service + Repository 三层架构
- **代码统一** — Server Actions 和 REST API 逻辑统一
- **Workflow 模板系统** — 模板加载 + 导入 + 前端管理
- **AuditLog + JobRevision** — 审计日志 + 修订历史
- **MCP Server** — 11 个 Tools + 7 个 Resources
- **审图快捷操作** — 批量保留/删除 + 自动跳转下一组
- **Prompt Block (v0.2)** — 提示词块系统（schema / backend / frontend / migration / MCP）

## Next: v0.3 Workflow 集成

详见 `design-v0.3-workflow-integration.md`，主要内容：

- [ ] LoRA 分区管理（characterLora / lora1 / lora2）
- [ ] 双 KSampler 参数支持（KSampler1 + KSampler2）
- [ ] 标准 workflow.api.json 填充器
- [ ] Prisma schema 变更 + 数据迁移
- [ ] 前端 LoRA 三栏编辑 + KSampler 参数表单

## Working Notes

- 单体 Next.js 项目，统一在 `main` 分支开发
- 两套数据访问路径：Server Actions（前端 RSC 直接调用）+ REST API（外部/Agent 调用）
- Worker 已统一为 `src/server/worker/` 单一体系，支持 fallback SDXL txt2img
- AuditLog 和 JobRevision 模型已激活，有完整的应用层代码
