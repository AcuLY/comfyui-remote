# Development Todo

## Priority A: make local run viable
- [x] 准备 `.env.example` / 本地启动说明统一化
- [x] 确认可在本机完成 `npm install`
- [x] 确认可在本机完成 `npm run lint`
- [x] 增加数据库初始化说明或 seed 方案
- [x] 让前端至少有一部分页面从真实 API 读数据

## Priority B: review flow
- [x] 实现 queue API 与前端对接
- [x] 实现 trash API 与前端对接
- [x] 实现 keep / trash / restore 的最小真实逻辑
- [x] 整理 review API 的 service 层校验与错误映射
- [x] 让宫格页从 run 真实数据渲染
- [x] 为宫格页接入批量 keep / trash 的真实提交

## Priority C: job flow
- [x] 继续完善 jobs API（已支持 search/status/enabledOnly/hasPending，并接到 jobs 列表筛选表单）
- [x] 补 job 复制 API，并把 jobs 列表“复制”按钮接到真实动作
- [x] 完善 job detail / edit 页与真实数据衔接（先完成只读加载与 fallback）
- [x] 预留 job 参数保存动作与 position 参数保存动作
- [x] 前端接上 job / position 编辑页真实 PATCH 保存链路
- [x] 预留 run-all / run-single-position 的真实逻辑入口
- [x] 前端接上 run-all / run-single-position 的真实触发与反馈

## Priority D: lora flow
- [x] LoRA 页接真实 `/api/loras`
- [x] 接真实上传表单到 `/api/loras`
- [x] 校验 category/path mapping
- [x] 记录上传后的 DB 数据

## Priority E: infra
- [x] 增加 seed/mock bootstrap 脚本
- [x] 增加 worker scaffold
- [x] 预留 ComfyUI payload builder
- [x] 让 worker scaffold 真正消费 queued run（状态流转 / 错误记录）
- [x] 补一个最小 worker 手动触发入口（本地受控 API）以便验证 queue -> worker 闭环
- [x] 接入 ComfyUI prompt submit / history polling
- [x] 接入 ComfyUI 输出下载与 ImageResult 落库
- [x] 预留图片缩略图生成与文件移动服务
- [x] 补图片缩略图 / 宽高元数据提取

- [x] 宫格页提交后的局部状态优化（成功后清空选择 / 忽略已失效选中项）

- [x] 补 frontend 的“新建任务”最小入口（表单或 server action），接上已完成的 `POST /api/jobs`
- [x] 让 `/jobs/new` 在创建 draft 成功后自动跳转到 edit/detail（已接到真实 server action redirect）
- [x] 记录并验证一条本机最小创建链路（打开 `/jobs/new` -> 创建 draft -> 自动跳转到 edit/detail，并补一条人工本机验证记录）

- [x] 让单图查看页优先读取真实 run 数据，并接上单张 keep / trash 动作
- [x] 让 job detail 页的“复制任务”入口复用真实 copy action，不再保留死按钮
- [x] 让宫格审核页的“参数编辑”入口优先跳到真实 position 编辑页，并在 mock fallback 场景保持安全禁用

## Working Notes
- 前后端并行开发，分别在 `frontend` / `backend` 分支提交并 push
- 共享进度文档放在 `main`
- 每轮优先选择“最小但可见”的下一步
