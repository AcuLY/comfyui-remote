# ComfyUI Remote

移动优先的 ComfyUI 管理后台，目标是把大任务管理、批量审图、回收站、LoRA 上传、参数编辑和后续 Agent 操作整合进一个仓库。

## 当前结构
- `src/app/queue`：待审核队列、宫格审核、单图查看
- `src/app/jobs`：大任务列表与详情骨架
- `src/app/trash`：回收站页
- `src/app/assets/loras`：LoRA 资源页
- `prisma/`：数据库模型草案
- `docs/design-v0.1.md`：产品与架构设计文档

## 开发方式
- 前端分支：`frontend`
- 后端分支：`backend`
- 整合分支：`main`

每次提交遵循 Conventional Commits，并在提交后立即 push 到远程对应分支。

## 本地运行
```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 后续计划
1. 完成前端交互与真实数据接入
2. 接入 Prisma + PostgreSQL
3. 增加 API / worker / 文件上传
4. 打通 ComfyUI HTTP API
