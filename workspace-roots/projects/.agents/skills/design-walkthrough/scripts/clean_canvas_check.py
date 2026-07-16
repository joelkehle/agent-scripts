#!/usr/bin/env python3
"""Validate that a walkthrough separates product and review material."""

from __future__ import annotations

import json
import sys
from pathlib import Path


DEFAULT_FORBIDDEN = (
    "acceptance checklist",
    "client note",
    "design preview",
    "design rationale",
    "facilitator only",
    "guided review",
    "reviewer note",
    "synthetic fixture",
)


def load_manifest(path: Path) -> dict:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read manifest: {exc}") from exc
    if manifest.get("schema") != 1:
        raise ValueError("manifest schema must be 1")
    return manifest


def resolve_files(base: Path, values: object, field: str) -> list[Path]:
    if not isinstance(values, list) or not values:
        raise ValueError(f"{field} must be a non-empty list")
    files = [(base / str(value)).resolve() for value in values]
    missing = [str(path) for path in files if not path.is_file()]
    if missing:
        raise ValueError(f"missing {field}: {', '.join(missing)}")
    return files


def combined_text(files: list[Path]) -> str:
    return "\n".join(path.read_text(encoding="utf-8", errors="replace") for path in files)


def check(path: Path) -> list[str]:
    manifest = load_manifest(path)
    base = path.parent.resolve()
    products = resolve_files(base, manifest.get("product_files"), "product_files")
    reviews = resolve_files(base, manifest.get("review_files"), "review_files")

    overlap = set(products) & set(reviews)
    if overlap:
        raise ValueError(f"product/review files overlap: {', '.join(map(str, sorted(overlap)))}")

    forbidden = list(DEFAULT_FORBIDDEN)
    extra_forbidden = manifest.get("forbidden_product_text", [])
    if not isinstance(extra_forbidden, list):
        raise ValueError("forbidden_product_text must be a list")
    forbidden.extend(str(value) for value in extra_forbidden)

    product_text = combined_text(products).casefold()
    leaked = sorted({term for term in forbidden if term.casefold() in product_text})
    if leaked:
        raise ValueError(f"review language leaked into product: {', '.join(leaked)}")

    required = manifest.get("required_review_text", [])
    if not isinstance(required, list):
        raise ValueError("required_review_text must be a list")
    review_text = combined_text(reviews).casefold()
    absent = [str(term) for term in required if str(term).casefold() not in review_text]
    if absent:
        raise ValueError(f"review surface missing required text: {', '.join(absent)}")

    return [
        "clean-canvas=pass",
        f"product_files={len(products)}",
        f"review_files={len(reviews)}",
    ]


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] in {"-h", "--help"}:
        print("usage: clean_canvas_check.py MANIFEST.json")
        return 0 if len(argv) == 2 else 2
    try:
        result = check(Path(argv[1]).resolve())
    except ValueError as exc:
        print(f"clean-canvas=fail: {exc}", file=sys.stderr)
        return 1
    print(" ".join(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
