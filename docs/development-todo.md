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

## ~~Priority A: 收尾~~ ✅ DONE
- [x] Server Actions 中的 trash/restore 接入 `image-file-service` 文件移动
- [x] 补一条清晰的本机验证文档：seed → create job → enqueue → worker → ComfyUI → output

## ~~Priority B: 代码统一~~ ✅ DONE
- [x] 统一 Server Actions（`src/lib/actions.ts`）和 REST API（`src/server/`）的审核/运行逻辑，消除重复
- [x] Server Actions 中 runJob/runPosition/copyJob 直接调用 repository 层

## ~~Priority A: Worker 统一~~ ✅ DONE
- [x] 统一新旧两套 Worker 系统（新版 `src/server/worker/` 体系 + fallback prompt builder）
- [x] 在 `comfyui-service.ts` 中增加 fallback：无 `extraParams.comfyPrompt` 时用内置 SDXL txt2img workflow
- [x] 清理旧版 worker 代码（`src/lib/worker.ts`、`prompt-builder.ts`、`comfyui-client.ts`）

## ~~Priority C: Workflow 模板~~ ✅ DONE
- [x] 创建 `config/workflows/` 目录 + 示例 workflow JSON 模板（`sdxl-txt2img` + `sdxl-txt2img-hires`）
- [x] 实现 workflow 模板加载器服务（`src/server/services/workflow-template-service.ts`）
- [x] `comfyui-service.ts` 支持 `workflowTemplateId` 解析（优先级：自定义 comfyPrompt > 模板 > fallback）
- [x] API 端点 `GET /api/workflows` + `GET /api/workflows/:templateId`
- [x] PositionTemplate 通过 `defaultParams.workflowTemplateId` 关联 workflow 模板
- [x] 前端 Position 模板设置页显示 Workflow 模板选择下拉框

## ~~Priority E: Agent / Automation~~ ✅ DONE
- [x] 编写 Agent API 使用说明文档（`docs/agent-api.md`）
- [x] 包含完整端点说明、请求/响应格式、典型工作流、Workflow 模板系统文档

## Working Notes
- 单体 Next.js 项目，统一在 `main` 分支开发
- `frontend` / `backend` 分支已合并到 `main` 并可归档
- 两套数据访问路径：Server Actions（前端 RSC 直接调用）+ REST API（外部/Agent 调用）
- `development-progress.md` 保持当前态摘要
- Worker 已统一为 `src/server/worker/` 单一体系，支持 fallback SDXL txt2img
