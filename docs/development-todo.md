# Development Todo

## ~~Priority B: reduce fallback dependence~~ ✅ DONE
- [x] 所有页面已从 mock-data 迁移到真实 Prisma 查询
- [x] mock-data.ts 已移除
- [x] 所有交互按钮已接上真实 Server Actions

## ~~Priority A: 核心缺失页面~~ ✅ DONE
- [x] 实现参数编辑页（入口：宫格三点菜单 + Job 详情页）
- [x] 实现 Job 创建页 `/jobs/new`（选择 Character / Scene / Style，勾选 Position）
- [x] 实现 LoRA 上传功能（当前只有只读列表）

## ~~Priority A: Worker / ComfyUI 对接~~ ✅ DONE
- [x] 实现 Worker scaffold（消费 queued PositionRun）
- [x] 接入 ComfyUI API（/prompt 提交 + /history 轮询）
- [x] 实现输出图下载、缩略图生成、ImageResult 落库

## ~~Priority A: 文件归档 + 配置管理~~ ✅ DONE
- [x] 实现 LoRA 真实文件写入磁盘
- [x] 补 Character 管理入口
- [x] 补 Scene / Style / PositionTemplate 管理入口

## ~~Priority A: REST API + Agent API~~ ✅ DONE（从 backend 分支合并）
- [x] 完整 REST API 层（Service + Repository 架构）
- [x] Agent API 路由（context / update / run / review）
- [x] 图片文件移动服务 `image-file-service.ts`
- [x] REST API 审核流程含文件移动

## Priority A: 收尾
- [ ] Server Actions 中的 trash/restore 接入 `image-file-service` 文件移动
- [ ] 补一条清晰的本机验证文档：seed → create job → enqueue → worker → ComfyUI → output

## Priority B: 代码统一
- [ ] 统一 Server Actions（`src/lib/actions.ts`）和 REST API（`src/server/`）的审核/运行逻辑，消除重复
- [ ] 考虑让 Server Actions 直接调用 service 层而非直接操作 Prisma

## Priority C: Workflow 模板
- [ ] 实现 workflow 模板系统（从 `config/workflows/*.json` 加载）
- [ ] 支持自定义 ComfyUI workflow（当前只有基础 SDXL txt2img）

## Priority E: Agent / Automation
- [ ] 为外部 AI/Agent 补更清晰的 API 使用说明
- [ ] 明确后续 agent / MCP 接口边界

## Working Notes
- 单体 Next.js 项目，统一在 `main` 分支开发
- `frontend` / `backend` 分支已合并到 `main` 并可归档
- 两套数据访问路径：Server Actions（前端 RSC 直接调用）+ REST API（外部/Agent 调用）
- `development-progress.md` 保持当前态摘要
