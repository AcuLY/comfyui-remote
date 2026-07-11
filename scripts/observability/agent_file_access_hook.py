"""Record coarse repository-path matches from Codex PreToolUse hook payloads."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import sys
import tempfile
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
SIGNAL_NAME = "pretooluse_path_match"
DEFAULT_LOG_PATH = Path("logs/agent-file-access.ndjson")
DEFAULT_METRICS_PATH = Path("metrics/agent-file-access.json")


def _string_values(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [item for child in value.values() for item in _string_values(child)]
    if isinstance(value, list):
        return [item for child in value for item in _string_values(child)]
    return []


def _command_tokens(command: str) -> list[str]:
    try:
        tokens = shlex.split(command, posix=os.name != "nt")
    except ValueError:
        tokens = command.split()
    return [token.strip("\"'`;|&") for token in tokens if token.strip("\"'`;|&")]


def build_event(payload: dict[str, Any], root: Path) -> dict[str, Any] | None:
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return None

    command = tool_input.get("command")
    tokens = _command_tokens(command) if isinstance(command, str) else []
    candidates = list(tokens)
    candidates.extend(
        value for value in _string_values(tool_input) if value != command
    )

    resolved_root = root.resolve()
    cwd = Path(str(payload.get("cwd", resolved_root))).resolve()
    matches: list[dict[str, str]] = []
    seen: set[str] = set()

    def add_candidate(raw_candidate: str, *, allow_missing: bool = False) -> None:
        token = raw_candidate.strip().strip("\"'`;|&")
        if not token or token.startswith("-"):
            return
        candidate = Path(token)
        if not candidate.is_absolute():
            candidate = cwd / candidate
        try:
            resolved = candidate.resolve()
            relative = resolved.relative_to(resolved_root)
        except (OSError, ValueError):
            return
        if not resolved.exists() and not allow_missing:
            return

        relative_text = relative.as_posix()
        if relative_text in seen:
            return
        seen.add(relative_text)
        matches.append(
            {
                "path": relative_text,
                "match_kind": (
                    "directory"
                    if resolved.is_dir()
                    else "file"
                    if resolved.exists()
                    else "planned-file"
                ),
            }
        )

    tool_name = str(payload.get("tool_name", ""))
    if tool_name == "apply_patch" and isinstance(command, str):
        for planned_path in re.findall(
            r"^\*\*\* (?:Add|Update|Delete) File: (.+)$",
            command,
            flags=re.MULTILINE,
        ):
            add_candidate(planned_path, allow_missing=True)

    for candidate in candidates:
        add_candidate(candidate)

    if not matches:
        return None

    session_id = str(payload.get("session_id", ""))
    session_hash = (
        hashlib.sha256(session_id.encode("utf-8")).hexdigest()[:16]
        if session_id
        else "unknown"
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "occurred_at": datetime.now(UTC).isoformat(),
        "session_hash": session_hash,
        "signal": SIGNAL_NAME,
        "paths": matches,
    }


def append_event(log_path: Path, event: dict[str, Any]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (
        json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n"
    ).encode("utf-8")
    descriptor = os.open(log_path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o600)
    try:
        os.write(descriptor, encoded)
    finally:
        os.close(descriptor)


def aggregate_events(log_path: Path) -> dict[str, Any]:
    events_total = 0
    path_counts: Counter[str] = Counter()
    if log_path.exists():
        for line in log_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            events_total += 1
            for match in event.get("paths", []):
                path = match.get("path") if isinstance(match, dict) else None
                if isinstance(path, str):
                    path_counts[path] += 1

    return {
        "schema_version": SCHEMA_VERSION,
        "events_total": events_total,
        "access_attempt_total": sum(path_counts.values()),
        "paths": [
            {"path": path, "access_attempt_total": path_counts[path]}
            for path in sorted(path_counts)
        ],
    }


def write_metrics(metrics_path: Path, metrics: dict[str, Any]) -> None:
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=metrics_path.parent,
        prefix=f".{metrics_path.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(metrics, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary_path, metrics_path)
    finally:
        temporary_path.unlink(missing_ok=True)


def record_event(
    log_path: Path,
    metrics_path: Path,
    event: dict[str, Any],
) -> None:
    append_event(log_path, event)
    write_metrics(metrics_path, aggregate_events(log_path))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Record coarse repository path matches from Codex PreToolUse."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    record_parser = subparsers.add_parser("record")
    record_parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()

    try:
        payload = json.load(sys.stdin)
        root = args.root.resolve()
        event = build_event(payload, root)
        if event is not None:
            record_event(
                root / DEFAULT_LOG_PATH,
                root / DEFAULT_METRICS_PATH,
                event,
            )
    except (json.JSONDecodeError, OSError, ValueError):
        # Observability must not block the tool call it is observing.
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
