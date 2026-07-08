# Archive Documentation

Classification: historical record
Update trigger: plan completion, PRD replacement, superseded handoff, obsolete prototype retirement, or stale documentation cleanup.

Older documents live here after their current replacement sources are named. Superseded files kept outside this directory need a banner that links to their maintained replacement.

Current archive groups:

| Archive path | Replaces | Current source |
| --- | --- | --- |
| `docs/archive/historical/**` | old handoff, progress, todo, and integration-test notes | `README.md`, `docs/index.md`, `docs/testing/README.md`, `tests/README.md`, `AGENTS.md`, `agent-rules/**` |
| `docs/archive/plans/**` | completed or stale `docs/plans/*.md` execution/design plans | `docs/index.md`, current source code, `docs/prototypes/README.md`, and maintained runbooks/API/UI docs |
| `docs/archive/prd/**` | old phased PRDs | current feature/service/API docs and tests named from `docs/index.md` |
| `docs/archive/design-system/**` | superseded design-system summaries and migration notes | `DESIGN.md`, `docs/frontend-design-guide.md`, `docs/ui/**` |
| `docs/archive/design-demos/**` | old static `design-demos/` HTML/CSS/JS references | `src/app/design-demos/**`, `docs/design-demos-frontend-parity.md`, `docs/ui/design-demo-governance.md`, `docs/ui/legacy-static-design-demos.md` |
| `docs/archive/superpowers/plans/**` | completed Superpowers implementation plans | current docs extracted into `docs/architecture/`, `docs/runbooks/`, `docs/api/`, `docs/ui/`, and `docs/testing/` |

`docs/plans/auto-review-analysis/**` remains outside archive because quality scripts still use it as the default generated-artifact and fixture directory.
