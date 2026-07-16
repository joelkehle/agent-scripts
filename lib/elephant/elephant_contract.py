"""Parse and render bounded Elephant receipt contracts."""

from __future__ import annotations

import hashlib
from pathlib import Path
import re
import subprocess
from typing import Any


MAX_CONTEXT_BYTES = 4096
MAX_RECEIPT_BYTES = 128 * 1024
MAX_CONDITIONS = 12
MAX_CONDITION_CHARS = 360


class CapsuleError(RuntimeError):
    """A deterministic capsule invariant failed."""


def git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(root), *args],
        check=check,
        capture_output=True,
        text=True,
    )


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
                    f"({capsule['traceability']['passed']}/{capsule['traceability']['total']} "
                    "EC conditions pass) "
                    f"at {capsule['traceability']['path']}"
                ]
                if capsule.get("traceability")
                else []
            ),
            f"Next action: {capsule['next_action']}",
            "Resume protocol: treat every EC condition as binding; re-open the receipt "
            "before changing architecture or claiming completion. Revalidate with "
            "`elephant-resume show` before delegating. This capsule restores constraints; "
            "it does not grant deployment or external-write authority.",
        ]
    )
    rendered = "\n".join(lines)
    size = len(rendered.encode("utf-8"))
    if size > MAX_CONTEXT_BYTES:
        raise CapsuleError(f"rendered capsule is {size} bytes; limit is {MAX_CONTEXT_BYTES}")
    return rendered
