"""Merge raw NIH + NSF + ClinicalTrials.gov + Semantic Scholar dumps into a
single deduplicated PI-level catalog.

Each row in data/catalog.jsonl is one lab/PI, with:
  - lab_id: stable canonical key
  - display_name, dept (best guess), source aliases
  - focus_text: the searchable blob used downstream for embeddings
  - funding: NIH/NSF dollar totals and counts
  - clinical: linked trial NCT IDs
  - recent_publications, h_index, citation_count (from scholar)
  - source_records: provenance for each underlying record

No LLM call here — focus_text is the deterministic concatenation of grant
titles, abstracts, project terms, trial conditions, and recent paper
titles. This keeps the build fast, free, and reproducible. If you want
LLM-rewritten lab descriptions, run the optional step in
`build_catalog.py --summarize` (commented hook below).
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path

from .common import (
    DATA, DATA_RAW, log, read_jsonl, write_jsonl,
    canonical_name, display_name, is_ucla_affiliation,
)


def _bucket() -> dict:
    return {
        "display_name": "",
        "name_aliases": set(),
        "depts": set(),
        "nih_grants": [],
        "nsf_awards": [],
        "trial_ids": set(),
        "trials": [],
        "scholar": None,
        "focus_terms": [],
    }


def _ingest_nih(buckets: dict[str, dict]) -> None:
    for row in read_jsonl(DATA_RAW / "nih.jsonl"):
        pi_names: list[str] = []
        for pi in row.get("pis") or []:
            if pi.get("name"):
                pi_names.append(pi["name"])
        if row.get("contact_pi"):
            pi_names.append(row["contact_pi"])
        # Dedupe by canonical key so the same PI on a grant gets one credit,
        # not one per source field (pis vs contact_pi can both name them).
        seen_keys: set[str] = set()
        for name in pi_names:
            key = canonical_name(name)
            if not key or key in seen_keys:
                continue
            seen_keys.add(key)
            b = buckets.setdefault(key, _bucket())
            if not b["display_name"]:
                b["display_name"] = display_name(name)
            b["name_aliases"].add(name)
            if row.get("org_dept"):
                b["depts"].add(row["org_dept"])
            b["nih_grants"].append({
                "project_num": row.get("project_num"),
                "title": row.get("title"),
                "year": row.get("fiscal_year"),
                "amount": row.get("award_amount"),
                "mechanism": row.get("funding_mechanism"),
                "ic": row.get("ic_admin"),
                "terms": row.get("terms") or [],
            })
            if row.get("title"):
                b["focus_terms"].append(row["title"])
            if row.get("abstract"):
                b["focus_terms"].append(row["abstract"][:1500])
            for t in (row.get("terms") or [])[:20]:
                if t and t.strip():
                    b["focus_terms"].append(t.strip())


def _ingest_nsf(buckets: dict[str, dict]) -> None:
    for row in read_jsonl(DATA_RAW / "nsf.jsonl"):
        name = row.get("pi_name")
        if not name:
            continue
        key = canonical_name(name)
        if not key:
            continue
        b = buckets.setdefault(key, _bucket())
        if not b["display_name"]:
            b["display_name"] = display_name(name)
        b["name_aliases"].add(name)
        b["nsf_awards"].append({
            "award_id": row.get("award_id"),
            "title": row.get("title"),
            "amount": row.get("funds_obligated"),
            "program": row.get("program"),
            "start_date": row.get("start_date"),
        })
        if row.get("title"):
            b["focus_terms"].append(row["title"])
        if row.get("abstract"):
            b["focus_terms"].append(row["abstract"][:1500])


def _ingest_trials(buckets: dict[str, dict]) -> None:
    for row in read_jsonl(DATA_RAW / "trials.jsonl"):
        nct = row.get("nct_id")
        for o in row.get("officials") or []:
            name = o.get("name")
            if not name:
                continue
            if not is_ucla_affiliation(o.get("affiliation") or ""):
                # Many trials list UCLA as a site but the overall PI is
                # at another institution. Only attribute the trial to a
                # PI when the PI is at UCLA.
                continue
            key = canonical_name(name)
            if not key:
                continue
            b = buckets.setdefault(key, _bucket())
            if not b["display_name"]:
                b["display_name"] = display_name(name)
            b["name_aliases"].add(name)
            if o.get("affiliation"):
                b["depts"].add(o["affiliation"])
            if nct:
                if nct not in b["trial_ids"]:
                    b["trial_ids"].add(nct)
                    b["trials"].append({
                        "nct_id": nct,
                        "title": row.get("title"),
                        "conditions": row.get("conditions") or [],
                        "phase": row.get("phase") or [],
                        "status": row.get("overall_status"),
                        "lead_sponsor": row.get("lead_sponsor"),
                        "role": o.get("role"),
                    })
                    if row.get("title"):
                        b["focus_terms"].append(row["title"])
                    for c in (row.get("conditions") or [])[:6]:
                        if c:
                            b["focus_terms"].append(c)
                    if row.get("brief_summary"):
                        b["focus_terms"].append(row["brief_summary"][:1500])


def _ingest_scholar(buckets: dict[str, dict]) -> None:
    for row in read_jsonl(DATA_RAW / "scholar.jsonl"):
        key = row.get("canonical") or canonical_name(row.get("query_name") or "")
        if not key or key not in buckets:
            continue
        b = buckets[key]
        b["scholar"] = {
            "author_id": row.get("author_id"),
            "matched": row.get("matched"),
            "h_index": row.get("h_index"),
            "citation_count": row.get("citation_count"),
            "paper_count": row.get("paper_count"),
            "affiliations": row.get("affiliations") or [],
            "recent_papers": row.get("recent_papers") or [],
        }
        for p in row.get("recent_papers") or []:
            if p.get("title"):
                b["focus_terms"].append(p["title"])
            if p.get("abstract"):
                b["focus_terms"].append(p["abstract"][:800])


def _finalize(key: str, b: dict) -> dict:
    nih_amt = sum((g.get("amount") or 0) for g in b["nih_grants"])
    nsf_amt = sum((a.get("amount") or 0) for a in b["nsf_awards"])
    # Deduplicate focus_terms while preserving order; cap total length
    seen: set[str] = set()
    pieces: list[str] = []
    total = 0
    for t in b["focus_terms"]:
        t = (t or "").strip()
        if not t or t in seen:
            continue
        seen.add(t)
        pieces.append(t)
        total += len(t)
        if total > 8000:
            break
    return {
        "lab_id": key,
        "display_name": b["display_name"] or key,
        "name_aliases": sorted(b["name_aliases"]),
        "depts": sorted(b["depts"]),
        "funding": {
            "nih_total_usd": nih_amt,
            "nih_grant_count": len(b["nih_grants"]),
            "nsf_total_usd": nsf_amt,
            "nsf_award_count": len(b["nsf_awards"]),
        },
        "clinical": {
            "trial_count": len(b["trials"]),
            "nct_ids": sorted(b["trial_ids"]),
            "trials": b["trials"][:25],
        },
        "scholar": b["scholar"],
        "nih_grants": b["nih_grants"][:25],
        "nsf_awards": b["nsf_awards"][:25],
        "focus_text": "\n".join(pieces),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-evidence", type=int, default=1,
                    help="drop PIs with fewer than N source records total")
    args = ap.parse_args()

    buckets: dict[str, dict] = {}
    _ingest_nih(buckets)
    _ingest_nsf(buckets)
    _ingest_trials(buckets)
    _ingest_scholar(buckets)

    rows = []
    for key, b in buckets.items():
        evidence = len(b["nih_grants"]) + len(b["nsf_awards"]) + len(b["trial_ids"])
        if evidence < args.min_evidence:
            continue
        rows.append(_finalize(key, b))

    rows.sort(key=lambda r: (
        -(r["funding"]["nih_total_usd"] or 0) - (r["funding"]["nsf_total_usd"] or 0)
    ))

    out = DATA / "catalog.jsonl"
    n = write_jsonl(out, rows)
    log(f"wrote {n} lab rows -> {out}")
    log(f"  NIH-funded labs: {sum(1 for r in rows if r['funding']['nih_grant_count'])}")
    log(f"  NSF-funded labs: {sum(1 for r in rows if r['funding']['nsf_award_count'])}")
    log(f"  Labs with trials: {sum(1 for r in rows if r['clinical']['trial_count'])}")
    log(f"  Labs w/ scholar match: {sum(1 for r in rows if r.get('scholar') and r['scholar'].get('matched'))}")


if __name__ == "__main__":
    main()
