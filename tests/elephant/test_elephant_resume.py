#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest


os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "lib" / "elephant" / "elephant_resume.py"
TRACE_SCRIPT = REPO_ROOT / "lib" / "elephant" / "elephant_traceability.py"
THREAD_ID = "019f6965-0a89-7052-95ec-bb1ea43fc8e6"
SECOND_THREAD_ID = "019f6b5c-a59b-74f1-9f66-51e64c06473e"


def receipt(revision: str, condition_body: str = "Keep every goal generic and source-bound.") -> str:
    return textwrap.dedent(
        f"""\
        # Elephant Check: Test objective

        Status: **PASS TO IMPLEMENTATION**

        Checked code revision: `{revision}`

        ## Findings and required conditions

        1. **EC-1 — General contract.** {condition_body}
        2. **EC-2 — Silent outcome.** Record no-delta outcomes without notifying Joel.

        ## Proof plan

        Run the tests.

        ## Handoff and stop rule

        Continue only while both conditions remain satisfied.
        """
    )


class ElephantResumeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.repo = base / "repo"
        self.state = base / "state"
        self.repo.mkdir()
        subprocess.run(["git", "init", "-q", str(self.repo)], check=True)
        subprocess.run(["git", "-C", str(self.repo), "config", "user.email", "test@example.com"], check=True)
        subprocess.run(["git", "-C", str(self.repo), "config", "user.name", "Test"], check=True)
        (self.repo / "base.txt").write_text("base\n")
        subprocess.run(["git", "-C", str(self.repo), "add", "base.txt"], check=True)
        subprocess.run(["git", "-C", str(self.repo), "commit", "-qm", "base fixture"], check=True)
        self.revision = subprocess.run(
            ["git", "-C", str(self.repo), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        (self.repo / "receipt.md").write_text(receipt(self.revision))
        subprocess.run(["git", "-C", str(self.repo), "add", "receipt.md"], check=True)
        subprocess.run(["git", "-C", str(self.repo), "commit", "-qm", "receipt fixture"], check=True)
        self.env = os.environ.copy()
        self.env["CODEX_THREAD_ID"] = THREAD_ID
        self.env["ELEPHANT_HOOK_STATE_DIR"] = str(self.state)

    def run_script(
        self,
        *args: str,
        payload: dict | None = None,
        include_thread_env: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        env = self.env.copy()
        if not include_thread_env:
            env.pop("CODEX_THREAD_ID", None)
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            cwd=self.repo,
            env=env,
            input=json.dumps(payload) if payload is not None else None,
            text=True,
            capture_output=True,
            check=False,
        )

    def activate(self) -> subprocess.CompletedProcess[str]:
        return self.run_script("activate", "--receipt", "receipt.md")

    def write_active_contract(self, *, passed: bool = False) -> None:
        digest = hashlib.sha256((self.repo / "receipt.md").read_bytes()).hexdigest()
        status = "pass" if passed else "pending"
        proof = ["receipt.md::verified"] if passed else ["pending:test"]
        trace = {
            "schema": 1,
            "receipt": "receipt.md",
            "receipt_sha256": digest,
            "overall_status": "pass" if passed else "in_progress",
            "conditions": [
                {
                    "id": condition_id,
                    "status": status,
                    "code": ["base.txt"],
                    "tests": ["receipt.md"],
                    "proof": proof,
                }
                for condition_id in ("EC-1", "EC-2")
            ],
        }
        (self.repo / "traceability.json").write_text(json.dumps(trace) + "\n")
        marker_dir = self.repo / ".codex"
        marker_dir.mkdir()
        marker = {
            "schema": 1,
            "active": True,
            "receipt": "receipt.md",
            "receipt_sha256": digest,
            "traceability": "traceability.json",
            "activated_at_commit": self.revision,
        }
        (marker_dir / "elephant-active.json").write_text(json.dumps(marker) + "\n")

    def run_traceability(self, *, structure_only: bool) -> subprocess.CompletedProcess[str]:
        args = [sys.executable, str(TRACE_SCRIPT), "verify"]
        if structure_only:
            args.append("--structure-only")
        return subprocess.run(
            args,
            cwd=self.repo,
            env=self.env,
            text=True,
            capture_output=True,
            check=False,
        )

    def hook(self, event: str, **extra: str) -> subprocess.CompletedProcess[str]:
        payload = {
            "hook_event_name": event,
            "cwd": str(self.repo),
            "transcript_path": str(self.repo / f"rollout-test-{THREAD_ID}.jsonl"),
            **extra,
        }
        return self.run_script("hook", payload=payload, include_thread_env=False)

    def test_resume_injects_bounded_verified_context(self) -> None:
        activated = self.activate()
        self.assertEqual(activated.returncode, 0, activated.stderr)
        result = self.hook("SessionStart", source="resume")
        response = json.loads(result.stdout)
        context = response["hookSpecificOutput"]["additionalContext"]
        self.assertTrue(response["continue"])
        self.assertIn("EC-1", context)
        self.assertIn("EC-2", context)
        self.assertLessEqual(len(context.encode()), 4096)

    def test_camel_case_session_id_is_accepted(self) -> None:
        self.assertEqual(self.activate().returncode, 0)
        payload = {
            "sessionId": THREAD_ID,
            "hook_event_name": "SessionStart",
            "cwd": str(self.repo),
            "source": "resume",
        }
        result = self.run_script("hook", payload=payload, include_thread_env=False)
        self.assertTrue(json.loads(result.stdout)["continue"])

    def test_stale_receipt_fails_closed(self) -> None:
        self.assertEqual(self.activate().returncode, 0)
        (self.repo / "receipt.md").write_text(receipt(self.revision, "Changed after activation."))
        result = self.hook("SessionStart", source="resume")
        response = json.loads(result.stdout)
        self.assertFalse(response["continue"])
        self.assertIn("stale", response["stopReason"])

    def test_fourth_compaction_within_window_opens_fuse(self) -> None:
        self.assertEqual(self.activate().returncode, 0)
        for index in range(3):
            armed = self.hook("PreCompact", turn_id=f"turn-{index}")
            self.assertEqual(armed.returncode, 0, armed.stderr)
            response = json.loads(self.hook("SessionStart", source="compact").stdout)
            self.assertTrue(response["continue"])
        armed = self.hook("PreCompact", turn_id="turn-3")
        self.assertEqual(armed.returncode, 0, armed.stderr)
        response = json.loads(self.hook("SessionStart", source="compact").stdout)
        self.assertFalse(response["continue"])
        self.assertIn("fuse opened", response["stopReason"])

    def test_duplicate_compact_session_start_is_suppressed(self) -> None:
        self.assertEqual(self.activate().returncode, 0)
        armed = self.hook("PreCompact", turn_id="turn-one")
        self.assertEqual(armed.returncode, 0, armed.stderr)
        first = self.hook("SessionStart", source="compact")
        self.assertTrue(json.loads(first.stdout)["continue"])
        for _ in range(3):
            duplicate = self.hook("SessionStart", source="compact")
            self.assertEqual(duplicate.returncode, 0, duplicate.stderr)
            self.assertEqual(duplicate.stdout, "")
        state_file = next(self.state.glob("*.json"))
        state = json.loads(state_file.read_text())
        self.assertEqual(len(state["recent_compactions"]), 1)

    def test_oversized_condition_is_rejected_at_activation(self) -> None:
        (self.repo / "receipt.md").write_text(receipt(self.revision, "x" * 500))
        result = self.activate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("character capsule limit", result.stderr)

    def test_symbolic_checked_revision_is_rejected(self) -> None:
        (self.repo / "receipt.md").write_text(receipt("HEAD"))
        result = self.activate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("immutable Git commit id", result.stderr)

    def test_no_active_capsule_is_noop(self) -> None:
        result = self.hook("SessionStart", source="resume")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")

    def test_subagent_receives_same_capsule(self) -> None:
        self.assertEqual(self.activate().returncode, 0)
        parent = json.loads(self.hook("SessionStart", source="resume").stdout)
        parent_context = parent["hookSpecificOutput"]["additionalContext"]
        for agent_type in ("default", "explorer"):
            result = self.hook("SubagentStart", agent_type=agent_type)
            response = json.loads(result.stdout)
            self.assertEqual(response["hookSpecificOutput"]["hookEventName"], "SubagentStart")
            self.assertEqual(response["hookSpecificOutput"]["additionalContext"], parent_context)

    def test_documented_subagent_start_payload_uses_parent_session(self) -> None:
        self.write_active_contract()
        common = {
            "session_id": THREAD_ID,
            "transcript_path": None,
            "cwd": str(self.repo),
            "model": "gpt-5.2",
            "permission_mode": "bypassPermissions",
        }
        parent_payload = {
            **common,
            "hook_event_name": "SessionStart",
            "source": "startup",
        }
        parent = self.run_script("hook", payload=parent_payload, include_thread_env=False)
        parent_response = json.loads(parent.stdout)
        subagent_payload = {
            **common,
            "hook_event_name": "SubagentStart",
            "turn_id": "turn-test",
            "agent_id": "agent-test",
            "agent_type": "default",
        }
        subagent = self.run_script("hook", payload=subagent_payload, include_thread_env=False)
        subagent_response = json.loads(subagent.stdout)
        self.assertTrue(subagent_response["continue"])
        self.assertEqual(
            subagent_response["hookSpecificOutput"]["additionalContext"],
            parent_response["hookSpecificOutput"]["additionalContext"],
        )

    def test_invalid_subagent_receives_blocking_context(self) -> None:
        self.assertEqual(self.activate().returncode, 0)
        (self.repo / "receipt.md").write_text(receipt(self.revision, "Changed after activation."))
        response = json.loads(self.hook("SubagentStart", agent_type="default").stdout)
        context = response["hookSpecificOutput"]["additionalContext"]
        self.assertTrue(response["continue"])
        self.assertIn("Elephant resume blocked", response["systemMessage"])
        self.assertIn("ELEPHANT SUBAGENT BLOCKED", context)
        self.assertIn("Do not inspect files, edit, test, invoke tools", context)
        self.assertIn("Return BLOCKED to the parent", context)

    def test_show_revalidates_before_delegation(self) -> None:
        self.assertEqual(self.activate().returncode, 0)
        current = self.run_script("show")
        self.assertEqual(current.returncode, 0, current.stderr)
        self.assertIn("ELEPHANT RESUME CAPSULE", current.stdout)
        (self.repo / "receipt.md").write_text(receipt(self.revision, "Changed after activation."))
        stale = self.run_script("show")
        self.assertNotEqual(stale.returncode, 0)
        self.assertIn("stale", stale.stderr)

    def test_active_marker_auto_loads_without_manual_activation(self) -> None:
        self.write_active_contract()
        response = json.loads(self.hook("SessionStart", source="startup").stdout)
        context = response["hookSpecificOutput"]["additionalContext"]
        self.assertTrue(response["continue"])
        self.assertIn("Traceability: in_progress (0/2 EC conditions pass)", context)

    def test_deleted_session_state_is_rebuilt_from_active_marker(self) -> None:
        self.write_active_contract()
        first = json.loads(self.hook("SessionStart", source="startup").stdout)
        self.assertTrue(first["continue"])
        state_file = next(self.state.glob("*.json"))
        state_file.unlink()
        resumed = json.loads(self.hook("SessionStart", source="resume").stdout)
        self.assertTrue(resumed["continue"])
        self.assertTrue(state_file.exists())

    def test_missing_active_receipt_fails_closed(self) -> None:
        self.write_active_contract()
        (self.repo / "receipt.md").unlink()
        response = json.loads(self.hook("SessionStart", source="startup").stdout)
        self.assertFalse(response["continue"])
        self.assertIn("Elephant", response["stopReason"])

    def test_missing_tracked_marker_and_state_fails_closed(self) -> None:
        self.write_active_contract()
        subprocess.run(
            ["git", "-C", str(self.repo), "add", ".codex/elephant-active.json"],
            check=True,
        )
        subprocess.run(["git", "-C", str(self.repo), "commit", "-qm", "active marker"], check=True)
        first = json.loads(self.hook("SessionStart", source="startup").stdout)
        self.assertTrue(first["continue"])
        next(self.state.glob("*.json")).unlink()
        (self.repo / ".codex" / "elephant-active.json").unlink()
        response = json.loads(self.hook("SessionStart", source="resume").stdout)
        self.assertFalse(response["continue"])
        self.assertIn("tracked active Elephant marker is missing", response["stopReason"])

    def test_changed_receipt_and_deleted_state_fails_closed(self) -> None:
        self.write_active_contract()
        first = json.loads(self.hook("SessionStart", source="startup").stdout)
        self.assertTrue(first["continue"])
        next(self.state.glob("*.json")).unlink()
        (self.repo / "receipt.md").write_text(receipt(self.revision, "Changed after state loss."))
        response = json.loads(self.hook("SessionStart", source="resume").stdout)
        self.assertFalse(response["continue"])
        self.assertIn("stale receipt fingerprint", response["stopReason"])

    def test_changed_traceability_fails_existing_capsule(self) -> None:
        self.write_active_contract()
        first = json.loads(self.hook("SessionStart", source="startup").stdout)
        self.assertTrue(first["continue"])
        trace_path = self.repo / "traceability.json"
        trace = json.loads(trace_path.read_text())
        trace["conditions"][0]["proof"] = ["pending:changed"]
        trace_path.write_text(json.dumps(trace) + "\n")
        response = json.loads(self.hook("SessionStart", source="resume").stdout)
        self.assertFalse(response["continue"])
        self.assertIn("traceability map changed", response["stopReason"])

    def test_intentional_traceability_change_can_be_explicitly_refreshed(self) -> None:
        self.write_active_contract()
        first = json.loads(self.hook("SessionStart", source="startup").stdout)
        self.assertTrue(first["continue"])
        trace_path = self.repo / "traceability.json"
        trace = json.loads(trace_path.read_text())
        trace["conditions"][0]["proof"] = ["pending:intentional-change"]
        trace_path.write_text(json.dumps(trace) + "\n")
        stale = json.loads(self.hook("PreCompact").stdout)
        self.assertFalse(stale["continue"])
        self.assertIn("traceability map changed", stale["stopReason"])

        refreshed = self.run_script(
            "refresh",
            "--session-id",
            THREAD_ID,
            "--accept-current-contract",
            include_thread_env=False,
        )
        self.assertEqual(refreshed.returncode, 0, refreshed.stderr)
        self.assertIn("Elephant resume refreshed", refreshed.stdout)
        armed = self.hook("PreCompact", turn_id="turn-after-refresh")
        self.assertEqual(armed.returncode, 0, armed.stderr)
        self.assertEqual(armed.stdout, "")
        compacted = json.loads(self.hook("SessionStart", source="compact").stdout)
        self.assertTrue(compacted["continue"])
        self.assertIn("ELEPHANT RESUME CAPSULE", compacted["hookSpecificOutput"]["additionalContext"])

    def test_changed_contract_stop_includes_external_recovery_commands(self) -> None:
        self.write_active_contract()
        self.assertTrue(json.loads(self.hook("SessionStart", source="startup").stdout)["continue"])
        trace_path = self.repo / "traceability.json"
        trace = json.loads(trace_path.read_text())
        trace["conditions"][0]["proof"] = ["pending:intentional-change"]
        trace_path.write_text(json.dumps(trace) + "\n")

        response = json.loads(self.hook("PreCompact").stdout)
        warning = response["systemMessage"]
        self.assertFalse(response["continue"])
        self.assertIn("Stored Elephant receipt: receipt.md", warning)
        self.assertIn(f"elephant-resume status --session-id {THREAD_ID}", warning)
        self.assertIn(
            f"elephant-resume refresh --session-id {THREAD_ID} --accept-current-contract",
            warning,
        )
        self.assertIn("do not refresh blindly", warning)

    def test_external_refresh_requires_explicit_contract_acceptance(self) -> None:
        self.write_active_contract()
        result = self.run_script(
            "refresh",
            "--session-id",
            THREAD_ID,
            include_thread_env=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("requires --accept-current-contract", result.stderr)
        self.assertFalse(self.state.exists())

    def test_explicit_session_id_overrides_caller_environment(self) -> None:
        self.write_active_contract()
        refreshed = self.run_script(
            "refresh",
            "--session-id",
            SECOND_THREAD_ID,
            "--accept-current-contract",
        )
        self.assertEqual(refreshed.returncode, 0, refreshed.stderr)
        second_digest = hashlib.sha256(SECOND_THREAD_ID.encode()).hexdigest()
        first_digest = hashlib.sha256(THREAD_ID.encode()).hexdigest()
        self.assertTrue((self.state / f"{second_digest}.json").exists())
        self.assertFalse((self.state / f"{first_digest}.json").exists())

    def test_status_compares_stored_and_current_traceability(self) -> None:
        self.write_active_contract()
        self.assertTrue(json.loads(self.hook("SessionStart", source="startup").stdout)["continue"])
        trace_path = self.repo / "traceability.json"
        trace = json.loads(trace_path.read_text())
        trace["conditions"][0]["status"] = "pass"
        trace["conditions"][0]["proof"] = ["receipt.md::verified"]
        trace_path.write_text(json.dumps(trace) + "\n")

        result = self.run_script(
            "status",
            "--session-id",
            THREAD_ID,
            include_thread_env=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("receipt=receipt.md", result.stdout)
        self.assertIn("current_traceability=in_progress passed=1/2", result.stdout)
        self.assertIn("stored_traceability=in_progress passed=0/2", result.stdout)
        self.assertIn("capsule=stale", result.stdout)

    def test_status_reports_fresh_after_external_refresh(self) -> None:
        self.write_active_contract()
        refreshed = self.run_script(
            "refresh",
            "--session-id",
            THREAD_ID,
            "--accept-current-contract",
            include_thread_env=False,
        )
        self.assertEqual(refreshed.returncode, 0, refreshed.stderr)
        result = self.run_script(
            "status",
            "--session-id",
            THREAD_ID,
            include_thread_env=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("marker=active", result.stdout)
        self.assertIn("capsule=fresh", result.stdout)

    def test_structure_only_accepts_pending_and_strict_rejects_it(self) -> None:
        self.write_active_contract()
        structural = self.run_traceability(structure_only=True)
        strict = self.run_traceability(structure_only=False)
        self.assertEqual(structural.returncode, 0, structural.stderr)
        self.assertIn("passed=0/2", structural.stdout)
        self.assertNotEqual(strict.returncode, 0)
        self.assertIn("not complete", strict.stderr)

    def test_strict_traceability_accepts_all_pass(self) -> None:
        self.write_active_contract(passed=True)
        result = self.run_traceability(structure_only=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("traceability=pass passed=2/2", result.stdout)

    def test_pass_proof_requires_existing_file_anchor(self) -> None:
        self.write_active_contract(passed=True)
        trace_path = self.repo / "traceability.json"
        trace = json.loads(trace_path.read_text())
        trace["conditions"][0]["proof"] = ["browser 21/21 desktop/mobile"]
        trace_path.write_text(json.dumps(trace) + "\n")

        result = self.run_traceability(structure_only=False)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "EC-1.proof must start with an existing repo-relative file before optional ::note",
            result.stderr,
        )
        self.assertNotIn("[Errno", result.stderr)

    def test_pass_proof_accepts_slash_rich_note_after_file_anchor(self) -> None:
        self.write_active_contract(passed=True)
        trace_path = self.repo / "traceability.json"
        trace = json.loads(trace_path.read_text())
        trace["conditions"][0]["proof"] = [
            "receipt.md::browser 21/21 desktop/mobile"
        ]
        trace_path.write_text(json.dumps(trace) + "\n")

        result = self.run_traceability(structure_only=False)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("traceability=pass passed=2/2", result.stdout)


if __name__ == "__main__":
    unittest.main()
