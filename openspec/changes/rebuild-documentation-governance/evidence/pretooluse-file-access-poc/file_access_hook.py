import argparse
import hashlib
import json
import os
import re
import shlex
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def _string_values(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [item for child in value.values() for item in _string_values(child)]
    if isinstance(value, list):
        return [item for child in value for item in _string_values(child)]
    return []


def build_event(payload: dict[str, Any], root: Path) -> dict[str, Any] | None:
    tool_name = str(payload.get("tool_name", "unknown"))
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return None

    command = tool_input.get("command")
    tokens: list[str] = []
    if isinstance(command, str):
        try:
            tokens.extend(shlex.split(command))
        except ValueError:
            tokens.extend(command.split())
    for value in _string_values(tool_input):
        if value != command:
            tokens.append(value)

    resolved_root = root.resolve()
    cwd = Path(str(payload.get("cwd", root))).resolve()
    matches: list[dict[str, str]] = []
    seen: set[str] = set()

    def add_candidate(token: str, *, allow_missing: bool = False) -> None:
        if token.startswith("-"):
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

    if tool_name == "apply_patch" and isinstance(command, str):
        for planned_path in re.findall(
            r"^\*\*\* (?:Add|Update|Delete) File: (.+)$",
            command,
            flags=re.MULTILINE,
        ):
            add_candidate(planned_path.strip(), allow_missing=True)

    shell_tokens = tokens[1:] if isinstance(command, str) else tokens
    for token in shell_tokens:
        add_candidate(token)

    if not matches:
        return None

    executable = Path(tokens[0]).name if isinstance(command, str) and tokens else ""
    if tool_name == "apply_patch":
        operation = "write"
    elif tool_name.startswith("mcp__") and "read" in tool_name:
        operation = "read"
    elif executable in {"cat", "sed", "head", "tail", "less", "bat"}:
        operation = "read"
    elif executable in {"rg", "grep", "find", "fd", "ls"}:
        operation = "search"
    else:
        operation = "access"
    session_id = str(payload.get("session_id", ""))
    session_hash = hashlib.sha256(session_id.encode("utf-8")).hexdigest()[:16]
    return {
        "schema_version": 1,
        "occurred_at": datetime.now(UTC).isoformat(),
        "session_hash": session_hash,
        "tool_name": tool_name,
        "operation": operation,
        "paths": matches,
        "coverage_class": "pretooluse-heuristic",
    }


def append_event(log_path: Path, event: dict[str, Any]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
    descriptor = os.open(log_path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o600)
    try:
        os.write(descriptor, encoded)
    finally:
        os.close(descriptor)


def aggregate_events(log_path: Path) -> dict[str, Any]:
    events_total = 0
    operations: dict[str, Counter[str]] = defaultdict(Counter)
    tools: dict[str, Counter[str]] = defaultdict(Counter)
    sessions: dict[str, set[str]] = defaultdict(set)
    if log_path.exists():
        for line in log_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            event = json.loads(line)
            events_total += 1
            for match in event.get("paths", []):
                path = match.get("path")
                if not isinstance(path, str):
                    continue
                operations[path][str(event.get("operation", "unknown"))] += 1
                tools[path][str(event.get("tool_name", "unknown"))] += 1
                sessions[path].add(str(event.get("session_hash", "")))

    path_rows = []
    for path in sorted(operations):
        operation_counts = dict(sorted(operations[path].items()))
        tool_counts = dict(sorted(tools[path].items()))
        path_rows.append(
            {
                "path": path,
                "access_total": sum(operation_counts.values()),
                "sessions_total": len(sessions[path]),
                "operations": operation_counts,
                "tools": tool_counts,
            }
        )
    return {"schema_version": 1, "events_total": events_total, "paths": path_rows}


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    record_parser = subparsers.add_parser("record")
    record_parser.add_argument("--root", type=Path, required=True)
    record_parser.add_argument("--log", type=Path, required=True)

    aggregate_parser = subparsers.add_parser("aggregate")
    aggregate_parser.add_argument("--log", type=Path, required=True)
    aggregate_parser.add_argument("--stats", type=Path, required=True)

    args = parser.parse_args()
    if args.command == "record":
        payload = json.load(__import__("sys").stdin)
        event = build_event(payload, args.root)
        if event is not None:
            append_event(args.log, event)
        return 0

    stats = aggregate_events(args.log)
    args.stats.parent.mkdir(parents=True, exist_ok=True)
    args.stats.write_text(
        json.dumps(stats, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
