"""Fetch UCLA-affiliated awards from the NSF Awards API.

Docs: https://www.research.gov/common/webapi/awardapisearch-v1.htm

Returns one row per award with PI, dept (from awardeeName), abstract,
title, funds obligated, start date.
"""
from __future__ import annotations

import argparse
import time

from .common import DATA_RAW, http_json, log, write_jsonl, is_ucla_affiliation

API = "https://api.nsf.gov/services/v1/awards.json"

NSF_AWARDEE_NAMES = [
    "University of California-Los Angeles",
    "University of California, Los Angeles",
]

FIELDS = ",".join([
    "id",
    "title",
    "awardeeName",
    "awardeeCity",
    "awardeeStateCode",
    "piFirstName",
    "piMiddleInitial",
    "piLastName",
    "piEmail",
    "abstractText",
    "fundsObligatedAmt",
    "startDate",
    "expDate",
    "fundProgramName",
    "primaryProgram",
    "transType",
])


def _fetch_page(awardee: str, offset: int, rpp: int, date_start: str) -> dict:
    params = {
        "awardeeName": f'"{awardee}"',
        "dateStart": date_start,
        "printFields": FIELDS,
        "rpp": rpp,
        "offset": offset,
    }
    return http_json("GET", API, params=params)


def _normalize(row: dict) -> dict:
    first = row.get("piFirstName") or ""
    mi = row.get("piMiddleInitial") or ""
    last = row.get("piLastName") or ""
    pi_name = " ".join(part for part in [first, mi, last] if part).strip()
    return {
        "source": "nsf",
        "award_id": row.get("id"),
        "title": row.get("title"),
        "abstract": row.get("abstractText"),
        "pi_name": pi_name,
        "pi_email": row.get("piEmail"),
        "org_name": row.get("awardeeName"),
        "city": row.get("awardeeCity"),
        "state": row.get("awardeeStateCode"),
        "funds_obligated": row.get("fundsObligatedAmt"),
        "start_date": row.get("startDate"),
        "exp_date": row.get("expDate"),
        "program": row.get("fundProgramName") or row.get("primaryProgram"),
        "trans_type": row.get("transType"),
    }


def fetch(date_start: str, rpp: int = 100, max_pages: int | None = None) -> list[dict]:
    out: list[dict] = []
    for awardee in NSF_AWARDEE_NAMES:
        offset = 0
        page = 0
        while True:
            log(f"NSF awardee={awardee!r} offset={offset} ...")
            data = _fetch_page(awardee, offset, rpp, date_start)
            results = (data.get("response") or {}).get("award") or []
            if not results:
                break
            for r in results:
                n = _normalize(r)
                if is_ucla_affiliation(n.get("org_name") or ""):
                    out.append(n)
            offset += len(results)
            page += 1
            log(f"  collected total={len(out)} (this awardee page {page})")
            if max_pages is not None and page >= max_pages:
                break
            if len(results) < rpp:
                break
            time.sleep(0.3)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date-start", default="01/01/2020",
                    help="MM/DD/YYYY; awards starting on/after this date")
    ap.add_argument("--rpp", type=int, default=100, help="results per page (max 25-100 depending on API)")
    ap.add_argument("--max-pages", type=int, default=None)
    args = ap.parse_args()

    rows = fetch(args.date_start, args.rpp, args.max_pages)
    out = DATA_RAW / "nsf.jsonl"
    n = write_jsonl(out, rows)
    log(f"wrote {n} NSF rows -> {out}")


if __name__ == "__main__":
    main()
