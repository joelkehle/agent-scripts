---
summary: "Normative state-ownership doctrine: which store owns which kind of fact across the JK / UCLA-TDG distributed agent system."
read_when:
  - Creating, choosing, or extending any state store (DB, JSON files, wiki pages, caches).
  - Deciding where a fact belongs: noun DB, project-manager, wiki, source system, or repo-local data/.
  - Designing intake, sync, or any pipeline that copies data between stores.
  - Reviewing a change that adds tables, schemas, or persistent files.
---

# State Architecture

Version: 1.1 (2026-06-10)

This is the normative contract. Rationale and the longer intake design live in
`~/Projects/shared/brainstorm/universal-intake-state-architecture.md`. If a change
moves state ownership, update this doc in the same commit, bump the version, and add
a changelog line.

## Tier Table

Every category of fact has exactly one home. Everything else holding a copy is a
projection.

| Tier | Authoritative store | Owns | Everything else is |
|---|---|---|---|
| Identity nouns | `ucla-tdg-assistant-db` (Supabase Postgres) | people, organizations, agreements, their IDs and relationships (`people`, `organizations`, `agreement_people`, rolodex) | a cache with a pointer back |
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

- `ucla-tdg-email-triage` `internal/contactstore` (local contacts SQLite, added
  2026-06-05): competes with assistant-db rolodex. Target: read capability
  `ucla-tdg-contact-resolver` (`contact-resolve { email|name|query }`) on the UCLA
  bus backed by assistant-db. Until that exists, treat the local SQLite strictly as
  a read-through cache — do not record new authoritative contact/org facts there,
  and do not grow its schema.
- `ucla-tdg-email-triage` repo-root handoff/RECONCILED narrative files: durable
  knowledge parked in a code repo. New durable narrative goes to the wiki or PM
  notes; repo docs are for repo behavior.

## Changelog

- 1.1 (2026-06-10): register email-triage `data/documents/` document-clerk
  projection cache (ruling under Ownership Rulings).
- 1.0 (2026-06-09): initial doctrine. Tier table, projection rule, bus-discovery
  rule, assistant-db/PM ownership ruling, contactstore retirement note.
