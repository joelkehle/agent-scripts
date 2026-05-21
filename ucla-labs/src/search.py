"""Natural-language semantic search over the lab catalog.

Usage:
  python -m src.search "cryo-EM membrane proteins"
  python -m src.search --top 20 --json "single cell transcriptomics"
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import struct
import sys

import sqlite_vec
from openai import OpenAI

from .embed_and_index import DB_PATH, MODEL, DIM


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.enable_load_extension(True)
    sqlite_vec.load(conn)
    conn.enable_load_extension(False)
    return conn


def _embed_query(text: str) -> bytes:
    client = OpenAI()
    r = client.embeddings.create(model=MODEL, input=text)
    vec = r.data[0].embedding
    return struct.pack(f"{DIM}f", *vec)


def search(query: str, top: int = 10) -> list[dict]:
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY not set")
    if not DB_PATH.exists():
        raise SystemExit(f"missing {DB_PATH}; run embed_and_index first")
    qvec = _embed_query(query)
    conn = _connect()
    rows = conn.execute(
        """
        SELECT labs.lab_id, labs.display_name, labs.depts_json,
               labs.funding_json, labs.clinical_json, labs.scholar_json,
               labs.focus_text, vec.distance
        FROM vec_labs vec
        JOIN labs ON labs.rowid = vec.rowid
        WHERE vec.embedding MATCH ? AND k = ?
        ORDER BY vec.distance
        """,
        (qvec, top),
    ).fetchall()
    out = []
    for lab_id, name, depts, funding, clinical, scholar, focus, dist in rows:
        out.append({
            "lab_id": lab_id,
            "display_name": name,
            "depts": json.loads(depts),
            "funding": json.loads(funding),
            "clinical": json.loads(clinical),
            "scholar": json.loads(scholar) if scholar else None,
            "focus_excerpt": (focus or "")[:600],
            "distance": dist,
        })
    return out


def _format(results: list[dict]) -> str:
    lines = []
    for i, r in enumerate(results, 1):
        funding = r["funding"]
        nih = funding.get("nih_total_usd") or 0
        nsf = funding.get("nsf_total_usd") or 0
        trials = r["clinical"].get("trial_count") or 0
        sch = r.get("scholar") or {}
        h = sch.get("h_index")
        dept = ", ".join(r["depts"][:2]) if r["depts"] else "(dept unknown)"
        lines.append(
            f"\n#{i}  {r['display_name']}   [distance={r['distance']:.3f}]\n"
            f"    dept: {dept}\n"
            f"    funding: NIH ${nih:,.0f} ({funding.get('nih_grant_count', 0)} grants), "
            f"NSF ${nsf:,.0f} ({funding.get('nsf_award_count', 0)} awards), "
            f"clinical trials: {trials}"
            + (f", h-index: {h}" if h else "")
            + f"\n    focus: {r['focus_excerpt'][:300]}..."
        )
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("query", nargs="+", help="natural language query")
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--json", action="store_true", help="emit JSON instead of formatted output")
    args = ap.parse_args()

    q = " ".join(args.query)
    results = search(q, args.top)
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print(f"\nquery: {q!r}\n")
        print(_format(results))
        print()


if __name__ == "__main__":
    main()
