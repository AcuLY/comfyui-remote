import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "observability"
    / "agent_file_access_hook.py"
)
SPEC = importlib.util.spec_from_file_location("agent_file_access_hook", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
agent_file_access_hook = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(agent_file_access_hook)


class AgentFileAccessHookTest(unittest.TestCase):
    def test_all_repository_paths_are_coarse_access_attempts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            docs = root / "docs"
            docs.mkdir()
            (docs / "guide.md").write_text("guide\n", encoding="utf-8")

            event = agent_file_access_hook.build_event(
                {
                    "session_id": "private-session-id",
                    "cwd": str(root),
                    "tool_name": "Bash",
                    "tool_input": {
                        "command": "Get-Content docs/guide.md; rg guide docs"
                    },
                },
                root,
            )

            self.assertIsNotNone(event)
            assert event is not None
            self.assertEqual(
                event["paths"],
                [
                    {"path": "docs/guide.md", "match_kind": "file"},
                    {"path": "docs", "match_kind": "directory"},
                ],
            )
            self.assertNotIn("operation", event)
            self.assertNotIn("tool_name", event)
            self.assertNotIn("tool_input", event)
            self.assertNotIn("command", event)
            self.assertNotIn("private-session-id", json.dumps(event))

    def test_duplicate_path_in_one_tool_call_is_counted_once(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            docs = root / "docs"
            docs.mkdir()
            (docs / "guide.md").write_text("guide\n", encoding="utf-8")

            event = agent_file_access_hook.build_event(
                {
                    "session_id": "session-1",
                    "cwd": str(root),
                    "tool_name": "Bash",
                    "tool_input": {
                        "command": "cat docs/guide.md docs/guide.md"
                    },
                },
                root,
            )

            self.assertIsNotNone(event)
            assert event is not None
            self.assertEqual(
                event["paths"],
                [{"path": "docs/guide.md", "match_kind": "file"}],
            )

    def test_direct_repository_executable_is_counted(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            scripts = root / "scripts"
            scripts.mkdir()
            (scripts / "check.sh").write_text("#!/bin/sh\n", encoding="utf-8")

            event = agent_file_access_hook.build_event(
                {
                    "session_id": "session-executable",
                    "cwd": str(root),
                    "tool_name": "Bash",
                    "tool_input": {"command": "./scripts/check.sh"},
                },
                root,
            )

            self.assertIsNotNone(event)
            assert event is not None
            self.assertEqual(
                event["paths"],
                [{"path": "scripts/check.sh", "match_kind": "file"}],
            )

    @unittest.skipUnless(os.name == "nt", "Windows path syntax")
    def test_direct_windows_repository_executable_is_counted(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            scripts = root / "scripts"
            scripts.mkdir()
            (scripts / "check.ps1").write_text("exit 0\n", encoding="utf-8")

            event = agent_file_access_hook.build_event(
                {
                    "session_id": "session-windows-executable",
                    "cwd": str(root),
                    "tool_name": "Bash",
                    "tool_input": {"command": ".\\scripts\\check.ps1"},
                },
                root,
            )

            self.assertIsNotNone(event)
            assert event is not None
            self.assertEqual(
                event["paths"],
                [{"path": "scripts/check.ps1", "match_kind": "file"}],
            )

    def test_planned_apply_patch_path_is_also_an_access_attempt(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "docs").mkdir()

            event = agent_file_access_hook.build_event(
                {
                    "session_id": "session-2",
                    "cwd": str(root),
                    "tool_name": "apply_patch",
                    "tool_input": {
                        "command": (
                            "*** Begin Patch\n"
                            "*** Add File: docs/new.md\n"
                            "+new\n"
                            "*** End Patch"
                        )
                    },
                },
                root,
            )

            self.assertIsNotNone(event)
            assert event is not None
            self.assertEqual(
                event["paths"],
                [{"path": "docs/new.md", "match_kind": "planned-file"}],
            )

    def test_repository_external_paths_are_not_recorded(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "repo"
            root.mkdir()
            external = Path(temp_dir) / "outside.txt"
            external.write_text("outside\n", encoding="utf-8")

            event = agent_file_access_hook.build_event(
                {
                    "session_id": "session-3",
                    "cwd": str(root),
                    "tool_name": "Bash",
                    "tool_input": {"command": f'cat "{external}"'},
                },
                root,
            )

            self.assertIsNone(event)

    def test_record_appends_raw_event_and_refreshes_atomic_metrics(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            log_path = root / "logs" / "agent-file-access.ndjson"
            metrics_path = root / "metrics" / "agent-file-access.json"
            first_event = {
                "schema_version": 1,
                "occurred_at": "2026-07-11T00:00:00+00:00",
                "session_hash": "session-a",
                "signal": "pretooluse_path_match",
                "paths": [
                    {"path": "docs/guide.md", "match_kind": "file"},
                    {"path": "docs", "match_kind": "directory"},
                ],
            }
            second_event = {
                **first_event,
                "session_hash": "session-b",
                "paths": [{"path": "docs/guide.md", "match_kind": "file"}],
            }

            with mock.patch.object(
                agent_file_access_hook.os,
                "replace",
                wraps=agent_file_access_hook.os.replace,
            ) as atomic_replace:
                agent_file_access_hook.record_event(
                    log_path, metrics_path, first_event
                )
                agent_file_access_hook.record_event(
                    log_path, metrics_path, second_event
                )

            self.assertEqual(atomic_replace.call_count, 2)

            lines = log_path.read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(lines), 2)
            self.assertEqual(json.loads(lines[0]), first_event)
            self.assertEqual(
                json.loads(metrics_path.read_text(encoding="utf-8")),
                {
                    "schema_version": 1,
                    "events_total": 2,
                    "access_attempt_total": 3,
                    "paths": [
                        {"path": "docs", "access_attempt_total": 1},
                        {"path": "docs/guide.md", "access_attempt_total": 2},
                    ],
                },
            )
            self.assertEqual(list(metrics_path.parent.glob("*.tmp")), [])

    def test_cli_uses_repository_local_log_and_metrics_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            docs = root / "docs"
            docs.mkdir()
            (docs / "guide.md").write_text("guide\n", encoding="utf-8")
            payload = {
                "session_id": "session-cli",
                "cwd": str(root),
                "tool_name": "Bash",
                "tool_input": {"command": "cat docs/guide.md"},
            }

            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_PATH),
                    "record",
                    "--root",
                    str(root),
                ],
                input=json.dumps(payload),
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            log_path = root / "logs" / "agent-file-access.ndjson"
            metrics_path = root / "metrics" / "agent-file-access.json"
            self.assertTrue(log_path.exists())
            self.assertEqual(
                json.loads(metrics_path.read_text(encoding="utf-8"))["paths"],
                [{"path": "docs/guide.md", "access_attempt_total": 1}],
            )

    def test_cli_creates_no_runtime_files_without_a_path_match(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            payload = {
                "session_id": "session-no-match",
                "cwd": str(root),
                "tool_name": "Bash",
                "tool_input": {"command": "pwd"},
            }

            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_PATH),
                    "record",
                    "--root",
                    str(root),
                ],
                input=json.dumps(payload),
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse((root / "logs").exists())
            self.assertFalse((root / "metrics").exists())

    def test_project_hook_has_posix_and_windows_commands(self) -> None:
        hook_path = Path(__file__).resolve().parents[1] / ".codex" / "hooks.json"
        config = json.loads(hook_path.read_text(encoding="utf-8"))
        handler = config["hooks"]["PreToolUse"][0]["hooks"][0]

        self.assertEqual(config["hooks"]["PreToolUse"][0]["matcher"], "*")
        self.assertIn("python3 ", handler["command"])
        self.assertIn("python ", handler["commandWindows"])
        self.assertIn("scripts/observability/agent_file_access_hook.py", handler["command"])
        self.assertIn(
            "scripts/observability/agent_file_access_hook.py",
            handler["commandWindows"],
        )


if __name__ == "__main__":
    unittest.main()
