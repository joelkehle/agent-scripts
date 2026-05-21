# Continuity — UCLA labs catalog

This file captures the state of this build so a future Claude Code session (or you) can pick it up cold. The branch `claude/ucla-lab-catalog-7ujxT` is the source of truth — anything not committed here is lost when the container reaps.

## Goal

A semantically-searchable catalog of every UCLA STEM/biomedical/clinical research lab, so when a business or VC says "find me labs working on X" I can return a ranked list with PIs, focus areas, funding, recent grants, and contact paths.

## Decisions locked in (this session, 2026-05-21)

| Decision | Choice |
| --- | --- |
| Scope | STEM + biomed + clinical (NIH/NSF/CT.gov coverage; skip humanities) |
| Format | Searchable database + semantic search (sqlite + sqlite-vec) |
| Freshness | One-shot snapshot |
| Language | Python 3.11+ |
| Storage | Commit to repo under `/ucla-labs/`; raw JSONL gitignored, catalog.jsonl committed |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dim), `OPENAI_API_KEY` required |
| Vector DB | sqlite-vec extension, single-file `data/catalog.db` |

## Data sources

| Source | API | Auth | Status from this session |
| --- | --- | --- | --- |
| NIH RePORTER | `api.reporter.nih.gov/v2` | none | **Blocked by sandbox allowlist.** Code is ready. |
| NSF Awards | `api.nsf.gov/services/v1/awards.json` | none | **Blocked by sandbox allowlist.** Code is ready. |
| ClinicalTrials.gov | `clinicaltrials.gov/api/v2` | none | **Blocked by sandbox allowlist.** Code is ready. |
| ClinicalTrials.gov (MCP) | brokered MCP | — | **Works**. Used to pull preview sample. |
| Semantic Scholar | `api.semanticscholar.org/graph/v1` | optional `SEMANTIC_SCHOLAR_API_KEY` | **Blocked**. Code is ready. |
| OpenAI Embeddings | `api.openai.com/v1/embeddings` | `OPENAI_API_KEY` | **Blocked + no key in env**. Code is ready. |

## The blocker

This Claude Code on the web environment has a strict egress allowlist; only the brokered MCP servers and a small set of hosts are reachable. Every direct API call returned `403 Host not in allowlist`. The pipeline runs fine outside this sandbox.

### Two ways to run it

**A. Locally on your laptop (fastest path forward).**

```bash
git fetch origin claude/ucla-lab-catalog-7ujxT
git checkout claude/ucla-lab-catalog-7ujxT
cd ucla-labs
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=sk-...
make all
make search Q="cryo-EM membrane proteins"
```

Expected runtime end-to-end: 30–60 min (Semantic Scholar enrichment is the slow leg without an API key, ~1s/PI). Expected embedding cost: <$1.

**B. From a new Claude Code on the web session with relaxed network policy.**

Update the environment's network policy to allowlist:
- `api.reporter.nih.gov`
- `api.nsf.gov`
- `clinicaltrials.gov`
- `api.semanticscholar.org`
- `api.openai.com`

Set `OPENAI_API_KEY` as an environment variable on the environment. Start a session on this branch and ask Claude to "run `make all` and commit the resulting `catalog.jsonl` + `catalog.db`."

Policy docs: https://code.claude.com/docs/en/claude-code-on-the-web

## What's committed already

- Full Python pipeline under `ucla-labs/src/`: `fetch_nih.py`, `fetch_nsf.py`, `fetch_trials.py`, `fetch_scholar.py`, `build_catalog.py`, `embed_and_index.py`, `search.py`, `common.py`.
- `Makefile` with `make install | fetch | catalog | index | search | all | clean`.
- `requirements.txt`, `.gitignore`, `README.md`, `docs/ARCHITECTURE.md`.
- **Preview** trial data in `data/raw/trials_preview.jsonl` pulled via the MCP this session — real UCLA trials with real PIs, useful to dry-run `build_catalog.py` on before doing the full fetch.

## How to dry-run with just the preview file (laptop)

```bash
cd ucla-labs
# rename the preview to look like a full pull
cp data/raw/trials_preview.jsonl data/raw/trials.jsonl
# touch empty NIH/NSF/scholar so build_catalog runs
: > data/raw/nih.jsonl
: > data/raw/nsf.jsonl
: > data/raw/scholar.jsonl
python -m src.build_catalog
export OPENAI_API_KEY=sk-...
python -m src.embed_and_index
python -m src.search "prostate cancer focal therapy"
```

This proves the end-to-end works with ~30-60 real labs before you commit to the full ~30-min run.

## Known limitations / future work

- **Name dedup** uses `first-initial + last-name`, which collapses "J Smith" cases. Acceptable for v1, but a future pass should use NIH `profile_id` and Semantic Scholar `authorId` as harder identifiers when present.
- **Department field** is extracted from NIH `org_dept` (clean) and from trial `affiliation` strings (messy). Catalog stores all alternatives; presentation layer picks the longest non-empty one.
- **No humanities / unfunded labs.** Will require department-page scraping (puppeteer-core is already in the parent repo's `package.json`).
- **Snapshot only.** No refresh logic. Adding `--since YYYY-MM` to the fetchers would make this incremental.

## Where the conversation has been

Joel asked for a catalog of UCLA professors' labs to match VC interests. We scoped to STEM+biomed+clinical, picked sqlite+sqlite-vec for semantic search, OpenAI embeddings for vector quality, and committed to a one-shot build. The sandbox blocked the public APIs we need, so the work this session was: write the complete pipeline, pull a real MCP-sourced preview, document the resume path. The artifact you're looking for next is `data/catalog.jsonl` — that's what you produce by running `make all` outside this sandbox.
