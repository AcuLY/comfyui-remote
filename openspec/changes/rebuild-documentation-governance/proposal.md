## Why

仓库文档包含重叠入口、过期计划、仅供 prototype 使用的材料、人工维护的清单、归属错误的操作知识，以及有时只保留旧结构而未证明当前事实的治理测试。在据此设计可观测性或全仓工程规范之前，文档治理必须成为一个小型、Agent 可理解的系统。

## What Changes

- **重大不兼容变更**：用已批准的根入口与分层 `docs/` 结构取代当前文档布局，从 `AGENTS.md` 和 `docs/README.md` 通过简短路由渐进披露知识。
- **重大不兼容变更**：分离普通开发强制 Agent 策略与操作步骤：将 `AGENTS.md` 设为唯一普通开发工作流策略权威，把可执行细节移到 `docs/runbooks/**`，再删除 `agent-rules/**`，不留兼容桩。
- **重大不兼容变更**：从 `docs/archive/**` 提取所有仍有效事实，更新错误地把历史文件视为当前权威的使用方，然后删除整个归档，不将其重建为 `docs/history/**`。
- **重大不兼容变更**：删除 `docs/prototypes/**` 下全部 Training 静态原型表面及其专用路由、清单和测试契约；Training 作为平级工作模式的权威来自生产源码和已验证当前文档。
- 建立根 `README.md`、`AGENTS.md`、`ARCHITECTURE.md`、`PRODUCT.md` 和 `DESIGN.md` 的权威边界；保持根设计契约可兼容未来另行批准的 `Impeccable` 集成。
- 建立当前产品、架构、详细设计和运行手册层；为 `QUALITY_SCORE.md`、`RELIABILITY.md` 与 `SECURITY.md` 增加诚实的占位契约，不虚构后续阶段内容。
- 规定全部受治理 Markdown 的正文和 frontmatter 人类可读字符串默认使用简体中文，项目内兼容 Skill 也不例外；技术标识、命令、路径、协议字段、测试 fixture、数据载荷和 OpenSpec 结构词是明确例外，并增加自动门禁阻止英文正文回归。
- 增加最小 `docs/_meta/**` 机器治理控制面，只包含文档 schema、结构/链接策略和编写模板。
- 增加一个确定性、非写入文档检查引擎，支持 full 与可安全限定的 changed scope，提供稳定 human/JSON 诊断；本地与 CI 使用同一 full 阻断检查，覆盖 metadata、结构、入口可达性、链接、anchor、禁止遗留路径、OpenSpec 有效性、源码契约，以及已有 generator 所有的生成文件新鲜度。
- 在 `.codex/skills/docs-audit/**` 增加一个必须显式调用的仓库 Skill，作为语义审计的唯一执行表面，用于过期声明、覆盖缺口、重复权威、无效操作步骤，以及源码、测试、文档和历史意图之间的冲突。普通开发不得自动运行它，`AGENTS.md` 不得包含其规则或触发器。
- 根据当前代码、schema、测试、Git 历史和必要运行时证据重建维护文档；将现有治理测试视为可修改的实施输入，重写或删除固化过时结构或错误权威的断言。
- 本阶段把现有 generated 与 reference-like 文档保留在已验证 owner 位置；只有后续 OpenSpec 变更在运维证据证明拆分有益后，才能引入 `docs/generated/**` 或 `docs/references/**`。
- 仅使用 OpenSpec 提案、规范、设计、任务、验证和归档工件作为重要变更生命周期；不得保留或创建平行的 `PLANS.md`、`docs/plans/**` 或 `Superpowers` 规划权威。

## Capabilities

### New Capabilities

- `documentation-governance`：定义已批准知识架构、权威边界、已验证迁移与删除规则、确定性文档门禁、Agent 语义审计工作流，以及本地/CI 执行契约。

### Modified Capabilities

无。

## 非目标

- 本变更不实施或选择后续可观测性栈、性能预算、工程规范工具、代码风格阈值或最终统一仓库 CI。
- 本变更不安装 `Impeccable`，也不创建其项目 Skill、Hook、配置、生成式设计旁车或评议报告。
- 本变更不增加受控 `docs:read` CLI、文档 MCP 网关、定时语义审计任务或自动 `$docs-audit` 触发器。
- 本变更不安装或生产化已保留的 PreToolUse 路径匹配实验；该证据交给后续 `build-agent-observability` 重新审查。用户另行授权的根 Hook 后继实验位于子变更之外，既不是文档治理实施，也不是验收证据。
- 本变更不创建新的历史文档存储；已验证当前知识提取后，Git 历史与 OpenSpec 归档继续保留旧工件。
- 本变更不在 Harness 产生运维证据前强制区分 generated 与 reference 目录。
- 被忽略的 `.tmp/**` 草稿只作为编写证据，绝不直接提升为当前事实。
- 简体中文要求不改写技术标识、命令、路径、协议字段、测试 fixture 或数据载荷，也不翻译 OpenSpec 解析器所需结构词；纳入仓库的 Skill 人类说明必须使用简体中文。

## 相关变更

- 父变更：`establish-agent-harness`。
- 未来另行批准的变更：`Impeccable` 集成、`build-agent-observability`、`enforce-engineering-standards` 和最终文档/CI 收口。

## Impact

- 影响根文档、`AGENTS.md`、`CLAUDE.md`、`agent-rules/**`、`docs/**`、`.codex/skills/docs-audit/**`、OpenSpec 配置与父工件、文档脚本、包脚本、文档/源码契约测试，以及纳入仓库的文档 CI 工作流。
- 在完成已验证提取后，删除 `docs/archive/**`、`docs/prototypes/**`、OpenSpec 外的遗留规划/spec 表面及其全部 live reference。
- 原地更新 `docs/repo-inventory.md` 等现有生成工件及其 generator；目录分类仍延后决定。
- 可能更新归属错误且存于 `docs/**` 下的非文档运行时资产的代码或配置引用；任何影响运行时的迁移仍必须遵循仓库正常构建、队列、部署和验证边界。
- 不改变 Generation 或 Training 产品行为。
