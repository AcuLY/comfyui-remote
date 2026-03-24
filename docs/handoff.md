# Handoff

## 这是什么
ComfyUI Remote 是一个移动优先的 ComfyUI 管理后台。核心目标是把：
- 大任务管理
- Position Run 运行
- 宫格审图
- 回收站
- LoRA 上传
- 参数编辑
- Worker / ComfyUI 对接
- Agent 接口
放进一个统一系统里。

## 当前代码组织
- 单体 Next.js 项目（App Router），统一在 `main` 分支
- `prisma/` — 数据库 schema + migration
- `src/app/` — 页面 + 客户端组件
- `src/lib/` — 共享工具（prisma client、server-data 查询、server actions、类型）
- `src/components/` — 通用 UI 组件（AppShell、SectionCard 等）
- `src/scripts/` — seed 脚本

## 当前完成度（接手时最该知道的）

### 数据库
- PostgreSQL via docker-compose
- Prisma schema 覆盖：Character、ScenePreset、StylePreset、PositionTemplate、CompleteJob、CompleteJobPosition、PositionRun、ImageResult、TrashRecord、LoraAsset、AuditLog
- 有 seed 脚本填充测试数据

### 页面 + 交互
| 路径 | 数据源 | 交互状态 |
|------|--------|----------|
| `/queue` | Prisma 真实查询 | 只读列表 |
| `/queue/[runId]` | Prisma | ✅ 多选 + 批量保留/删除 |
| `/queue/[runId]/images/[imageId]` | Prisma | ✅ 单图保留/删除 |
| `/jobs` | Prisma | ✅ 编辑/复制/运行按钮 |
| `/jobs/[jobId]` | Prisma | ✅ 运行整组/复制/运行单节 |
| `/trash` | Prisma | ✅ 恢复按钮 |
| `/assets/loras` | Prisma | 只读列表 |

### Server Actions (`src/lib/actions.ts`)
- `reviewImages` — 批量 keep/trash
- `restoreImage` — 回收站恢复
- `runJob` — 运行整组（创建 PositionRun 记录）
- `runPosition` — 运行单节
- `copyJob` — 复制大任务（含 Prisma JSON 类型桥接）

### 尚未实现
- 参数编辑页
- Job 创建页 `/jobs/new`
- LoRA 上传功能
- Worker scaffold / ComfyUI API 对接
- 文件归档逻辑（raw / kept / trashed 目录组织）
- Character / Scene / Style / PositionTemplate 管理入口
- Agent API 路由

## 推荐接手顺序
1. 看 `docs/design-v0.1.md` 了解整体设计
2. 看 `prisma/schema.prisma` 了解数据模型
3. 看 `src/lib/server-data.ts` 了解查询层
4. 看 `src/lib/actions.ts` 了解已有的 Server Actions
5. 看 `docs/development-todo.md` 了解下一步优先级

## 本地运行
```bash
docker compose up -d          # 启动 PostgreSQL
npx prisma migrate deploy     # 应用迁移
npx tsx src/scripts/seed.mts  # 填充测试数据
npm run dev                   # 启动开发服务器
```

## 接手前建议先看
1. `docs/design-v0.1.md`
2. `docs/development-progress.md`
3. `docs/development-todo.md`
4. `prisma/schema.prisma`

## 当前文档状态
- `development-progress.md`：保留当前态，不再记录过细流水
- `development-todo.md`：只放尚未完成或仍值得跟进的项
