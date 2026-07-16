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
import subprocess
import sys
from typing import Any

from elephant_traceability import (
    TraceabilityError,
    attach_active_contract,
    load_active_marker,
    validate_traceability,
)


MAX_CONTEXT_BYTES = 4096
MAX_RECEIPT_BYTES = 128 * 1024
MAX_CONDITIONS = 12
MAX_CONDITION_CHARS = 360
COMPACTION_WINDOW_SECONDS = 10 * 60
MAX_COMPACTIONS_PER_WINDOW = 3


class CapsuleError(RuntimeError):
    """A deterministic capsule invariant failed."""


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


def session_id(payload: dict[str, Any] | None = None) -> str:
    payload = payload or {}
    candidates = [
        os.environ.get("CODEX_THREAD_ID"),
        os.environ.get("CODEX_SESSION_ID"),
        payload.get("session_id"),
        payload.get("sessionId"),
        payload.get("thread_id"),
        payload.get("threadId"),
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
    return hashlib.sha256(value.encode()).hexdigest()


def state_path(payload: dict[str, Any] | None = None) -> Path:
    return state_root() / f"{session_id(payload)}.json"


def git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(root), *args],
        check=check,
        capture_output=True,
        text=True,
    )


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


def contained_file(root: Path, value: str | Path) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = Path.cwd() / candidate
    resolved = candidate.resolve(strict=True)
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise CapsuleError("receipt must remain inside the current Git worktree") from exc
    if not resolved.is_file():
        raise CapsuleError("receipt is not a regular file")
    return resolved


def read_receipt(path: Path) -> tuple[str, str]:
    size = path.stat().st_size
    if size > MAX_RECEIPT_BYTES:
        raise CapsuleError(f"receipt exceeds {MAX_RECEIPT_BYTES} bytes")
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise CapsuleError("receipt must be UTF-8") from exc
    return text, hashlib.sha256(raw).hexdigest()


def strip_markdown(value: str) -> str:
    value = value.replace("`", "").replace("**", "")
    return " ".join(value.split())


def required_match(pattern: str, text: str, label: str) -> re.Match[str]:
    match = re.search(pattern, text, flags=re.MULTILINE)
    if not match:
        raise CapsuleError(f"receipt is missing {label}")
    return match


def section(text: str, heading: str) -> str:
    marker = f"## {heading}"
    start = text.find(marker)
    if start < 0:
        raise CapsuleError(f"receipt is missing section: {heading}")
    body_start = start + len(marker)
    next_heading = text.find("\n## ", body_start)
    return text[body_start : next_heading if next_heading >= 0 else len(text)].strip()


def parse_conditions(text: str) -> list[dict[str, str]]:
    body = section(text, "Findings and required conditions")
    matches = list(
        re.finditer(
            r"(?ms)^\d+\.\s+\*\*(?P<label>.+?)\*\*\s*(?P<body>.*?)(?=^\d+\.\s+\*\*|\Z)",
            body,
        )
    )
    if not matches:
        raise CapsuleError("receipt has no numbered binding conditions")
    if len(matches) > MAX_CONDITIONS:
        raise CapsuleError(f"receipt has more than {MAX_CONDITIONS} binding conditions")

    conditions: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in matches:
        label = strip_markdown(match.group("label"))
        id_match = re.search(r"\bEC-\d+\b", label)
        if not id_match:
            raise CapsuleError(f"binding condition lacks an EC-n id: {label}")
        condition_id = id_match.group(0)
        if condition_id in seen:
            raise CapsuleError(f"duplicate binding condition id: {condition_id}")
        seen.add(condition_id)
        description = strip_markdown(f"{label} {match.group('body')}")
        if len(description) > MAX_CONDITION_CHARS:
            raise CapsuleError(
                f"{condition_id} exceeds the {MAX_CONDITION_CHARS}-character capsule limit"
            )
        conditions.append({"id": condition_id, "text": description})
    return conditions


def first_paragraph(text: str, heading: str) -> str:
    body = section(text, heading)
    paragraph = body.split("\n\n", 1)[0]
    return strip_markdown(paragraph)


def parse_receipt(root: Path, receipt: Path) -> dict[str, Any]:
    text, digest = read_receipt(receipt)
    title = strip_markdown(
        required_match(r"^# Elephant Check:\s*(.+)$", text, "Elephant Check title").group(1)
    )
    status = strip_markdown(required_match(r"^Status:\s*(.+)$", text, "status").group(1))
    revision_line = required_match(
        r"^Checked (?:code )?revision(?:/runtime)?:\s*(.+)$",
        text,
        "checked revision",
    ).group(1)
    revision_match = re.search(r"`([^`]+)`", revision_line)
    revision = revision_match.group(1) if revision_match else revision_line.split()[0]
    if not re.fullmatch(r"[0-9a-fA-F]{7,40}", revision):
        raise CapsuleError("checked revision must be an immutable Git commit id")
    if git(root, "cat-file", "-e", f"{revision}^{{commit}}", check=False).returncode != 0:
        raise CapsuleError(f"checked revision does not resolve: {revision}")

    return {
        "schema": 1,
        "objective": title,
        "status": status,
        "checked_revision": revision,
        "receipt": str(receipt.relative_to(root)),
        "receipt_sha256": digest,
        "conditions": parse_conditions(text),
        "next_action": first_paragraph(text, "Handoff and stop rule"),
    }


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


def render_context(capsule: dict[str, Any]) -> str:
    lines = [
        "ELEPHANT RESUME CAPSULE (deterministically validated)",
        f"Objective: {capsule['objective']}",
        f"Status: {capsule['status']}",
        f"Receipt: {capsule['receipt']} (sha256 {capsule['receipt_sha256'][:12]})",
        f"Checked revision: {capsule['checked_revision']}",
        "Binding conditions:",
    ]
    lines.extend(f"- {item['text']}" for item in capsule["conditions"])
    lines.extend(
        [
            *(
                [
                    "Traceability: "
                    f"{capsule['traceability']['overall_status']} "
                    f"({capsule['traceability']['passed']}/{capsule['traceability']['total']} EC conditions pass) "
                    f"at {capsule['traceability']['path']}"
                ]
                if capsule.get("traceability")
                else []
            ),
            f"Next action: {capsule['next_action']}",
            "Resume protocol: treat every EC condition as binding; re-open the receipt "
            "before changing architecture or claiming completion. Revalidate with "
            "`python3 .codex/hooks/elephant_resume.py show` before delegating. This capsule "
            "restores constraints; it does not grant deployment or external-write authority.",
        ]
    )
    rendered = "\n".join(lines)
    size = len(rendered.encode("utf-8"))
    if size > MAX_CONTEXT_BYTES:
        raise CapsuleError(f"rendered capsule is {size} bytes; limit is {MAX_CONTEXT_BYTES}")
    return rendered


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


def stopped_response(message: str) -> dict[str, Any]:
    return {
        "continue": False,
        "stopReason": f"Elephant resume blocked: {message}",
        "systemMessage": f"Elephant resume blocked: {message}",
    }


def blocked_subagent_response(message: str) -> dict[str, Any]:
    warning = f"Elephant resume blocked: {message}"
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
            return 0
        if event_name == "SessionStart":
            source = str(payload.get("source", ""))
            if source not in {"startup", "resume", "clear", "compact"}:
                return 0
            if source == "compact":
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
        response = (
            blocked_subagent_response(str(exc))
            if event_name == "SubagentStart"
            else stopped_response(str(exc))
        )
        print(json.dumps(response))
        return 0


def show() -> int:
    payload = {
        "session_id": os.environ.get("CODEX_THREAD_ID", ""),
        "cwd": str(Path.cwd()),
    }
    capsule = load_state(payload)
    if capsule is None:
        print("Elephant resume is not active for this session")
        return 1
    print(validate(capsule, payload))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    activate_parser = subparsers.add_parser("activate")
    activate_parser.add_argument("--receipt", required=True)
    subparsers.add_parser("deactivate")
    subparsers.add_parser("show")
    subparsers.add_parser("hook")
    args = parser.parse_args()

    try:
        if args.command == "activate":
            return activate(args.receipt)
        if args.command == "deactivate":
            return deactivate()
        if args.command == "show":
            return show()
        return run_hook()
    except (CapsuleError, TraceabilityError, OSError, subprocess.SubprocessError) as exc:
        print(f"elephant-resume: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
