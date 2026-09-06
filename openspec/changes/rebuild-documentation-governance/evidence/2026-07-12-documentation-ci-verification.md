# 文档 CI 阶段验证证据 — 2026-07-12

这是活动变更 `rebuild-documentation-governance` 的非规范性阶段验证证据。提案、规范、设计和 `tasks.md` 继续拥有权威；本文件不创建平行状态机，也不把已有 `push` 运行解释为最终受保护基准验收。

## 验证对象

- 分支：`codex/harness-doc-governance-handoff-20260710`
- 已验证 `GitHub Actions` 头提交：`e71dd0162e46c352be73b3be87164b7487c11868`
- 推送比较提交：`3825e0f1a2dfff77e09a8cf4af5db7368e7e017d`
- 目标主分支比较提交：`74080ce352881bbecce9b7e6b16badeabd6a12d1`；公开 GitHub API 当前显示 `main` 尚未受保护，下述成功运行也未使用它作为比较基准
- 成功运行：[文档治理运行 29196186623](https://github.com/AcuLY/comfyui-remote/actions/runs/29196186623)
- 作业：`文档治理门禁`，编号 `86659453636`
- GitHub 执行环境：`Microsoft Windows Server 2025`、`windows-2025-vs2026`、Node.js `20.19.6`、npm `10.8.2`

## 本地主工作树非写入证明

在包含当前任务两项未提交合同运行器修正，以及原先已有 1 个兼容配置副本和 5 个个人脚本的主工作树中，先后运行聚焦测试、`docs:check`、OpenSpec 严格校验、TypeScript 检查和差异格式检查。

- 前快照摘要：`f006e1c7a7969e8523fe6d54d34a212c7c2262a329972dd08eea599b79220f6c`
- 后快照摘要：`f006e1c7a7969e8523fe6d54d34a212c7c2262a329972dd08eea599b79220f6c`
- 结果：已跟踪未暂存、已暂存、未跟踪路径及未跟踪文件内容摘要完全一致。
- 聚焦文档测试：`76/76` 通过。
- `npm run docs:check -- --mode full --base HEAD`：`requested=full`、`effective=full`、`errors=0`、`warnings=0`。
- `npm run openspec:validate`：2 个活动变更通过，0 个失败。
- `npx tsc --noEmit --pretty false` 与 `git diff --check`：通过。

这里保留的未跟踪 `docs/workflow.api.json` 是旧生产进程退出前的兼容副本，不属于已接受 Git 树；它仍绑定任务 11.1 与 11.3，不能解释为机器上已经不存在旧路径。5 个未跟踪 `scripts/*.ts` 个人脚本保持不变且不属于本变更。

## 干净检出预检

在 `%TEMP%\comfyui-manager-docs-ci-d2f5a988d01145e68721ab7e9a4f0159` 的分离头指针工作树中验证提交 `3825e0f1a2dfff77e09a8cf4af5db7368e7e017d`。该检出复用主仓库固定依赖，仅作为本地干净源码预检，不冒充 `GitHub CI`：

- 验收前 `git status --porcelain=v1 --untracked-files=all` 为空。
- PowerShell runbook 合同全部通过。
- CLI 受控成功、规则失败、工具失败和恢复场景：`15/15` 通过。
- 工作流原始聚焦命令：`76/76` 通过。
- CI 配置合同：`1/1` 通过。
- 对主分支提交运行 `full` 检查：`errors=0`、`warnings=0`。
- `git diff --exit-code` 为 0，验收后 `git status` 仍为空。

## 受控失败与恢复

`tests/test-docs-check-cli.test.ts` 在独立 `%TEMP%\docs-check-*` 仓库中执行，不修改真实检出。使用 Node.js `20.19.6` 串行运行后 `15/15` 通过，并证明：

- 缺失 Markdown 目标产生规则失败退出码 `1`，诊断包含 `links/target-missing`。
- 畸形策略产生工具失败退出码 `2`，诊断包含 `tool/configuration`。
- 必需生成器漂移产生退出码 `1`；适配器崩溃产生退出码 `2`。
- 合同断言不匹配保持规则失败；语法错误和导入崩溃保持工具失败。
- 每个临时仓库都在 `finally` 中清理，随后真实 `full` 检查恢复为退出码 `0`。

干净 Windows 检出还揭示并关闭了两项真实兼容问题：

1. `core.autocrlf=true` 使运行手册成为 `CRLF`，旧围栏正则漏掉合同块；`a6010ac378395b4451114dcba58028488472564e` 修复结束围栏匹配。
2. `GitHub Actions` 运行 `29195661257` 在 Node.js `20.19.6` 下报告 `Node test runner returned no structured summary`；`e71dd0162e46c352be73b3be87164b7487c11868` 改为在父进程预加载固定 TSX，并为缺少 `test:summary` 的 Node 20 汇总 `test:pass` 与 `test:fail`。

修复后，本地 Node.js `20.19.6` 合同测试为 `8/8`，CLI 场景为 `15/15`，`full` 检查为 `0/0`。

## `GitHub Actions` 阶段成功证明

`push` 运行 `29196186623` 的所有步骤均成功，但它比较 `push` 前提交 `3825e0f1...`，不满足任务 13.5 对受保护比较修订版和最终目标树的验收要求：

- 完整历史检出：成功。
- 固定 Node.js 与 `npm ci`：成功。
- 文档聚焦测试：`76/76` 通过，0 个失败。
- `npm run docs:check -- --mode full --base 3825e0f1a2dfff77e09a8cf4af5db7368e7e017d`：`requested=full`、`effective=full`、`errors=0`、`warnings=0`。
- `git diff --exit-code`：成功。
- 最终 `git status --porcelain=v1 --untracked-files=all`：为空。

## 遗留路径与权威边界

- 已接受 Git 树不跟踪 `agent-rules/**`、`docs/archive/**`、`docs/plans/**`、`docs/superpowers/**`、`docs/prototypes/**` 或 `docs/workflow.api.json`。
- `AGENTS.md` 的聚焦合同测试证明它是普通开发硬策略的唯一权威。
- `docs:check` 的禁止路径、有限范围、导航和 OpenSpec 检查均为零违规。
- 本次检查没有警告，因此没有未处置的警告责任方。
- 公开 GitHub API 当前返回 `main.protected=false`；规则集与保护详情仍需要有权限身份完成认证核验。因此必须先由有权限维护者完成任务 13.6，在认证设置中保护 `main` 并把文档治理作业设为必需检查。
- 任务 13.5 仍未完成：必须通过以受保护合并目标为比较基准、且包含最终目标树的拉取请求或等价运行重新采集成功干净 CI；本文件记录的 `push` 运行不能替代该证据。
- 任务 13.6 仍未完成：本证据不声称已把文档作业配置为受保护合并路径的必需检查。
- 任务 11.1 与 11.3 仍未完成：本证据不声称生产进程已经切换工作流配置，也不替代构建、部署和公开验证。
