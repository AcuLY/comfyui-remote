## ADDED Requirements

### Requirement: OpenSpec 负责重要变更生命周期
仓库 `SHALL` 使用已固定版本的 OpenSpec 表示重要功能、架构、性能和仓库策略变更，并遵循其状态、指令、验证与归档生命周期。

#### Scenario: 提出重要变更
- **WHEN** 变更新增产品能力、修改架构、改变性能合同或修改全仓策略
- **THEN** 实施前必须创建并批准对应 OpenSpec 变更
- **AND** 不得创建竞争性的通用生命周期状态机

### Requirement: 用户批准与验收保持独立
变更 `MUST` 区分实施前的范围批准与实现后的用户验收。

#### Scenario: 工件已实现但用户尚未验收
- **WHEN** 已批准范围已经实现并通过所需验证，但用户尚未审查最终结果
- **THEN** 变更必须保持未归档
- **AND** 不得把规划批准当作最终验收

### Requirement: 证据类别保持独立
Harness `SHALL` 区分当前实现、已批准目标和历史意图，且不得让任一类别静默取代另一类别。

#### Scenario: 已取消的未来计划仍存在于历史
- **WHEN** 历史父计划描述了未实施且已取消的未来阶段
- **THEN** 当前文档和现行 specs 不得把这些阶段描述为已批准目标或当前能力
- **AND** Git 历史仍可用于解释原始意图

### Requirement: 仓库安全边界扩展 OpenSpec
OpenSpec `SHALL NOT` 取代 `AGENTS.md` 与当前运行手册拥有的 Git、构建、数据库、队列、服务、部署和恢复规则。

#### Scenario: 纯文档收口完成
- **WHEN** 变更只修改 OpenSpec、文档、证据和对应合同测试
- **THEN** 可以有边界提交与推送
- **AND** 不得因此构建、重启、部署或控制队列

#### Scenario: 后续工作影响生产运行时
- **WHEN** 未来变更需要构建、重启、数据库同步、队列控制或公开验证
- **THEN** 必须重新读取并遵循当前生产运行手册

### Requirement: 文档治理是唯一已实施子阶段
父 Harness `MUST` 只把 `rebuild-documentation-governance` 作为已经批准并实施的子变更，并保持其独立用户验收与归档门。

#### Scenario: 文档治理完成技术验证
- **WHEN** 文档治理最终审计与验证通过，但用户尚未明确验收
- **THEN** 子变更任务 `13.9` 必须保持未完成
- **AND** 不得执行归档

### Requirement: 未实施阶段已经取消
父 Harness `SHALL` 不再要求实施原计划中的可观测性、工程规范或统一 CI 阶段。

#### Scenario: 查看父变更完成条件
- **WHEN** 智能体读取父变更的 `proposal`、`design`、`spec` 或 `tasks`
- **THEN** 未实施阶段必须表示为 2026-08-26 已取消的历史范围
- **AND** 不得用已完成复选框伪装实施

#### Scenario: 未来重新提出已取消能力
- **WHEN** 用户未来需要可观测性、工程规范或统一 CI
- **THEN** 必须基于当时仓库基线创建独立 OpenSpec
- **AND** 必须重新取得用户批准

### Requirement: 处置清单不授权清理
工作表面与运行资产清单 `MUST` 使用脱敏证据，并把任何处置建议与实际修改授权分开。

#### Scenario: 清单标记对象为 remove-later
- **WHEN** 清单建议未来删除 Git 工作树、Git 暂存快照、脚本、日志或运行资产
- **THEN** 当前任务不得执行删除、移动、应用、丢弃或清理
- **AND** 后续操作必须重新核对精确目标和恢复边界

### Requirement: 父变更归档需要最终用户验收
父 Harness `MUST` 在文档治理子变更完成验收、范围缩减验证通过且用户审查最终证据后才能归档。

#### Scenario: 技术工作已经完成但尚未最终验收
- **WHEN** 所有剩余任务只包含用户验收与归档
- **THEN** 父变更必须保持活动
- **AND** 不得自动执行 OpenSpec archive
