# ComfyUI Remote

一个移动优先的 ComfyUI 管理后台，用来把大任务管理、Position Run、批量审图、回收站、LoRA 上传、参数编辑、后续 Agent 接口整合到一个项目里。

## 目标
支持以下核心流程：
- 创建和管理 Character / Scene / Style / Position 组合成的大任务
- 运行整组任务或单个 Position
- 在手机上按宫格批量审核图片（保留 / 删除）
- 回收站恢复
- 上传 LoRA 到受控路径
- 通过 worker 对接 ComfyUI API

## 技术栈
- Frontend: Next.js App Router + Tailwind
- Backend: Next.js Route Handlers + Prisma
- Database: PostgreSQL
- Worker: Node-based worker scaffold
- Storage: 本地文件系统
- AI/Agent: HTTP API（后续可扩展 MCP）

## 仓库结构
- `docs/design-v0.1.md`：产品与架构设计文档
- `docs/handoff.md`：接手文档 / 当前状态摘要
- `docs/development-progress.md`：精简后的当前进度
- `docs/development-todo.md`：当前待办清单
- `prisma/`：数据模型、seed
- `src/app`：前端页面与 API 路由
- `src/server`：repository / service / worker
- `config/path-maps.json`：LoRA 分类到相对目录的映射

## 本地启动
1. 安装依赖
```bash
npm install
```
2. 配置 `.env`
- 参考 `.env.example`
- 填写 PostgreSQL / ComfyUI / 路径配置
3. 初始化数据库
```bash
npm run prisma:generate
npm run db:bootstrap
```
4. 启动项目
```bash
npm run dev
```

### 本地手动触发 worker pass
- 启动 `npm run dev` 后，可用 `POST /api/worker/process` 手动触发一次 worker pass。
- `POST /api/local/worker/pass?limit=1` 也可触发（只允许 localhost 访问）。
- 当前 pass 会 claim queued run、向 ComfyUI 提交 `/prompt`，再轮询 `/history/:promptId`。
- 成功后下载图片、生成缩略图、写入 ImageResult，标记 PositionRun 为 `done`。

### 本地数据库 bootstrap
- `npm run prisma:generate`：生成 Prisma client
- `npm run prisma:migrate`：运行数据库 migration
- `npm run db:seed`：写入样例 seed 数据
- `npm run db:bootstrap`：串联 migrate + seed，作为本地初始化默认入口

## 建议接手顺序
1. 先读 `docs/handoff.md`
2. 再读 `docs/design-v0.1.md`
3. 看 `docs/development-todo.md`
4. 然后继续开发
