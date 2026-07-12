# OpenSpec workflow

OpenSpec is the only planning lifecycle for significant feature, architecture,
performance, and repository-policy changes in this repository. The CLI is pinned in
`package.json`; use the package scripts so local and CI runs use the same version.

## Native lifecycle

1. Inspect artifact readiness:

   ```powershell
   npm run openspec:status -- --change <change-id> --json
   ```

2. Read the upstream apply instructions and listed context files:

   ```powershell
   npm run openspec:instructions -- apply --change <change-id> --json
   ```

3. Implement the pending items in that change's `tasks.md`, mark progress there, and
   verify the behavior required by its specs and design. OpenSpec 1.5.0 has no separate
   CLI `apply` or `verify` command; those are agent workflows driven by `status` and
   `instructions apply`.

4. Strictly validate all active changes and living specs:

   ```powershell
   npm run openspec:validate
   ```

5. After implementation, verification, and explicit user acceptance, archive through
   the native command:

   ```powershell
   npm run openspec:archive -- <change-id> --yes
   ```

   Do not use `--skip-specs` or `--no-validate` for normal completion.

## Harness stage order

The harness is delivered serially: documentation governance, observability,
engineering standards, then final documentation and CI convergence. A later-stage
change may be drafted or applied only after the preceding stage has been verified and
accepted. The active parent change, `establish-agent-harness`, owns that ordering;
OpenSpec owns artifact dependencies and lifecycle state.

User authorization is recorded as concise evidence inside the relevant change. It is
not a second approval database, digest gate, or replacement for OpenSpec.
