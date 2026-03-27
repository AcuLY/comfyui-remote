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

## Completed (v0.3 — Workflow 集成 + LoRA 改造)

详见 `design-v0.3-workflow-integration.md`，全部 5 个 Phase 已完成：

- [x] LoRA 分区管理（characterLora / lora1 / lora2 三栏编辑）
- [x] 双 KSampler 参数支持（KSampler1 + KSampler2 可折叠面板）
- [x] 标准 workflow.api.json 填充器（workflow-prompt-builder.ts）
- [x] Prisma schema 变更 + Worker 集成
- [x] 前端 LoRA 三栏编辑 + KSampler 参数表单

## Completed (v0.4 — 结果管理 + LoRA 文件管理)

- [x] **结果 Gallery 页** — 独立页面展示小节所有运行结果，3-5 列网格，按 Run 分组
- [x] **Lightbox 放大** — 点击图片放大查看，左右切换，键盘快捷键
- [x] **精选标记** — Lightbox 中星形按钮标记精选（F 快捷键），缩略图显示星标
- [x] **图片整合导出** — 一键将 kept 图片转 JPG 打包 zip，featured 图片单独输出到 pixiv/ 目录
- [x] **LoRA 文件管理器** — 磁盘目录浏览、上传到当前目录、跨目录移动文件
- [x] **LoRA 级联选择器** — 替换所有 LoRA 下拉为逐级目录导航的底部弹窗选择器
- [x] **LoRA 备注** — 数据库绑定文件的备注字段，文件移动时自动跟随
- [x] **结果缩略图条** — Job 详情的小节列表直接展示最近运行图片

## Completed (v0.5 — 统一提示词分类系统)

- [x] PromptCategory + PromptPreset schema
- [x] 数据迁移脚本 (migrate-presets.ts)
- [x] 后端 CRUD actions + server-data fetchers
- [x] 提示词管理页 /assets/prompts
- [x] PromptBlock 编辑器动态分类支持
- [x] 任务创建/编辑表单动态分类多选
- [x] Pipeline snapshot presets 数组
- [x] 删除旧 CRUD、旧 fetchers、旧设置页面
- [x] 展示层 characterName 改为 presetBindings 解析

## Working Notes

- 单体 Next.js 项目，统一在 `main` 分支开发
- 两套数据访问路径：Server Actions（前端 RSC 直接调用）+ REST API（外部/Agent 调用）
- Worker 已统一为 `src/server/worker/` 单一体系，支持 fallback SDXL txt2img
- AuditLog 和 JobRevision 模型已激活，有完整的应用层代码
