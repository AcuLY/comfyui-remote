# OpenSpec 工作流

本仓库中，涉及重要功能、架构、性能和仓库策略的变更只能使用 OpenSpec 规划生命周期。CLI 版本固定在 `package.json` 中；请通过包脚本运行，确保本地与 CI 使用同一版本。

## 原生生命周期

1. 检查工件就绪状态：

   ```powershell
   npm run openspec:status -- --change <change-id> --json
   ```

2. 阅读上游应用指令及其列出的上下文文件：

   ```powershell
   npm run openspec:instructions -- apply --change <change-id> --json
   ```

3. 实现该变更 `tasks.md` 中的待办项，在文件内标记进度，并验证 specs 与 design 要求的行为。OpenSpec 1.5.0 没有独立的 CLI `apply` 或 `verify` 命令；二者是由 `status` 和 `instructions apply` 驱动的 Agent 工作流。

4. 严格校验所有活动变更和现行 specs：

   ```powershell
   npm run openspec:validate
   ```

5. 实现与验证完成并获得用户明确验收后，通过原生命令归档：

   ```powershell
   npm run openspec:archive -- <change-id> --yes
   ```

   正常完成时不得使用 `--skip-specs` 或 `--no-validate`。

## Harness 阶段顺序

Harness 必须依次交付：文档治理、可观测性、工程规范，最后是文档与 CI 收口。只有前一阶段完成验证并获得验收后，才能起草或实施后一阶段变更。活动父变更 `establish-agent-harness` 负责该顺序；OpenSpec 负责工件依赖和生命周期状态。

用户授权以简洁证据记录在对应变更中。该证据不是第二套审批数据库、摘要门禁，也不取代 OpenSpec。
