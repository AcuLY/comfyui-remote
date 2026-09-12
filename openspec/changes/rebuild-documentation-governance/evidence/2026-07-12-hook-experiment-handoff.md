# Hook 实验交接确认 — 2026-07-12

这是任务 13.8 的非规范性交接证据。它只确认两项实验输入的身份、隔离和后续责任方，不把可观测性实施纳入 `rebuild-documentation-governance` 验收。

## 隔离的 PreToolUse 尝试

`evidence/pretooluse-file-access-poc/**` 保留最初的路径匹配尝试、fixture、脱敏样例和重建说明。

- `hooks.example.json` 只是一次性 fixture 配置；当前 `.codex/hooks.json` 不引用本 evidence 目录。
- 样例 `access_total` 只代表 PreToolUse 载荷中出现一次仓库路径匹配，不能证明工具成功、文件系统实际读取、写入完成或模型理解。
- 真实事件、项目身份、临时信任状态和运行时缓存没有纳入 Git。
- `python -m unittest discover -s openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc -p test_file_access_hook.py -v`：`7/7` 通过。

因此该目录仍是可由 Git 恢复的调查证据，不是直接安装实现、当前文档权威或文档治理验收要求。

## 另行授权的根级后继实验

用户另行授权的简化实验位于 `.codex/hooks.json`、`scripts/observability/agent_file_access_hook.py` 和 `tests/test_agent_file_access_hook.py`。它与 evidence 副本不是同一实现，也不把文档治理扩展为可观测性阶段。

- Hook 使用 `PreToolUse` 与 `matcher: "*"`，只把载荷中的仓库内路径粗略计为访问尝试。
- POSIX 命令使用 `python3`，Windows 命令使用 `python`；两者都调用根级后继脚本。
- 事件默认追加到 `logs/harness/agent-file-access.ndjson`。
- 聚合默认写到 `metrics/harness/agent-file-access.json`。
- 两个目录分别由 `.gitignore` 的 `/logs/` 与 `/metrics/` 根规则忽略；`git ls-files -- logs metrics` 返回零路径。
- 记录和聚合都直接使用本地文件，不依赖已经启动的应用服务。
- 没有匹配到仓库路径时不创建 `logs/**` 或 `metrics/**`。
- `python -m unittest -v tests.test_agent_file_access_hook`：`10/10` 通过。

这些断言只说明当前受限实验满足“粗略统计、无服务、本地分区存储”的已授权边界。它不声明生产级完整性、精确读写分类、并发安全、保留策略或跨环境同构已经完成。

## 后续责任方

未来 `build-agent-observability` 子变更在设计或采用信号前，必须重新检查两项输入：

1. 隔离 evidence 中原始路径匹配尝试的载荷假设、平台差异和失败边界；
2. 根级后继实验的当前 Hook schema、忽略规则、输出路径和测试结果。

后续设计还必须重新决定身份、隐私、轮转与保留、格式损坏恢复、并发写入、原子聚合、开销、环境隔离、清理和 CI/生产接入。本文不批准这些实现，也不推进父 Harness 的可观测性阶段进度。
