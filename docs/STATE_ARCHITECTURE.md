---
summary: "Normative state-ownership doctrine: which store owns which kind of fact across the JK / UCLA-TDG distributed agent system."
read_when:
  - Creating, choosing, or extending any state store (DB, JSON files, wiki pages, caches).
  - Deciding where a fact belongs: noun DB, project-manager, wiki, source system, or repo-local data/.
  - Designing intake, sync, or any pipeline that copies data between stores.
  - Reviewing a change that adds tables, schemas, or persistent files.
---

# State Architecture

Version: 1.3 (2026-06-10)

This is the normative contract. Rationale and the longer intake design live in
`~/Projects/shared/brainstorm/universal-intake-state-architecture.md`. If a change
moves state ownership, update this doc in the same commit, bump the version, and add
a changelog line.

## Tier Table

Every category of fact has exactly one home. Everything else holding a copy is a
projection.

| Tier | Authoritative store | Owns | Everything else is |
|---|---|---|---|
| Identity nouns | `ucla-tdg-assistant-db` — hosted on beelink Postgres + PostgREST `127.0.0.1:8239` since 2026-06-10 (cloud Supabase is a frozen legacy copy pending teardown; do NOT write to it) | people, organizations, agreements, their IDs and relationships (`people`, `organizations`, `agreement_people`, rolodex) | a cache with a pointer back |
| Work nouns | `ucla-tdg-project-agents` project-manager (SQLite `project-manager.db`) | canonical `project_id`, tasks, deadlines, escalation runtime, proposals, invention seeds | a proposal *into* it |
| Stories / narrative | UCLA TDG Wiki (MediaWiki, `wiki.techtransfer.agency`) | SOPs, process rules, deal/invention/person history, "why we decided this" — citing noun IDs | a draft |
| Personal narrative | JK `llm-wiki` | same role, scope `personal` | a draft |
| Source evidence | Gmail, Krisp, Synology NAS media (`/mnt/synology-share1`) | the immutable record, referenced by stable `source_ref` (thread_id, message_id, NAS path) | never copied as truth |
| Agent working state | each repo's `data/` | run artifacts, caches, learned policy docs; disposable and regenerable | n/a — never authoritative |
| Transport | pinakes bus (UCLA :8080, JK :8081) | nothing durable, ever (see `~/Projects/shared/pinakes/docs/ECOSYSTEM_ARCHITECTURE.md`) | — |

## Rules

1. **Facts are born in their home store and flow outward.** A wiki page cites a
   `person_id`; it never coins one. An email agent proposes a task to
   project-manager; it never keeps the authoritative copy.
2. **Every second copy is a labeled projection.** It must carry a pointer to its
   source (ID or `source_ref`) and be safe to delete and rebuild. If deleting it
   would lose information, it is an unlabeled source of truth — fix that.
3. **No new stores without bus discovery first.** Before adding a table, schema, or
   persistent file family: run `bus-discover`, check this table, and reuse or extend
   the owning store. If a new store is genuinely needed, add it to this doc in the
   same change.
4. **Wikis hold knowledge, not state.** No task status, deadlines, contact records,
   or agreement metadata as wiki facts.
5. **The bus is never storage.** Bus message archives (e.g. `data/agent-mail/`) are
   logs subject to retention, not state anyone reads back for truth.

## Ownership Rulings

- **assistant-db vs project-manager:** assistant-db owns identity nouns (who/what
  exists: people, orgs, agreements). Project-manager owns work nouns (what we are
  doing: projects, tasks, proposals). They reference each other by ID only. Neither
  mirrors the other's tables; any project-ish data in assistant-db is a UI
  projection of PM, not a source.
- **Inteum / Ironclad:** external systems of record for final operational
  agreement/case state where they exist. Our stores hold working state plus
  pointers, until a sync is explicitly engineered.
- **email-triage document clerk (`data/documents/`, added 2026-06-10, branch
  document-clerk):** content-addressed projection cache of Gmail attachments
  (blobs + meta + extracted text/facts, keyed by sha256). Agent-working-state
  tier: every meta record carries thread/message `source_ref`s into Gmail;
  safe to delete and rebuild by re-capture + re-processing. It never coins
  identity nouns — agreement entities stay assistant-db, operational agreement
  state stays Ironclad/Inteum; the clerk only stages actions toward them.

## Known Violations (to retire)

(none open)

## Retired Violations

- `ucla-tdg-email-triage` `internal/contactstore`: RETIRED 2026-06-10
  (email-triage 81e49c5). `ucla-tdg-contact-resolver` (read-only
  `contact-resolve { email|name|query }`, port 8238, backed by assistant-db
  PostgREST) now exists; contactstore is a 24h-TTL read-through cache whose rows
  require an assistant-db `person_id` + `source_of_truth` back-pointer — local
  identity minting is blocked in code. Workbench org briefing notes remain local
  working context by design. Pending ops item: resolver runs degraded until
  `CONTACT_RESOLVER_SUPABASE_URL/KEY` are provisioned (Joel).
- `ucla-tdg-email-triage` repo-root handoff/RECONCILED narrative files:
  RETIRED 2026-06-09 (email-triage 97fd634). Dated relay narrative moved to
  `docs/archive/relay/`; AGENT_HANDOFF_PROTOCOL.md pins future relay files there.
  Related: disposition mutations no longer write PM-owned `manual/` trackers
  (email-triage 0c32bed); source notes live in repo-local `data/source-notes/`.

## Changelog

- 1.3 (2026-06-10): identity-noun hosting cutover — beelink Postgres+PostgREST
  (:8239) is live with the full Supabase export (14 tables, counts verified);
  cloud Supabase frozen as legacy copy; Vercel/Supabase teardown backlogged
  (decision points in assistant-db deploy/local/README.md + docs/LOCAL_IDENTITY_STORE_SPEC.md).
  Nightly pg_dump to NAS via beelink crontab.
- 1.2 (2026-06-10): retire both v1.0 known violations (contact-resolver built +
  contactstore demoted to labeled cache, 81e49c5; relay narrative archived,
  97fd634; PM manual/ tracker writes removed, 0c32bed).
- 1.1 (2026-06-10): register email-triage `data/documents/` document-clerk
  projection cache (ruling under Ownership Rulings).
- 1.0 (2026-06-09): initial doctrine. Tier table, projection rule, bus-discovery
  rule, assistant-db/PM ownership ruling, contactstore retirement note.
