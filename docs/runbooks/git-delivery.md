---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: repository-delivery
  authority:
    subject: operations/git-delivery
    kind: operational
  readWhen:
    - 暂存当前任务文件时
    - 提交或推送已完成变更时
    - 报告 Git 交付失败时
  sources:
    - AGENTS.md
    - .gitignore
  verifiedBy:
    - git status --short
    - git diff --check
    - npm run docs:check
  environment:
    - 已安装 Git 并配置远端的仓库检出
  risk: 只暂存当前任务，绝不纳入运行时状态、秘密、生成缓存或无关脏改动。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# Git 交付

## 适用场景

当前任务授权暂存、提交或推送受跟踪变更时使用本流程。Git 交付位于部署互斥锁之外：已有 `.deploy.lock` 不会阻止 `git add`、`git commit` 或 `git push`。

“不部署”“稍后部署”和“只推送”会跳过构建、重启、部署与公开验证，但不会跳过默认的有边界提交和推送。显式 `local-only` 会跳过全部 Git 交付：不得暂存、提交或推送。显式 `no-commit` 会跳过提交，因而也跳过推送；显式 `no-push` 只跳过推送。

不得把本流程当作部署、构建、重启服务、同步数据库或控制队列的授权。

## 前置条件

- 识别当前任务的文件集合，保留所有无关的已跟踪或未跟踪改动。
- 确认用户是否明确要求 `local-only`、`no-commit` 或 `no-push`，并严格应用上述跳过规则。否则，即使有意跳过部署，已完成的受跟踪变更仍应进行有边界的提交与推送。
- 除非用户精确授权该工件，否则绝不暂存获准示例之外的 `.env*`、`.deploy.lock/**`、`.next/**`、`data/**`、`logs/**`、`metrics/**`、本地数据库文件、生成缓存、本地配置或服务/构建日志。

## 操作步骤

1. 暂存前检查分支和全部工作树表面：

   ```powershell
   git status --short
   git diff --stat
   git diff --cached --stat
   git branch --show-current
   ```

2. 审查当前任务的真实 diff。如果无法把当前任务与并发改动明确分开，停止并列出有歧义的文件；不得使用 `git add -A`。

3. 只暂存显式路径：

   ```powershell
   git add -- path/to/current-task-file path/to/another-current-task-file
   git diff --cached --name-status
   git diff --cached --check
   ```

4. 确认暂存 diff 完整覆盖当前任务且不含其他内容，再使用描述交付行为的消息提交：

   ```powershell
   git diff --cached
   git commit -m "docs: describe the scoped operational change"
   ```

5. 推送当前分支，仅在没有上游分支时建立它：

   ```powershell
   $branch = git branch --show-current
   $upstream = git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null
   if ($LASTEXITCODE -eq 0) {
     git push
   } else {
     git push --set-upstream origin $branch
   }
   ```

6. 再次运行 `git status --short`，把剩余无关工作与当前任务的交付失败区分开。

## 预期结果

提交只包含已审查的当前任务路径，目标远端分支包含该提交，无关工作树状态保持不变。

## 故障处理与恢复

- 暂存范围有歧义时，让文件保持未暂存并报告精确重叠范围。
- 提交或推送失败时，不得扩大暂存集合或改写无关历史。报告精确错误、当前已暂存与脏路径以及下一项必要操作。
- 如果禁止提交的运行时文件或秘密已暂存但尚未提交，只取消暂存该精确路径并保留其工作副本；不得以清理为由删除用户数据。
- 除非用户明确授权该精确恢复，否则不得使用 `git reset --hard`、破坏性检出或强制推送。

## 验证状态

本流程尚未实际演练。当前 `verifiedBy` 只核对仓库 Git 边界、忽略规则和文档合同，不执行暂存、提交或推送。

## 上级导航

- [返回运行手册](./README.md)
