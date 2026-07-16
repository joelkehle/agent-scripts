#!/usr/bin/env python3
"""Validate the active Elephant receipt and its EC-to-proof traceability map."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from typing import Any


ACTIVE_MARKER = Path(".codex/elephant-active.json")
MAX_MARKER_BYTES = 4096
MAX_TRACEABILITY_BYTES = 64 * 1024
VALID_CONDITION_STATUSES = {"pending", "pass", "blocked"}


class TraceabilityError(RuntimeError):
    """The active marker or traceability contract is invalid."""


def git_root(cwd: Path | None = None) -> Path:
    result = subprocess.run(
        ["git", "-C", str(cwd or Path.cwd()), "rev-parse", "--show-toplevel"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not result.stdout.strip():
        raise TraceabilityError("current directory is not inside a Git worktree")
    return Path(result.stdout.strip()).resolve()


def contained_path(root: Path, value: str, *, must_exist: bool) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        raise TraceabilityError("contract paths must be relative to the Git worktree")
    resolved = (root / candidate).resolve(strict=must_exist)
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise TraceabilityError("contract path escapes the Git worktree") from exc
    if must_exist and not resolved.is_file():
        raise TraceabilityError(f"contract path is not a file: {value}")
    return resolved


def read_json(path: Path, limit: int, label: str) -> tuple[dict[str, Any], str]:
    if path.stat().st_size > limit:
        raise TraceabilityError(f"{label} exceeds {limit} bytes")
    raw = path.read_bytes()
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise TraceabilityError(f"{label} is not valid JSON") from exc
    if not isinstance(value, dict):
        raise TraceabilityError(f"{label} must be a JSON object")
    return value, hashlib.sha256(raw).hexdigest()


def load_active_marker(root: Path) -> tuple[dict[str, Any], str] | None:
    path = root / ACTIVE_MARKER
    if not path.exists():
        tracked = subprocess.run(
            ["git", "-C", str(root), "ls-files", "--error-unmatch", str(ACTIVE_MARKER)],
            check=False,
            capture_output=True,
        )
        if tracked.returncode == 0:
            raise TraceabilityError("tracked active Elephant marker is missing from the worktree")
        return None
    marker, digest = read_json(path, MAX_MARKER_BYTES, "active Elephant marker")
    if marker.get("schema") != 1:
        raise TraceabilityError("active Elephant marker has an unsupported schema")
    if marker.get("active") is not True:
        changed = subprocess.run(
            ["git", "-C", str(root), "diff", "--quiet", "--", str(ACTIVE_MARKER)],
            check=False,
        )
        if changed.returncode != 0:
            raise TraceabilityError("active Elephant marker cannot be deactivated before commit")
        return None
    for key in ("receipt", "receipt_sha256", "traceability", "activated_at_commit"):
        if not isinstance(marker.get(key), str) or not marker[key].strip():
            raise TraceabilityError(f"active Elephant marker is missing {key}")
    receipt = contained_path(root, marker["receipt"], must_exist=True)
    if not re.fullmatch(r"[0-9a-f]{64}", marker["receipt_sha256"]):
        raise TraceabilityError("active marker receipt fingerprint must be a SHA-256 digest")
    if hashlib.sha256(receipt.read_bytes()).hexdigest() != marker["receipt_sha256"]:
        raise TraceabilityError("active marker has a stale receipt fingerprint")
    contained_path(root, marker["traceability"], must_exist=True)
    revision = marker["activated_at_commit"]
    if not re.fullmatch(r"[0-9a-fA-F]{7,40}", revision):
        raise TraceabilityError("active marker commit must be an immutable Git commit id")
    exists = subprocess.run(
        ["git", "-C", str(root), "cat-file", "-e", f"{revision}^{{commit}}"],
        check=False,
        capture_output=True,
    )
    if exists.returncode != 0:
        raise TraceabilityError("active marker commit does not resolve")
    ancestor = subprocess.run(
        ["git", "-C", str(root), "merge-base", "--is-ancestor", revision, "HEAD"],
        check=False,
        capture_output=True,
    )
    if ancestor.returncode != 0:
        raise TraceabilityError("active marker commit is not an ancestor of HEAD")
    return marker, digest


def condition_ref_path(root: Path, value: str, label: str, must_exist: bool) -> None:
    if not isinstance(value, str) or not value.strip():
        raise TraceabilityError(f"{label} contains an empty reference")
    path_text = value.split("::", 1)[0]
    contained_path(root, path_text, must_exist=must_exist)


def validate_traceability(
    root: Path,
    marker: dict[str, Any],
    receipt_sha256: str,
    condition_ids: list[str],
    *,
    strict: bool,
) -> tuple[dict[str, Any], str]:
    path = contained_path(root, marker["traceability"], must_exist=True)
    trace, digest = read_json(path, MAX_TRACEABILITY_BYTES, "Elephant traceability map")
    if trace.get("schema") != 1:
        raise TraceabilityError("traceability map has an unsupported schema")
    if trace.get("receipt") != marker["receipt"]:
        raise TraceabilityError("traceability map points to a different receipt")
    if trace.get("receipt_sha256") != receipt_sha256:
        raise TraceabilityError("traceability map has a stale receipt fingerprint")
    entries = trace.get("conditions")
    if not isinstance(entries, list):
        raise TraceabilityError("traceability conditions must be a list")

    seen: set[str] = set()
    passed = 0
    for entry in entries:
        if not isinstance(entry, dict):
            raise TraceabilityError("each traceability condition must be an object")
        condition_id = entry.get("id")
        if not isinstance(condition_id, str) or not re.fullmatch(r"EC-\d+", condition_id):
            raise TraceabilityError("traceability condition has an invalid EC-n id")
        if condition_id in seen:
            raise TraceabilityError(f"duplicate traceability condition: {condition_id}")
        seen.add(condition_id)
        status = entry.get("status")
        if status not in VALID_CONDITION_STATUSES:
            raise TraceabilityError(f"{condition_id} has an invalid status")
        for field in ("code", "tests", "proof"):
            values = entry.get(field)
            if not isinstance(values, list) or not values:
                raise TraceabilityError(f"{condition_id} must map at least one {field} reference")
            for value in values:
                if field in {"code", "tests"}:
                    condition_ref_path(root, value, f"{condition_id}.{field}", status == "pass")
                elif status == "pass":
                    condition_ref_path(root, value, f"{condition_id}.proof", must_exist=True)
                elif not isinstance(value, str) or not value.strip():
                    raise TraceabilityError(f"{condition_id}.proof contains an empty reference")
        if status == "pass":
            if any(str(value).startswith("pending:") for value in entry["proof"]):
                raise TraceabilityError(f"{condition_id} is pass but still has pending proof")
            passed += 1

    expected = set(condition_ids)
    if seen != expected:
        missing = ",".join(sorted(expected - seen)) or "none"
        extra = ",".join(sorted(seen - expected)) or "none"
        raise TraceabilityError(
            f"traceability EC ids differ from receipt; missing={missing}; extra={extra}"
        )
    overall = trace.get("overall_status")
    if overall not in {"in_progress", "pass", "blocked"}:
        raise TraceabilityError("traceability map has an invalid overall_status")
    if overall == "pass" and passed != len(condition_ids):
        raise TraceabilityError("overall_status is pass but not every EC condition is pass")
    if strict and (overall != "pass" or passed != len(condition_ids)):
        raise TraceabilityError(
            f"traceability is not complete: overall={overall}; passed={passed}/{len(condition_ids)}"
        )
    trace["_summary"] = {
        "path": marker["traceability"],
        "overall_status": overall,
        "passed": passed,
        "total": len(condition_ids),
    }
    return trace, digest


def attach_active_contract(
    root: Path,
    capsule: dict[str, Any],
    active: tuple[dict[str, Any], str] | None = None,
) -> dict[str, Any]:
    active = active if active is not None else load_active_marker(root)
    if active is None:
        return capsule
    marker, marker_digest = active
    if marker["receipt"] != capsule["receipt"]:
        raise TraceabilityError("active marker points to a different Elephant receipt")
    trace, trace_digest = validate_traceability(
        root,
        marker,
        capsule["receipt_sha256"],
        [item["id"] for item in capsule["conditions"]],
        strict=False,
    )
    capsule["required_by_active_marker"] = True
    capsule["active_marker_sha256"] = marker_digest
    capsule["traceability_sha256"] = trace_digest
    capsule["traceability"] = trace["_summary"]
    return capsule


def parse_receipt_identity(path: Path) -> tuple[str, list[str]]:
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    start = text.find("## Findings and required conditions")
    if start < 0:
        raise TraceabilityError("receipt is missing binding conditions")
    end = text.find("\n## ", start + 1)
    body = text[start : end if end >= 0 else len(text)]
    ids = re.findall(r"^\d+\.\s+\*\*(EC-\d+)\b", body, flags=re.MULTILINE)
    if not ids:
        raise TraceabilityError("receipt has no numbered EC conditions")
    return digest, ids


def verify(structure_only: bool) -> int:
    root = git_root()
    active = load_active_marker(root)
    if active is None:
        raise TraceabilityError("no active Elephant marker exists")
    marker, _ = active
    receipt = contained_path(root, marker["receipt"], must_exist=True)
    receipt_sha256, condition_ids = parse_receipt_identity(receipt)
    trace, _ = validate_traceability(
        root,
        marker,
        receipt_sha256,
        condition_ids,
        strict=not structure_only,
    )
    summary = trace["_summary"]
    print(
        f"traceability={summary['overall_status']} "
        f"passed={summary['passed']}/{summary['total']} path={summary['path']}"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--structure-only", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "verify":
            return verify(args.structure_only)
    except (OSError, UnicodeDecodeError, TraceabilityError) as exc:
        print(f"elephant-traceability: {exc}", file=sys.stderr)
        return 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
