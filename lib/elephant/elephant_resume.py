#!/usr/bin/env python3
"""Restore a bounded, receipt-backed context capsule after Codex compaction.

The hook never reads a transcript or calls a model. An implementation session
must explicitly activate one Elephant Check receipt. The resulting session-
scoped capsule is a disposable projection; the checked-in receipt remains the
authority.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
from typing import Any

from elephant_contract import (
    CapsuleError,
    contained_file,
    git,
    parse_receipt,
    render_context,
)
from elephant_traceability import (
    TraceabilityError,
    attach_active_contract,
    load_active_marker,
    validate_traceability,
)


COMPACTION_WINDOW_SECONDS = 10 * 60
MAX_COMPACTIONS_PER_WINDOW = 3
CONTRACT_CHANGE_MESSAGES = (
    "changed after capsule creation",
    "active capsule is stale",
    "points to a different receipt",
)


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC).replace(microsecond=0)


def isoformat(value: dt.datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def state_root() -> Path:
    override = os.environ.get("ELEPHANT_HOOK_STATE_DIR")
    if override:
        return Path(override).expanduser().resolve()
    codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    return codex_home / "hook-state" / "elephant-resume"


def session_value(payload: dict[str, Any] | None = None) -> str:
    payload = payload or {}
    candidates = [
        payload.get("session_id"),
        payload.get("sessionId"),
        payload.get("thread_id"),
        payload.get("threadId"),
        os.environ.get("CODEX_THREAD_ID"),
        os.environ.get("CODEX_SESSION_ID"),
    ]
    value = next((str(item).strip() for item in candidates if item), "")
    if not value:
        transcript_path = str(payload.get("transcript_path") or payload.get("transcriptPath") or "")
        match = re.search(
            r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$",
            transcript_path,
            flags=re.IGNORECASE,
        )
        if match:
            value = match.group(1)
    if not value:
        raise CapsuleError("Codex session id is unavailable")
    if len(value) > 256 or not value.isprintable():
        raise CapsuleError("Codex session id is invalid")
    return value


def session_id(payload: dict[str, Any] | None = None) -> str:
    return hashlib.sha256(session_value(payload).encode()).hexdigest()


def state_path(payload: dict[str, Any] | None = None) -> Path:
    return state_root() / f"{session_id(payload)}.json"


def git_root(cwd: Path | None = None) -> Path:
    result = subprocess.run(
        ["git", "-C", str(cwd or Path.cwd()), "rev-parse", "--show-toplevel"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not result.stdout.strip():
        raise CapsuleError("current directory is not inside a Git worktree")
    return Path(result.stdout.strip()).resolve()


def capsule_from_active_marker(
    root: Path,
    active: tuple[dict[str, Any], str],
) -> dict[str, Any]:
    marker, _ = active
    receipt = contained_file(root, root / marker["receipt"])
    capsule = parse_receipt(root, receipt)
    capsule["root"] = str(root)
    capsule["activated_at"] = isoformat(utc_now())
    capsule["recent_compactions"] = []
    return attach_active_contract(root, capsule, active)


def save_state(capsule: dict[str, Any], hook_payload: dict[str, Any] | None = None) -> None:
    root = state_root()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = state_path(hook_payload)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(capsule, indent=2, sort_keys=True) + "\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def load_state(payload: dict[str, Any]) -> dict[str, Any] | None:
    path = state_path(payload)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise CapsuleError("active capsule state is unreadable") from exc
    if not isinstance(data, dict) or data.get("schema") != 1:
        raise CapsuleError("active capsule state has an unsupported schema")
    return data


def ensure_capsule(payload: dict[str, Any]) -> dict[str, Any] | None:
    payload_cwd = Path(str(payload.get("cwd") or Path.cwd())).resolve()
    root = git_root(payload_cwd)
    active = load_active_marker(root)
    capsule = load_state(payload)
    if capsule is None:
        if active is None:
            return None
        capsule = capsule_from_active_marker(root, active)
        render_context(capsule)
        save_state(capsule, payload)
        return capsule
    if active is not None and not capsule.get("required_by_active_marker"):
        capsule = capsule_from_active_marker(root, active)
        render_context(capsule)
        save_state(capsule, payload)
    return capsule


def validate(capsule: dict[str, Any], payload: dict[str, Any]) -> str:
    payload_cwd = Path(str(payload.get("cwd") or Path.cwd())).resolve()
    root = git_root(payload_cwd)
    expected_root = Path(str(capsule.get("root", ""))).resolve()
    if root != expected_root:
        raise CapsuleError("active capsule belongs to a different Git worktree")
    receipt = contained_file(root, root / str(capsule.get("receipt", "")))
    current = parse_receipt(root, receipt)
    for key in (
        "objective",
        "status",
        "checked_revision",
        "receipt",
        "receipt_sha256",
        "conditions",
        "next_action",
    ):
        if current[key] != capsule.get(key):
            raise CapsuleError(f"active capsule is stale: {key} changed")
    if git(root, "merge-base", "--is-ancestor", current["checked_revision"], "HEAD", check=False).returncode != 0:
        raise CapsuleError("checked revision is not an ancestor of the current HEAD")
    if capsule.get("required_by_active_marker"):
        active = load_active_marker(root)
        if active is None:
            raise CapsuleError("required active Elephant marker is missing")
        marker, marker_digest = active
        if marker_digest != capsule.get("active_marker_sha256"):
            raise CapsuleError("active Elephant marker changed after capsule creation")
        if marker["receipt"] != current["receipt"]:
            raise CapsuleError("active Elephant marker points to a different receipt")
        trace, trace_digest = validate_traceability(
            root,
            marker,
            current["receipt_sha256"],
            [item["id"] for item in current["conditions"]],
            strict=False,
        )
        if trace_digest != capsule.get("traceability_sha256"):
            raise CapsuleError("Elephant traceability map changed after capsule creation")
        if trace["_summary"] != capsule.get("traceability"):
            raise CapsuleError("Elephant traceability summary changed after capsule creation")
    return render_context(capsule)


def arm_compaction(capsule: dict[str, Any], payload: dict[str, Any]) -> None:
    capsule["pending_compaction"] = {
        "armed_at": isoformat(utc_now()),
        "turn_id": str(payload.get("turn_id") or ""),
    }


def consume_compaction(capsule: dict[str, Any]) -> bool:
    if capsule.pop("pending_compaction", None) is None:
        return False
    return True


def record_compaction(capsule: dict[str, Any]) -> None:
    now = utc_now()
    cutoff = now - dt.timedelta(seconds=COMPACTION_WINDOW_SECONDS)
    recent: list[dt.datetime] = []
    for value in capsule.get("recent_compactions", []):
        try:
            parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            continue
        if parsed >= cutoff:
            recent.append(parsed)
    if len(recent) >= MAX_COMPACTIONS_PER_WINDOW:
        raise CapsuleError(
            f"compaction fuse opened after {MAX_COMPACTIONS_PER_WINDOW} compactions "
            f"within {COMPACTION_WINDOW_SECONDS // 60} minutes"
        )
    recent.append(now)
    capsule["recent_compactions"] = [isoformat(value) for value in recent]


def activate(receipt_value: str) -> int:
    root = git_root()
    receipt = contained_file(root, receipt_value)
    capsule = parse_receipt(root, receipt)
    capsule["root"] = str(root)
    capsule["activated_at"] = isoformat(utc_now())
    capsule["recent_compactions"] = []
    capsule = attach_active_contract(root, capsule)
    render_context(capsule)
    save_state(capsule)
    print(f"Elephant resume active for {capsule['receipt']}")
    print(f"session_state={state_path()}")
    print(f"context_bytes={len(render_context(capsule).encode('utf-8'))}")
    return 0


def refresh(target_session_id: str, accept_current_contract: bool) -> int:
    if not accept_current_contract:
        raise CapsuleError(
            "refresh requires --accept-current-contract after reviewing the current "
            "marker, receipt, and traceability map"
        )
    payload = {"session_id": session_value({"session_id": target_session_id})}
    root = git_root()
    active = load_active_marker(root)
    if active is None:
        raise CapsuleError("no active Elephant marker exists")
    capsule = capsule_from_active_marker(root, active)
    context = render_context(capsule)
    save_state(capsule, payload)
    summary = capsule["traceability"]
    print(f"Elephant resume refreshed for {capsule['receipt']}")
    print(f"session_state={state_path(payload)}")
    print(
        f"traceability={summary['overall_status']} "
        f"passed={summary['passed']}/{summary['total']}"
    )
    print(f"context_bytes={len(context.encode('utf-8'))}")
    return 0


def deactivate() -> int:
    path = state_path()
    if path.exists():
        path.unlink()
        print(f"Elephant session projection cleared: {path}")
    else:
        print("Elephant session projection was not active for this session")
    return 0


def hook_response(event_name: str, context: str) -> dict[str, Any]:
    return {
        "continue": True,
        "hookSpecificOutput": {
            "hookEventName": event_name,
            "additionalContext": context,
        },
    }


def recovery_guidance(
    payload: dict[str, Any],
    capsule: dict[str, Any] | None,
    message: str,
) -> str:
    if capsule is None or not any(value in message for value in CONTRACT_CHANGE_MESSAGES):
        return ""
    try:
        target = shlex.quote(session_value(payload))
    except CapsuleError:
        return ""
    receipt = capsule.get("receipt", "unknown")
    return "\n".join(
        [
            f"Stored Elephant receipt: {receipt}",
            f"Inspect: elephant-resume status --session-id {target}",
            "After confirming the current contract changes are intentional, refresh:",
            f"elephant-resume refresh --session-id {target} --accept-current-contract",
            "Otherwise reconcile the tracked contract; do not refresh blindly.",
        ]
    )


def stopped_response(message: str, guidance: str = "") -> dict[str, Any]:
    warning = f"Elephant resume blocked: {message}"
    if guidance:
        warning = f"{warning}\n{guidance}"
    return {
        "continue": False,
        "stopReason": f"Elephant resume blocked: {message}",
        "systemMessage": warning,
    }


def stop_recovery_response(message: str, guidance: str) -> dict[str, Any]:
    reason = "\n".join(
        [
            f"Elephant detected contract drift before this turn could stop: {message}",
            guidance,
            "Inspect the marker, receipt, and traceability changes now, while this "
            "turn still has context.",
            "If they are intentional and belong to this task, run the exact refresh "
            "command above, then verify status reports capsule=fresh.",
            "If they are unexpected, reconcile the tracked contract instead. Never "
            "refresh merely to clear the warning.",
        ]
    )
    return {
        # Stop's block decision creates one continuation prompt. The follow-up
        # Stop payload sets stop_hook_active, so an unrepaired contract falls
        # back to the normal fail-closed response instead of looping.
        "decision": "block",
        "reason": reason,
    }


def blocked_subagent_response(message: str, guidance: str = "") -> dict[str, Any]:
    warning = f"Elephant resume blocked: {message}"
    if guidance:
        warning = f"{warning}\n{guidance}"
    context = "\n".join(
        [
            "ELEPHANT SUBAGENT BLOCKED (contract validation failed)",
            f"Reason: {message}",
            "Do not inspect files, edit, test, invoke tools, or perform the delegated task.",
            "Return BLOCKED to the parent and include the reason above.",
            "The parent must repair or refresh the Elephant contract before delegating again.",
        ]
    )
    return {
        # Codex does not stop SubagentStart when continue is false. Keep the hook
        # successful so the blocking developer context is delivered to the child.
        "continue": True,
        "systemMessage": warning,
        "hookSpecificOutput": {
            "hookEventName": "SubagentStart",
            "additionalContext": context,
        },
    }


def run_hook() -> int:
    payload: dict[str, Any] = {}
    capsule: dict[str, Any] | None = None
    try:
        loaded = json.load(sys.stdin)
        if not isinstance(loaded, dict):
            raise CapsuleError("hook input is not a JSON object")
        payload = loaded
        capsule = ensure_capsule(payload)
        if capsule is None:
            return 0

        event_name = str(payload.get("hook_event_name", ""))
        context = validate(capsule, payload)
        if event_name == "PreCompact":
            arm_compaction(capsule, payload)
            save_state(capsule, payload)
            return 0
        if event_name == "SessionStart":
            source = str(payload.get("source", ""))
            if source not in {"startup", "resume", "clear", "compact"}:
                return 0
            if source == "compact":
                if not consume_compaction(capsule):
                    return 0
                record_compaction(capsule)
                save_state(capsule, payload)
            print(json.dumps(hook_response("SessionStart", context)))
            return 0
        if event_name == "SubagentStart":
            print(json.dumps(hook_response("SubagentStart", context)))
            return 0
        return 0
    except (CapsuleError, TraceabilityError, json.JSONDecodeError, OSError) as exc:
        event_name = str(payload.get("hook_event_name", ""))
        if capsule is None:
            try:
                capsule = load_state(payload)
            except (CapsuleError, OSError):
                pass
        guidance = recovery_guidance(payload, capsule, str(exc))
        if event_name == "SubagentStart":
            response = blocked_subagent_response(str(exc), guidance)
        elif event_name == "Stop" and guidance and not payload.get("stop_hook_active"):
            response = stop_recovery_response(str(exc), guidance)
        else:
            response = stopped_response(str(exc), guidance)
        print(json.dumps(response))
        return 0


def show(target_session_id: str | None = None) -> int:
    payload = {"cwd": str(Path.cwd())}
    if target_session_id:
        payload["session_id"] = target_session_id
    capsule = load_state(payload)
    if capsule is None:
        print("Elephant resume is not active for this session")
        return 1
    print(validate(capsule, payload))
    return 0


def traceability_status(summary: dict[str, Any]) -> str:
    return (
        f"{summary['overall_status']} "
        f"passed={summary['passed']}/{summary['total']}"
    )


def status(target_session_id: str | None = None) -> int:
    root = git_root()
    active = load_active_marker(root)
    current: dict[str, Any] | None = None
    if active is None:
        print("marker=inactive")
    else:
        current = capsule_from_active_marker(root, active)
        print("marker=active")
        print(f"receipt={current['receipt']}")
        print(f"current_traceability={traceability_status(current['traceability'])}")

    target = target_session_id
    if target is None:
        target = os.environ.get("CODEX_THREAD_ID") or os.environ.get("CODEX_SESSION_ID")
    if not target:
        print("capsule=not_checked reason=session-id-unavailable")
        return 0

    payload = {"session_id": session_value({"session_id": target}), "cwd": str(root)}
    capsule = load_state(payload)
    if capsule is None:
        print("capsule=missing")
        return 1 if active is not None else 0
    if capsule.get("traceability"):
        print(f"stored_traceability={traceability_status(capsule['traceability'])}")
    try:
        validate(capsule, payload)
    except (CapsuleError, TraceabilityError, OSError, subprocess.SubprocessError) as exc:
        print("capsule=stale")
        print(f"reason={exc}")
        return 1
    print("capsule=fresh")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    activate_parser = subparsers.add_parser("activate")
    activate_parser.add_argument("--receipt", required=True)
    refresh_parser = subparsers.add_parser("refresh")
    refresh_parser.add_argument("--session-id", required=True)
    refresh_parser.add_argument("--accept-current-contract", action="store_true")
    subparsers.add_parser("deactivate")
    show_parser = subparsers.add_parser("show")
    show_parser.add_argument("--session-id")
    status_parser = subparsers.add_parser("status")
    status_parser.add_argument("--session-id")
    subparsers.add_parser("hook")
    args = parser.parse_args()

    try:
        if args.command == "activate":
            return activate(args.receipt)
        if args.command == "refresh":
            return refresh(args.session_id, args.accept_current_contract)
        if args.command == "deactivate":
            return deactivate()
        if args.command == "show":
            return show(args.session_id)
        if args.command == "status":
            return status(args.session_id)
        return run_hook()
    except (CapsuleError, TraceabilityError, OSError, subprocess.SubprocessError) as exc:
        print(f"elephant-resume: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
