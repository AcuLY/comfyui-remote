# ComfyUI Remote

单仓库项目，长期目标是承载移动端审图、大任务管理、LoRA 上传、ComfyUI 调度、Agent 接口与 worker。

## 分支
- `frontend`：页面与交互
- `backend`：Prisma、API、worker、文件处理
- `main`：整合基线

## 当前后端基础
- Prisma 数据模型草案：`prisma/schema.prisma`
- Prisma client 入口：`src/lib/db.ts`
- API 返回工具：`src/lib/api-response.ts`
- 环境变量封装：`src/lib/env.ts`
- repository 骨架：`src/server/repositories/*`
- API 占位：`src/app/api/**`
- worker 目录：`src/server/worker/`

## 本地准备
1. 复制 `.env.example` 为 `.env`
2. 填写 `DATABASE_URL`
3. 执行：
```bash
npm install
npm run prisma:generate
npm run lint
npm run dev
```

## 下一步
1. 接入真实 PostgreSQL
2. 生成 migration 并验证 Prisma client
3. 完成 queue/jobs/trash/loras 的真实 API
4. 增加 LoRA 上传与回收站恢复
5. 接入 ComfyUI worker
