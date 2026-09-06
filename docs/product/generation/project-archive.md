---
schemaVersion: 1
document:
  type: product
  status: current
  owner: product-generation
  authority:
    subject: generation-project-archive
    kind: reference
  readWhen:
    - 修改 Generation 项目导出、归档或归档列表行为时
    - 判断归档会保留哪些记录并删除哪些文件时
  sources:
    - src/server/services/project-export-service.ts
    - src/server/services/project-archive-service.ts
    - src/server/services/project-deletion-service.ts
    - src/server/services/comfy-output-cleanup.ts
    - src/server/services/comfy-remote-output-cleanup.ts
    - src/app/projects/project-archive-button.tsx
    - src/app/projects/project-list-view-model.ts
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-project-archive-ui-source.test.ts tests/test-project-list-view-state.test.ts tests/test-comfy-output-cleanup.test.ts tests/test-comfy-remote-output-cleanup.test.ts tests/test-project-deletion-cleanup.test.ts tests/test-work-mode-resource-boundary.test.ts
---

# 项目导出与归档

## 产品边界

归档是 `Generation` 项目的破坏性收尾操作，不是删除数据库中的项目。成功导出会在导出文件完成后写入 `publishedAt`；归档服务只接受满足以下全部条件的 `Generation` 项目：

- 项目存在且不属于隐藏的 `Training` 基准资源；
- `archivedAt` 仍为空；
- `publishedAt` 已写入；
- 状态是 `done` 或 `partial_done`；
- 受约束的 `data/export/<项目标题>/` 目录存在。

该前置检查只证明导出目录可访问，不校验其中压缩包的完整性。项目列表会为每个未归档项目显示归档按钮；按钮只在请求进行中禁用，其他前置条件由服务端在执行时拒绝。

## 归档副作用

通过前置检查后，当前服务依次执行以下动作：

1. 尝试从 `ComfyUI` 取消项目中处于 `queued`、`running` 或 `paused` 的生成运行与内容审查任务，再把对应本地记录标记为 `cancelled`。
2. 删除位于受管数据目录内的回收站文件，并删除已处理的 `TrashRecord`。
3. 清理 `data/images/<项目 slug>/` 下的受管图片目录。
4. 根据运行记录中的 `comfyOutputSubfolder` 清理当前活动 `ComfyUI` 目标的输出。
5. 删除 `data/export/<项目标题>/` 导出目录。
6. 最后写入 `Project.archivedAt`。

归档保留 `Project`、`Run` 与 `ImageResult` 记录，但不会保留所有关联状态原样：活动运行和内容审查任务会转为 `cancelled`，已处理的回收站记录会被删除。归档不是可逆的“隐藏”操作，也没有自动恢复已删除文件的产品流程。

## ComfyUI 输出范围

清理器不会逐个删除 `comfyOutputSubfolder` 指向的运行子目录。它从每个值中提取第一个非空顶层目录并去重，然后删除完整顶层目录：

- 本地目标只能解析到 `<comfyLaunchCwd>/output/<顶层目录>` 内；
- `SSH` 目标只能解析到 `<remoteComfyRoot>/output/<顶层目录>` 内，并以参数引用后的 `rm -rf --` 执行；
- 空值、`.`、`..` 和无法留在输出根下的路径不会成为删除目标。

因此，共享同一顶层目录的多个运行会一起被清理；这也是归档确认框把整个项目的 `ComfyUI` 输出列为删除对象的原因。

受管图片目录目前直接通过已存储的 `project.slug` 组合为 `data/images/<slug>` 后递归删除。与导出目录、回收站文件和 `ComfyUI` 输出清理不同，这一步没有再次调用 `isPathInsideDirectory` 做路径包含关系校验。当前安全性依赖数据库中的 slug 已由既有创建流程约束；不得把它描述为归档服务自行验证过的路径边界。补齐该防护属于运行时代码变更，不应通过文档措辞伪装为已经存在。

## 失败与列表表现

文件清理不是数据库事务。回收站文件、受管图片或 `ComfyUI` 输出删除失败时，服务会记录错误并继续，之后仍可能删除导出目录并写入 `archivedAt`。远端取消失败也不会自动阻止本地任务转为 `cancelled`。服务和 API 会返回取消/删除计数，但当前 `ProjectArchiveButton` 丢弃该返回值，只显示“项目已归档”并刷新列表。因此普通界面无法区分完整清理与部分清理；需要通过保留响应的诊断调用、服务日志和实际文件状态核对。不能把“已归档”解释成所有文件均已删除，也不能假设失败会自动回滚。

项目列表默认过滤带 `archivedAt` 的项目。“显示归档”会让它们重新出现在列表中；归档卡片不再展示最新图片，并固定显示“已归档 · 文件已清理”。由于服务采用上述尽力清理语义，这句文案只是当前乐观界面状态，不是全部文件已删除的证据，属于尚未由本次文档变更修复的界面真实性缺口。当前行为也不承诺其他详情界面都能为已删除文件提供占位内容。

## 上级导航

- [返回 Generation 产品](README.md)
