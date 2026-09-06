# 已保留的会话源材料

这些文件是影响 2026-07-10 Harness 设计会话的临时材料之已跟踪续接副本。它们是证据，不是当前仓库事实、批准记录或平行实施计划。后续 Agent 必须把已接受要求路由进正常 OpenSpec 工件，并在必要时对照源码、schema、测试、Git 历史和运行时证据重新验证仓库事实。

## 内容与权威

| 文件 | 用途 | 权威警告 |
| --- | --- | --- |
| `harness-design-decisions-2026-07-10.md` | 汇总会话决策、已拒绝方案、阶段边界和未解决设计工作。 | 部分状态行描述写入时刻；当前状态请查阅交接文档和活动 OpenSpec 任务。 |
| `harness-docs-ia-draft-2026-07-10.md` | 已批准文档目录讨论、逐目录责任、`Impeccable` 兼容性研究和迁移边界。 | 只作为讨论证据；获批准 `apply` 时，子提案、规范、设计与任务继续拥有规范权威。 |
| `repo-understanding-deep-2026-07-08.md` | 主要深度仓库阅读草稿，覆盖前端、后端、数据、Training、队列、ComfyUI、Agent/MCP、测试、文档和运行时观察。 | 时点声明可能过时，迁移前必须重新验证。 |
| `repo-understanding-2026-07-08.md` | 较早的紧凑仓库理解快照。 | 次级输入；优先使用深度草稿与当前代码证据。 |

## 来源

这些文件在交接完整性检查期间从被忽略的 `.tmp/**` 路径移动而来。只修改了开头的来源与状态措辞，以描述已跟踪证据位置。修改措辞前原始临时文件的 SHA-256 值如下：

```text
a454ffc573c403ac222dc23145e27f81e8e311c9a8247944cc1606055ec9bedc  harness-design-decisions-2026-07-10.md
fef72ec19dee50b551e60aaf6f40318dcfc04b929afd48b80d1235df365ca49b  harness-docs-ia-draft-2026-07-10.md
afc26ce67402b484329ca44d7a48cc0ff6fb11ef9bce6ac3e6e7d8e1b9a408f6  repo-understanding-2026-07-08.md
940140ba7a24e38b6e3313ed4791598c44237ef123a5af49317b50a36a159b00  repo-understanding-deep-2026-07-08.md
```

原始 Codex 会话 JSON 被有意排除，不提交：其中可能包含内部指令、工具载荷、机器元数据和无关敏感状态。决策日志与会话交接已保留用户可见要求、已解决选择、已拒绝替代方案、待解决问题、当前进度和续接路径。
