# `$docs-audit` 引入 Skill 前的对照基线

采集时间：2026-07-12

范围：`.codex/skills/docs-audit/**` 出现前的 `HEAD` 仓库状态

方法：只读 tracked-file 与 reference 检查

这是语义审计工作流的对照基线。它记录具体仓库场景和受路径限制约束的执行合同缺失；不声称历史文档当前正确。本基线不声称全新 Agent 行为结果。

## 对照能力缺失

`git cat-file -e HEAD:.codex/skills/docs-audit/SKILL.md` 以 `128` 退出；`.codex/skills/docs-audit/SKILL.md` 当时只存在于工作树，不在 `HEAD` 中。引入新包前，仓库没有单一显式 Skill 合同来约束范围选择、报告/记录/修复写入、证据优先级、问题处置或独立审查。

## 基线场景

| ID | 仓库 evidence | Skill 引入前的不受控失败 |
| --- | --- | --- |
| `B1-current-target-history` | `docs/index.md` 同时把 Training 路由到 `docs/prototypes/README.md` 的原型意图和生产源码；`tests/test-asset-page-boundaries.test.ts` 与 `tests/test-work-mode-resource-boundary.test.ts` 读取归档路线图。 | 在作出声明前，没有语义工作流强制分别分类当前实现、已批准目标和历史意图。 |
| `B2-missing-runtime-proof` | `docs/local-verification.md` 与 `agent-rules/deploy/**` 含依赖环境、服务、队列、数据库和恢复的指令。 | 缺少新运行时证据时，没有语义工作流要求依赖运行时的声明保持未解决。 |
| `B3-duplicate-authority` | `docs/index.md`、`docs/documentation-map.md` 和 `docs/repo-inventory.md` 作为 navigation/classification 表面相互重叠。 | 将某一表面视为 authority 前，没有 finding schema 要求提供 owner、conflict、merge/delete disposition 和 verification。 |
| `B4-unsafe-operations` | 部署与本地验证文档包含可执行构建、进程、数据库和队列操作。 | 仅确定性路径与链接检查无法证明操作序列、失败停止与恢复路径安全且当前有效。 |
| `B5-fix-authorization` | `HEAD` 中没有已跟踪的 `$docs-audit` 包。 | 没有仓库 Skill 边界区分无写入报告、单路径 OpenSpec 证据记录和用户显式授权修复。 |
| `B6-self-review` | `HEAD` 中没有已跟踪的 `$docs-audit` 包。 | 没有仓库 Skill 规则禁止修复者签署自己的语义通过，也没有规则在无法独立审查时要求 `review-required`。 |

## 采用后的比较要求

新 Skill 预期使用相同六个场景检查。包校验与契约测试证明工作流存在；仍需后续使用全新 Agent 前向测试，证明其在实际迁移批次中的行为。不得把本基线重写为已通过的前向测试结果。
