# Preserved session source materials

These files are the tracked continuation copies of the scratch materials that informed
the 2026-07-10 harness-design session. They are evidence, not current repository truth,
not an approval record, and not a parallel implementation plan. Later agents must route
accepted requirements into the normal OpenSpec artifacts and revalidate repository facts
against source, schemas, tests, Git history, and runtime evidence where needed.

## Contents and authority

| File | Purpose | Authority warning |
| --- | --- | --- |
| `harness-design-decisions-2026-07-10.md` | Consolidated conversation decisions, rejected options, stage boundaries, and unresolved design work. | Some status lines describe the moment they were written; consult the handoff and active OpenSpec tasks for current state. |
| `harness-docs-ia-draft-2026-07-10.md` | Approved documentation tree discussion, per-directory responsibilities, Impeccable compatibility research, and migration boundaries. | Discussion evidence only; the child proposal/spec/design/tasks remain normative for an approved apply. |
| `repo-understanding-deep-2026-07-08.md` | Main deep repository-reading draft covering frontend, backend, data, Training, queues, ComfyUI, Agent/MCP, tests, docs, and runtime observations. | Point-in-time claims may be stale and must be reverified before migration. |
| `repo-understanding-2026-07-08.md` | Earlier compact repository-understanding snapshot. | Secondary input; prefer the deep draft and current code evidence. |

## Provenance

The files were moved from ignored `.tmp/**` paths during the handoff-completeness pass.
Only their opening provenance/status wording was updated to describe the tracked evidence
location. SHA-256 values of the original scratch files before that wording change were:

```text
a454ffc573c403ac222dc23145e27f81e8e311c9a8247944cc1606055ec9bedc  harness-design-decisions-2026-07-10.md
fef72ec19dee50b551e60aaf6f40318dcfc04b929afd48b80d1235df365ca49b  harness-docs-ia-draft-2026-07-10.md
afc26ce67402b484329ca44d7a48cc0ff6fb11ef9bce6ac3e6e7d8e1b9a408f6  repo-understanding-2026-07-08.md
940140ba7a24e38b6e3313ed4791598c44237ef123a5af49317b50a36a159b00  repo-understanding-deep-2026-07-08.md
```

The raw Codex conversation JSON is deliberately not committed: it can contain internal
instructions, tool payloads, machine metadata, and unrelated sensitive state. The
decision log plus the session handoff preserve the user-visible requirements, resolved
choices, rejected alternatives, open questions, current progress, and continuation path.
