# Development Todo

## Priority A: make the local path explicit
- [ ] 写一条可复现的本机验证文档：seed -> create job -> enqueue -> local worker pass -> ComfyUI history -> output images
- [ ] 把 `.env.example`、数据库初始化、worker 本地触发方式统一整理进 README / handoff

## Priority B: reduce fallback dependence
- [ ] 继续减少 queue / jobs / detail 页面上的 mock fallback
- [ ] 明确哪些 fallback 只是开发期保底，哪些应长期保留

## Priority C: file/output flow
- [ ] 明确 raw / kept / trashed 的目标目录组织
- [ ] 按最终目录策略补文件移动 / 恢复 / 归档逻辑

## Priority D: config management
- [ ] 补 Character 管理入口
- [ ] 补 Scene / Style / PositionTemplate 管理入口
- [ ] 明确模板配置与大任务覆盖的边界

## Priority E: agent / automation
- [ ] 继续完善 agent 写接口
- [ ] 明确后续 agent / MCP 接口边界
- [ ] 为外部 AI/Agent 接手补更清晰的 API 使用说明

## Working Notes
- 前后端并行开发，分别在 `frontend` / `backend` 分支提交并 push
- 共享文档放在 `main`
- `development-progress.md` 保持当前态摘要，不再写成流水账
