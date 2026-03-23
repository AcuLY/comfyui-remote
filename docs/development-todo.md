# Development Todo

## Priority A: make local run viable
- [x] 准备 `.env.example` / 本地启动说明统一化
- [ ] 确认可在本机完成 `npm install`
- [x] 确认可在本机完成 `npm run lint`
- [x] 增加数据库初始化说明或 seed 方案
- [x] 让前端至少有一部分页面从真实 API 读数据

## Priority B: review flow
- [x] 实现 queue API 与前端对接
- [x] 实现 trash API 与前端对接
- [x] 实现 keep / trash / restore 的最小真实逻辑
- [x] 整理 review API 的 service 层校验与错误映射
- [x] 让宫格页从 run 真实数据渲染

## Priority C: job flow
- [ ] 完善 jobs API
- [x] 完善 job detail / edit 页与真实数据衔接（先完成只读加载与 fallback）
- [ ] 预留 job 参数保存动作与 position 参数保存动作
- [ ] 预留 run-all / run-single-position 的真实逻辑入口

## Priority D: lora flow
- [x] LoRA 页接真实 `/api/loras`
- [x] 接真实上传表单到 `/api/loras`
- [x] 校验 category/path mapping
- [x] 记录上传后的 DB 数据

## Priority E: infra
- [x] 增加 seed/mock bootstrap 脚本
- [ ] 增加 worker scaffold
- [ ] 预留 ComfyUI payload builder
- [ ] 预留图片缩略图生成与文件移动服务

## Working Notes
- 前后端并行开发，分别在 `frontend` / `backend` 分支提交并 push
- 共享进度文档放在 `main`
- 每轮优先选择“最小但可见”的下一步
