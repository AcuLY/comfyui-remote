# Documentation governance control plane

This directory contains only the repository's documentation-governance mechanics. It does not own product, architecture, operational, or planning facts. Significant proposed changes remain in OpenSpec; audit evidence belongs to the OpenSpec change that authorized it.

## Files

- [`documentation.schema.json`](./documentation.schema.json) defines the metadata fields and the ten maintained-document profiles.
- [`policy.yaml`](./policy.yaml) defines finite governed surfaces, explicit profile selection, navigation ownership, forbidden live paths, typed source relationships, and controlled adapters.
- [`templates/document.md`](./templates/document.md), [`templates/directory-readme.md`](./templates/directory-readme.md), and [`templates/runbook.md`](./templates/runbook.md) are authoring starting points. Their angle-bracket values must be replaced before use.

Do not add a per-file owner registry, generated audit reports, product facts, OpenSpec templates, or another planning lifecycle here.

## Metadata contract

Maintained root files and current Markdown under the approved `docs/**` owner areas start with YAML frontmatter:

```yaml
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: system-architecture
  authority:
    subject: architecture/system
    kind: reference
  readWhen:
    - changing a system boundary
  sources:
    - src/server/example.ts
  verifiedBy:
    - npm run relevant:test
```

Instance metadata is authoritative for that document. `policy.yaml` assigns a schema profile through explicit path patterns, and the checker must resolve exactly one profile for every current document. It then validates the matching `$defs` entry from `documentation.schema.json`; it must not infer type or owner from a path substring. The schema's top-level `anyOf` is only an authoring convenience and is not sufficient for governance validation.

Repository paths use Git spelling: repository-relative, `/`-separated, case-sensitive, with no drive prefix, leading `/`, `.` or `..` segment, doubled separator, or glob token. Policy include/source patterns may use globs but remain repository-relative and may not escape the repository.

## Profiles

| Profile | Use | Additional contract |
| --- | --- | --- |
| `router` | `README.md` landing pages | Routes readers without duplicating detail authority. |
| `architecture` | Current system and domain structure | `type: architecture`, `status: current`. |
| `product` | Current user-facing capability knowledge | `type: product`, `status: current`. |
| `design` | Current visual and interaction knowledge | `type: design`, `status: current`. |
| `api` | Distinct maintained interface contracts | `type: api`, `status: current`. |
| `testing` | Distinct test-infrastructure knowledge | `type: testing`, `status: current`. |
| `runbook` | Executable operational procedures | Adds `environment`, `risk`, `recovery`, and `lastVerified`. |
| `placeholder` | Approved future context files with no invented content | Requires `status: deferred`, activation metadata, and an authority boundary. |
| `root-file` | Approved root entrypoints and compatibility pointer | Allows only router, architecture, product, or design types. |
| `existing-generator` | A maintained document already owned by a generator | Adds generator path, inputs, separate regeneration command, and non-writing check. |

`sources` identifies evidence paths for claims in the document. `verifiedBy` lists non-writing commands or tests that validate those claims. Neither field is a prose backlog or an update-trigger substitute.

## Policy semantics

- `scope` is the finite matrix of governed surfaces. `frontmatter: none` means the current-document schema is not applied to that surface; it does not prohibit example frontmatter in templates.
- Policy mappings are closed shapes: unknown keys, omitted control fields, empty core rule sets, disabled OpenSpec/Skill validation, and unknown schema keywords are configuration failures rather than permissive defaults.
- Every `rootEntrypoints` path must be tracked and resolve to exactly one finite scope rule.
- `profiles` selects exactly one schema profile for each current document.
- `navigation.roots` are approved graph entrypoints. For overlapping owner areas, the owner with the longest matching landing path is authoritative; each current detail links back to that landing when `reverseLinkRequired` is true.
- `forbiddenLivePaths` identifies legacy or misowned paths that must not survive acceptance.
- A `contract` relationship is blocking and must name a controlled adapter in `adapters.generators` or `adapters.contracts`. Generator argv is restricted to the repository-pinned `tsx scripts/docs/<generator> --check` shape. Source-contract adapters select a checker-owned allowlisted kind and cannot provide executable argv in policy. A `review` relationship emits an owned, non-blocking semantic warning with a reason and never invokes `$docs-audit` automatically.
- Adapter configuration is offline. A check operation reports drift and the separate repair command; it never regenerates content during validation. Generator-owned frontmatter must agree with the adapter output, owner, entrypoint, regeneration command, and exact non-writing check.
- Controlled contract tests return a structured result: assertion-only mismatches are repository violations, while syntax/import/runner failures are tool failures. Source/config consumers of forbidden live paths are detected in code literals and template fragments, structured mapping keys/values, package/OpenSpec configuration, `.env*`, Dockerfiles, TOML, and repository scripts; checker self-tests, governance negative fixtures, comments, and active OpenSpec migration evidence are excluded.

## Authoring flow

1. Choose the nearest template and place the new file only in an allowed owner area.
2. Replace every angle-bracket value and select the correct `document.type`.
3. Point `authority` at one normalized subject and authority kind; link to a higher owner instead of restating it.
4. Record exact evidence paths and non-writing verification.
5. Add or change policy only for a real structural, navigation, or source-relationship contract. Do not add an instance row just to make one file pass.
6. Run `npm run docs:check` and the owning source or runtime tests.
