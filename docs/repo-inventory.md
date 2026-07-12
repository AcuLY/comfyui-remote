---
schemaVersion: 1
document:
  type: router
  status: current
  owner: documentation-governance
  authority:
    subject: repository-inventory
    kind: reference
  readWhen:
    - 检查受跟踪路径、文档分类与维护责任方时
  sources:
    - docs/_meta/documentation.schema.json
    - docs/_meta/policy.yaml
    - scripts/docs/generate-repo-inventory.ts
  verifiedBy:
    - npx tsx scripts/docs/generate-repo-inventory.ts --check
  generator: scripts/docs/generate-repo-inventory.ts
  inputs:
    - '**'
    - docs/_meta/documentation.schema.json
    - docs/_meta/policy.yaml
  regenerate: npx tsx scripts/docs/generate-repo-inventory.ts
  check: npx tsx scripts/docs/generate-repo-inventory.ts --check
---

# 仓库清单

本文件由 `scripts/docs/generate-repo-inventory.ts` 生成。路径来自 `git ls-files`；当前文档的分类与责任方来自已校验的同文件元数据；其他受治理路径的分类来自 `docs/_meta/policy.yaml` 中的 `scope.kind`。未声明语义归属的源码与资产使用通用责任方，不根据文件名猜测领域。

| 路径 | 顶层区域 | 责任方 | 文件类型 | 分类 | 分类依据 |
| --- | --- | --- | --- | --- | --- |
| `.claude/settings.json` | `.claude` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `.codebuddy/settings.json` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `.codebuddy/skills/ui-ux-pro-max/SKILL.md` | `.codebuddy` | `repository-maintainers` | `Markdown` 文档 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/charts.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/colors.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/icons.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/landing.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/products.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/react-performance.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/astro.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/flutter.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/html-tailwind.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/jetpack-compose.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/nextjs.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/nuxt-ui.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/nuxtjs.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/react-native.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/react.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/shadcn.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/svelte.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/swiftui.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/stacks/vue.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/styles.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/typography.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/ui-reasoning.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/ux-guidelines.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/data/web-interface.csv` | `.codebuddy` | `repository-maintainers` | 结构化数据 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/scripts/__pycache__/core.cpython-314.pyc` | `.codebuddy` | `repository-maintainers` | 仓库文件 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/scripts/__pycache__/design_system.cpython-314.pyc` | `.codebuddy` | `repository-maintainers` | 仓库文件 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/scripts/__pycache__/search.cpython-314.pyc` | `.codebuddy` | `repository-maintainers` | 仓库文件 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/scripts/core.py` | `.codebuddy` | `repository-maintainers` | 源码 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/scripts/design_system.py` | `.codebuddy` | `repository-maintainers` | 源码 | `compatibility-skill` | 治理策略 |
| `.codebuddy/skills/ui-ux-pro-max/scripts/search.py` | `.codebuddy` | `repository-maintainers` | 源码 | `compatibility-skill` | 治理策略 |
| `.codex/config.toml` | `.codex` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `.codex/hooks.json` | `.codex` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `.codex/skills/docs-audit/SKILL.md` | `.codex` | `repository-maintainers` | `Markdown` 文档 | `skill` | 治理策略 |
| `.codex/skills/docs-audit/agents/openai.yaml` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/docs-audit/references/evidence-contract.md` | `.codex` | `repository-maintainers` | `Markdown` 文档 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/SKILL.md` | `.codex` | `repository-maintainers` | `Markdown` 文档 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/charts.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/colors.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/icons.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/landing.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/products.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/react-performance.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/astro.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/flutter.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/html-tailwind.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/jetpack-compose.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/nextjs.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/nuxt-ui.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/nuxtjs.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/react-native.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/react.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/shadcn.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/svelte.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/swiftui.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/stacks/vue.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/styles.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/typography.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/ui-reasoning.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/ux-guidelines.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/data/web-interface.csv` | `.codex` | `repository-maintainers` | 结构化数据 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/scripts/core.py` | `.codex` | `repository-maintainers` | 源码 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/scripts/design_system.py` | `.codex` | `repository-maintainers` | 源码 | `skill` | 治理策略 |
| `.codex/skills/ui-ux-pro-max/scripts/search.py` | `.codex` | `repository-maintainers` | 源码 | `skill` | 治理策略 |
| `.env.example` | `root` | `repository-maintainers` | 仓库文件 | `仓库文件` | 通用回退 |
| `.github/workflows/documentation-governance.yml` | `.github` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `.gitignore` | `root` | `repository-maintainers` | 仓库文件 | `仓库文件` | 通用回退 |
| `AGENTS.md` | `root` | `agent-policy` | `Markdown` 文档 | `router` | 文档元数据 |
| `ARCHITECTURE.md` | `root` | `system-architecture` | `Markdown` 文档 | `architecture` | 文档元数据 |
| `CLAUDE.md` | `root` | `agent-policy` | `Markdown` 文档 | `router` | 文档元数据 |
| `DESIGN.md` | `root` | `product-design` | `Markdown` 文档 | `design` | 文档元数据 |
| `PRODUCT.md` | `root` | `product` | `Markdown` 文档 | `product` | 文档元数据 |
| `README.md` | `root` | `repository-maintainers` | `Markdown` 文档 | `router` | 文档元数据 |
| `components.json` | `root` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `config/comfy-targets.example.json` | `config` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `config/path-maps.json` | `config` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `config/workflows/standard-workflow.api.json` | `config` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `docker-compose.yml` | `root` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `docs/QUALITY_SCORE.md` | `docs` | `engineering-standards` | `Markdown` 文档 | `placeholder` | 文档元数据 |
| `docs/README.md` | `docs` | `documentation-governance` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/RELIABILITY.md` | `docs` | `observability` | `Markdown` 文档 | `placeholder` | 文档元数据 |
| `docs/SECURITY.md` | `docs` | `security-governance` | `Markdown` 文档 | `placeholder` | 文档元数据 |
| `docs/_meta/README.md` | `docs` | `repository-maintainers` | `Markdown` 文档 | `control-plane` | 治理策略 |
| `docs/_meta/documentation.schema.json` | `docs` | `repository-maintainers` | 结构化数据 | `control-plane` | 治理策略 |
| `docs/_meta/policy.yaml` | `docs` | `repository-maintainers` | 结构化数据 | `control-plane` | 治理策略 |
| `docs/_meta/templates/directory-readme.md` | `docs` | `repository-maintainers` | `Markdown` 文档 | `control-plane` | 治理策略 |
| `docs/_meta/templates/document.md` | `docs` | `repository-maintainers` | `Markdown` 文档 | `control-plane` | 治理策略 |
| `docs/_meta/templates/runbook.md` | `docs` | `repository-maintainers` | `Markdown` 文档 | `control-plane` | 治理策略 |
| `docs/api/README.md` | `docs` | `api-contracts` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/api/route-handler-template.md` | `docs` | `api-contracts` | `Markdown` 文档 | `api` | 文档元数据 |
| `docs/architecture/README.md` | `docs` | `system-architecture` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/architecture/core-beliefs.md` | `docs` | `system-architecture` | `Markdown` 文档 | `architecture` | 文档元数据 |
| `docs/architecture/domains/README.md` | `docs` | `system-architecture` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/architecture/domains/generation/README.md` | `docs` | `generation` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/architecture/domains/shared-resources/README.md` | `docs` | `shared-resources` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/architecture/domains/training/README.md` | `docs` | `training` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/architecture/system/README.md` | `docs` | `system-architecture` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/architecture/system/agent-interfaces.md` | `docs` | `api-contracts` | `Markdown` 文档 | `architecture` | 文档元数据 |
| `docs/architecture/system/context.md` | `docs` | `system-architecture` | `Markdown` 文档 | `architecture` | 文档元数据 |
| `docs/architecture/system/data-model.md` | `docs` | `data-architecture` | `Markdown` 文档 | `architecture` | 文档元数据 |
| `docs/architecture/system/dependency-model.md` | `docs` | `system-architecture` | `Markdown` 文档 | `architecture` | 文档元数据 |
| `docs/architecture/system/execution/README.md` | `docs` | `queue-runtime` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/architecture/system/execution/queue-worker.md` | `docs` | `queue-runtime` | `Markdown` 文档 | `architecture` | 文档元数据 |
| `docs/architecture/system/runtime-topology.md` | `docs` | `runtime-architecture` | `Markdown` 文档 | `architecture` | 文档元数据 |
| `docs/design/README.md` | `docs` | `product-design` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/design/component-patterns.md` | `docs` | `product-design` | `Markdown` 文档 | `design` | 文档元数据 |
| `docs/design/design-demo-governance.md` | `docs` | `product-design` | `Markdown` 文档 | `design` | 文档元数据 |
| `docs/design/interaction-and-motion.md` | `docs` | `product-design` | `Markdown` 文档 | `design` | 文档元数据 |
| `docs/design/layout-and-density.md` | `docs` | `product-design` | `Markdown` 文档 | `design` | 文档元数据 |
| `docs/design/responsive-and-accessibility.md` | `docs` | `product-design` | `Markdown` 文档 | `design` | 文档元数据 |
| `docs/design/review-workbench.md` | `docs` | `product-design` | `Markdown` 文档 | `design` | 文档元数据 |
| `docs/prisma-schema-compatibility.md` | `docs` | `data-architecture` | `Markdown` 文档 | `architecture` | 文档元数据 |
| `docs/product/README.md` | `docs` | `product` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/product/generation/README.md` | `docs` | `product-generation` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/product/generation/preset-section-replacement.md` | `docs` | `product-generation` | `Markdown` 文档 | `product` | 文档元数据 |
| `docs/product/generation/project-archive.md` | `docs` | `product-generation` | `Markdown` 文档 | `product` | 文档元数据 |
| `docs/product/shared-resources/README.md` | `docs` | `product-shared-resources` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/product/shared-resources/position-presets.md` | `docs` | `product-prompt-reference` | `Markdown` 文档 | `product` | 文档元数据 |
| `docs/product/training/README.md` | `docs` | `product-training` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/repo-inventory.md` | `docs` | `documentation-governance` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/runbooks/README.md` | `docs` | `operations` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/runbooks/deployment/README.md` | `docs` | `deployment-operations` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/runbooks/deployment/database-sync.md` | `docs` | `data-architecture` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/deployment/lock.md` | `docs` | `deployment-operations` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/deployment/next-build.md` | `docs` | `deployment-operations` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/deployment/queue-safety.md` | `docs` | `queue-runtime` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/deployment/service-restart.md` | `docs` | `deployment-operations` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/deployment/verification.md` | `docs` | `deployment-operations` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/development/README.md` | `docs` | `development-operations` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/runbooks/development/database-bootstrap.md` | `docs` | `development-operations` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/development/dev-service.md` | `docs` | `development-operations` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/development/local-verification.md` | `docs` | `development-operations` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/git-delivery.md` | `docs` | `repository-delivery` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/mypc/README.md` | `docs` | `mypc-operations` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/runbooks/mypc/powershell-over-ssh.md` | `docs` | `mypc-operations` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/runbooks/script-maintenance.md` | `docs` | `repository-maintenance` | `Markdown` 文档 | `runbook` | 文档元数据 |
| `docs/testing/README.md` | `docs` | `test-infrastructure` | `Markdown` 文档 | `router` | 文档元数据 |
| `docs/testing/quality-analysis.md` | `docs` | `quality-pipeline` | `Markdown` 文档 | `testing` | 文档元数据 |
| `eslint.config.mjs` | `root` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `next.config.ts` | `root` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `openspec/README.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/establish-agent-harness/.openspec.yaml` | `openspec` | `repository-maintainers` | 结构化数据 | `openspec` | 治理策略 |
| `openspec/changes/establish-agent-harness/README.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/establish-agent-harness/design.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/establish-agent-harness/proposal.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/establish-agent-harness/specs/agent-harness/spec.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/establish-agent-harness/tasks.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/.openspec.yaml` | `openspec` | `repository-maintainers` | 结构化数据 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/README.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/design.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/2026-07-10-session-handoff.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/2026-07-12-apply-authorization.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/2026-07-12-apply-baseline.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/2026-07-12-legacy-input-baseline.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/README.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit-skill-baseline.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-10-prototypes.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-current-knowledge-followup.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-current-knowledge.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-design-demo-source-adjacent.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-7-authority-cutover.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-8-planning-cutover.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-design-system-demos.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-historical.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-plans-prd.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-superpowers-followup.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-superpowers.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/.gitignore` | `openspec` | `repository-maintainers` | 仓库文件 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/README.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/file_access_hook.py` | `openspec` | `repository-maintainers` | 源码 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/fixture/AGENTS.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/fixture/docs/guide.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/fixture/notes.txt` | `openspec` | `repository-maintainers` | 仓库文件 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/hooks.example.json` | `openspec` | `repository-maintainers` | 结构化数据 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/sample/file-access-stats.json` | `openspec` | `repository-maintainers` | 结构化数据 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/sample/file-access.ndjson` | `openspec` | `repository-maintainers` | 仓库文件 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/test_file_access_hook.py` | `openspec` | `repository-maintainers` | 源码 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/session-materials/README.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/session-materials/harness-design-decisions-2026-07-10.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/session-materials/harness-docs-ia-draft-2026-07-10.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/session-materials/repo-understanding-2026-07-08.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/evidence/session-materials/repo-understanding-deep-2026-07-08.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/proposal.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/specs/documentation-governance/spec.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/changes/rebuild-documentation-governance/tasks.md` | `openspec` | `repository-maintainers` | `Markdown` 文档 | `openspec` | 治理策略 |
| `openspec/config.yaml` | `openspec` | `repository-maintainers` | 结构化数据 | `openspec` | 治理策略 |
| `package-lock.json` | `root` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `package.json` | `root` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `postcss.config.mjs` | `root` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `prisma.config.ts` | `root` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260324093717_init/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260324133657_add_prompt_blocks_and_negative_prompts/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260325065132_add_short_side_px/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260325082406_add_position_name/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260325091730_add_lora_bindings_to_presets/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260326075526_add_character_lora_bindings/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260524090000_add_character_lora_canonical_views/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260616090000_replace_character_lora_with_training/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260616120000_add_training_order_visibility/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/20260618120000_add_section_two_stage_ksampler/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations-sqlite/migration_lock.toml` | `prisma` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `prisma/migrations/20260616090000_replace_character_lora_with_training/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations/20260616120000_add_training_order_visibility/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/migrations/20260618120000_add_section_two_stage_ksampler/migration.sql` | `prisma` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `prisma/schema.prisma` | `prisma` | `repository-maintainers` | `Prisma` 结构 | `仓库文件` | 通用回退 |
| `prisma/schema.sqlite.prisma` | `prisma` | `repository-maintainers` | `Prisma` 结构 | `仓库文件` | 通用回退 |
| `prisma/seed.ts` | `prisma` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `reports/quality/auto-review-analysis/phase0-labeled-images.csv` | `reports` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-by-section-project.csv` | `reports` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-by-section.csv` | `reports` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-by-section.md` | `reports` | `repository-maintainers` | `Markdown` 文档 | `仓库文件` | 通用回退 |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-summary.json` | `reports` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `scripts/auto-censor-mosaic.py` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/cleanup-latent-artifacts.mjs` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/db/collapse-preset-group-bindings.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/db/migrate-zero-redundancy.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/db/verify-zero-redundancy.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/adapters.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/config.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/consumers.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/contract-runner.mjs` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/diagnostics.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/engine.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/git.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/language.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/markdown.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/model.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/path.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/check/scope.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/generate-prisma-schema-compatibility.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/docs/generate-repo-inventory.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/fix-position-presets.py` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/migrate-preset-variants.sql` | `scripts` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `scripts/migrate-sqlite.sql` | `scripts` | `repository-maintainers` | `SQL` 文件 | `仓库文件` | 通用回退 |
| `scripts/observability/agent_file_access_hook.py` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/quality/baseline.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/quality/evaluate.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/quality/review.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/quality/verify.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/skills/validate.mjs` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/training/dataset-freeze-worker.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/training/image-worker-runtime.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/training/image-worker.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/training/training-worker-runtime.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/training/training-worker.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/training/worker-common.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/training/worker-queue-runtime.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `scripts/training/worker-queue.ts` | `scripts` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/projects/[projectId]/context/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/projects/[projectId]/run-all/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/projects/[projectId]/switch-variants/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/projects/[projectId]/sync-preset-variants/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/projects/[projectId]/update/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/projects/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/projects/sync-preset-variant-flow/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/runs/[runId]/context/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/runs/[runId]/review/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/agent/sections/[sectionId]/run/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/audit-logs/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/auth/verify/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/comfy/health-probe/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/comfy/restart/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/comfy/start/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/comfy/status/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/comfy/stop/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/health/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/image-review/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/images/[...path]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/images/[imageId]/cover/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/images/[imageId]/featured-helper.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/images/[imageId]/featured/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/images/[imageId]/featured2/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/images/[imageId]/manual-censor/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/images/[imageId]/restore/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/logs/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/loras/browse/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/loras/move/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/loras/notes/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/loras/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/mcp/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/models/browse/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/models/hash/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/models/move/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/models/notes/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/models/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/path-maps/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/categories/[categoryId]/groups/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/categories/[categoryId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/categories/[categoryId]/slot-template/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/categories/[categoryId]/sort-orders/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/categories/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/categories/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/folders/[folderId]/move/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/folders/[folderId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/folders/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/folders/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/groups/[groupId]/flatten/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/groups/[groupId]/members/[memberId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/groups/[groupId]/members/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/groups/[groupId]/members/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/groups/[groupId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/groups/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/presets/[presetId]/cascade/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/presets/[presetId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/presets/[presetId]/sync/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/presets/[presetId]/usage/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/presets/[presetId]/variants/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/presets/[presetId]/variants/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/presets/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/presets/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/preset-library/variants/[variantId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/presets/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/project-create-options/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/project-folders/[folderId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/project-folders/move/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/project-folders/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/project-folders/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/apply-param/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/archive/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/cancel-runs/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/copy/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/export/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/preset-replacements/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/results/trash/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/run/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/save-as-template/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/section-workflow/[sectionId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/[sectionId]/blocks/[blockId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/[sectionId]/blocks/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/[sectionId]/copy/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/[sectionId]/create-from-template/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/[sectionId]/import-preset/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/[sectionId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/[sectionId]/run/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/[sectionId]/switch-variant/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/batch-delete/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/[projectId]/sections/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/projects/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/queue-data/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/queue/clear-active/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/queue/clear/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/queue/pause-active/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/queue/resume-paused/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/queue/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/runs/[runId]/cancel/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/runs/[runId]/review/keep/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/runs/[runId]/review/trash/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/runs/[runId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/runs/[runId]/workflow/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/sections/[sectionId]/trash/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/templates/[templateId]/import/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/templates/[templateId]/preset-replacements/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/templates/[templateId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/templates/[templateId]/sections/[sectionId]/copy/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/templates/[templateId]/sections/[sectionId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/templates/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/blocks/[blockId]/detach/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/blocks/[blockId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/dataset-revisions/[revisionId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/generation-inputs/[inputId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/generation-outputs/[outputId]/apply/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/generation-tasks/[taskId]/cancel/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/generation-tasks/[taskId]/inputs/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/generation-tasks/[taskId]/outputs/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/generation-tasks/[taskId]/preview/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/generation-tasks/[taskId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/generation-tasks/[taskId]/run/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/generation-tasks/[taskId]/supplemental-images/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/image-results/[imageResultId]/caption/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/image-results/[imageResultId]/review/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/image-results/[imageResultId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/presets/[presetId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/presets/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/presets/sort-rules/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/archive/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/captions/generate/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/dataset-readiness/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/dataset-revisions/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/generation-tasks/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/image-results/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/image-results/upload/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/profile/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/reference-images/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/restore/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/save-as-template/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/sections/[sectionId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/sections/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/sections/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/text-revisions/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/[projectId]/training-runs/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/projects/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/reference-images/[imageId]/add-to-results/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/reference-images/[imageId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/runs/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scene-description/categories/[categoryId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scene-description/categories/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scene-description/folders/[folderId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scene-description/folders/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scene-description/presets/[presetId]/cascade/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scene-description/presets/[presetId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scene-description/presets/[presetId]/usage/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scene-description/presets/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scheduler/status/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/scheduler/tick/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/section-runs/[runId]/cancel/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/section-runs/[runId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/sections/[sectionId]/blocks/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/sections/[sectionId]/blocks/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/sections/[sectionId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/sections/[sectionId]/runs/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/sections/[sectionId]/scene-description/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/[templateId]/blocks/[blockId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/[templateId]/projects/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/[templateId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/[templateId]/sections/[sectionId]/blocks/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/[templateId]/sections/[sectionId]/blocks/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/[templateId]/sections/[sectionId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/[templateId]/sections/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/[templateId]/sections/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/reorder/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/templates/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/text-revisions/[revisionId]/restore/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/training-runs/[trainingRunId]/cancel/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/training-runs/[trainingRunId]/cleanup/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/training-runs/[trainingRunId]/create-preset/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/training-runs/[trainingRunId]/poll/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/training-runs/[trainingRunId]/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/generation-tasks/[taskId]/complete/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/generation-tasks/[taskId]/fail/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/status/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/tasks/[taskId]/complete/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/tasks/[taskId]/fail/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/tasks/[taskId]/heartbeat/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/tasks/next/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/training-runs/[trainingRunId]/complete/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/training-runs/[trainingRunId]/fail/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/training/worker/training-runs/[trainingRunId]/progress/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/api/worker/status/route.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/loras/lora-file-manager.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/loras/lora-upload-form.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/loras/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/model-file-manager-shared.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/models/model-file-manager.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/models/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/preset-groups/[groupId]/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/[presetId]/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/[presetId]/preset-edit-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/add-group-member-form.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/category-components.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/change-history-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/folder-components.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/group-components.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/group-create-form.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/group-inline-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/group-list.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/group-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/preset-form-action-footer.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/preset-form.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/preset-manager.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/preset-types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/preset-variant-bulk-apply.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/preset-variant-bulk-edit-dialog.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/preset-variant-bulk-text.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/preset-variant-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/preset-variant-list.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/sort-rules/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/sort-rules/sort-rules-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/sortable-group-card.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/presets/use-preset-save-queue.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/[templateId]/edit/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/[templateId]/sections/[sectionIndex]/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-form.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-lora-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-navigation.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-preset-bindings.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-prompt-blocks.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/new/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/template-form-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/assets/templates/templates-list-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/[[...route]]/loading.shell.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/[[...route]]/loading.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/[[...route]]/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/fallback-data.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/fallback-images.test.ts` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/fallback-images.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/fallback-route-data.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/load-demo-data.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/local-image-files.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/lora-training-types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/lora-training.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/model-assets.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/preset-library.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/row-shaping.test.ts` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/row-shaping.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/selectors.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/source-summary.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/sql-types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/sqlite-source.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/data/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/auth/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/auth/login-page.shell.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/auth/login-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/fixtures.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/training-project-list-item.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/training-project-list-item.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/training-project-pages.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/training-projects-page.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/training-projects-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/training-resource-pages.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/training-run-detail-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/training-runs-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/lora-training/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/models/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/models/model-fixtures.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/models/model-list.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/models/model-list.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/models/model-types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/category-form-page.library.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/category-form-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/group-page.library.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/group-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/library-page.library.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/library-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/preset-edit-page.library.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/preset-edit-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/sort-rules-page.library.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/presets/sort-rules-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/batch/batch-candidates.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/batch/batch-create.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/batch/batch.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-controls.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-controls.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-lora-column.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-lora-column.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-lora-history.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-lora-history.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-page-data.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-parts.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-presets.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-presets.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-prompts.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-prompts.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-shared.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-shell.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor-shell.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/editor.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/history-panel.editor.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/history-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/lightbox-preview.editor.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/lightbox-preview.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/lora-panel.editor.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/lora-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/missing-section-state.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/params-panel.editor.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/params-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/preset-bindings-panel.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/preset-bindings-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/prompts-panel.editor.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/prompts-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/results-panel.editor.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/results-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/editor/use-section-editor-state.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-detail-page.projects.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-detail-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-folders.projects.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-folders.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-form-page.projects.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-form-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-list-item.projects.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-list-item.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-list-page.projects.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-list-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-result-card.projects.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-result-card.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-section-card.projects.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-section-card.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-section-shell.projects.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/project-section-shell.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/root-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/section-rail.projects.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/projects/section-rail.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/current-running-progress-card.runs.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/current-running-progress-card.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/demo-pager.runs.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/demo-pager.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/pending-review-groups.runs.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/pending-review-groups.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/queue-metrics.runs.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/queue-metrics.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/queue-model.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/queue-page.runs.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/queue-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/review-meta-card.runs.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/review-meta-card.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/review-page.runs.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/review-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/run-list.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/run-list.runs.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/run-list.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/runs/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/logs-page.shell.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/logs-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/monitor-page.shell.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/monitor-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/not-found-page.shell.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/not-found-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/settings-page.shell.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/settings-page.test.ts` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/settings/settings-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/templates/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/templates/template-form-page.library.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/templates/template-form-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/templates/template-list.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/templates/template-list.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/templates/template-section-page.library.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/templates/template-section-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/templates/template-section-shell.library.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/features/templates/template-section-shell.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/font-options.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/LICENSE` | `src` | `repository-maintainers` | 仓库文件 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_00a682.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_0f9ed6.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_121ef3.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_170a05.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_17f172.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_217dc2.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_256855.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_272cc0.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_27c723.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_28749b.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_2b1dc1.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_2dce0b.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_3056fd.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_312071.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_375414.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_39f71f.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_3ef9bb.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_3fc7ac.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_409c84.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_44123f.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_449d8d.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_45ef02.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_47cfe5.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_4d7a5e.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_4fed1d.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_533bb6.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_68d530.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_6acba8.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_6cf07f.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_6dd231.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_6fde5a.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_7058e1.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_7a0ff1.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_7c169d.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_7ef7a1.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_7f7d1c.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_83d7dd.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_84452c.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_84f7ac.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_86f2d2.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_88d643.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_8a3521.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_8b2a9d.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_8c54f5.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_8ef126.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_8fcd67.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_92d092.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_95b6b4.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_96734e.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_997d05.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_9dbf33.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_a2360c.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_a3f550.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_a4d91f.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_a9cfd5.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_a9e9db.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_aab13d.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_ac4458.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_b00490.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_b13597.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_b2c226.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_b2e109.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_b62ca1.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_c59db4.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_cdc930.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_d0a30d.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_d605af.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_d892dd.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_d9b42a.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_da4d56.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_de2c82.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_e17466.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_e39c0d.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_ea8896.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_eccccb.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_f07e53.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_f61d6a.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_f64fe5.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_f796c7.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_fda05f.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_fe0341.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/harmonyos-sans-sc/Regular_fff490.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/ibm-plex-mono/IBMPlexMono-Bold.ttf` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/ibm-plex-mono/IBMPlexMono-Medium.ttf` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/ibm-plex-mono/IBMPlexMono-Regular.ttf` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/ibm-plex-mono/IBMPlexMono-SemiBold.ttf` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/design-demos/fonts/ibm-plex-mono/OFL.txt` | `src` | `repository-maintainers` | 仓库文件 | `仓库文件` | 通用回退 |
| `src/app/design-demos/layout.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/routing/header-specs.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/routing/href.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/routing/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/routing/routes.test.ts` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/routing/routes.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/routing/sfw.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/routing/showcase-routes.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/routing/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/shell/app-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/shell/app-shell.test.mjs` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/shell/app-shell.test.ts` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/shell/app-shell.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/shell/header-action-slots.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/shell/header-surface.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/shell/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/helpers.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/icons/custom-icon-demo.showcase.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/icons/custom-icon-demo.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/icons/custom-icons.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/icons/icon-data.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/icons/icon-list.showcase.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/icons/icon-list.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/icons/icons-page.showcase.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/icons/showcase-icons.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/interactive-previews.test.mjs` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/pages/component-previews.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/pages/family-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/pages/family-samples.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/pages/headers-page.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/pages/headers-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/pages/icons-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/pages/index-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/pages/showcase-pages.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/preview-keys.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/registry.test.ts` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/registry.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/showcase-item.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/design-demos/showcase/showcase-item.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/design-system.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/favicon.ico` | `src` | `repository-maintainers` | 图像资产 | `仓库文件` | 通用回退 |
| `src/app/fonts/geist-latin.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/fonts/geist-mono-latin.woff2` | `src` | `repository-maintainers` | 字体资产 | `仓库文件` | 通用回退 |
| `src/app/globals.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/app/layout.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/login/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/not-found.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/app-sidebar.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/batch-create/batch-create-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/batch-create/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/censor-button.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/clear-sections-button.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/edit/apply-param-response.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/edit/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/edit/project-edit-form.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/loading.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/project-detail-actions.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/project-detail-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/results/loading.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/results/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/results/project-results-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/results/project-results-gallery.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/results/project-results-lightbox.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/results/project-results-toolbar.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/results/use-project-results-filter-state.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/results/use-project-results-mutations.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/section-actions.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/section-cards.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/actions.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/loading.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/results/loading.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/results/results-route-prefetcher.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/section-change-history.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/section-name-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/section-params-form.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sections/[sectionId]/section-switch-navigation.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/[projectId]/sync-preset-variant-flow-dialog.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/action-types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/actions-export.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/actions.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/new/from-existing/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/new/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/new/project-form.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/project-archive-button.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/project-delete-button.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/project-list-view-model.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/project-loading-skeletons.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/project-section-card-components.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/projects-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/projects/use-project-list-view-state.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/[runId]/image-lightbox.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/[runId]/loading.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/[runId]/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/[runId]/queue-review-batch-actions.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/[runId]/queue-review-image-card.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/[runId]/queue-review-selection-toolbar.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/[runId]/review-grid.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/[runId]/use-queue-review-keyboard-shortcuts.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/[runId]/use-queue-review-selection.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/loading.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/queue-censoring-progress-card.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/queue-page-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/queue-pending-tab.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/queue-running-tab.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/queue-trash-tab.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/queue/use-queue-trash-state.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/settings/logs/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/settings/monitor/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/settings/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/training/[[...route]]/page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/training/load-training-route-data.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/training/server-data.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/app/training/training-app-client.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/app-shell.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/aspect-ratio-picker.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/batch-size-quick-fill.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/change-diff-view.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/checkpoint-cascade-picker.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-routing/href-context.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-routing/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-shell/app-shell.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-shell/app-shell.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-shell/header-action-slots.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-shell/header-surface.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-shell/header-surface.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-shell/header-types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-shell/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/feedback/context.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/feedback/feedback.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/feedback/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/feedback/operation-state-strip/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/feedback/operation-state-strip/operation-state-strip.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/feedback/provider-theme.test.mjs` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/feedback/provider.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/asset-paths.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-accessibility.test.ts` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-grid/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-list-medium/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-list-small/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-list-stats/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-preview-frame/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-preview-large/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-status.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-thumb-medium/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image-thumb-small/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/image/image.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/media/review-image-board/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/patterns/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/patterns/patterns.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/button/button.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/button/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/checkbox/checkbox.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/checkbox/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/classnames.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/controls-interaction.test.mjs` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/empty-page/empty-page.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/empty-page/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/empty-rows/empty-rows.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/empty-rows/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/field/field.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/field/field.test.ts` | `src` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/field/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/floating-select/floating-select.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/floating-select/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/icons/custom-svg.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/metric-card/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/metric-card/metric-card.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/page-header/action-portal-context.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/page-header/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/page-header/page-header.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/panel/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/panel/panel.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/route-table/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/route-table/route-table.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/segmented-control/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/segmented-control/segmented-control.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/shared/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/shared/utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/sortable/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/status-badge/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/status-badge/status-badge.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/switch-row/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/switch-row/switch-row.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/switch/index.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/design-demo-ui/primitives/switch/switch.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/components/hard-navigation-link.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/ksampler-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/lora-binding-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/lora-cascade-picker.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/lora-list-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/neighbor-navigation.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/notification-copy-buttons.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/page-header.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/persistent-bottom-nav.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/preset-cascade-picker.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/preset-group-cascade-picker.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/preset-section-replacement-dialog.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/project-cascade-picker.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/prompt-block-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/quick-censor-canvas.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/section-card.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/section-editor-binding-rules.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/section-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/section-folder-controls.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/section-import-preset-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/section-sidebar-nav.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/sfw-mode-provider.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/sfw-mode-toggle.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/stat-chip.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/template-prompt-block-editor.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/theme-toggle.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/ui/button.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/ui/input.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/ui/select.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/ui/separator.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/ui/sheet.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/ui/sidebar.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/ui/skeleton.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/ui/tooltip.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/upscale-factor-quick-fill.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/components/workflow-download-menu.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/app.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/build.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/data.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/header-action-slots.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/header-specs.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/not-found-page.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/features/training/not-found-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/routes.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/runtime.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/shell.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/theme.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/project-page-shell.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/project-page-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/project-run-rows.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/reference-picker.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-generation-compose-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-preset-detail-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-preset-library-primitives.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-preset-sort-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-preset-sort-rules-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-presets-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-dataset-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-dataset-revision-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-detail-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-form-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-list-item.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-list-item.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-pages.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-pages.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-profile-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-reference-image-panel.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-results-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-scoped-runs-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-section-detail-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-project-sections-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-projects-page.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-projects-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-resource-page-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-resource-pages.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-resource-pages.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-result-grid.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-run-detail-page.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-run-detail-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-run-detail-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-run-generation-output-grid.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-runs-page.module.css` | `src` | `repository-maintainers` | 样式 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-runs-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-section-workspace.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-template-form-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-template-list-primitives.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-template-page-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-template-scene-block-card.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-template-section-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-template-section-row.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/training-templates-page.tsx` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-generation-compose-form.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-generation-compose-reference-selection.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-generation-supplemental-images.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-generation-task-draft.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-archive-state.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-create-form.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-create-training-defaults.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-created-draft.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-reference-selection.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-reference-upload-drafts.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-section-draft.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-section-results.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-section-scene-blocks.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-project-section-seeds.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-resource-url-search.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/features/training/ui/use-url-search.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/generated/prisma.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/hooks/use-mobile.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/hooks/use-scroll-spy.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/instrumentation.node.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/instrumentation.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/_helpers.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/cancellation-helpers.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/censoring.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/image-review.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/lora.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/preset-category.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/preset-folder.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/preset-group-sync.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/preset-group.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/preset-sync.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/preset-variant-crud.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/preset-variant-resolve.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/preset-variant.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/project-folder.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/project.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/prompt-block.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/run-execution.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/run-lifecycle.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/run.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/section-folder-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/section-folder.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/section.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/template-crud.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/template-import.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/template-save.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/actions/template.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/api-error-message.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/api-response.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/aspect-ratio-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/change-history-types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/character-lora-canonical-views.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/character-lora-prompt-card-draft.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/character-lora-source-images.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/client-review-mutation.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/db-enums.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/db.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/env.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/folder-navigation.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/image-url.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/logger.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/lora-types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/model-asset-navigation.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/model-constants.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/preset-binding-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/preset-group-slot-layout.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/preset-resource-scope.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/preset-section-replacement-ui.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/prisma.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/queue-control-progress.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/quick-censor-core.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/review-lightbox-state.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/review-undo-state.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/route-fallback.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/run-submission-toast.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/scroll-container.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/section-batch-run.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/section-list-ordering.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/server-data.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/sfw-mode.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/sync-preset-variant-flow-ui.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/training/provider-policy.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/training/schemas.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/use-review-lightbox-state.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/work-mode-resources.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/lib/work-mode.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/proxy.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/scripts/backfill-comfy-output-subfolder.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/scripts/seed.mts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/http/request-json.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/mcp/server.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/prompt-config/diff.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/prompt-config/order.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/prompt-config/preset-group-resolver.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/prompt-config/preset-resolver.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/prompt-config/section-resolver.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/prompt-config/template-resolver.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/prompt-config/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/quality/csv-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/quality/phase0-baseline.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/quality/phase1-offline-eval.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/quality/phase1-reviewer.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/generation-resource-boundary.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/lora-repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/preset-view-repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/project-repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/project-repository/enqueue.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/project-repository/helpers.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/project-view-repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/project-view-repository/detail-view.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/project-view-repository/form-view.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/project-view-repository/index.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/project-view-repository/list-view.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/prompt-block-repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/queue-data-repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/review-repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/template-view-repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/training/generation-tasks.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/training/helpers.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/training/image-results.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/training/profile-text.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/training/projects.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/training/scene-description-presets.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/training/snapshot.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/training/templates.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/repositories/trash-repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/agent-preset-variant-flow-core.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/agent-preset-variant-flow-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/agent-preset-variant-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/audit-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/auto-censor-runner.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/censoring-executor.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/censoring-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/change-history-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-gpu-watchdog.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-output-cleanup.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-patch-manager.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-process-manager.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-progress-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-queue-cancellation.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-remote-file-adapter.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-remote-output-cleanup.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-ssh.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-target-process.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfy-target.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/comfyui-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/image-file-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/image-result-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/lora-upload-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/model-asset-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/preset-binding-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/preset-change-history-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/preset-query-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/preset-section-replacement-core.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/preset-section-replacement-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/project-archive-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/project-deletion-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/project-export-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/project-file-cleanup-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/project-folder-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/project-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/prompt-block-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/queue-control-stream.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/review-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/run-executor.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/run-workflow-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/runtime-data-path.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/section-change-history-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/section-cleanup-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/section-edit-page-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/section-lora-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/section-workflow-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/caption-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/generation-output-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/generation-task-draft-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/preset-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/project-actions-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/project-order-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/project-scene-block-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/project-section-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/project-template-copy-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/project-visibility-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/read-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/route-data-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/run-maintenance-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/run-preset-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/run-preset-state-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/run-visibility-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/snapshot-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/template-order-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/template-scene-block-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/template-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/training/text-revision-service.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/validation-utils.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/workflow-debug-download.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/services/workflow-prompt-builder.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/fallback-prompt-builder.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/payload-builder.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/repository.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/completion.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/failure.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/heartbeat.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/leasing.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/scheduler.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/target-discovery.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/task-api.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/task-errors.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/task-id.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/task-json.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/training/task-serialization.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `src/server/worker/types.ts` | `src` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `start-server.bat` | `root` | `repository-maintainers` | 脚本 | `仓库文件` | 通用回退 |
| `tests/README.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `source-adjacent` | 治理策略 |
| `tests/fixtures/documentation-governance/checker/adapter-policy.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/checker/valid-repository/README.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/checker/valid-repository/docs/README.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/checker/valid-repository/docs/_meta/documentation.schema.json` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/checker/valid-repository/docs/_meta/policy.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/checker/valid-repository/docs/guide.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/checker/valid-repository/src/example.ts` | `tests` | `repository-maintainers` | 源码 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/language/invalid-english.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/language/invalid-frontmatter-english.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/language/invalid-skill-frontmatter.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/language/valid-frontmatter-zh-cn.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/language/valid-zh-cn.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/cases.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/invalid-absolute-source.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/invalid-generator-missing-check.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/invalid-placeholder-current.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/invalid-runbook-exercised-with-null-date.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/invalid-runbook-missing-recovery.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/invalid-runbook-not-exercised-with-date.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/path-cases.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/valid-architecture.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/valid-generator.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/valid-placeholder.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/valid-runbook-not-exercised.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/metadata/valid-runbook.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/skills/docs-audit/SKILL.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/skills/docs-audit/agents/openai.yaml` | `tests` | `repository-maintainers` | 结构化数据 | `fixture` | 治理策略 |
| `tests/fixtures/documentation-governance/skills/docs-audit/references/evidence-contract.md` | `tests` | `repository-maintainers` | `Markdown` 文档 | `fixture` | 治理策略 |
| `tests/fixtures/domain-builders.ts` | `tests` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `tests/fixtures/prisma-schema-source.ts` | `tests` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `tests/fixtures/quality/auto-review-analysis/reference-section-exclusions.json` | `tests` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
| `tests/fixtures/sqlite-db.ts` | `tests` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `tests/runbook-contract-harness.ps1` | `tests` | `repository-maintainers` | 脚本 | `仓库文件` | 通用回退 |
| `tests/test-agent-policy-runbooks.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-agent-preset-variant-flow-core.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-agent-preset-variant-flow-service.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-api-request-json.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-apply-param-response.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-asset-file-manager-shared.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-asset-page-boundaries.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-auto-censor-python-script.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-auto-censor-runner.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-auto-censor-service-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-cancellation-helpers.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-censor-button-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-change-history-display.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-character-lora-source-images.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-cleanup-latent-artifacts.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-clear-active-runs-responsiveness.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-collapse-preset-group-bindings.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-comfy-gpu-aware-restart.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-comfy-output-cleanup.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-comfy-queue-cancellation.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-comfy-remote-file-adapter.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-comfy-remote-output-cleanup.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-comfy-target-config.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-comfy-target-process.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-config-runtime-governance.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-design-demo-governance.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-docs-audit-skill.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-docs-check-cli.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-docs-check-core.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-docs-check-generators.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-docs-check-language.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-docs-check-metadata.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-documentation-ci.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-documentation-governance.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-fixture-governance.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-folder-navigation.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-folder-neighbor-navigation.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-global-api-routes.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-global-css-design-tokens.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-hard-navigation-for-image-heavy-pages.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-image-access-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-instrumentation-boundary.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-latent-cleanup-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-latent-schema-cleanup.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-lora-detach-persistence.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-lora-model-navigation.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-lora-remove-binding.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-lora-upload-action-boundary.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-model-asset-remote-notes.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-model-civitai-info-panel.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-model-search-filter.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-next-dev-origin-config.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-next16-build-compat-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-notification-copy-button.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-cascade-picker-overlay.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-detail-neighbors.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-form-split.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-group-detail-rename.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-group-member-replacement-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-group-name-fill.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-group-slot-layout.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-group-sync.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-group-update-revalidation.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-library-folder-scoped-order.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-resource-scope.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-save-queue.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-section-replacement-core.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-section-replacement-dialog-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-section-replacement-entrypoints.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-section-replacement-ui.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-sortable-card-links.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-variant-bulk-apply.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-variant-bulk-text.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-preset-variant-save-optimization.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-prisma-schema-compatibility-doc.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-prisma-schema-domain-comments.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-product-design-doc-governance.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-archive-ui-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-deletion-cleanup.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-detail-section-batch-size-save.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-export-filenames.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-folder-api.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-list-view-state.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-loading-skeletons.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-mobile-sidebar-width.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-results-client-split.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-results-lightbox-parity.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-results-review-counts.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-section-card-components.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-project-section-delete-service.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-proxy-dev-internal-paths.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-quality-phase0-baseline.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-quality-phase1-offline-eval.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-quality-phase1-reviewer.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-quality-script-governance.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-queue-autopoll-no-router-refresh.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-queue-control-progress-stream.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-queue-page-client-split.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-queue-pagination-ordering.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-queue-review-grid-split.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-queue-review-section-label.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-queue-trash-restore.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-quick-censor-core.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-quick-censor-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-repo-inventory.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-review-lightbox-optimistic-navigation.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-route-fallback.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-run-recovery-poller-cap.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-run-submission-deferral.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-runtime-data-path-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-script-maintenance-doc.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-section-batch-run.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-section-detail-shortcuts.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-section-editor-binding-rules.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-section-folder-copy.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-section-list-ordering.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-section-preset-detail-links.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-settings-operational-dashboards.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-shared-neighbor-navigation-usage.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-skills-check.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-sync-preset-variant-flow-ui.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-system-entity-cascade-selectors-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-template-section-detail-split.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-template-ui-action-imports.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-api-boundary.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-api-routes.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-feature-entry-boundaries.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-frontend-api-contract.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-generation-task-prisma-service.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-image-results-prisma-boundary.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-image-thumbnail-contract.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-list-layout.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-preset-service-prisma-runtime.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-preset-service-runtime-boundary.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-prod-route-shell.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-project-list-item.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-project-pages.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-resource-pages.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-route-data-loading.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-route-data-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-run-detail-page.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-runs-page.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-section-workflow.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-template-prisma-service.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-template-section-workflow.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-training-worker-entrypoints.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-two-stage-ksampler-source-paths.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-two-stage-ksampler-workflow.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-ui-component-boundaries.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-work-mode-resource-boundary.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-worker-boundary-governance.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-workflow-debug-download.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-workflow-download-options-source.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-zero-redundancy-enqueue.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-zero-redundancy-migration.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-zero-redundancy-no-legacy-fields.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-zero-redundancy-preset-resolver.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-zero-redundancy-schema-shape.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-zero-redundancy-section-resolver.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-zero-redundancy-template-resolver.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test-zero-redundancy-write-paths.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tests/test_agent_file_access_hook.py` | `tests` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `tests/test_fix_position_presets.py` | `tests` | `repository-maintainers` | 源码 | `仓库文件` | 通用回退 |
| `tests/text-editor-mobile-height.test.ts` | `tests` | `repository-maintainers` | 测试代码 | `仓库文件` | 通用回退 |
| `tsconfig.json` | `root` | `repository-maintainers` | 结构化数据 | `仓库文件` | 通用回退 |
