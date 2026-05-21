# Architecture

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  NIH RePORTER    │  │  NSF Awards      │  │  ClinicalTrials.gov  │  │  Semantic Scholar    │
│  fetch_nih.py    │  │  fetch_nsf.py    │  │  fetch_trials.py     │  │  fetch_scholar.py    │
└────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  └──────────┬───────────┘
         │ nih.jsonl           │ nsf.jsonl             │ trials.jsonl            │ scholar.jsonl
         ▼                     ▼                       ▼                         ▼
                          data/raw/  (one row per upstream record, raw-ish)
                                                │
                                                ▼
                                  ┌──────────────────────────┐
                                  │  build_catalog.py        │
                                  │    - dedup by PI         │
                                  │    - merge fields        │
                                  │    - build focus_text    │
                                  └────────────┬─────────────┘
                                               │ data/catalog.jsonl
                                               ▼
                                  ┌──────────────────────────┐
                                  │  embed_and_index.py      │
                                  │    OpenAI embeddings     │
                                  │    sqlite-vec            │
                                  └────────────┬─────────────┘
                                               │ data/catalog.db
                                               ▼
                                  ┌──────────────────────────┐
                                  │  search.py               │
                                  │    embed query           │
                                  │    KNN over vec_labs     │
                                  └──────────────────────────┘
```

## Why these choices

- **PI as the unit.** A "lab" is fuzzy; a PI with their portfolio of grants + papers + trials is a clean dedup target and is how VCs and BD people think about it ("introduce me to Wu's lab").
- **JSONL files as intermediate state.** Each stage writes a complete file; each stage can be re-run independently. Easy to inspect (`jq`), easy to diff in git for the small ones.
- **sqlite + sqlite-vec.** A single file, no server, ships with the repo, runs on a laptop or behind a tiny HTTP API. Vector search performance is great at ~3000 rows.
- **`text-embedding-3-small`.** $0.02 per 1M tokens, ~1536 dims. Quality plenty good for "topic similarity over an English research blurb". `text-embedding-3-large` is overkill at our scale.
- **No LLM rewriting of focus_text.** Deterministic concatenation of titles + abstracts + project terms + paper titles gives perfectly good embeddings and keeps the build free and reproducible. The LLM-summarize step is an easy add later if you want polished prose for each lab card.

## The dedup story

Name dedup key = `first-initial + last-name`, lowercased, credentials stripped:

| Raw name | Key |
| --- | --- |
| `Edmund Tsui, MD` | `e tsui` |
| `Wayne Brisbane, MD, PhD` | `w brisbane` |
| `Smith, John A.` | `j smith` |
| `Theodore B. Moore` | `t moore` |

False merges (two real PIs with the same key) are rare at UCLA scale. When they do occur, `name_aliases` and `depts` arrays let you spot them. A hardening pass would use NIH `profile_id` + Semantic Scholar `authorId` as preferred keys.

## Schema: one row of `catalog.jsonl`

```jsonc
{
  "lab_id": "w brisbane",                // canonical dedup key
  "display_name": "Wayne Brisbane",
  "name_aliases": ["Wayne Brisbane, MD", ...],
  "depts": ["UCLA Department of Urology", ...],
  "funding": {
    "nih_total_usd": 2480000,
    "nih_grant_count": 3,
    "nsf_total_usd": 0,
    "nsf_award_count": 0
  },
  "clinical": {
    "trial_count": 2,
    "nct_ids": ["NCT...", "NCT..."],
    "trials": [{ "nct_id": "...", "title": "...", "conditions": [...], "phase": [...], "status": "RECRUITING", "role": "PRINCIPAL_INVESTIGATOR" }]
  },
  "scholar": {
    "author_id": "12345678",
    "h_index": 24,
    "citation_count": 1840,
    "paper_count": 78,
    "recent_papers": [{ "title": "...", "year": 2025, "venue": "JCO" }]
  },
  "nih_grants": [{ "project_num": "5R01CA...", "title": "...", "amount": 540000, "year": 2024 }],
  "nsf_awards": [...],
  "focus_text": "Title 1\nAbstract 1\nProject Term\nTitle 2\n..."
}
```

`focus_text` is what gets embedded. Everything else is metadata the search CLI prints.

## Cost / runtime estimate

| Step | Time | Cost |
| --- | --- | --- |
| fetch_nih | 5-10 min | $0 |
| fetch_nsf | 2-5 min | $0 |
| fetch_trials | 10-20 min (~2000 trials × `get_trial_details`) | $0 |
| fetch_scholar | 30-50 min @ 1 req/s w/o key | $0 |
| build_catalog | <1 min | $0 |
| embed_and_index | 5-10 min | <$1 (≈3K rows × 1K tokens × $0.02/1M) |
| **Total** | **~60 min** | **<$1** |

A Semantic Scholar API key cuts the scholar step to ~10 min.
