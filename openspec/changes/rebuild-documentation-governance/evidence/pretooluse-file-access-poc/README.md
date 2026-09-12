# PreToolUse 仓库文件访问实验

这是为续接而保留的非生产、非规范性实验。它证明项目本地 Codex `PreToolUse` Hook 可以用启发式方式识别仓库内路径，并在没有指标服务时写入离线事件。

阶段归属已确定：本目录是未来 `build-agent-observability` 设计的输入，不是 `rebuild-documentation-governance` 的实现或验收工件。保留脚本不是已安装实现。Windows 续接后，用户另行授权位于 `scripts/observability/agent_file_access_hook.py` 的简化根级后继实现；它是子变更外的本地实验，不表示采用本证据副本。样例聚合字段 `access_total` 是遗留原型名称，只表示一次尝试的 PreToolUse 仓库路径匹配；不能证明工具成功、文件系统读取或模型理解。

## 内容

- `file_access_hook.py`：路径匹配器、`NDJSON` 写入器与离线 JSON 聚合器。
- `test_file_access_hook.py`：7 个只使用标准库的单元与集成测试。
- `hooks.example.json`：隔离测试使用的项目本地 Hook 形态。
- `fixture/`：真实隔离 Codex 运行使用的已脱敏初始文件。
- `sample/file-access.ndjson`：已脱敏成功事件。
- `sample/file-access-stats.json`：已脱敏聚合输出。

原始且被忽略的证明仓库、嵌套 `.git/**`、真实事件日志、Python 缓存、被修改的 `notes.txt` 和机器级项目信任条目都未保留。它们包含本地身份与运行时状态，或可能造成误导性的活动配置。

## 验证

在本目录运行：

```bash
python3 -m unittest -v test_file_access_hook.py
python3 file_access_hook.py aggregate \
  --log sample/file-access.ndjson \
  --stats /tmp/file-access-stats.json
```

`hooks.example.json` 中的 Hook 命令假定脚本已复制到测试仓库根。这里保留的是精确测试形态，不是实际仓库的安装指令。

不得提交真实 `logs/**` 或 `stats/**`。示例只作为已脱敏 evidence。

## 已测试环境

原始成功实验使用：

- arm64 上的 macOS/Darwin；
- Python 3.14.0；脚本因 import `datetime.UTC` 而要求 Python 3.11 或更高版本；
- Git 2.52.0；
- `codex-cli 0.142.5`；
- 运行时原账户可用的模型。

2026-07-11 的 Windows 续接使用 Windows 11、Python 3.11.9 和 `codex-cli 0.142.2`；其本地功能目录报告 Hook 为稳定状态。测试从这个已信任仓库运行两个新的临时 Codex 任务，并使用临时项目 `.codex/hooks.json`；该文件随后立即删除，真实 `NDJSON` 日志保持在仓库外且在断言后删除，没有永久安装 Hook。

临时处理器把 POSIX `command` 设为 `exit 91`，仅通过 `commandWindows` 提供 Python 记录器。一个 `cat` 命令生成一条 `Bash/read/<fixture guide path>` 事件，证明项目 Hook 已加载且 Windows 覆盖项已运行。原生 PowerShell `Get-Content -LiteralPath` 为同一仓库相对文件生成第二条事件，但当前分类器将其标为 `access` 而非 `read`。因此 Windows 路径检测可行，但 PowerShell 操作分类仍不完整。没有测试 Windows 多进程追加或并发行为。

后续可观测性变更在采用任何等价信号前，还必须定义并测试轮转与保留、格式错误或不完整行的恢复、原子聚合、环境/仓库/工作树/服务/运行身份、存储归属与冲突检查、跨环境封闭失败隔离、隐私、清理和实测开销。

## 隔离端到端重建

要在另一设备重建 fixture，创建一次性 Git 仓库，复制 `file_access_hook.py`，把 `hooks.example.json` 复制为 `.codex/hooks.json`，并将 `fixture/` 内容复制到仓库根。提交这些 fixture 文件，使 Codex 看到正常仓库。

项目信任与 Hook 信任是不同门禁。在一次性仓库中正常启动 Codex，并通过当前 Codex 信任流程批准该项目配置。不要复制原机器的 `~/.codex/config.toml`。原始运行只为隔离证明而使用 `--dangerously-bypass-hook-trust`；该标志绕过 Hook 哈希审查，但不会启用原本不受信任的项目配置层。

使用新账户可用模型运行会话交接记录的命令，预期恰好 3 条匹配工具调用事件：对 `docs/guide.md` 的 `read`、对目录 `docs` 的 `search`，以及对 `notes.txt` 的 `write`。与 `sample/**` 比较前，先规范化时间戳与会话哈希。

此步骤说明是可行性证据，不是确定性跨平台验收测试。模型可用性、Codex 信任交互和 Hook schema 都可能变化。PowerShell 命令分类、Windows 并发和单命令规范化断言仍是未来可观测性变更的待办工作。
