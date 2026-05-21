"""Fetch UCLA clinical trials from ClinicalTrials.gov v2 REST API.

Docs: https://clinicaltrials.gov/data-api/api

We query by lead sponsor AND by site location, then dedupe by NCT ID. Each
trial we emit captures: nct_id, title, conditions, interventions, lead
sponsor, overall officials (PIs with role + affiliation), responsible party,
locations, study type, phase, status, brief_summary.
"""
from __future__ import annotations

import argparse
import time

from .common import DATA_RAW, http_json, log, write_jsonl, is_ucla_affiliation

API = "https://clinicaltrials.gov/api/v2/studies"

# Field set returned by the API. See Studies v2 schema.
FIELDS = ",".join([
    "NCTId",
    "BriefTitle",
    "OfficialTitle",
    "Condition",
    "InterventionName",
    "InterventionType",
    "LeadSponsorName",
    "LeadSponsorClass",
    "CollaboratorName",
    "OverallStatus",
    "Phase",
    "StudyType",
    "BriefSummary",
    "OverallOfficialName",
    "OverallOfficialAffiliation",
    "OverallOfficialRole",
    "ResponsiblePartyInvestigatorFullName",
    "ResponsiblePartyInvestigatorTitle",
    "ResponsiblePartyInvestigatorAffiliation",
    "LocationFacility",
    "LocationCity",
    "LocationState",
    "LocationCountry",
    "StartDate",
    "PrimaryCompletionDate",
])

UCLA_SEARCH_TERMS = [
    "University of California, Los Angeles",
    "UCLA",
    "Jonsson Comprehensive Cancer Center",
    "David Geffen School of Medicine",
    "Stein Eye Institute",
]


def _fetch_page(query_lead: str | None, query_locn: str | None, page_token: str | None) -> dict:
    params: dict = {
        "fields": FIELDS,
        "pageSize": 100,
        "countTotal": "true",
    }
    if query_lead:
        params["query.lead"] = query_lead
    if query_locn:
        params["query.locn"] = query_locn
    if page_token:
        params["pageToken"] = page_token
    return http_json("GET", API, params=params)


def _normalize(study: dict) -> dict:
    protocol = study.get("protocolSection") or {}
    ident = protocol.get("identificationModule") or {}
    desc = protocol.get("descriptionModule") or {}
    cond = protocol.get("conditionsModule") or {}
    arms = protocol.get("armsInterventionsModule") or {}
    sponsor = protocol.get("sponsorCollaboratorsModule") or {}
    contacts = protocol.get("contactsLocationsModule") or {}
    status = protocol.get("statusModule") or {}
    design = protocol.get("designModule") or {}

    officials = []
    for o in contacts.get("overallOfficials") or []:
        officials.append({
            "name": o.get("name"),
            "role": o.get("role"),
            "affiliation": o.get("affiliation"),
        })

    rp = sponsor.get("responsibleParty") or {}
    if rp.get("investigatorFullName"):
        officials.append({
            "name": rp.get("investigatorFullName"),
            "role": "RESPONSIBLE_PARTY",
            "affiliation": rp.get("investigatorAffiliation"),
            "title": rp.get("investigatorTitle"),
        })

    return {
        "source": "trials",
        "nct_id": ident.get("nctId"),
        "title": ident.get("briefTitle") or ident.get("officialTitle"),
        "conditions": cond.get("conditions") or [],
        "interventions": [
            {"name": i.get("name"), "type": i.get("type")}
            for i in arms.get("interventions") or []
        ],
        "lead_sponsor": (sponsor.get("leadSponsor") or {}).get("name"),
        "lead_sponsor_class": (sponsor.get("leadSponsor") or {}).get("class"),
        "collaborators": [c.get("name") for c in sponsor.get("collaborators") or []],
        "officials": officials,
        "locations": [
            {
                "facility": loc.get("facility"),
                "city": loc.get("city"),
                "state": loc.get("state"),
                "country": loc.get("country"),
            }
            for loc in contacts.get("locations") or []
        ],
        "overall_status": status.get("overallStatus"),
        "phase": design.get("phases") or [],
        "study_type": design.get("studyType"),
        "brief_summary": desc.get("briefSummary"),
        "start_date": (status.get("startDateStruct") or {}).get("date"),
        "primary_completion_date": (status.get("primaryCompletionDateStruct") or {}).get("date"),
    }


def _has_ucla_site(record: dict) -> bool:
    for loc in record.get("locations") or []:
        if is_ucla_affiliation(loc.get("facility") or ""):
            return True
    for o in record.get("officials") or []:
        if is_ucla_affiliation(o.get("affiliation") or ""):
            return True
    if is_ucla_affiliation(record.get("lead_sponsor") or ""):
        return True
    return False


def fetch(max_pages: int | None = None) -> list[dict]:
    seen: dict[str, dict] = {}

    # Pull by lead sponsor (UCLA-sponsored trials)
    for term in UCLA_SEARCH_TERMS:
        log(f"trials lead-sponsor query: {term!r}")
        page_token = None
        page = 0
        while True:
            data = _fetch_page(query_lead=term, query_locn=None, page_token=page_token)
            studies = data.get("studies") or []
            if not studies:
                break
            for s in studies:
                rec = _normalize(s)
                if rec["nct_id"] and _has_ucla_site(rec):
                    seen[rec["nct_id"]] = rec
            page += 1
            log(f"  lead={term!r} page {page}: +{len(studies)} (unique total {len(seen)})")
            page_token = data.get("nextPageToken")
            if not page_token:
                break
            if max_pages is not None and page >= max_pages:
                break
            time.sleep(0.3)

    # Pull by site location too (catches UCLA-located trials with external sponsors)
    for term in UCLA_SEARCH_TERMS:
        log(f"trials location query: {term!r}")
        page_token = None
        page = 0
        while True:
            data = _fetch_page(query_lead=None, query_locn=term, page_token=page_token)
            studies = data.get("studies") or []
            if not studies:
                break
            for s in studies:
                rec = _normalize(s)
                if rec["nct_id"] and _has_ucla_site(rec):
                    seen.setdefault(rec["nct_id"], rec)
            page += 1
            log(f"  locn={term!r} page {page}: +{len(studies)} (unique total {len(seen)})")
            page_token = data.get("nextPageToken")
            if not page_token:
                break
            if max_pages is not None and page >= max_pages:
                break
            time.sleep(0.3)

    return list(seen.values())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-pages", type=int, default=None)
    args = ap.parse_args()

    rows = fetch(args.max_pages)
    out = DATA_RAW / "trials.jsonl"
    n = write_jsonl(out, rows)
    log(f"wrote {n} trial rows -> {out}")


if __name__ == "__main__":
    main()
