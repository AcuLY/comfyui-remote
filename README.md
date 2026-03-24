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

## 分支 / worktree 规则
- `main`：共享文档、整合基线
- `frontend`：前端页面、交互、页面级数据接入
- `backend`：Prisma、API、worker、文件处理、ComfyUI 对接

本地 worktree：
- `D:\luca\code\myproject\comfyui-manager`
- `D:\luca\code\myproject\comfyui-manager-frontend`
- `D:\luca\code\myproject\comfyui-manager-backend`

## 开发约定
- 使用 Conventional Commits
- 每次提交后立即 push 到对应远程分支
- 小步推进，优先做可验证的小闭环

## 当前状态
项目已经不是纯骨架，当前已具备：
- queue / review / trash / jobs / lora 的主要页面骨架
- 多数关键页面已优先读取真实 API，保留 mock fallback
- review keep / trash / restore 的最小真实逻辑
- job create / copy / edit / run 的最小真实 API
- worker scaffold、local worker pass、ComfyUI prompt submit / history polling / 输出落库 / 缩略图生成
- agent context / update / review / single-position run 的最小接口

还未完全完成的主要部分：
- 进一步减少页面对 mock fallback 的依赖
- 补更完整的本机启动与手动验证记录
- 视需要补文件归档 / kept-raw 组织逻辑
- 补更正式的 Character / Scene / Style / PositionTemplate 管理入口

## 本地启动（当前建议）
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

## 建议接手顺序
1. 先读 `docs/handoff.md`
2. 再读 `docs/design-v0.1.md`
3. 看 `docs/development-todo.md`
4. 然后在对应分支/worktree 上继续开发
