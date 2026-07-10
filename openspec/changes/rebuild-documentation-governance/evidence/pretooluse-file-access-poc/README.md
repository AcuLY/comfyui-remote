# PreToolUse repository-file-access spike

This is a non-production, non-normative spike preserved for continuation. It proves that
a project-local Codex `PreToolUse` hook can heuristically recognize repository-local
paths and write offline events without a metrics service.

## Contents

- `file_access_hook.py`: path matcher, NDJSON writer, and offline JSON aggregator.
- `test_file_access_hook.py`: seven standard-library unit/integration tests.
- `hooks.example.json`: the project-local hook shape used in the isolated test.
- `sample/file-access.ndjson`: sanitized successful events.
- `sample/file-access-stats.json`: sanitized aggregate output.

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
