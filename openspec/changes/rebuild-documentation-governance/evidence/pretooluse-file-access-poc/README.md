# PreToolUse repository-file-access spike

This is a non-production, non-normative spike preserved for continuation. It proves that
a project-local Codex `PreToolUse` hook can heuristically recognize repository-local
paths and write offline events without a metrics service.

Stage ownership is resolved: this directory is input for the future
`build-agent-observability` design, not an implementation or acceptance artifact for
`rebuild-documentation-governance`. This preserved script is not the installed implementation.
After the Windows continuation, the user separately authorized the simplified root successor
at `scripts/observability/agent_file_access_hook.py`; it is an out-of-child local experiment,
not adoption of this evidence copy. The sample aggregate field `access_total` is a legacy
prototype name and means only an attempted PreToolUse repository-path match; it does not
prove tool success, a filesystem read, or model comprehension.

## Contents

- `file_access_hook.py`: path matcher, NDJSON writer, and offline JSON aggregator.
- `test_file_access_hook.py`: seven standard-library unit/integration tests.
- `hooks.example.json`: the project-local hook shape used in the isolated test.
- `fixture/`: sanitized initial files used by the real isolated Codex run.
- `sample/file-access.ndjson`: sanitized successful events.
- `sample/file-access-stats.json`: sanitized aggregate output.

The original ignored proof repository, its nested `.git/**`, real event log, Python
cache, mutated `notes.txt`, and machine-level project-trust entry are intentionally not
preserved. They contain local identity/runtime state or can create misleading active
configuration.

## Verification

From this directory:

```bash
python3 -m unittest -v test_file_access_hook.py
python3 file_access_hook.py aggregate \
  --log sample/file-access.ndjson \
  --stats /tmp/file-access-stats.json
```

The hook command in `hooks.example.json` assumes the script is copied to the test
repository root. It is preserved as the exact tested shape, not an installation
instruction for the real repository.

Do not commit real `logs/**` or `stats/**`. The examples are sanitized evidence only.

## Tested environments

The original successful spike used:

- macOS/Darwin on arm64;
- Python 3.14.0; the script requires Python 3.11 or newer because it imports
  `datetime.UTC`;
- Git 2.52.0;
- `codex-cli 0.142.5`;
- a model available to the original account at the time of the run.

A Windows continuation on 2026-07-11 used Windows 11, Python 3.11.9, and
`codex-cli 0.142.2`, whose local feature catalog reports hooks as stable. The test ran
two new ephemeral Codex tasks from this already trusted repository with a temporary
project `.codex/hooks.json`; the file was deleted immediately afterward, the real NDJSON
log stayed outside the repository and was deleted after the assertions, and no hook was
installed persistently.

The temporary handler set its POSIX `command` to `exit 91` and supplied the Python
recorder only through `commandWindows`. A `cat` command produced one
`Bash/read/<fixture guide path>` event, proving that the project hook loaded and that the
Windows override ran. Native PowerShell `Get-Content -LiteralPath` produced a second
event for the same repository-relative file, but the current classifier labeled it
`access`, not `read`. Windows path detection is therefore feasible, while PowerShell
operation classification remains incomplete. Windows multi-process append/concurrency
behavior was not tested.

The later observability change must also define and test rotation/retention, malformed or
partial-line recovery, atomic aggregation, environment/repository/worktree/service/run
identity, storage ownership and collision checks, fail-closed cross-environment isolation,
privacy, teardown, and measured overhead before adopting any equivalent signal.

## Isolated end-to-end reconstruction

To reconstruct the fixture on another device, create a disposable Git repository,
copy `file_access_hook.py`, copy `hooks.example.json` to `.codex/hooks.json`, and copy
the contents of `fixture/` into its root. Commit those fixture files so Codex sees a
normal repository.

Project trust and hook trust are separate gates. Start Codex normally in the disposable
repository and approve that project's configuration through the current Codex trust
flow. Do not copy the original machine's `~/.codex/config.toml`. For the isolated proof
only, the original run then used `--dangerously-bypass-hook-trust`; that flag bypasses
hook hash review but does not enable an otherwise untrusted project config layer.

Run the command recorded in the session handoff with a model available on the new
account, then expect exactly three matched tool-call events: a `read` for
`docs/guide.md`, a `search` for directory `docs`, and a `write` for `notes.txt`.
Normalize timestamps and session hashes before comparing with `sample/**`.

This recipe is feasibility evidence, not a deterministic cross-platform acceptance
test. Model availability, Codex trust UX, and hook schemas can change. PowerShell command
classification, Windows concurrency, and a one-command normalized assertion remain open
work for the future observability change.
