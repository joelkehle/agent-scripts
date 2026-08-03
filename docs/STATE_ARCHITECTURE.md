---
summary: "Normative state-ownership doctrine: which store owns which kind of fact across the JK / UCLA-TDG distributed agent system."
read_when:
  - Creating, choosing, or extending any state store (DB, JSON files, wiki pages, caches).
  - Deciding where a fact belongs: noun DB, project-manager, wiki, source system, or repo-local data/.
  - Designing intake, sync, or any pipeline that copies data between stores.
  - Changing GitHub contribution state, owner attention, supervised coding state, or reviewer calibration.
  - Reviewing a change that adds tables, schemas, or persistent files.
---

# State Architecture

Version: 1.27 (2026-08-03)

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
| UCLA work nouns | `ucla-tdg-project-agents` project-manager (SQLite `project-manager.db`) | canonical UCLA `project_id`, tasks, deadlines, escalation runtime, proposals, invention seeds, and owner-attention state | a proposal *into* it |
| Repository engineering lifecycle | GitHub issues and PRs, including versioned `issue-claim.v1` issue-comment events and `owner-attention.v1` PR events | issue definitions and claim leases for repo engineering; personal/shared repo-bound ready-for-Joel attention and disposition by exact head | assignment, label, dashboard, coordinator cursor, or private receipt projection |
| Supervised coding orchestration | Manager Projects MCP durable state under `~/.local/state/claude-projects-mcp/agent-{missions,initiatives,campaigns}/` | exact mission, initiative, and campaign lifecycle records; contiguous audit journals; bounded parent/child intent; supervised child-run references; validation and independent-review receipts; immutable ready packets; terminal outcomes and recovery evidence | non-authoritative disposable standalone agent-run working state, or a dashboard, metric, WWI breadcrumb, GitHub artifact, or narrative summary |
| Stories / narrative | UCLA TDG Wiki (MediaWiki, `wiki.techtransfer.agency`) | SOPs, process rules, deal/invention/person history, "why we decided this" — citing noun IDs | a draft |
| Personal narrative | JK `llm-wiki` | same role, scope `personal` | a draft |
| Personal life events | `life-events` single-writer service; immutable one-record-per-file log at `nas:state/life-events/log/` | personal timeline event assertions, their EDTF dates and attribution, event identity, provenance pointers, and immutable correction/retraction history; never evidence bytes or narrative truth | a rebuildable local-SSD projection, wiki draft, feed, or dashboard |
| Personal / Joel Inc decision lifecycle | NOUS Decision Ledger, written only through the protected JK `llm-wiki` NOUS server; canonical append-only events in the existing private `llm-wiki` PostgreSQL | `scope=personal` or `scope=joel_inc` decision-time forecasts and recommendations, action selection, verified outcomes, attributable Joel assessments, lessons, corrections/retractions, and the exact values, goals, and evidence bindings used | a Collective Chat link, wiki narrative, policy-evaluation input, dashboard, mutable stream head, or query index |
| Interactions | `ucla-tdg-project-agents` project-manager `interactions` table for `scope=ucla`; `life-events` event log for promoted `scope=personal` timeline events | the fact and provenance of communication events (meetings, email threads, calls, voice memos, message threads), including what outputs they produced; never task state, identities, or narrative truth | a projection into PM proposals, wiki drafts, timelines, or dashboards |
| Source evidence | NAS `/mnt/synology-share1/evidence/<channel>/<id>/` canonical owned copies; Gmail, Krisp, Apple, and other vendor clouds are capture devices and convenience caches | the immutable record: media, transcript, message/export bytes, manifest, hashes, and stable `source_ref` / `evidence_ref` | never copied as truth |
| Mail synchronization governance | `mail-mirror` append-only, metadata-only synchronization ledger at the future scope-separated namespace `nas:state/mail-mirror/sync-ledger/<scope>/<opaque-account-ref>/` (approved; not operational) | opaque synchronization stream, generation, and epoch IDs; committed IMAP and Gmail History boundaries; synchronization gaps; machine-only capture, reconciliation, metadata-refresh, and gap-resolution obligations, including canonical opaque provider message and thread locator IDs required to execute them; capture attempt/outcome classifications; recovery, freeze, verification, and promotion records; immutable references and locator hashes pointing to canonical evidence | SQLite and other local indexes are rebuildable projections; scheduler state, leases, holders, fences, page progress, and governor-token state are ephemeral or disposable; mail evidence remains owned by the Source evidence tier |
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

- **weekly focus and local workspace-run state (added 2026-07-30):**
  `/mnt/synology-share1/AgentCoord/registry/weekly-focus.yaml` owns current
  weekly priority/attention metadata: week ending, declared goals, definitions
  of done, required milestones, fallbacks, non-goals, and optional opaque
  mission/initiative/campaign references. Version 2 keeps one active execution
  reference apart from a list of proof references. It also records whether a
  goal requires supervised execution for write-capable repository work. Proof
  references grant no write authority. Old files with `execution_refs` remain
  readable for display and migration, but one file cannot mix the formats. It is
  above the supervised execution
  hierarchy and owns no execution status, descendants, budgets, evidence,
  dispatch, planning, or scheduling. Manager's supervised coding control plane
  remains authoritative for mission, initiative, and campaign truth.

  `~/.local/state/agent-workspaces/` (override:
  `AGENT_WORKSPACE_STATE_ROOT`) holds disposable atomic local coordination
  manifests for coding-process entrance, PID/start-token ownership, exit,
  abandonment, and quarantine observations. Git owns source and commits;
  AgentCoord claims own cross-host writer hints. Losing these manifests loses
  local collision/reconciliation context but no work noun, source, commit, or
  supervised execution truth. Version 2 records form a repository or workspace
  union. Workspace records require explicit operator admission. They are
  read-only observations keyed by exact resolved path and carry no Git facts.
  Version 1 repository records remain readable. Only `agent-workspace` writes
  this directory.

- **csub delegation logs and receipts (added 2026-07-28):**
  `~/.local/state/csub/` (override: `CSUB_LOG_DIR`) is owned by the `csub`
  wrapper (`bin/csub`). `csub-*.log` and `csub-*.last.md` are disposable
  projections of Codex's own session records — safe to delete, auto-pruned
  after 14 days. `receipts.jsonl` is the authoritative append-only record of
  csub usage accounting (timestamp, mode, model, effort, sandbox, duration,
  tokens, exit, outcome — completed/timeout/signaled/failed — and log
  pointer; tokens is null when Codex reported no parseable usage, with
  outcome distinguishing interruption). Rows appended before 2026-07-28
  predate the outcome field; consumers treat a missing outcome as
  legacy/unknown, not malformed. It owns no work nouns and nothing rebuilds from
  it; loss is acceptable accounting loss, so no rebuild path is required.
  Nothing else may write to this directory.

- **assistant-db vs project-manager:** assistant-db owns identity nouns (who/what
  exists: people, orgs, agreements). Project-manager owns work nouns (what we are
  doing: projects, tasks, proposals). They reference each other by ID only. Neither
  mirrors the other's tables; any project-ish data in assistant-db is a UI
  projection of PM, not a source.
- **Repository engineering claims and owner attention (added 2026-07-26,
  JK-SPEC-GHLIFE-001):** GitHub owns issue, commit, PR, posted review, and
  adjudication facts. A server-ordered, append-only `issue-claim.v1` issue
  comment stream owns current repo-issue claim and lease state; assignment is a
  projection. For personal/shared repo-bound engineering, a server-ordered
  `owner-attention.v1` PR event stream owns exact-head readiness, invalidation,
  and disposition; `ready-for-joel` is a rebuildable label projection. UCLA
  owner attention remains in UCLA Project Manager. Non-repository personal
  attention has no owner under this ruling and must fail closed.
- **supervised coding orchestration (added 2026-07-27):** Manager's Projects
  MCP owns the durable truth that a bounded supervised coding mission,
  single-repository initiative, or named cross-repository campaign entered and
  completed each required conductor stage. Its private snapshots, contiguous
  journals, exact-SHA validation/review receipts, parent/child dispatch intent,
  terminal outcome, and immutable ready packet are one control-plane state
  family. Supervised child-run identities and outcomes are recorded through
  that family; standalone agent-run maps and cache logs remain disposable and
  may disappear on restart. Git repositories remain authoritative for code and
  commits; GitHub remains authoritative for issues, PRs, posted review, and
  adjudication. Manager orchestration records grant no external-write
  authority, including GitHub or Gmail writes, business-data or service
  changes, push, deploy, merge, migration, restart, or Joel impersonation.
  Campaign state may reference child packet hashes and bounded exact-diff
  evidence, but never owns business nouns, source evidence, credentials, raw
  model logs, or external-system truth.
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
- **NOUS Decision Ledger (approved 2026-07-25; H6):** the protected JK
  `llm-wiki` NOUS server is the sole writer for canonical personal and Joel Inc
  decision-lifecycle events. The ledger is a separate logical store implemented
  as additive, append-only tables in the existing private `llm-wiki` PostgreSQL.
  It accepts only `scope=personal` or `scope=joel_inc`. UCLA-TDG facts and work
  remain in their UCLA owners; a Joel Inc decision record may carry only typed
  external-owner references to them.

  The original decision-time question, alternatives, forecast, recommendation,
  confidence, abstention threshold, expected benefits and harms, affected
  parties, reversibility, information value, values hash, goals hash, and
  verified evidence bindings are immutable. Later action, outcome observation,
  attributable Joel assessment, lesson, correction, and retraction facts append
  new events. Exact retries are idempotent. Stale or concurrent successors fail
  closed. Mutable stream heads and query indexes are rebuildable projections;
  they never replace the event history.

  Ledger events contain typed, server-authorized evidence bindings and external
  owner references, not source evidence bytes. Every event preserves the exact
  values and goals document hashes in force. Recording a decision lifecycle does
  not authorize a task, notification, health or medical action, external write,
  learned-policy promotion, or change to Joel Inc values or decision doctrine.
  Those remain governed by their existing owners and approval boundaries.
- **mail-mirror synchronization-governance ledger (approved 2026-07-25; not
  operational):** `mail-mirror` owns the canonical append-only, metadata-only
  ledger for durable mail synchronization continuity and is its sole appender.
  Its future logical namespace is
  `nas:state/mail-mirror/sync-ledger/<scope>/<opaque-account-ref>/`. JK and
  UCLA-TDG use separate `jk/` and `ucla-tdg/` roots, configuration, access
  controls, account mappings, credentials, and service instances. Records use
  opaque account references, never an email address as the durable key.

  The payload allowlist is limited to opaque synchronization lineage IDs;
  committed IMAP and Gmail History boundaries; unresolved and resolved gap
  types and status; machine-only capture, reconciliation, metadata-refresh, and
  gap-resolution obligations; canonical opaque provider message and thread
  locator IDs required to execute those obligations; capture intent, attempt,
  and outcome classification; generation freeze, verification,
  recovery-required, and
  promotion records; and immutable references plus locator hashes pointing to
  canonical evidence. The ledger does not own account or person identity,
  account configuration, human tasks or commitments, subjects, addresses,
  header values, bodies, attachments, label names or deltas, credentials,
  OAuth material, secrets, page tokens, raw provider responses or errors, RFC
  822 bytes, manifests, blobs, evidence hashes as truth, or the evidence
  observation sequence. Canonical mail evidence remains under the Source
  evidence tier at `nas:evidence/...`; ledger references never establish
  evidence validity.

  Each transition is an immutable, versioned, typed record or atomic bundle
  with a monotonic sequence, predecessor hash, stable idempotency key, record
  hash, and allowlisted payload. Corrections, resolutions, freezes, and
  retractions append new records. SQLite is a deletable projection and may lag
  but never lead the ledger: no SQLite synchronization transition is
  acknowledged until the corresponding ledger transition is atomically
  published and durably synced under the configured store. Missing, corrupt,
  forked, truncated, or unsupported ledger state fails closed as
  `recovery_required`. After total SQLite loss, transient coordination
  disappears and governor safety restarts circuit-open with a conservative
  cooldown.

  Production NAS unavailability fails closed; there is no implicit repo-local
  or local-SSD fallback. Fixture-only Gate A2 work may use an explicitly
  configured temporary root with the same layout. This ruling authorizes policy
  and fixture-only implementation only; it does not make the ledger
  operational or authorize production NAS writes, live Gmail API or IMAP
  access, credentials, deployment, provider mutation, automatic recovery, or
  promotion. The ordering contract is not an RPO=0 claim; production durability
  requires later NAS, backup, restore, and promotion proof.

  Retain ledger records indefinitely until a separate retention policy is
  approved. Provider deletion never deletes ledger or evidence automatically.
  Decommissioning freezes the account stream, records a terminal reason,
  revokes or detaches credentials, and preserves ledger and evidence. Deletion
  or cryptographic destruction requires separate destructive-write
  authorization and a verified retention and backup decision.

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

- **ucla-tdg-ip-agents contribution-coordinator GitHub sweep cursor
  (`data/intern-manager/github-sweep-cursor.json`, added 2026-06-26):**
  disposable agent working state for deduping 15-minute contribution GitHub
  sweeps and retrying PR-review dispatch. GitHub remains the source for issues,
  comments, PRs, and head SHAs. GitHub claim events own repo-issue lease state;
  GitHub PR events own personal/shared repo-bound owner attention; Project
  Manager owns accepted UCLA work nouns. The cursor records only what the
  contribution-coordinator has observed or already handed to the GitHub review
  agent. It is safe to delete and rebuild from GitHub plus bus/project-manager
  receipts.

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

- **ucla-tdg-ip-agents contribution-coordinator PM event log
  (`data/intern-manager/pm-events.jsonl` + sibling JSON state files, added
  2026-07-03, JK-SPEC-INTERNPM-001 mission A1):** durable, append-only owner of
  the contribution-coordinator's own action/outcome history — dispatches sent,
  dispatch failures, check-ins observed, review replies received, proposals
  filed, and (as later missions land) nudges, routes, and escalations. Unlike the sweep
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
- 1.27 (2026-08-03): define weekly-focus version 2. One active execution,
  finished proof, and the supervision requirement use separate fields. Old
  files stay readable, and mixed files fail closed.
- 1.26 (2026-08-01): extend disposable local workspace-run records with a
  versioned repository/workspace union. Workspace sessions use exact-path
  identity, declare read-only operator authority, and omit Git-only facts.
- 1.25 (2026-07-30): register weekly focus as priority metadata above the
  existing mission/initiative/campaign hierarchy and local workspace manifests
  as disposable launch/reconciliation coordination state.
- 1.24 (2026-07-28): csub receipts gain the authoritative outcome field
  (completed/timeout/signaled/failed); tokens:null means no parseable usage
  reported; pre-2026-07-28 rows lack outcome and read as legacy/unknown.
- 1.23 (2026-07-28): register csub delegation state family under
  `~/.local/state/csub/` — disposable Codex-session log projections plus
  authoritative append-only usage receipts.
- 1.22 (2026-07-27): register Manager Projects MCP durable mission, initiative,
  and campaign lifecycle records as one supervised-coding control-plane state
  family; retain standalone runs as non-authoritative disposable working state
  and retain code, GitHub, business-noun, evidence, and adjudication authority
  in their existing owners.
- 1.21 (2026-07-26): make GitHub event streams canonical for repo-issue claims
  and personal/shared repo-bound engineering attention; retain UCLA
  owner-attention and work nouns in UCLA Project Manager.
- 1.20 (2026-07-25): register the protected `llm-wiki` NOUS Decision Ledger as
  the append-only owner of personal and Joel Inc decision lifecycles; bind every
  record to verified evidence plus exact values/goals hashes, keep UCLA facts in
  UCLA owners, and leave effects, policy promotion, and values changes outside
  the ledger's authority.
- 1.19 (2026-07-25): clarify that executable machine synchronization
  obligations may include canonical opaque provider message and thread locator
  IDs; this does not authorize message content, account identity, or live
  provider access.
- 1.18 (2026-07-25): authorize, but do not operationalize, `mail-mirror` as
  sole appender to the scope-separated append-only synchronization-governance
  ledger under future `nas:state/mail-mirror/sync-ledger/`; keep SQLite
  disposable and mail evidence under `nas:evidence/...`; require production
  NAS failure to fail closed with no implicit fallback; authorize fixture-only
  implementation only.
- 1.17 (2026-07-23): rename coordinator runtime references while retaining
  the legacy `data/intern-manager/` state path and historical
  `JK-SPEC-INTERNPM-001` identifier.
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
- 1.10 (2026-07-03): register the ucla-tdg-ip-agents contribution-coordinator
  (then intern-manager) PM event log as the durable, non-disposable owner of
  PM action/outcome history (JK-SPEC-INTERNPM-001 audit + metrics substrate).
- 1.9 (2026-06-27): register email-triage `data/attention-events/` as
  disposable Gmail History watcher working state / interaction projection.
- 1.8 (2026-06-26): register the ucla-tdg-ip-agents contribution-coordinator
  (then intern-manager) GitHub sweep cursor as disposable agent working
  state for sweep dedup and review dispatch retry.
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
