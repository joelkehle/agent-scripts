"""Shared helpers: paths, name normalization, HTTP, JSONL."""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any, Iterable, Iterator

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT / "data" / "raw"
DATA = ROOT / "data"
DATA_RAW.mkdir(parents=True, exist_ok=True)

# UCLA appears under many strings in upstream data. We query each and
# post-filter for an exact match against this set after lowercasing +
# punctuation strip.
UCLA_ALIASES = [
    "University of California, Los Angeles",
    "University of California-Los Angeles",
    "University of California Los Angeles",
    "UCLA",
    "UCLA Health",
    "UCLA School of Medicine",
    "David Geffen School of Medicine at UCLA",
    "Jonsson Comprehensive Cancer Center",
    "Stein Eye Institute",
]

_CRED_RE = re.compile(
    r",?\s*(MD|PhD|MD/PhD|MD,? PhD|MPH|MS|MSc|DDS|DVM|DPhil|ScD|JD|RN|PharmD|FACP|FACS|MBA)\.?$",
    re.IGNORECASE,
)
_WS_RE = re.compile(r"\s+")
_PUNCT_RE = re.compile(r"[^a-z0-9 ]")


def _strip_credentials(name: str) -> str:
    prev = None
    out = name.strip()
    while prev != out:
        prev = out
        out = _CRED_RE.sub("", out).strip().rstrip(",").strip()
    return out


def canonical_name(raw: str) -> str:
    """Normalize a person name into a stable dedup key.

    - strips trailing credentials (MD, PhD, ...)
    - handles "Last, First Middle" -> "First Last"
    - lowercase, single-space, no punctuation
    - returns "first_initial last" as the dedup key
    """
    if not raw:
        return ""
    n = _strip_credentials(raw)
    if "," in n and not re.search(r",\s*(jr|sr|iii|ii|iv)\.?$", n, re.I):
        last, _, first = n.partition(",")
        n = f"{first.strip()} {last.strip()}"
    n = _PUNCT_RE.sub(" ", n.lower())
    n = _WS_RE.sub(" ", n).strip()
    parts = n.split(" ")
    if len(parts) < 2:
        return n
    first = parts[0]
    last = parts[-1]
    return f"{first[0]} {last}"


def display_name(raw: str) -> str:
    if not raw:
        return ""
    n = _strip_credentials(raw)
    if "," in n and not re.search(r",\s*(jr|sr|iii|ii|iv)\.?$", n, re.I):
        last, _, first = n.partition(",")
        n = f"{first.strip()} {last.strip()}"
    return _WS_RE.sub(" ", n).strip()


def is_ucla_affiliation(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(a.lower() in t for a in UCLA_ALIASES)


# ---------- HTTP ----------

class HttpError(Exception):
    pass


def http_json(
    method: str,
    url: str,
    *,
    params: dict | None = None,
    json_body: dict | None = None,
    headers: dict | None = None,
    timeout: int = 60,
    retries: int = 4,
) -> dict:
    """HTTP with exponential backoff on 429/5xx."""
    last_exc: Exception | None = None
    delay = 2.0
    for attempt in range(retries + 1):
        try:
            r = requests.request(
                method,
                url,
                params=params,
                json=json_body,
                headers=headers or {"Accept": "application/json"},
                timeout=timeout,
            )
            if r.status_code in (429, 500, 502, 503, 504):
                raise HttpError(f"{r.status_code} from {url}")
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_exc = e
            if attempt == retries:
                break
            time.sleep(delay)
            delay = min(delay * 2, 30.0)
    raise HttpError(f"giving up on {url}: {last_exc}")


# ---------- JSONL ----------

def write_jsonl(path: Path, rows: Iterable[dict]) -> int:
    n = 0
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
            n += 1
    return n


def append_jsonl(path: Path, rows: Iterable[dict]) -> int:
    n = 0
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
            n += 1
    return n


def read_jsonl(path: Path) -> Iterator[dict]:
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def log(msg: str) -> None:
    print(f"[ucla-labs] {msg}", flush=True)
