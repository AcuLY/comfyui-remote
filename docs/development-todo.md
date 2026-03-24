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
- [ ] 补一条清晰的本机验证文档：seed → create job → enqueue → worker → ComfyUI → output

## Priority A: 文件归档 + 配置管理
- [ ] 明确 raw / kept / trashed 的目标目录组织
- [ ] 按最终目录策略补文件移动 / 恢复 / 归档逻辑
- [ ] 实现 LoRA 真实文件写入磁盘
- [ ] 补 Character 管理入口
- [ ] 补 Scene / Style / PositionTemplate 管理入口
- [ ] 明确模板配置与大任务覆盖的边界
- [ ] 补一条清晰的本机验证文档：seed → create job → enqueue → worker → ComfyUI → output

## Priority E: Agent / Automation
- [ ] 继续完善 agent 写接口
- [ ] 明确后续 agent / MCP 接口边界
- [ ] 为外部 AI/Agent 接手补更清晰的 API 使用说明

## Working Notes
- 单体 Next.js 项目，统一在 `main` 分支开发
- `development-progress.md` 保持当前态摘要，不再写成流水账
