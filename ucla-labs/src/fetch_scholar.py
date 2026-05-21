"""Enrich PI list with recent publications from Semantic Scholar.

Docs: https://api.semanticscholar.org/api-docs/

This step depends on the catalog assembly (build_catalog) for the PI list,
so it can also be run AFTER build_catalog using `--from-catalog`. Default
behavior here is to use the union of PIs found in the raw NIH+NSF+trials
fetches.
"""
from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

from .common import (
    DATA, DATA_RAW, http_json, log, read_jsonl, write_jsonl,
    canonical_name, display_name, is_ucla_affiliation,
)

API_SEARCH = "https://api.semanticscholar.org/graph/v1/author/search"
API_AUTHOR = "https://api.semanticscholar.org/graph/v1/author"


def _headers() -> dict:
    h = {"Accept": "application/json"}
    if key := os.environ.get("SEMANTIC_SCHOLAR_API_KEY"):
        h["x-api-key"] = key
    return h


def _collect_pi_names() -> list[str]:
    names: set[str] = set()

    nih = DATA_RAW / "nih.jsonl"
    for row in read_jsonl(nih):
        for pi in row.get("pis") or []:
            if pi.get("name"):
                names.add(pi["name"])
        if row.get("contact_pi"):
            names.add(row["contact_pi"])

    nsf = DATA_RAW / "nsf.jsonl"
    for row in read_jsonl(nsf):
        if row.get("pi_name"):
            names.add(row["pi_name"])

    trials = DATA_RAW / "trials.jsonl"
    for row in read_jsonl(trials):
        for o in row.get("officials") or []:
            if o.get("name") and is_ucla_affiliation(o.get("affiliation") or ""):
                names.add(o["name"])

    return sorted(names)


def _search_author(name: str) -> dict | None:
    params = {
        "query": name,
        "limit": 5,
        "fields": "name,affiliations,paperCount,hIndex,citationCount",
    }
    data = http_json("GET", API_SEARCH, params=params, headers=_headers(), retries=2)
    matches = data.get("data") or []
    # Prefer a UCLA-affiliated match if any
    for m in matches:
        affs = " ".join(m.get("affiliations") or [])
        if is_ucla_affiliation(affs):
            return m
    return matches[0] if matches else None


def _recent_papers(author_id: str, limit: int = 8) -> list[dict]:
    params = {
        "limit": limit,
        "fields": "title,year,abstract,venue,citationCount",
        "sort": "year:desc",
    }
    data = http_json(
        "GET",
        f"{API_AUTHOR}/{author_id}/papers",
        params=params,
        headers=_headers(),
        retries=2,
    )
    return data.get("data") or []


def fetch(max_pis: int | None = None) -> list[dict]:
    names = _collect_pi_names()
    if max_pis:
        names = names[:max_pis]
    log(f"resolving {len(names)} unique PI names against Semantic Scholar")

    out: list[dict] = []
    for i, raw in enumerate(names):
        try:
            match = _search_author(raw)
        except Exception as e:
            log(f"  search failed for {raw!r}: {e}")
            match = None
        if not match:
            out.append({
                "source": "scholar",
                "query_name": raw,
                "canonical": canonical_name(raw),
                "display": display_name(raw),
                "matched": False,
            })
            time.sleep(0.4)
            continue

        author_id = match.get("authorId")
        try:
            papers = _recent_papers(author_id) if author_id else []
        except Exception as e:
            log(f"  papers failed for {raw!r}: {e}")
            papers = []

        out.append({
            "source": "scholar",
            "query_name": raw,
            "canonical": canonical_name(raw),
            "display": display_name(raw),
            "matched": True,
            "author_id": author_id,
            "name": match.get("name"),
            "affiliations": match.get("affiliations") or [],
            "paper_count": match.get("paperCount"),
            "h_index": match.get("hIndex"),
            "citation_count": match.get("citationCount"),
            "recent_papers": [
                {
                    "title": p.get("title"),
                    "year": p.get("year"),
                    "abstract": p.get("abstract"),
                    "venue": p.get("venue"),
                    "citations": p.get("citationCount"),
                }
                for p in papers
            ],
        })
        if i % 25 == 0:
            log(f"  scholar progress {i}/{len(names)}")
        # Semantic Scholar public rate limit: ~1 req/sec without API key
        time.sleep(0.5 if os.environ.get("SEMANTIC_SCHOLAR_API_KEY") else 1.1)

    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-pis", type=int, default=None, help="limit for testing")
    args = ap.parse_args()

    rows = fetch(args.max_pis)
    out = DATA_RAW / "scholar.jsonl"
    n = write_jsonl(out, rows)
    log(f"wrote {n} scholar rows -> {out}")


if __name__ == "__main__":
    main()
