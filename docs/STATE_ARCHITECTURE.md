---
summary: "Normative state-ownership doctrine: which store owns which kind of fact across the JK / UCLA-TDG distributed agent system."
read_when:
  - Creating, choosing, or extending any state store (DB, JSON files, wiki pages, caches).
  - Deciding where a fact belongs: noun DB, project-manager, wiki, source system, or repo-local data/.
  - Designing intake, sync, or any pipeline that copies data between stores.
  - Reviewing a change that adds tables, schemas, or persistent files.
---

# State Architecture

Version: 1.16 (2026-07-19)

This is the normative contract. Rationale and the longer intake design live in
`~/Projects/shared/brainstorm/universal-intake-state-architecture.md`. If a change
moves state ownership, update this doc in the same commit, bump the version, and add
a changelog line.

## Tier Table

Every category of fact has exactly one home. Everything else holding a copy is a
projection.

| Tier | Authoritative store | Owns | Everything else is |
|---|---|---|---|
| Identity and IP docket nouns | `ucla-tdg-assistant-db` — hosted on beelink Postgres + PostgREST `127.0.0.1:8239` since 2026-06-10 (cloud Supabase is a frozen legacy copy pending teardown; do NOT write to it) | people, organizations, agreements, technologies, IP sequences, patent/application matters, interested parties, funding assertions, imported source dates, their IDs and relationships | a cache with a pointer back |
| Work nouns | `ucla-tdg-project-agents` project-manager (SQLite `project-manager.db`) | canonical `project_id`, tasks, deadlines, escalation runtime, proposals, invention seeds | a proposal *into* it |
| Stories / narrative | UCLA TDG Wiki (MediaWiki, `wiki.techtransfer.agency`) | SOPs, process rules, deal/invention/person history, "why we decided this" — citing noun IDs | a draft |
| Personal narrative | JK `llm-wiki` | same role, scope `personal` | a draft |
| Personal life events | `life-events` single-writer service; immutable one-record-per-file log at `nas:state/life-events/log/` | personal timeline event assertions, their EDTF dates and attribution, event identity, provenance pointers, and immutable correction/retraction history; never evidence bytes or narrative truth | a rebuildable local-SSD projection, wiki draft, feed, or dashboard |
| Interactions | `ucla-tdg-project-agents` project-manager `interactions` table for `scope=ucla`; `life-events` event log for promoted `scope=personal` timeline events | the fact and provenance of communication events (meetings, email threads, calls, voice memos, message threads), including what outputs they produced; never task state, identities, or narrative truth | a projection into PM proposals, wiki drafts, timelines, or dashboards |
| Source evidence | NAS `/mnt/synology-share1/evidence/<channel>/<id>/` canonical owned copies; Gmail, Krisp, Apple, and other vendor clouds are capture devices and convenience caches | the immutable record: media, transcript, message/export bytes, manifest, hashes, and stable `source_ref` / `evidence_ref` | never copied as truth |
| Agent working state | each repo's `data/` | run artifacts, caches, learned policy docs; disposable and regenerable | n/a — never authoritative |
| Agent org governance | `shared/manager/ops/config/agent-org.json` | Joel Inc agent titles, reporting lines, trust level, safety class, and escalation policy | a projection into bus passports, dashboards, docs, or wiki pages |
| Transport | pinakes bus (UCLA :8080, JK :8081) | agent registration secrets for HMAC identity; no durable workflow facts (see `~/Projects/shared/pinakes/docs/ECOSYSTEM_ARCHITECTURE.md`) | — |

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
- **IP docket vs project-manager:** assistant-db owns the imported technology,
  sequence, application, ownership-interest, funding-assertion, and source-deadline
  facts, with Inteum export provenance. Project-manager may consume those facts and
  propose or own filing-decision tasks; it must not mirror the docket as task state.
  A filing deadline in assistant-db is a docket fact. The assignment, escalation,
  and completion of work prompted by that deadline belong to project-manager.
- **Inteum / Ironclad:** external systems of record for final operational
  agreement/case state where they exist. Our stores hold working state plus
  pointers, until a sync is explicitly engineered.
- **interaction ledger (`interactions`, added 2026-06-16, branch
  interaction-ledger):** project-manager owns UCLA-scope interaction projections
  because meeting/email outputs become PM proposals there. Each interaction row
  carries `source_ref` and is rebuildable from owned evidence; deleting the table
  must not destroy the source record. Commitments point to PM proposals/tasks
  rather than owning their state. Decisions and knowledge are queued as
  propose-only wiki distillation items; the wiki remains narrative truth after
  human approval. Personal-scope events promoted into the personal timeline belong
  to the `life-events` event log and must not be written into UCLA systems.
- **personal life-event log (`nas:state/life-events/`, added 2026-07-19,
  JK-SPEC-LIFEEVENT-001):** `life-events` owns canonical personal timeline state.
  The Beelink `life-events` service is the sole writer. It appends immutable
  one-record-per-file JSON under `log/`; corrections and retractions are new
  records, never edits or deletes. Source archives, media, transcripts, and other
  evidence bytes remain under `nas:evidence/...`; life-event records contain only
  evidence references and hashes.

  While the NAS state root is unavailable, the writer may use an explicitly
  configured local state root with the identical immutable-file layout. There is
  no implicit repo-local fallback. Restoration copies immutable record files into
  `nas:state/life-events/`, then rebuilds projections. Feed, people, geo, and
  undated SQLite projections live on Beelink local SSD only, never on NFS/SMB, and
  are safe to delete and rebuild from the event log.
- **email-triage document clerk (`data/documents/`, added 2026-06-10, branch
  document-clerk):** content-addressed projection cache of Gmail attachments
  (blobs + meta + extracted text/facts, keyed by sha256). Agent-working-state
  tier: every meta record carries thread/message `source_ref`s into Gmail;
  safe to delete and rebuild by re-capture + re-processing. It never coins
  identity nouns — agreement entities stay assistant-db, operational agreement
  state stays Ironclad/Inteum; the clerk only stages actions toward them.

- **hall-monitor `data/hall-monitor.db` (added 2026-06-10, M1 build):**
  disposable SQLite working state for the read/propose-only fleet supervisor: finding
  dedup status, first/last-seen timestamps, scan log, fingerprints, and source
  pointers. Agent-working-state tier; safe to delete and rebuild from Prometheus,
  wwi loop files, and Pinakes read endpoints. It never owns service truth, work
  nouns, or bus registry facts; it only remembers what hall-monitor has already
  reported.

- **fleet-repair-dispatcher state and repair receipts (added 2026-07-18):**
  `~/.local/state/fleet-repair-dispatcher/notification.json` is disposable
  agent-working state used only for at-most-once daily ntfy delivery. Dry-run
  JSONL under that directory is also disposable evaluation evidence: it records
  no attempted action and is not an action audit. The proof files under
  `shared/dev-dashboard/codex-output/fleet-repair-shadow-pilot/` are a disposable
  projection of Hall Monitor findings plus Manager-owned policy; Hall Monitor and
  Prometheus remain the source of observed alert truth, while
  `shared/manager/ops/config/repair-policies.json` owns the pilot classification
  and compiled recipe policy.

  Durable repair decision, attempt, outcome, verification, approval, and rollback
  events belong to the private Operations repo at
  `observations/<target_host_id>/repair-log/`, written only through the dedicated
  `~/.local/share/ops-state` clone. Each event is a new immutable, uniquely named
  JSON file; earlier events are never edited. A pre-action decision/attempt event
  must be atomically created, committed, and pushed before any repair write. Git
  sync failure, an unpushed prior event, unreadable receipt history, or corrupt
  local projection fails write mode closed. Receipt records contain fixed step
  identifiers and structured outcomes, never raw alert bodies, stdout/stderr, or
  secrets. Any local cooldown, lease, or idempotency database is a disposable
  projection rebuilt from pushed receipts plus live Hall Monitor truth. Manager
  owns policy/recipe definitions; Operations owns the immutable lifecycle record.

- **jk-fitness-telemetry `data/fitness.db` (added 2026-06-11, v1 spec):** fleet-side
  archive of Apple Health *fitness* telemetry. The iPhone Health database remains
  the upstream source of truth but is not fleet-queryable, so `raw_payloads`
  (allowlist-filtered Health Auto Export pushes + baseline import batches) is the
  fleet's authoritative evidence copy — append-only, never edited. The
  `metrics`/`workouts`/`sleep` tables are projections derived from `raw_payloads`
  (each row carries `payload_id` as source_ref) and are safe to drop and rebuild
  from `raw_payloads` (dedicated rebuild command deferred to v2).
  Clinical data is excluded at ingest by allowlist (repo AGENTS.md hard boundary;
  ruling memory `feedback-fitness-telemetry-inbounds` 2026-06-11). Spec:
  `jk-fitness-telemetry/docs/FITNESS_TELEMETRY_SPEC.md`.

- **Joel Inc agent org chart (added 2026-06-16):**
  `shared/manager/ops/config/agent-org.json` owns agent titles, reporting lines,
  trust/probation status, safety class, and escalation policy. Manager owns this
  because it already owns allowlist, promotion, verification, fleet compliance,
  dashboards, and alerts. Pinakes may project capability/passport metadata, and
  wikis or dashboards may mirror the org chart, but they must cite this file.
  Individual agent repos must not become authoritative for their own manager.

- **ucla-tdg-ip-agents intern-manager GitHub sweep cursor
  (`data/intern-manager/github-sweep-cursor.json`, added 2026-06-26):**
  disposable agent working state for deduping 15-minute intern GitHub sweeps and
  retrying PR-review dispatch. GitHub remains the source for issues, comments,
  PRs, and head SHAs; project-manager remains the owner of work nouns once a
  proposal is accepted. The cursor only records what the intern-manager has
  observed or already handed to the GitHub review agent. It is safe to delete and
  rebuild from GitHub plus bus/project-manager receipts.

- **ucla-tdg-email-triage Gmail History attention-event ledger
  (`data/attention-events/`, added 2026-06-27):** disposable agent working state
  and interaction projection for Gmail History label transitions observed by the
  watcher. Gmail History / owned evidence copies remain source evidence; the
  project-manager `interactions` table remains the owner of any promoted UCLA
  communication-event facts. The ledger may store watcher cursor state,
  idempotent event IDs, thread/message refs, label deltas, attribution guesses,
  and learning/report provenance, but it must never own tasks, policy, identity
  nouns, or narrative truth. Rows must carry source refs and be safe to delete
  and rebuild from upstream evidence plus watcher reprocessing.

- **ucla-tdg-ip-agents intern-manager PM event log
  (`data/intern-manager/pm-events.jsonl` + sibling JSON state files, added
  2026-07-03, JK-SPEC-INTERNPM-001 mission A1):** durable, append-only owner of
  the intern-manager's own action/outcome history — dispatches sent, dispatch
  failures, check-ins observed, review replies received, proposals filed, and
  (as later missions land) nudges, routes, and escalations. Unlike the sweep
  cursor above, this log is NOT disposable: it is the audit trail (spec NFR-2)
  and metrics substrate (PM-MET-1/4), and its failure-and-timing facts are not
  rebuildable from upstream. GitHub remains the source for issues/PRs/comments;
  project-manager remains the owner of proposals; records carry evidence
  pointers (URLs, SHAs, conversation IDs) back to those owners. UCLA work
  product: per PM-MET-4 it must never be written to the personal llm-wiki
  ledger.

- **private Langfuse evaluation datasets (added 2026-07-19):** disposable
  evaluation telemetry only. They may hold fixture IDs, hashes, redacted
  structured outputs, model usage, latency, cost, and scores. They never own
  production dialogue, source evidence, workflow state, policy, tasks, trial
  state, or model-selection decisions, and must be safe to rebuild from
  committed fixtures, code, and explicitly authorized runs. Do not store source
  bodies, private conversation replays, full prompts, raw evidence references,
  or free-form model responses without a separate explicit privacy contract.
  Loop receipts and proof pages are working-state projections; ratified policy
  remains in its owning repository.

- **assistant-db `ip_sequence_email_threads` (added 2026-07-14, feat/inteum-docket-import):**
  assistant-db owns the docket-relevance mapping between Inteum IP sequences and
  Gmail threads (match status, match location, message-level provenance with body
  hashes only — never body content). Rows are labeled projections of Gmail search
  evidence: each carries thread/message source refs and is safe to delete and
  rebuild by re-running the sequence-token search. Gmail/NAS remain source
  evidence; the PM `interactions` table remains the owner of promoted
  communication-event facts; PM `intake_work_state` metadata (derived from these
  links) lives in project-manager and cites `ip_sequence_id` back to assistant-db.

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
- 1.16 (2026-07-19): classify private Langfuse evaluation datasets as
  disposable, redacted evaluation telemetry; forbid them from owning source,
  conversation, workflow, policy, task, trial, or model-selection truth.
- 1.15 (2026-07-19): register the `life-events` single-writer immutable log at
  `nas:state/life-events/` as canonical personal timeline state; keep evidence in
  `nas:evidence/...`, allow only an explicit local interim root, and classify
  local-SSD SQLite indexes as rebuildable projections.
- 1.14 (2026-07-18): define Operations `observations/<target_host_id>/repair-log/`
  as the immutable repair-lifecycle owner; classify guarded dry-run JSONL as a
  disposable projection and require pushed pre-action receipts before any write.
- 1.13 (2026-07-18): register fleet-repair-dispatcher notification state and
  proof output as disposable projections; require a new durable append-only audit
  owner before any write-mode remediation.
- 1.12 (2026-07-14): register assistant-db `ip_sequence_email_threads` as the
  canonical case↔Gmail-thread docket-relevance link table (rebuildable labeled
  projection; PM keeps interaction/event ownership and intake work state).
- 1.11 (2026-07-13): clarify assistant-db ownership of technology and IP docket
  nouns imported from Inteum, including uncertain funding assertions and source
  deadlines; keep resulting filing-decision work in project-manager.
- 1.10 (2026-07-03): register the ucla-tdg-ip-agents intern-manager PM event
  log as the durable, non-disposable owner of PM action/outcome history
  (JK-SPEC-INTERNPM-001 audit + metrics substrate).
- 1.9 (2026-06-27): register email-triage `data/attention-events/` as
  disposable Gmail History watcher working state / interaction projection.
- 1.8 (2026-06-26): register the ucla-tdg-ip-agents intern-manager GitHub sweep
  cursor as disposable agent working state for sweep dedup and review dispatch
  retry.
- 1.7 (2026-06-16): add the Interactions tier for communication-event
  provenance and invert Source evidence to NAS-owned canonical evidence, with
  vendor clouds demoted to capture devices/caches.
- 1.6 (2026-06-16): register Manager-owned Joel Inc agent org chart for titles,
  reporting lines, trust/probation, safety class, and escalation policy.
- 1.5 (2026-06-11): register jk-fitness-telemetry `data/fitness.db` — raw_payloads
  as fleet-authoritative fitness evidence copy, metric tables as rebuildable
  projections; clinical excluded at ingest by allowlist.
- 1.4 (2026-06-10): register hall-monitor `data/hall-monitor.db` as disposable
  agent working state for finding dedup, scan log, and digest rendering.
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
