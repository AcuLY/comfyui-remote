# 项目收敛前只读处置清单 — 2026-08-26

本清单为用户明确选择的项目收敛第 2 项交付。它记录当前 Git 工作树、Git 暂存快照、个人脚本和生产运行资产的脱敏事实，并为后续独立任务提出处置建议。本次只读采集不授权删除、移动、应用、丢弃、清理、构建、部署、数据库写入、队列控制或服务修改。

## 证据边界

- 仓库：`D:\Luca\Code\MyProject\comfyui-manager`。
- 当前分支：`codex/harness-doc-governance-handoff-20260710`。
- 采集时已提交头：`67d8d823ec26b196d54575c564029856c4cb1939`；采集时与同名上游一致。
- 当前任务开始前的主工作树基线：6 个已跟踪修改、0 个已暂存修改、5 个未跟踪个人脚本。
- 当前任务新增的 OpenSpec 与清单修改属于本次明确范围，不改变上述既有基线身份。
- 未记录令牌、Cookie、数据库连接串、私有主机、SSH 密钥、认证文件内容、私有 URL 或模型绝对路径。

处置标签含义：

- `keep`：当前生产、恢复或历史证明仍需要保留。
- `review`：必须在后续任务重新核对内容、进程归属和恢复边界后决定。
- `remove-later`：当前证据支持未来清理候选，但本任务绝不执行。
- `protect`：属于运行资产或用户数据，未经精确备份、恢复验证和授权不得修改。

## 主工作树

| 表面 | 当前状态 | 建议 | 理由 |
| --- | --- | --- | --- |
| 当前文档治理分支 | 已提交头与上游一致；本任务开始前有 6 个治理相关已跟踪修改 | `keep` | 当前生产配置迁移和文档治理尚未合入 `main`，不能丢弃分支。 |
| 3 份 runbook 与 2 份合同测试 | 已有未提交的真实演练状态修正 | `keep` | 属于文档治理最终审计的明确收口范围。 |
| 最终 docs-audit 记录 | 已有未提交修订，本任务继续限定写入同一路径 | `keep` | 子任务 `13.7` 的唯一最终语义证据。 |
| 5 个个人脚本 | 未跟踪、未暂存 | `review` | 副作用不同，不能批量暂存或删除；详见下表。 |

## Git 工作树

Git 共登记 14 个工作树。下列建议不构成 `git worktree remove`、`prune`、分支删除或文件删除授权。

| 工作树路径 | 已知状态 | 建议 | 后续核对 |
| --- | --- | --- | --- |
| `D:/Luca/Code/MyProject/comfyui-manager` | 当前主检出，承载生产 `next start` 的依赖与 `.next`；工作树不干净 | `protect` | 在建立干净生产检出前不得作为清理目标。 |
| `C:/Users/26552/.config/superpowers/worktrees/comfyui-manager/codex-comfy-ssh-targets` | 干净；分支相对当前头无独有提交 | `remove-later` | 重新确认没有进程、未推送提交或外部引用。 |
| `C:/Users/26552/.config/superpowers/worktrees/comfyui-manager/codex-fix-preset-group-rename` | 干净；分支相对当前头无独有提交 | `remove-later` | 同上。 |
| `C:/Users/26552/.config/superpowers/worktrees/comfyui-manager/codex-lora-model-link` | 干净；分支相对当前头无独有提交 | `remove-later` | 同上。 |
| `C:/Users/26552/.config/superpowers/worktrees/comfyui-manager/codex-model-assets-search-filter` | 干净；分支相对当前头无独有提交 | `remove-later` | 同上。 |
| `C:/Users/26552/.config/superpowers/worktrees/comfyui-manager/codex-notification-copy-button` | 干净；分支相对当前头无独有提交 | `remove-later` | 同上。 |
| `C:/Users/26552/.config/superpowers/worktrees/comfyui-manager/codex-preset-card-detail-navigation` | 干净；分支相对当前头无独有提交 | `remove-later` | 同上。 |
| `C:/Users/26552/.config/superpowers/worktrees/comfyui-manager/codex-project-results-review-counts` | 干净；分支相对当前头无独有提交 | `remove-later` | 同上。 |
| `C:/Users/26552/.config/superpowers/worktrees/comfyui-manager/codex-queue-detail-section-name` | 干净；分支相对当前头无独有提交 | `remove-later` | 同上。 |
| `C:/Users/26552/AppData/Local/Temp/comfyui-manager-docs-ci-d2f5a988d01145e68721ab7e9a4f0159` | 路径已不存在，Git 标为可清理登记 | `remove-later` | 后续只清理精确的失效登记，不触碰其他工作树。 |
| `D:/Luca/Code/MyProject/comfyui-manager-build-check` | 分离头指针；2 个未跟踪构建日志 | `review` | 先保存或确认日志无价值，再判断工作树。 |
| `D:/Luca/Code/MyProject/comfyui-manager-deploy-20260614-003814` | 分离头指针；1 个未跟踪构建日志 | `review` | 先核对是否仍是部署恢复证据。 |
| `D:/Luca/Code/MyProject/comfyui-manager-deploy-20260615-000031` | 分离头指针；1 个未跟踪构建日志 | `review` | 先核对是否仍是部署恢复证据。 |
| `D:/Luca/Code/MyProject/comfyui-manager-deploy-clean` | `main` 检出；约 1,106 个跟踪和未跟踪状态项 | `protect` | 名称不能证明干净；严禁 `reset`、`clean`、覆盖或直接作为部署候选。 |

## Git 暂存快照

仓库有 5 个 Git 暂存快照。对象标识只用于后续身份复核；本次没有执行 `apply`、`pop` 或 `drop`。

| 对象 | 原始说明 | 含未跟踪文件后的文件数 | 建议 |
| --- | --- | ---: | --- |
| `9d09540d` | `cleanup: runtime-data-build-and-prompt-block-worktree-2026-06-16` | 34 | `review` |
| `a9672251` | `codex-deploy-preserve-untracked-docs-before-main-sync-20260611` | 2 | `review` |
| `86ed71e6` | `deploy dcb2bc4 preserve mypc tracked changes 2026-06-10` | 8 | `review` |
| `aeeb8313` | `pre-caf91ee deploy overlapping review lightbox files` | 10 | `review` |
| `c049f8af` | `codex-preserve-mypc-tracked-before-zero-redundancy-sync` | 1 | `review` |

后续审查应逐个比较 Git 暂存快照的基准提交、工作树、已跟踪和未跟踪父对象，不得按日期或说明直接批量恢复/删除。

## 未跟踪个人脚本

| 路径 | 静态副作用分类 | 建议 | 原因 |
| --- | --- | --- | --- |
| `scripts/agent-run-sunshangxiang-full-20260703.ts` | 查找固定项目、创建整项目运行记录、提交到 ComfyUI、轮询并恢复过期运行 | `remove-later` | 高副作用、目标固定且不符合当前受治理维护入口。 |
| `scripts/force-resume-all-paused-runs-after-reboot-20260625.ts` | 查询并恢复全部暂停运行记录，可能提交 ComfyUI 并写数据库 | `remove-later` | 无项目或批次范围，不适合作为常规恢复入口。 |
| `scripts/repair-paused-runs-after-force-resume-20260625.ts` | 读取 ComfyUI 队列、重新提交 prompt、更新 Run/Project 并启动轮询 | `remove-later` | 高副作用且包含机器专用回环地址。 |
| `scripts/test-import-resume-run.ts` | 仅导入 `resumeRun` 并输出类型 | `remove-later` | 一次性导入诊断，没有持续产品价值。 |
| `scripts/test-prisma-count-paused.ts` | 只读统计暂停运行记录 | `review` | 若仍需要，应改造成有明确参数、脱敏输出和维护文档的受治理诊断入口。 |

本次没有运行上述任何脚本，也没有修改其内容或状态。

## 生产运行资产

### 进程与构建

- 采集时唯一仓库范围生产服务为 `next start`，PID `19920`，监听端口 `3000`，创建时间为 2026-08-24 21:30:10（Asia/Shanghai）。PID 与启动时间是快照，不是稳定合同。
- 活跃 `.next/BUILD_ID` 为 `pNVVm9ZLShFEeCaYu9ygn`，工件时间为 2026-07-13 23:30:10。
- `.deploy.lock` 不存在；这只表示采集时没有部署锁，不授权开始部署。
- `.next`、`node_modules`、`logs`、`metrics`、`server.log` 和 `server.err.log` 均存在，统一为 `protect/review`。
- `server.log` 与 `server.err.log` 的时间早于当前进程创建时间；后续必须先确认启动与日志归属，不能把旧日志当成当前进程事实或直接删除。

### 配置存在性

- 项目根 `.env` 存在、被忽略；认证已配置，数据库提供方为 SQLite。
- 当前 ComfyUI 目标模式为 `local`；未配置启动命令，自动启动和自动重启均关闭。
- ComfyUI 目标、自动审查、Training 图片工作进程与 Training 队列的私有配置已配置、存在、被忽略且未跟踪。
- 外部模型根、图像认证文件和 Training 运行器已配置且存在。
- `config/workflows/standard-workflow.api.json` 存在并受 Git 跟踪。
- 以上只记录布尔存在性和非秘密分类，统一标记为 `protect`。

### 数据规模

| 资产 | 文件数 | 字节数 | 建议 |
| --- | ---: | ---: | --- |
| SQLite 主库 | 1 | 595,369,984 | `protect` |
| `data/` | 87,513 | 30,904,107,565 | `protect` |
| `data/images/` | 56,778 | 25,088,444,232 | `protect` |
| `data/export/` | 2,758 | 4,616,348,920 | `protect` |
| 数据库备份表面 | 6 | 3,077,541,888 | `review` |

SQLite 主库最后写入时间为 2026-07-04 02:18:42（Asia/Shanghai）；现有最新备份早于该时间。后续任何 schema、数据清理或生产切换任务都应先创建并验证更新备份，但本清单不授权备份写入。

## 已知路径漂移

下列结果只表示数据库记录按当前管理器路径解析时文件不存在，不等同于已经确认不可恢复的数据丢失。外部磁盘、WSL、历史目录、远程执行器或配置漂移仍可能解释部分记录。

| 记录范围 | 总数 | 当前路径存在 | 当前路径不存在 | 建议 |
| --- | ---: | ---: | ---: | --- |
| pending/kept 图片原图引用 | 10,531 | 8,660 | 1,871 | `review` |
| pending/kept 图片缩略图引用 | 10,531 | 8,660 | 1,871 | `review` |
| 活动回收站 `trashPath` | 16,379 | 4,581 | 11,798 | `review` |
| TrainingArtifact | 97 | 80 | 17 | `review` |
| LoRA 资产绝对路径 | 295 | 280 | 15 | `review` |

17 个缺失 TrainingArtifact 按类型为：`mutable_source` 1 个、`generation_output` 8 个、`final_lora` 8 个；8 个 `final_lora` 均按当前路径不存在。不得据此删除记录、重建空文件或修改状态。

## 后续处置顺序建议

1. 先让文档治理分支完成验收并合入干净主线，生产继续保持当前已知构建。
2. 为 SQLite、`data/`、私有配置和外部模型/训练资产建立带恢复验证的新备份任务。
3. 逐个审查 5 个 Git 暂存快照与 `deploy-clean` 的真实内容，先提取唯一知识，再决定保留或清理。
4. 重新核对 8 个已合并功能工作树的进程、分支和远端引用，再提出精确清理授权。
5. 把路径漂移对账与前端重构分开；先生成清单和恢复证据，再决定数据修正。
6. 个人脚本逐个处置；高副作用脚本不得进入普通提交或无范围运行。

## 本次实际动作

- 创建本清单。
- 没有删除、移动、重命名、应用、丢弃、清理、暂存、构建、部署、数据库写入、队列控制或服务修改。
