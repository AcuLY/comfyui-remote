import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import file_access_hook
from file_access_hook import build_event


class FileAccessHookTest(unittest.TestCase):
    def test_shell_read_records_repo_relative_file_without_raw_input(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            docs = root / "docs"
            docs.mkdir()
            (docs / "guide.md").write_text("guide\n", encoding="utf-8")
            event = build_event(
                {
                    "session_id": "session-1",
                    "turn_id": "turn-1",
                    "cwd": str(root),
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Bash",
                    "tool_input": {"command": "sed -n '1,20p' docs/guide.md"},
                },
                root,
            )
            self.assertIsNotNone(event)
            self.assertEqual(event["operation"], "read")
            self.assertEqual(
                event["paths"],
                [{"path": "docs/guide.md", "match_kind": "file"}],
            )
            self.assertNotIn("tool_input", event)
            self.assertNotIn("command", event)

    def test_shell_search_records_directory_scope_as_search(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "docs").mkdir()
            event = build_event(
                {
                    "session_id": "session-1",
                    "cwd": str(root),
                    "tool_name": "Bash",
                    "tool_input": {"command": "rg -n alpha docs"},
                },
                root,
            )
            self.assertIsNotNone(event)
            self.assertEqual(event["operation"], "search")
            self.assertEqual(
                event["paths"],
                [{"path": "docs", "match_kind": "directory"}],
            )

    def test_apply_patch_records_changed_repo_file_as_write(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            docs = root / "docs"
            docs.mkdir()
            (docs / "guide.md").write_text("before\n", encoding="utf-8")
            event = build_event(
                {
                    "session_id": "session-2",
                    "cwd": str(root),
                    "tool_name": "apply_patch",
                    "tool_input": {
                        "command": "*** Begin Patch\n*** Update File: docs/guide.md\n@@\n-before\n+after\n*** End Patch"
                    },
                },
                root,
            )
            self.assertIsNotNone(event)
            self.assertEqual(event["operation"], "write")
            self.assertEqual(
                event["paths"],
                [{"path": "docs/guide.md", "match_kind": "file"}],
            )

    def test_mcp_read_records_structured_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            docs = root / "docs"
            docs.mkdir()
            guide = docs / "guide.md"
            guide.write_text("guide\n", encoding="utf-8")
            event = build_event(
                {
                    "session_id": "session-3",
                    "cwd": str(root),
                    "tool_name": "mcp__filesystem__read_file",
                    "tool_input": {"path": str(guide), "offset": 1},
                },
                root,
            )
            self.assertIsNotNone(event)
            self.assertEqual(event["operation"], "read")
            self.assertEqual(
                event["paths"],
                [{"path": "docs/guide.md", "match_kind": "file"}],
            )

    def test_apply_patch_records_new_repo_path_before_it_exists(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "docs").mkdir()
            event = build_event(
                {
                    "session_id": "session-4",
                    "cwd": str(root),
                    "tool_name": "apply_patch",
                    "tool_input": {
                        "command": "*** Begin Patch\n*** Add File: docs/new.md\n+new\n*** End Patch"
                    },
                },
                root,
            )
            self.assertIsNotNone(event)
            self.assertEqual(event["operation"], "write")
            self.assertEqual(
                event["paths"],
                [{"path": "docs/new.md", "match_kind": "planned-file"}],
            )

    def test_events_are_appended_and_aggregated_without_a_service(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "logs" / "file-access.ndjson"
            base_event = {
                "schema_version": 1,
                "occurred_at": "2026-07-10T00:00:00+00:00",
                "session_hash": "session-a",
                "coverage_class": "pretooluse-heuristic",
                "paths": [{"path": "docs/guide.md", "match_kind": "file"}],
            }
            file_access_hook.append_event(
                log_path,
                {**base_event, "tool_name": "Bash", "operation": "read"},
            )
            file_access_hook.append_event(
                log_path,
                {
                    **base_event,
                    "session_hash": "session-b",
                    "tool_name": "apply_patch",
                    "operation": "write",
                },
            )
            stats = file_access_hook.aggregate_events(log_path)
            self.assertEqual(stats["events_total"], 2)
            self.assertEqual(
                stats["paths"],
                [
                    {
                        "path": "docs/guide.md",
                        "access_total": 2,
                        "sessions_total": 2,
                        "operations": {"read": 1, "write": 1},
                        "tools": {"Bash": 1, "apply_patch": 1},
                    }
                ],
            )

    def test_cli_records_hook_stdin_and_generates_offline_stats(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            docs = root / "docs"
            docs.mkdir()
            (docs / "guide.md").write_text("guide\n", encoding="utf-8")
            log_path = root / "logs" / "file-access.ndjson"
            stats_path = root / "stats" / "file-access.json"
            script = Path(__file__).with_name("file_access_hook.py")
            payload = {
                "session_id": "session-cli",
                "cwd": str(root),
                "tool_name": "Bash",
                "tool_input": {"command": "cat docs/guide.md"},
            }
            record = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "record",
                    "--root",
                    str(root),
                    "--log",
                    str(log_path),
                ],
                input=json.dumps(payload),
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(record.returncode, 0, record.stderr)
            self.assertTrue(log_path.exists())
            aggregate = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "aggregate",
                    "--log",
                    str(log_path),
                    "--stats",
                    str(stats_path),
                ],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(aggregate.returncode, 0, aggregate.stderr)
            self.assertEqual(
                json.loads(stats_path.read_text(encoding="utf-8"))["paths"][0]["path"],
                "docs/guide.md",
            )


if __name__ == "__main__":
    unittest.main()
