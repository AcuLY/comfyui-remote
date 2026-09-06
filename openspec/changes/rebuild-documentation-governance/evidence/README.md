# 文档治理证据

本目录保存活动变更 `rebuild-documentation-governance` 的非规范性调查与交接材料。它不是当前仓库文档、实施计划或额外生命周期。

- `2026-07-10-session-handoff.md` 记录暂停时的设计状态和续接路径。
- `2026-07-12-documentation-ci-verification.md` 记录本地主工作树非写入、干净检出、受控失败与恢复，以及真实 `GitHub Actions` 阶段成功证据；该 `push` 运行不替代受保护比较基准上的最终验收运行。
- `2026-07-12-hook-experiment-handoff.md` 确认隔离 `PreToolUse` 尝试与另行授权根级后继实验的身份、数据隔离和后续责任方。
- `2026-07-13-branch-protection-verification.md` 记录经用户明确授权启用的 `main` 分支保护、必需检查身份和最小配置，以及保护生效后的拉取请求成功运行；它关闭任务 `13.5` 和 `13.6`。
- `2026-07-13-workflow-production-migration.md` 记录工作流配置迁移的真实生产构建、双 worker 门、同端口重启、本地与公开 HTTPS 验证、旧兼容副本删除和运行手册演练边界；它关闭任务 `11.1` 和 `11.3`。
- `docs-audit/` 保存 OpenSpec 任务显式调用 `$docs-audit` 产生的限定记录；`task-13-final-acceptance.md` 当前仍是未通过且必须在修复后重跑的最终完整审计草稿。
- `session-materials/` 保存完整决策日志、信息架构草稿，以及此前只存在于 `.tmp/**` 下的两份仓库理解草稿。
- `pretooluse-file-access-poc/` 只把隔离的路径匹配尝试遥测实验保留为未来 `build-agent-observability` 输入；保留副本既未安装，也不是文档治理子变更已接受或必需的实现。另行授权的根级后继实验是证据目录和子变更验收之外的受限本地实验。

任何获接受要求都必须在 `apply` 前纳入正常 OpenSpec 提案、规范、设计和任务。生成式运行时日志与统计保持不受跟踪；这里只保留已脱敏示例。

未来若复用该实验，必须引用已归档证据或摘要绑定副本，并由后续可观测性子变更重新设计和验证。
