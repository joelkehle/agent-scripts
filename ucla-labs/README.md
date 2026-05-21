# ucla-labs

A one-shot pipeline that builds a semantically-searchable catalog of UCLA STEM, biomedical, and clinical research labs. Given a natural-language query like *"labs working on cryo-EM of membrane proteins"* it returns ranked PI matches with focus areas, funding, recent grants, and links.

## Quick start

```bash
cd ucla-labs
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export OPENAI_API_KEY=sk-...    # required for embeddings

make catalog                    # full pipeline, ~30-60 min
make search Q="cryo-EM membrane proteins"
```

Or step-by-step:

```bash
python -m src.fetch_nih           # NIH RePORTER -> data/raw/nih.jsonl
python -m src.fetch_nsf           # NSF Awards   -> data/raw/nsf.jsonl
python -m src.fetch_trials        # ClinicalTrials.gov v2 -> data/raw/trials.jsonl
python -m src.fetch_scholar       # Semantic Scholar -> data/raw/scholar.jsonl
python -m src.build_catalog       # dedupe + merge -> data/catalog.jsonl
python -m src.embed_and_index     # embed + sqlite-vec -> data/catalog.db
python -m src.search "your query"
```

## Data sources

| Source | API | Auth | Coverage |
| --- | --- | --- | --- |
| NIH RePORTER | `api.reporter.nih.gov/v2` | none | All NIH-funded UCLA labs, 2020-present |
| NSF Awards | `api.nsf.gov/services/v1/awards.json` | none | All NSF-funded UCLA labs, 2020-present |
| ClinicalTrials.gov | `clinicaltrials.gov/api/v2` | none | UCLA-sponsored or UCLA-located trials |
| Semantic Scholar | `api.semanticscholar.org/graph/v1` | none (rate-limited; key recommended) | Recent paper titles per PI |
| OpenAI Embeddings | `api.openai.com/v1/embeddings` | `OPENAI_API_KEY` | `text-embedding-3-small`, 1536 dims |

All UCLA aliases are queried (`University of California, Los Angeles`, `UCLA`, `UCLA Health`, `Jonsson Comprehensive Cancer Center`, etc.) and results post-filtered for exact UCLA affiliation.

## Architecture

See `docs/ARCHITECTURE.md`.

## Status / continuity

See `docs/CONTINUITY.md` for the current state of the build and the open decisions.
