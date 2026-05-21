"""Fetch UCLA-affiliated grants from NIH RePORTER v2.

Docs: https://api.reporter.nih.gov/

We paginate through all projects with org_names matching any UCLA alias,
filtered to fiscal years 2020-present. Each row written to data/raw/nih.jsonl
captures: project_num, PI name(s), org, dept, fiscal_year, project_title,
abstract_text, terms (controlled vocab keywords), funding amount, mechanism.
"""
from __future__ import annotations

import argparse
import time
from typing import Any

from .common import DATA_RAW, http_json, log, write_jsonl, is_ucla_affiliation

API = "https://api.reporter.nih.gov/v2/projects/search"

# NIH RePORTER's canonical UCLA org names (verify against /v2/organizations
# if these change). Common alternates included.
NIH_ORG_NAMES = [
    "UNIVERSITY OF CALIFORNIA LOS ANGELES",
    "UNIVERSITY OF CALIFORNIA, LOS ANGELES",
]


def _fetch_page(orgs: list[str], fiscal_years: list[int], offset: int, limit: int) -> dict:
    body = {
        "criteria": {
            "org_names": orgs,
            "fiscal_years": fiscal_years,
        },
        "include_fields": [
            "ProjectNum",
            "ProjectTitle",
            "AbstractText",
            "Terms",
            "PrincipalInvestigators",
            "ContactPiName",
            "OrgName",
            "OrgDept",
            "FiscalYear",
            "AwardAmount",
            "ProjectStartDate",
            "ProjectEndDate",
            "AgencyIcAdmin",
            "FundingMechanism",
        ],
        "offset": offset,
        "limit": limit,
        "sort_field": "project_start_date",
        "sort_order": "desc",
    }
    return http_json("POST", API, json_body=body)


def _normalize(row: dict) -> dict:
    pis = row.get("principal_investigators") or []
    pi_records = [
        {
            "name": " ".join(filter(None, [p.get("first_name"), p.get("last_name")])),
            "title": p.get("title"),
            "is_contact_pi": p.get("is_contact_pi", False),
            "profile_id": p.get("profile_id"),
        }
        for p in pis
    ]
    return {
        "source": "nih",
        "project_num": row.get("project_num"),
        "title": row.get("project_title"),
        "abstract": row.get("abstract_text"),
        "terms": (row.get("terms") or "").split(";") if row.get("terms") else [],
        "pis": pi_records,
        "contact_pi": row.get("contact_pi_name"),
        "org_name": row.get("org_name"),
        "org_dept": row.get("org_dept"),
        "fiscal_year": row.get("fiscal_year"),
        "award_amount": row.get("award_amount"),
        "start_date": row.get("project_start_date"),
        "end_date": row.get("project_end_date"),
        "ic_admin": (row.get("agency_ic_admin") or {}).get("name"),
        "funding_mechanism": row.get("funding_mechanism"),
    }


def fetch(years: list[int], page_size: int = 500, max_pages: int | None = None) -> list[dict]:
    out: list[dict] = []
    offset = 0
    page = 0
    while True:
        log(f"NIH page {page} offset={offset} ...")
        data = _fetch_page(NIH_ORG_NAMES, years, offset, page_size)
        results = data.get("results") or []
        meta = data.get("meta") or {}
        total = meta.get("total") or 0
        if not results:
            break
        for r in results:
            n = _normalize(r)
            if is_ucla_affiliation(n.get("org_name") or ""):
                out.append(n)
        offset += len(results)
        page += 1
        log(f"  collected {len(out)} / total {total}")
        if max_pages is not None and page >= max_pages:
            break
        if offset >= total:
            break
        time.sleep(0.3)  # be polite
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", nargs="+", type=int, default=[2020, 2021, 2022, 2023, 2024, 2025, 2026])
    ap.add_argument("--page-size", type=int, default=500)
    ap.add_argument("--max-pages", type=int, default=None, help="limit for testing")
    args = ap.parse_args()

    rows = fetch(args.years, args.page_size, args.max_pages)
    out = DATA_RAW / "nih.jsonl"
    n = write_jsonl(out, rows)
    log(f"wrote {n} NIH rows -> {out}")


if __name__ == "__main__":
    main()
