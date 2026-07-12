---
schemaVersion: 1
document:
  type: router
  status: current
  owner: agent-policy
  authority:
    subject: agent-workflow/claude-entrypoint
    kind: compatibility
  readWhen:
    - 客户端自动读取 CLAUDE.md 时
  sources:
    - AGENTS.md
  verifiedBy:
    - node --import tsx --test tests/test-agent-policy-runbooks.test.ts
    - npm run docs:check
---

@AGENTS.md

# `Claude` 兼容入口

本文件只服务于自动读取 `CLAUDE.md` 的客户端。普通开发工作流的唯一权威是 [AGENTS.md](AGENTS.md)；开始任务前请读取它，不得在此维护另一份规则。
