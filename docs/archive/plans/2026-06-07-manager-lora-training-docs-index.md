# Manager LoRA Training 文档索引

日期：2026-06-07
状态：当前文档入口。进入开发前，先按本文确认应该阅读哪份设计文档。

## 当前有效文档

1. `docs/plans/2026-06-07-manager-lora-training-final-technical-design.md`
   - 当前 LoRA Training v2 的主设计来源。
   - 迁入来源：`/root/.hermes/tmp/manager-lora-training-final-technical-design-2026-06-07.md`。
   - 覆盖数据结构、业务行为、服务/API 边界、生成任务模型、训练集冻结、artifact 生命周期、路由与模块组织。
   - 若其他 LoRA 训练文档与它冲突，以此文档为准。

2. `docs/plans/2026-06-07-manager-lora-training-backend-api-schema-design.md`
   - 后端专项补充文档。
   - 覆盖 Prisma model/enum 草案、repository/service 分层、HTTP API surface、关键事务与不变量。
   - 它是主设计的下游展开，不应反向覆盖主设计。

## 外部原始来源

- `/root/.hermes/tmp/manager-lora-training-final-technical-design-2026-06-07.md`
  - 这是最初提供的 Hermes 临时目录设计文档。
  - 内容已经迁入 `docs/plans/2026-06-07-manager-lora-training-final-technical-design.md`。
  - 后续开发、评审和引用应使用 repo 内副本；该外部路径只作为来源追溯记录。

## 已废弃原型

- `docs/prototypes/manager-lora-training-prototype.html` 已废弃并移除。
- 当前没有有效的 LoRA Training 前端原型。
- 后续重新做前端原型时，必须同时对齐：
  - 主设计文档中的 UI 结构与行为约束；
  - 现有 ComfyUI Manager 前端架构和导航层级；
  - 现有页面的组件密度、底部导航/模式切换方式、信息层级。

## 实施约束

- 新模块使用 `Training*` 命名，不继续扩展已退役的训练 v1 命名。
- 页面路由使用 `/training/**`。
- API 路由使用 `/api/training/**`。
- 不把训练页面挂到 `/projects/[projectId]/training`。
- 不继续使用已退役的训练 v1 route namespace 作为新模块入口。
- 代码组织以主设计的 `src/app/training/*`、`src/lib/actions/training/*`、`src/server/repositories/training/*`、`src/server/services/training/*`、`src/server/worker/training/*`、`src/lib/training/*` 为准。
- 首版不包含 benchmark 矩阵、推荐权重、广义 promotion/evaluation 流程；只保留成功 `TrainingRun` 后创建角色 Preset 的窄入口。

## 开发前仍需落地

1. 前端原型需要重做：先按现有前端架构抽取导航、列表、详情、设置页的真实布局规律，再映射主设计中的运行、项目、预制、模板、模型、设置入口。
2. 开发计划需要拆分：后端 schema/API、服务层、worker/runner、前端页面、迁移与验证分别拆任务。
3. UI 视觉样式不从旧 prototype 继承；旧 prototype 只作为已废弃产物，不再参与评审。
