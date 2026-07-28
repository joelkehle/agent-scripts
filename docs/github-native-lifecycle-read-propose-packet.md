---
summary: "Approved operational specification, read/propose evidence ledger, roadmap, and proposed GitHub issue batch for Joel-owned contribution lifecycles."
read_when:
  - Implementing or reviewing JK-SPEC-GHLIFE-001.
  - Verifying the maiden-voyage contribution-lifecycle audit or its live evidence.
  - Preparing the separately authorized GitHub issue batch.
status: "Approved by Joel for Phase 0 preservation; effective after merge to main."
---

# GitHub-native lifecycle specification and evidence packet

Specification: `JK-SPEC-GHLIFE-001`

Audit date: 2026-07-26

Decision state: approved by Joel on 2026-07-26 for Phase 0 preservation;
implementation, GitHub writes, and activation remain separately authorized

## Document role and boundary

This file records the approved implementation specification and its complete
first-phase review packet: current state, gap analysis, bounded roadmap, pilot,
acceptance scenarios, draft issue bodies, external-write ledger, and exact
evidence commands.

It is not a second architecture. The canonical cross-repository contract
remains
[`contribution-review-architecture.md`](contribution-review-architecture.md).
This file supplies the executable requirements and evidence beneath that
contract. It becomes effective when the Phase 0 PR is merged to `main`.

The audit preserved the requested boundaries:

- read/propose only for GitHub and live systems;
- no issue, PR, comment, review, label, assignment, credential, deployment,
  service, migration, or runtime write;
- no branch creation, push, or commit;
- GitHub remains canonical for issues, commits, PRs, and posted review evidence;
- contributor, reviewer, and poster identities remain explicit;
- automation never uses Joel's GitHub identity;
- no automatic `APPROVE`, merge, or final `REQUEST_CHANGES`;
- Joel remains final adjudicator;
- `start_agent_mission` remains the local coding conductor, not a GitHub
  credential holder or lifecycle database;
- GitHub Actions remain outside the validation surface.

## Executive finding

The doctrine is coherent, and several hard parts are real and live. The
end-to-end lifecycle is not implemented.

The strongest existing capability is Manager's supervised coding-mission
conductor: exact-revision validation, independent review, bounded repair,
durable mission state, and ready packets are implemented and proven live.
The contribution coordinator and GitHub review agent are also deployed and
observable.

The missing operational layer is the connective contract from an approved
specification to faithful issues, guarded claims, a contributor-fork PR,
successful exact-head review, a decision-ready GitHub packet, correctly scoped
owner attention, Joel adjudication, and durable graduation of rulings.

The proposed lifecycle-conductor role will be implemented by the existing
`ucla.contribution-coordinator` deployable. That service already discovers
covered repositories, serializes PR coordination, dispatches exact-head
review, records outcomes, and calls guarded proposal adapters. Extending it to
own the bounded issue sequence reuses the current coordination and recovery
surface. No second conductor service is justified. Manager's
`start_agent_mission` remains the inner local coding conductor and durable
mission owner; it does not gain GitHub credentials or lifecycle state.

Three ordered blockers prevent a live canary:

1. Manager currently has `agent_policy: null` for
   `shared-agent-scripts`, `ucla-tdg-ip-agents`, and
   `ucla-tdg-project-agents`. They cannot run supervised implementation
   missions until an exact reviewed Manager policy build is activated.
2. The review service's first-pass provider is failing. The original snapshot
   showed 196 retryable first-pass failures and zero ready packets. A later
   snapshot showed 301 retryable failures and still zero packets.
3. No approved Project Manager owner exists for personal/shared
   owner-attention work under the current canonical architecture. This packet
   resolves that gap by proposing a deliberate architecture amendment:
   GitHub owns personal/shared repo-bound engineering attention on the PR;
   UCLA Project Manager remains canonical for UCLA owner attention. Until Joel
   merges that amendment, the route continues to fail closed.

The recommended implementation approach reuses the current services and adds
guarded lifecycle verbs and contracts. It does not introduce another
long-lived service.

## Authority reviewed

Canonical `agent-scripts` sources at
`c7b33a9e99e0e15b7315e92178b74f1c9a2c8fe2`:

- `docs/contribution-review-architecture.md`
- `docs/contributor-operating-protocol.md`
- `docs/maintainer-charter.md`
- `docs/STATE_ARCHITECTURE.md`
- `docs/loop-operating-model.md`
- `docs/shared-agent-coordination.md`

Manager sources at
`d12dd914c66aef79bd7d68a97c7ab6cae73fbd68`:

- `docs/services/claude-projects-mcp.md`
- `docs/runbooks/supervised-coding-missions.md`
- `docs/runbooks/contribution-review.md`
- `docs/elephant-checks/supervised-coding-missions.md`
- the implemented `start_agent_mission` policy, conductor, receipt, and ready
  packet surfaces

Runtime implementation sources:

- `ucla-tdg-ip-agents` origin/main
  `c905a7250a8ea85189e9587912c39f143d300686`
- `ucla-tdg-project-agents` origin/main
  `042111a526d6ed6e60ca9d5d3f47af8f5e59f11c`

Live registry and runtime claims were verified independently. Documentation
was not treated as proof of deployment.

## Current-state map

The words **documented**, **implemented**, **deployed**, and **proven live** are
deliberately separate.

| Lifecycle slice | Documented | Implemented | Deployed | Proven live | Current finding |
|---|---|---|---|---|---|
| Cross-repo doctrine and role boundaries | Yes | N/A | N/A | N/A | Canonical architecture, contributor protocol, maintainer charter, state ownership, loop model, and coordination rules agree on the major boundaries. |
| Specification to faithful GitHub issues | Requirement only | No compiler or adapter found | No | No | `agent-scripts` had zero open issues, no issue forms/templates, and only default labels. No current surface preserves requirement IDs, dependencies, acceptance criteria, validation, and non-goals into an authorized issue batch. |
| Claims and assignment | Protocol exists | Read-side coordination exists | Coordinator deployed | Observation proven | The coordinator discovers PRs and dispatches reviews. No guarded issue-claim writer was found for assignment plus an idempotent claim marker. |
| Issue lifecycle conductor | Required by this proposed implementation spec | Not implemented | Existing `ucla.contribution-coordinator` selected for reuse | No | The deployable already owns cross-repo observation, dispatch, retry, and outcome recording. It does not yet claim an issue, start/poll a Manager mission, verify its successful packet, or invoke contributor publication. |
| Supervised local coding mission | Contract and runbook are detailed | Yes | Manager service live | Yes | `start_agent_mission` owns bounded local coding, exact-revision validation, independent review, repair budgets, durable receipts, and ready packets. It has no GitHub credential and must stay that way. |
| Repository mission enablement | Manager policy model exists | Partial | Partial | One project proven | Twelve live ready packets were present. `shared-manager` is mission-enabled. The exact registry entries `shared-agent-scripts`, `ucla-tdg-ip-agents`, and `ucla-tdg-project-agents` each have `agent_policy: null`; none can run `start_agent_mission`. Pinakes also lacks mission policy. |
| Contributor identity and publishing | Fork-first identity doctrine exists | Wrapper and machine fork exist | Installed wrapper exists | Historical PRs prove the path | `kehle-contributor-agent` authored PRs, including `agent-scripts` PR #6. The installed wrapper matched the tracked wrapper checksum. The generic coding child can still receive the contributor token; a narrower exact-SHA publisher boundary is required. |
| Contribution coordination | Coordinator role is canonical | Yes, for observe/dispatch/retry/proposals | `ucla.contribution-coordinator` live at `:8247` | Health, metrics, sweeps, and dispatches proven | Five repositories were covered. The service is propose-oriented but writes proposal state to UCLA Project Manager. It does not create issues, claims, assignments, contributor PRs, or adjudications. |
| Deterministic policy evaluation | Required | Yes | Review agent live | 306 policy stages succeeded in later snapshot | The deterministic stage is healthy, but it is not substantive review. |
| Substantive first-pass review | Required | Implemented with Anthropic model path | `ucla-tdg-github-review-agent` live at `:8251` | Failure proven; success not currently proven | The service processed review attempts but the provider failed. Original snapshot: 201 processed, 196 retryable first-pass failures, 5 soft outcomes, zero packets. Later snapshot: 306 processed, 301 retryable failures, 5 soft outcomes, zero packets. |
| Independent reviewer and poster identity | Required | Runtime checks exist | Review agent configured write-capable | Historical COMMENT writes proven | The service reports `write_enabled=true`, GitHub login `kehle-reviewer-agent`, and substantive review enabled. Five GitHub writes were counted. No automatic `APPROVE` path was observed. Current provider failure prevents a fresh ready packet. |
| Exact-head invalidation | Required | Present in coordinator/reviewer and Manager | Deployed | Historical PR evidence plus source/test evidence | Unit is `(repository, pull_request, head_sha)`. New heads trigger fresh review. Existing PR #25 shows older-head review evidence that does not cover the current head. |
| Ready-for-Joel packet | Contract defined | Implemented in Manager and review agent | Both services live | Manager packet proven; GitHub-review packet not proven in current runtime | Manager had twelve local mission packets. The GitHub review service had zero ready packets at both snapshots. |
| Owner-attention work item | Canonical requirement; scope amendment proposed here | UCLA proposal projection exists | PM live at `:8223` | UCLA proposal writes proven | Thirty-seven GitHub-review proposals existed in a 303-proposal snapshot. The PM runtime reported version `dev` with no build identity and was absent from current bus discovery. Proposed resolution: UCLA remains in UCLA PM; personal/shared repo-bound engineering attention becomes canonical GitHub PR state only after the architecture amendment merges. |
| Joel adjudication | Maintainer doctrine exists | GitHub manual path exists | GitHub live | Human PR activity exists | No automated final adjudication was found or proposed. The lifecycle does not yet ingest and correlate Joel's disposition as a completed state. |
| Durable decisions and rulings | Charter defines graduation | Manual docs/PR process | N/A | Not proven end to end | There is no observer that proposes a linked canonical-doc graduation after adjudication. |
| Observability and runbook | Required | Health/metrics and event log exist | Live | Partially proven | Stage counters and durable events exist. Failure reasons are not exposed in the reviewed metrics, logs did not show them, and unbounded redispatch inflated counters without a terminal-age signal. |

## Live capability discovery

The current registry showed:

| Agent or capability | Registry/runtime state | Safety and authority |
|---|---|---|
| `ucla.contribution-coordinator` | Registered; worker/propose/pull | Current: GitHub-read capable and write-capable only for guarded UCLA Project Manager proposal ingest. Proposed reuse: also implement the lifecycle-conductor role and contained issue/claim/publication adapters; activation must reclassify it as write-capable and verify exact actor/scopes. |
| `ucla-tdg-github-review-agent` | Registered; worker/propose/pull; live runtime says `write_enabled=true` | Read/propose reasoning plus a guarded COMMENT-only GitHub poster using `kehle-reviewer-agent`. No merge or automatic approval authority. |
| `start_agent_mission` | Live Manager tool | Local repo write-capable inside server-owned policy. No GitHub credential, push, deploy, or Project Manager authority. |
| `ucla-tdg-project-manager` | Healthy direct HTTP service at `:8223`; absent from current bus discovery | Read-only GET surfaces and guarded proposal writes. Its absence from the bus and `dev`/no-build health identity are deployment/provenance gaps. |

The live registry remains the authority for bus capabilities. Static names in
architecture documents are not proof of availability.

## Explanation of the 196 failures

### What the number means

The 196 value was a cumulative Prometheus counter value at the first snapshot,
not 196 distinct defects, PRs, or heads:

```text
processed outcomes       201
retryable first-pass     196
soft outcomes              5
ready packets              0
GitHub writes               5
```

At the later read-only snapshot, the same counters were:

```text
processed outcomes       306
retryable first-pass     301
soft outcomes              5
ready packets              0
GitHub writes               5
```

The invariant `processed = retryable + soft` held at both snapshots. The five
existing writes did not produce a current ready packet. The additional 105
retryable outcomes occurred while no new successful packet appeared.

The coordinator's durable event ledger contained fourteen deduplicated
first-pass failure records across nine PRs and fourteen distinct
`repo + PR + head` tuples:

- four records failed because the escalated `claude-opus-4-8` request sent a
  deprecated `temperature` parameter;
- ten records failed because the primary `claude-sonnet-4-6` request received
  an Anthropic insufficient-credit response;
- no other first-pass error class appeared in the captured durable ledger.

The durable ledger deduplicates a stage by its stable idempotency key, while
the Prometheus counter increments on each processing attempt. Therefore, the
301 runtime count and fourteen durable failure records measure different
things: attempts versus unique stage evidence.

### Why the number kept increasing

Four implementation facts combine into a retry loop:

1. `internal/githubreview/packet.go:13-32` classifies any substantive reviewer
   error as `retryable_failure` and returns no ready packet.
2. `internal/contributioncoordinator/agent.go:299-338` clears
   `LastReviewRequestToken`, generation, and request time after a failed reply.
3. `internal/contributioncoordinator/sweep.go:304-315` suppresses redispatch
   only while the same token and generation retain a non-zero request time
   inside the retry window.
4. The deployed sweep interval was 900 seconds and the configured review retry
   interval was 1800 seconds. Clearing the timestamp defeats that retry window,
   so the next fifteen-minute sweep treats the same head as
   `pr_review_pending` and dispatches it again.

The latest captured sweep dispatched five already-tracked PR heads. PRs #24
and #25 in `kehle-tdg-dev/ucla-tdg-ip-agents` were explicitly recorded with
reason `pr_review_pending`, not a bounded retry-exhausted state.

There is no observed attempt ceiling or age transition from retryable to a
visible terminal/operator-attention state. The result is:

```text
provider failure
  -> retryable first-pass result
  -> request timestamp cleared
  -> next sweep sees no pending request
  -> same exact head redispatched
  -> cumulative failure counter rises
```

This is both an infrastructure blocker and an implementation-gate gap:

- provider access must be restored or changed through separately authorized
  credential/configuration work;
- the deprecated model parameter must be corrected;
- retry suppression must survive a failed reply;
- attempts and age must be bounded;
- exhausted failures must produce attributable, scoped owner attention;
- metrics must separate attempts, unique heads, retry age, and exhausted
  failures.

No conclusion about review quality can be drawn from these failures because the
substantive model never returned a successful review in the captured failing
records.

## Gap analysis against the ten implementation gates

| Gate | Status | Evidence and gap |
|---|---|---|
| 1. Reconcile active Git lineages and re-audit current `origin/main` | Met for this audit | Local HEAD, local `origin/main`, and remote `refs/heads/main` were compared for all four owning repositories. Tests used archived origin/main source for repositories whose working trees had unrelated changes. This must be repeated per mission. |
| 2. Align repository coverage and expose uncovered repositories | Partial | Five repositories are configured in the coordinator. Coverage is static runtime configuration, not a repo-owned enrollment contract. `agent-scripts` and future Joel repos need explicit policy, visibility, and fail-closed handling. |
| 3. Enforce contributor/reviewer/poster identities at runtime | Partial | Reviewer and poster checks exist; current account intent is correct. The contributor token is still available to a generic coding child, and per-repo permissions are inconsistent. The repaired spec names `kehle-contributor-agent` for issue/claim/publication and `kehle-reviewer-agent` for review/packet/attention writes, but activation proof does not yet exist. |
| 4. Add a guarded attributed verbatim-poster boundary | Partial | COMMENT-only review posting is implemented with idempotency and poster identity. Guarded issue/claim/publication verbs and their lifecycle-conductor integration are missing. |
| 5. Prove substantive first-pass review | Not met live | Deterministic policy succeeds, but substantive inference fails on provider request/configuration. Zero ready packets. |
| 6. Make partial-stage status, retries, and exact failures durable | Partial | Stage records and a durable event ledger exist. Repeated processing attempts are not bounded, failure reasons are absent from reviewed metrics/log output, and clearing request time defeats the retry window. |
| 7. Upsert/invalidate owner attention by exact head and scope | Not met; ownership resolved in proposed amendment | UCLA proposals exist and are keyed to PR/head. This repaired packet specifies UCLA PM as canonical for UCLA and GitHub PR events as canonical for personal/shared repo-bound engineering attention only. That allocation requires a deliberate canonical-architecture amendment before implementation. The coordinator emits `github_pr_adjudication`, while the inspected PM no-PM-write allowlist did not recognize that action: latent contract drift. |
| 8. Add local tests for lifecycle invariants | Partial | Package tests cover coordinator and review-agent behavior. Missing end-to-end acceptance proof spans issue fidelity, claims, mission provenance, fork publication, exact-head invalidation, exhausted retry, owner scope, adjudication, and replay. |
| 9. Pass every owning repo's documented local gate | Partial | Current origin/main package tests passed for the coordinator/reviewer and Project Manager. `agent-scripts` `npm run agent:check` passed. No implementation slice has yet passed all owning-repo gates because implementation has not started. |
| 10. Prove live health, metrics, actor, GitHub artifacts, and PM state | Not met end to end | Each subsystem has partial live proof, but no single work item traversed the entire proposed lifecycle. The current provider failure and undecided owner route make a canary unsafe. |

## Proposed operational specification

### Outcome

An approved, requirement-addressable specification becomes a faithful GitHub
issue set. One claimed issue drives one supervised coding mission. A
contributor machine identity publishes the exact validated mission head from
its fork. A distinct reviewer evaluates that exact head. A distinct guarded
poster places attributed evidence and a decision-ready packet on GitHub. The
approved scope-specific attention owner records that Joel owes a decision.
Joel adjudicates. Any durable ruling is proposed back to its canonical document
through the same contribution path.

### Logical roles and deployable allocation

| Logical role | Existing deployable or system | Authority and state boundary |
|---|---|---|
| Lifecycle conductor | `ucla.contribution-coordinator` | Owns the bounded outer sequence from a confirmed issue claim through mission start/poll, successful packet verification, and guarded contributor publication. It owns only reconstructable coordination cursor state. |
| Local coding conductor | `claude-projects-mcp` through `start_agent_mission` and `check_agent_mission` | Owns local mission policy, execution, durable journal/snapshot, exact-SHA validation/review, repair budgets, and the immutable successful packet. No GitHub credential, push, deploy, or lifecycle database. |
| Issue/claim/publisher adapter | Contained verbs inside `ucla.contribution-coordinator` | Uses a narrowly scoped contributor credential only for approved repositories and exact verbs. No model or mission child receives the credential. |
| Contribution review coordinator | `ucla.contribution-coordinator` | Continues current-head observation, review dispatch, retry, and outcome recording after publication. |
| First-pass reviewer and review poster | `ucla-tdg-github-review-agent` | Performs exact-head policy/substantive review and guarded attributed GitHub COMMENT/packet writes as the reviewer machine actor. |
| UCLA owner-attention owner | `ucla-tdg-project-manager` | Canonical only for UCLA work state. |
| Personal/shared repo-bound owner-attention owner | GitHub PR timeline under the proposed architecture amendment | Canonical only for Joel-owned personal/shared engineering PR adjudication. It is not a general personal Project Manager. |
| Adjudicator | Joel | Sole merge, approval, and final request-changes authority. |

No new long-lived service is proposed. Reuse is viable because
`ucla.contribution-coordinator` already has repository coverage, a durable
coordination/event surface, periodic recovery, exact-head review dispatch, and
guarded downstream adapter patterns. A new deployable would duplicate those
responsibilities without enforcing a boundary that the existing process cannot
enforce.

### Authenticated GitHub actors

| Write | Required authenticated actor |
|---|---|
| Approved issue creation | `kehle-contributor-agent` |
| Automated claim, renew, bind-mission, release, recovery, assignment, and publication marker | `kehle-contributor-agent` |
| Contributor-fork branch and PR creation/update | `kehle-contributor-agent` |
| Independent review, ready packet, personal/shared `owner-attention.v1` event, and ready-label projection | `kehle-reviewer-agent` |
| Merge, approval, final request-changes, and Joel adjudication | `joelkehle`, interactively and never through automation |

The actor names are configuration validated at activation. The logical
identity fields remain explicit if an account is renamed later.

### Requirements

#### `GHL-REQ-01` — Faithful issue projection

The lifecycle layer MUST accept an approved, versioned specification manifest
and propose GitHub issue payloads that preserve:

- specification ID and source revision;
- requirement IDs;
- owning repository;
- dependencies;
- acceptance criteria;
- exact local validation commands;
- non-goals;
- external-write class;
- traceability from each requirement to one or more bounded issues.

Validation MUST fail closed on unknown requirement IDs, missing ownership,
cycles, missing acceptance criteria, missing validation, or unrepresented
normative requirements. Creating issues remains a separately authorized write.

#### `GHL-REQ-02` — Claims and collision control

The canonical claim state MUST be a versioned, append-only event stream in
machine-readable GitHub issue comments. GitHub issue state and comment
timeline are canonical; issue assignment, labels, AgentCoord, WWI, and the
lifecycle conductor's cursor are projections or coordination aids.

Automated issue, claim, renew, release, recovery, assignment, and publication
markers MUST authenticate as `kehle-contributor-agent`. A human contributor's
manual claim uses that human's GitHub identity and enters the same reducer.

Each `github-lifecycle-claim.v1` event MUST contain:

```json
{
  "schema": "github-lifecycle-claim.v1",
  "event_id": "<stable UUID>",
  "idempotency_key": "<stable request hash>",
  "action": "claim|renew|bind_mission|packet_ready|published|release|recover",
  "repository": "<owner/repo>",
  "issue_number": 123,
  "claim_generation": 1,
  "previous_event_id": "<reducer head or null>",
  "claimant_identity": "<human or agent contributor>",
  "authenticated_actor": "<GitHub comment author>",
  "lease_id": "<stable UUID for this generation>",
  "occurred_at": "<client timestamp>",
  "lease_expires_at": "<policy-bounded timestamp or null>",
  "mission_request_id": "<stable repo/issue/generation key or null>",
  "mission_id": "<Manager mission ID or null>",
  "candidate_sha": "<exact successful SHA or null>",
  "pull_request_url": "<published PR or null>",
  "reason": "<bounded text or null>"
}
```

Automation MUST post a new comment for every transition. It MUST NOT edit or
delete a prior claim event. The comment body MUST use stable framing:

~~~text
<!-- github-lifecycle-claim.v1 idempotency_key=<key> -->
```json
<UTF-8 JSON serialized with schema-defined key order and no unknown fields>
```
~~~

The adapter hashes the canonical JSON bytes, validates the marker key against
the payload key, and verifies `authenticated_actor` equals GitHub's immutable
comment author. Human-authored prose outside a valid marker is not claim state.

#### Conflict-safe serialization

GitHub atomically creates each issue comment and assigns immutable server
identity and ordering fields. The canonical reducer:

1. selects valid `github-lifecycle-claim.v1` comments for the issue;
2. orders them by GitHub `created_at`, then numeric comment `databaseId`;
3. deduplicates identical `idempotency_key` values, retaining the first
   server-created event;
4. validates that each event's `previous_event_id` equals the current valid
   reducer head and that the transition is legal;
5. for competing `claim` or `recover` events from the same predecessor and
   generation, accepts only the earliest server-ordered event;
6. classifies every later competitor as `conflict_lost` without starting a
   mission.

The adapter MUST read current state, post its event with a stable idempotency
key, then reread through its own comment and run the reducer. It owns the claim
only if that event is the reducer head. An ambiguous HTTP result is resolved by
searching for the idempotency key before retrying. Duplicate writes may exist
as GitHub comments after transport ambiguity, but they collapse to one logical
event and can never start two missions. Reuse of an idempotency key with a
different canonical payload hash is a terminal integrity failure.

The confirmed active claim is projected to the issue assignee. For automated
work the assignee is `kehle-contributor-agent`. Assignment mismatch or failure
blocks mission start; assignment is not allowed to override the canonical
comment reducer.

#### Reducer states and bounded issue ownership

| Derived state | Canonical evidence | Permitted next behavior |
|---|---|---|
| `unclaimed` | No valid active generation | One new `claim` generation may compete. |
| `claimed` | Winning claim with valid lease and no mission binding | Lifecycle conductor may issue one idempotent mission start. |
| `mission_active` | Valid `bind_mission`; Manager reports `active` or `paused` | Poll, renew, or recover the same mission only. |
| `packet_ready` | Manager reports `ready_for_joel`; valid packet event cites exact candidate SHA | Guarded publication may run; no new mission. |
| `published` | Publication event cites matching fork PR and head | Generation is terminal; bounded conductor ownership ends. The linked PR now carries contribution state. |
| `released` | Authorized release after terminal unsuccessful or pre-mission abandonment | Generation is terminal; the next generation may claim. |
| `expired_pending_recovery` | Lease expired without a valid terminal event | No claimant owns executable authority until recovery proves Manager state. |
| `recovery_blocked` | Recovery found unavailable, ambiguous, or mismatched mission evidence | Fail closed and surface owner attention; no takeover. |

`conflict_lost` is a classification of an invalid competing event, not a state
transition. A published issue cannot be reclaimed while its linked PR remains
open. Recovery after a closed-unmerged PR requires a new explicit generation
that cites the terminal PR state.

#### Lease and recovery

Claim lease duration is server policy, default two hours, and MUST NOT exceed
the Manager mission deadline plus a bounded publication grace period. While a
mission is active, the lifecycle conductor renews by one-third of the
remaining lease or sooner. Every renewal references the current reducer head
and the same `lease_id`.

Expiry changes the state to `expired_pending_recovery`, not `unclaimed`.
Recovery MUST:

1. reread and reduce the GitHub claim stream;
2. inspect the bound Manager mission through `check_agent_mission`;
3. inspect the repo's required AgentCoord/WWI handoff evidence;
4. renew the same generation if the mission is still active and the claimant
   is recoverable;
5. continue publication if the exact successful packet exists;
6. post `release` only after a terminal unsuccessful mission is proven;
7. post `recover` for a new generation only after the old mission is terminal
   or absent and no publication is pending.

Ambiguous Manager state, an unavailable Manager service, a live process with
an expired GitHub lease, or mismatched mission/claim lineage fails closed and
requires owner attention. A second mission MUST NOT start merely because wall
clock time expired.

#### `GHL-REQ-03` — Mission provenance

One confirmed claim generation launches at most one active
`start_agent_mission` generation. The lifecycle conductor supplies a stable
`mission_request_id` derived from repository, issue, and claim generation.
Manager MUST return the original mission for a replay of that request ID and
reject a payload mismatch.

Manager policy, not caller input, owns:

- repository path;
- allowed files and commands;
- validation commands;
- branch/worktree policy;
- time, repair, and reviewer budgets;
- contributor and independent-review roles.

Mission state MUST record issue URL/number, requirement IDs, spec revision,
claim generation/lease ID, mission request ID, base revision, final candidate
SHA, validation receipts, reviewer identity, and ready packet. Manager MUST NOT
receive a GitHub credential, publish a branch, open a PR, or become the
lifecycle database.

#### `GHL-REQ-04` — Bounded lifecycle conducting

The existing `ucla.contribution-coordinator` deployable MUST implement the
lifecycle-conductor role:

```text
confirmed claim
  -> idempotent start_agent_mission
  -> check_agent_mission polling and lease renewal
  -> terminal-state classification
  -> successful packet and exact-SHA verification
  -> guarded contributor publication
  -> published claim event
```

Only `ready_for_joel` with a valid immutable Manager packet is success.
`escalated`, `budget_exhausted`, `cancelled`, `system_failure`, unavailable
status, missing packet, changed base, uncommitted changes, or lineage mismatch
MUST stop publication.

The lifecycle conductor MAY keep a disposable polling cursor. Canonical facts
remain in GitHub claim events and Manager mission state. After restart it MUST
reconstruct from those sources and replay stable request keys. It MUST NOT
become a second mission or lifecycle database.

#### `GHL-REQ-05` — Contributor-fork publication

A guarded publisher MUST accept only a successful mission packet and the exact
final SHA it names. It MUST:

- authenticate as the configured contributor machine account, never Joel;
- publish to a server-owned branch in the contributor fork;
- verify the pushed SHA equals the mission candidate SHA;
- open or update one idempotent PR against the approved base;
- preserve issue, spec, requirements, acceptance, validation, mission, and
  contributor attribution;
- record a write receipt for branch publication and PR creation/update.

It MUST NOT expose the credential to a general model session, write directly
to the base repository, force-push, merge, or infer a broader repository scope.

#### `GHL-REQ-06` — Exact-head independent review

The coordinator MUST dispatch a reviewer whose identity differs from the
contributor. Policy and substantive review MUST cite the exact current PR head.
A new head invalidates prior readiness, packet, and attention state.

The review pipeline MUST use stable stage idempotency keys, preserve failure
timestamps, enforce attempt/age budgets, and distinguish:

- provider/configuration failure;
- policy terminal failure;
- substantive findings;
- GitHub posting failure;
- reviewer-request failure;
- packet-post failure.

No automatic `APPROVE`, merge, or final `REQUEST_CHANGES` is allowed.

#### `GHL-REQ-07` — Decision-ready packet and owner attention

A `ready-for-joel.v1` GitHub packet MUST satisfy the canonical packet contract
and cite its exact head, identities, validation, findings, risks, unresolved
judgment, disposition recommendation, deployment state, and payload hash.

“Ready for Joel” means decision-ready, including a legitimate `discuss`
recommendation; it does not mean merge-ready.

The scope-specific attention owner is explicit:

- UCLA repositories: UCLA Project Manager owns canonical
  `owner-attention.v1` work state. The GitHub packet is canonical review
  evidence and cites the PM item.
- Joel personal/shared repositories: after the canonical architecture
  amendment merges, the GitHub PR timeline owns canonical
  `owner-attention.v1` state for repo-bound engineering adjudication only. A
  machine-readable event cites the packet and exact head; later events
  supersede, escalate, or decide it. The `ready-for-joel` label is only a
  projection.

The architecture amendment MUST update architectural principle 6, the state
ownership table, owner-attention routing, contributor protocol, and Elephant
Check. It MUST explicitly exclude non-repository personal attention, general
task management, and UCLA work from the GitHub exception.

The approved scope-specific adapter MUST upsert exactly one logical
`owner-attention.v1` item for the same head and packet, invalidate it on a new
head, and record age, escalation, and disposition. Missing or ambiguous scope
fails closed.

#### `GHL-REQ-08` — Joel-only adjudication

Automation MAY observe and correlate Joel's GitHub action or an explicit Joel
command. It MUST NOT perform the merge, automatic approval, or final
request-changes adjudication.

The recorded decision MUST cite Joel as actor, the exact decided head, packet,
attention item, action, timestamp, and any reasoning Joel chose to make
durable. A changed head makes a stale decision inapplicable.

#### `GHL-REQ-09` — Durable graduation

After adjudication, the lifecycle layer MAY propose a bounded follow-up issue
or PR when the decision changes architecture, policy, protocol, state
ownership, or a standing maintainer ruling.

The proposal MUST identify the canonical owning document and ruling/requirement
IDs. It MUST use the ordinary issue, mission, PR, review, and adjudication path.
Automation MUST NOT silently edit canonical doctrine or create a competing
source of truth.

#### `GHL-REQ-10` — Repository enrollment

Each enrolled repository MUST declare, in server-owned Manager/lifecycle
policy:

- canonical GitHub repository and base branch;
- local checkout and mission policy;
- exact connector invocation scope;
- server-owned allowed and denied repository-relative path prefixes;
- contributor fork and permitted publisher identity;
- reviewer and poster identity policy;
- local targeted and full gates;
- maximum mission, focused-repair, review-repair, and reviewer-infrastructure
  retry budgets;
- issue template/labels used as projections;
- owner-attention business scope and approved owner;
- deploy and migration prohibitions;
- rollback/disable procedure.

Caller scope MUST be a subset of policy-owned allowed prefixes and may only
narrow budgets. A wrong connector scope, unlisted or denied path, substituted
validation command, widened budget, disallowed agent, identity collision,
push/deploy request, aggregate root, disabled policy, or unknown policy field
MUST fail before a mission record or child process is created.

An uncovered, inactive, or incomplete repository MUST be visible and fail
closed.

### Exact-build activation checkpoints

Implementation completion does not activate a runtime. Before any live
GitHub-write canary, every participating component MUST pass a separately
authorized activation checkpoint:

| Checkpoint | Exact reviewed revision | Required proof after separate authorization |
|---|---|---|
| `ACT-REV-01` Manager policy bootstrap | Merged Manager revision containing `GHL-001` | Local gate and independent review receipts; activated `:8228` health reports exact build and registry hash; read-only effective-policy preflight proves the three project policies, exact connector scopes, path allow/deny sets, validations, budgets, and refusal cases; no target-repo mission is started during activation. |
| `ACT-REV-02` review repair | Merged `ucla-tdg-ip-agents` revision containing `GHL-002` | Local gate and independent review receipts; deployed health reports exact build; provider smoke succeeds; retry counters stop growing for the repaired cause; no GitHub write required for the smoke. |
| `ACT-REV-03` Manager mission contract | Merged Manager revision containing `GHL-001` and `GHL-005` | Local gate and independent review receipts; activated `:8228` health reports exact build; the bootstrap policies remain effective; idempotent mission-request and provenance dry run pass; no GitHub credential present. |
| `ACT-REV-04` lifecycle conductor | Merged `ucla-tdg-ip-agents` revision containing `GHL-002`, `GHL-004`, `GHL-006`, and `GHL-008` | Local gate and independent review receipts; activated coordinator reports exact build and write-capable registry contract; actor and repo scopes are verified without printing credentials; claim reducer, restart recovery, dry-run publication, retained review repair, health, metrics, alert, and rollback checks pass. |
| `ACT-REV-05` UCLA Project Manager | Merged `ucla-tdg-project-agents` revision containing `GHL-007` | Required before a UCLA live canary, not the `agent-scripts` pilot. Local gate and independent review receipts; activated health reports exact build; versioned proposal dry run and scope rejection pass. |

Each checkpoint requires its own explicit deployment/restart/configuration
authorization. This packet authorizes none of them. A reviewed commit, merged
PR, green local gate, or built image is not activated proof.

`ACT-REV-01` is the bootstrap that makes `GHL-002` executable.
`ACT-REV-03` later supersedes that deployed Manager build and MUST retain and
re-prove the three policies. `ACT-REV-02` is the immediate live review-repair
checkpoint. `ACT-REV-04` later supersedes that deployed
`ucla-tdg-ip-agents` build and MUST contain and re-prove the `GHL-002` repair.
The canary preflight requires the historical `ACT-REV-01` and `ACT-REV-02`
receipts plus the currently active `ACT-REV-03` and `ACT-REV-04` exact builds;
it does not require one process to report two build revisions.

#### `GHL-NFR-01` — Identity and authority

`contributor_identity`, `reviewer_identity`, and `poster_identity` are distinct
fields. Reviewer and contributor MUST differ. The authenticated GitHub actor
MUST equal the configured poster or contributor identity for that write.
Automation MUST never authenticate as `joelkehle`.

#### `GHL-NFR-02` — Guarded external writes

Every external write MUST pass through a verb-limited, repository-scoped
adapter with:

- server-authoritative policy;
- exact target and expected head;
- stable idempotency key;
- bounded payload;
- attribution and authenticated actor;
- dry-run/proposal form;
- durable attempted/completed receipt;
- replay safety and exact failure reporting.

#### `GHL-NFR-03` — Separation of concerns

GitHub owns issues, commits, PRs, comments/reviews, posted adjudication
evidence, and—after the deliberate amendment—personal/shared repo-bound
engineering attention. Manager owns supervised local coding state. UCLA
Project Manager owns UCLA owner-attention work state. Pinakes owns
discovery/transport only.

No service may become a parallel lifecycle database. GitHub Actions are not a
validation surface.

#### `GHL-NFR-04` — Observability

The lifecycle MUST expose:

- covered/uncovered repos;
- exact Manager build, registry hash, per-project mission-policy hash, and
  policy-preflight refusal reason;
- active/conflicting/aged claims;
- issue projection and write receipts;
- mission state and exact candidate SHA;
- publish attempts and authenticated actor;
- per-stage review status;
- retry attempts, unique heads, age, and exhaustion;
- current-head packet validity;
- attention upsert/invalidation reference;
- Joel decision correlation;
- graduation proposal status.

Health and metrics MUST identify the deployed build. Critical signals require
an alert and linked runbook.

### Operational state flow

```text
approved specification
  -> validated issue manifest
  -> separately authorized issue batch
  -> conflict-safe GitHub claim event and assignment projection
  -> lifecycle conductor starts one idempotent supervised mission
  -> lifecycle conductor polls and renews the claim lease
  -> Manager emits a successful exact-SHA packet
  -> lifecycle conductor verifies packet and lineage
  -> guarded contributor-fork publication as kehle-contributor-agent
  -> published claim event
  -> GitHub PR linked to issue/spec/mission
  -> exact-head policy evaluation
  -> exact-head independent substantive review
  -> attributed GitHub review and ready-for-Joel packet
  -> scope-correct owner-attention item
  -> Joel discussion and adjudication
  -> decision receipt on GitHub
  -> proposed canonical ruling graduation, when required
```

Each arrow is independently observable. Success at one stage does not imply
success at the next.

## Phase 0 — specification ratification

Phase 0 is the specification PR itself, not a retrospective GitHub issue.
After Joel's agreement on this packet, a separately authorized contributor-fork PR
MUST:

- preserve `JK-SPEC-GHLIFE-001` and its requirement IDs;
- amend canonical owner-attention ownership in
  `docs/contribution-review-architecture.md` and
  `docs/STATE_ARCHITECTURE.md`;
- update the contributor protocol and contribution-review Elephant Check;
- record lifecycle-conductor reuse, claim semantics, authenticated actors,
  activation gates, issue graph, and non-goals;
- pass `docs-list`, `npm run agent:check`, and the documented whitespace check;
- be reviewed and adjudicated by Joel.

The merged Phase 0 commit is the immutable specification revision cited by
`GHL-001` through `GHL-010`. No `GHL-*` implementation issue is created to
describe work already completed in Phase 0.

## Bounded implementation roadmap

One supervised coding mission per issue; no issue combines unrelated owning
repositories.

| Order | Issue or gate | Owning repository/runtime | Coherent slice | Depends on |
|---|---|---|---|---|
| 0 | Phase 0 specification PR | `joelkehle/agent-scripts` | Ratify the spec and canonical architecture amendment. This is not an implementation issue. | Joel specification agreement; separate commit/push/PR authority |
| 1 | `GHL-001` | `joelkehle/manager`, project `shared-manager` | From the already mission-enabled Manager project, add bounded mission policies and read-only policy preflight for `shared-agent-scripts`, `ucla-tdg-ip-agents`, and `ucla-tdg-project-agents`. | merged Phase 0 specification |
| 2 | `ACT-REV-01` | deployed Manager | Separately authorize and verify the exact reviewed `GHL-001` policy build. | merged/reviewed `GHL-001`; separate activation authority |
| 3 | `GHL-002` | `kehle-tdg-dev/ucla-tdg-ip-agents` | Immediately repair active review-provider compatibility and the unbounded retry loop; improve exact error/retry evidence. | verified `ACT-REV-01` |
| 4 | `ACT-REV-02` | deployed review agent | Separately authorize and verify the exact reviewed `GHL-002` build so the active failure loop is actually repaired. | merged/reviewed `GHL-002`; separate activation authority |
| 5 | `GHL-003` | `joelkehle/agent-scripts` | Versioned spec-to-issue manifest, coverage validator, stable renderer, and write-proposal receipt. | verified `ACT-REV-02` |
| 6 | `GHL-004` | `kehle-tdg-dev/ucla-tdg-ip-agents` | GitHub claim reducer plus guarded issue, claim/renew/release/recovery, assignment, and receipt verbs as `kehle-contributor-agent`. | `GHL-003`; verified `ACT-REV-02` |
| 7 | `GHL-005` | `joelkehle/manager`, project `shared-manager` | Add idempotent external mission request and issue/claim provenance while retaining the bootstrap policies. | `GHL-001` |
| 8 | `GHL-006` | `kehle-tdg-dev/ucla-tdg-ip-agents` | Add lifecycle-conductor behavior to the existing contribution coordinator: confirmed claim, mission start/poll/recovery, packet verification, and guarded contributor-fork publication. | `GHL-004`, `GHL-005` |
| 9 | `GHL-007` | `kehle-tdg-dev/ucla-tdg-project-agents` | UCLA-only versioned owner-attention/adjudication proposal contract, exact-head invalidation, allowlist alignment, and build identity. | verified `ACT-REV-02` |
| 10 | `GHL-008` | `kehle-tdg-dev/ucla-tdg-ip-agents` | Scope-route ready packets: GitHub PR events for personal/shared; UCLA PM for UCLA; observe exact-head disposition without adjudicating. | `GHL-002`, `GHL-006`, `GHL-007` |
| 11 | `GHL-009` | `joelkehle/agent-scripts` | Render a linked canonical-ruling graduation proposal after Joel adjudication; no direct doctrine write. | `GHL-005`, `GHL-008` |
| 12 | `ACT-REV-03` | deployed Manager | Separately authorize and verify the exact reviewed `GHL-001`/`GHL-005` build and idempotent mission provenance. | merged/reviewed `GHL-005`; separate activation authority |
| 13 | `ACT-REV-04` | deployed contribution coordinator/review runtime | Separately authorize and verify the exact reviewed `GHL-002`/`GHL-004`/`GHL-006`/`GHL-008` build, actor scopes, retained retry repair, recovery, metrics, alert, and rollback. | merged/reviewed `GHL-002`, `GHL-004`, `GHL-006`, `GHL-008`; separate activation authority |
| 14 | `GHL-010` | `joelkehle/agent-scripts` | Run all local/fake scenarios, then—only under another authorization—one live `agent-scripts` canary against the exact activated revisions. | `GHL-001` through `GHL-009`; historical `ACT-REV-01`/`ACT-REV-02`; current `ACT-REV-03`/`ACT-REV-04` verified |

`ACT-REV-05` activates the exact reviewed `GHL-007` UCLA Project Manager build
before a later UCLA live canary. It is not required to place personal/shared
`agent-scripts` attention in GitHub and therefore is not on the critical path
to `GHL-010`.

Post-pilot work is intentionally not padded into this initial issue batch:

- `PIN-GHL-001`, owning repo `joelkehle/manager`: mission-enable Pinakes after
  `GHL-010` adjudication.
- `PIN-GHL-002`, owning repo `joelkehle/pinakes`: run one bounded Pinakes
  canary after `PIN-GHL-001` and the applicable exact-build activation.

Broader enrollment starts only after the agent-scripts and Pinakes pilots meet
the same acceptance scenarios.

## Proposed pilot

### Repository

`joelkehle/agent-scripts`

### Why it is lowest risk

- It owns the canonical contribution doctrine and the proposed lifecycle
  tooling.
- It already has a working contributor fork and historical machine-authored
  PR evidence.
- Its full local gate is explicit: `npm run agent:check`.
- A docs/schema/CLI pilot can avoid deployment, production data, migrations,
  and business-sensitive state.
- GitHub issue configuration is minimal, so projections and write receipts are
  easy to inspect.
- Its current branch is unprotected; fork-first publication and explicit
  authorization provide the safety boundary without depending on branch
  protection.

### Pilot issue shape

Use one non-production documentation or validator enhancement from this
approved specification. The pilot work item itself makes no runtime deployment,
credential change, migration, or business-data access. Its runtime
prerequisites are activated only through the separate exact-build checkpoints.
The first pass is dry-run only. The live canary is another separate
authorization.

## End-to-end acceptance scenarios

### `GHL-E2E-01` — Phase 0 and mission-policy bootstrap

The merged Phase 0 PR is the approved specification source; no retrospective
ratification issue exists. `GHL-001` runs through the already enabled
`shared-manager` project and adds policies for exactly the three target project
IDs. Before `ACT-REV-01`, all three remain non-invokable. After separately
authorized activation, read-only preflight proves connector scope, path
allow/deny sets, validation commands, budgets, identities, and refusal cases.
Only then may `GHL-002` start.

The approved spec manifest still maps every normative requirement to the
expected issue set. IDs, dependencies, acceptance criteria, validation, owner,
and non-goals are byte-stable or semantically equivalent. An omitted
requirement fails validation.

### `GHL-E2E-02` — Claim collision

Two claim requests cite the same reducer head and generation. Both comments may
be created, but GitHub server order makes exactly one the valid successor. The
adapter rereads through its event; the loser becomes `conflict_lost`, remains
visible, and cannot start a mission. Replaying either request collapses by
idempotency key. Assignment matches only the reducer winner.

### `GHL-E2E-03` — Lease expiry and recovery

An active conductor stops after binding a mission. The claim lease expires.
The replacement conductor reduces GitHub state and checks Manager. If the
mission is still active, it renews the same generation and resumes polling. If
the exact successful packet exists, it resumes publication. It starts a new
generation only after terminal unsuccessful or absent mission state is proven.
Manager unavailability or ambiguity produces no takeover.

### `GHL-E2E-04` — Lifecycle conductor and mission provenance

The confirmed claim starts one idempotent `start_agent_mission` request. The
existing contribution-coordinator deployable polls `check_agent_mission` and
renews the claim. The final packet cites issue, claim generation, spec
revision, requirements, base SHA, exact candidate SHA, targeted/full local
checks, and a contributor-independent local reviewer. No GitHub credential
enters Manager or a mission child. Every non-success terminal state blocks
publication.

### `GHL-E2E-05` — Authenticated issue and publication writes

Issue creation, claim/release events, assignment, fork branch, and PR writes
authenticate as `kehle-contributor-agent`. The publisher accepts only the
successful packet's exact SHA, pushes it to the configured fork, and opens one
PR. The PR body cites issue, claim, requirements, acceptance, validation,
mission, and candidate SHA. Replay creates neither a second issue, logical
claim, branch, nor PR.

### `GHL-E2E-06` — New-head invalidation

A contributor correction creates a new head. The previous review packet and
owner-attention state become stale. Review is rerun for the new SHA. Joel is
never presented an old packet as current.

### `GHL-E2E-07` — Partial failure and bounded retry

Simulated provider, GitHub-post, reviewer-request, packet-post, and
owner-attention failures preserve earlier successful stages. Retries do not
duplicate artifacts. Attempt/age exhaustion becomes one visible, scoped item
with exact failure evidence.

### `GHL-E2E-08` — Business-scope routing and canonical attention

A UCLA PR routes canonical attention to UCLA Project Manager and cites that
item from GitHub. A personal/shared engineering PR records canonical
`owner-attention.v1` events on its GitHub PR and never enters UCLA PM. The
ready label is rebuildable. Non-repo personal work is rejected as outside this
GitHub exception. Missing or conflicting scope fails closed.

### `GHL-E2E-09` — Identity enforcement

Contributor and reviewer equality fails terminally. A poster actor mismatch
fails before writing. An issue/claim/publisher actor other than the configured
`kehle-contributor-agent` fails before writing. Any configuration naming
`joelkehle` for unattended automation fails policy validation.

### `GHL-E2E-10` — Exact-build activation gate

A reviewed but inactive revision cannot satisfy the pilot preflight. The live
canary is refused unless historical `ACT-REV-01` bootstrap and `ACT-REV-02`
review-repair receipts exist, current health/build identity exactly matches
the superseding `ACT-REV-03` Manager and `ACT-REV-04` lifecycle builds, those
builds re-prove their earlier policy/repair guarantees, actor and repo scopes
are verified, smoke checks pass, and rollback is named. Activation itself
requires separate authorization.

### `GHL-E2E-11` — Joel adjudication

Automation posts no `APPROVE`, merge, or final `REQUEST_CHANGES`. Joel's
decision is observed for the exact head, correlated to packet and attention
item, and closes/supersedes the work state. A stale-head decision is rejected.

### `GHL-E2E-12` — Replay and reconstruction

After loss of disposable cursors, the system reconstructs current state from
GitHub claim/attention events, Manager mission receipts, and UCLA Project
Manager work state when applicable. Replaying all authorized adapters creates
no duplicate logical issue, claim, mission, PR, review, packet, or attention
item.

## Draft GitHub issue set

These are ten proposed implementation bodies, not created issues. Phase 0 is
the specification PR and is intentionally absent from this issue set.

### `GHL-001` — Bootstrap bounded Manager mission policies

**Owner:** `joelkehle/manager`

**Manager project:** `shared-manager` (already mission-enabled)

**Requirements:** `GHL-REQ-03`, `GHL-REQ-04`, `GHL-REQ-10`,
`GHL-NFR-01`, `GHL-NFR-03`, `GHL-NFR-04`

**Dependencies:** merged Phase 0 specification revision

**Bootstrap mission scope:**

The issue itself MUST run through `start_agent_mission(project_id:
"shared-manager")` with these allowed paths:

```text
config/claude-projects-mcp/projects.json
internal/projectsmcp/types.go
internal/projectsmcp/registry.go
internal/projectsmcp/registry_test.go
internal/projectsmcp/agent_mission_policy.go
internal/projectsmcp/agent_mission_policy_test.go
docs/services/claude-projects-mcp.md
docs/runbooks/supervised-coding-missions.md
docs/elephant-checks/supervised-coding-missions.md
```

The existing `shared-manager` policy supplies:

```text
connector scope                  personal
targeted validation              go test ./internal/projectsmcp
full validation                  scripts/agent-check.sh
max mission seconds              7200
focused attempts                 3
review-repair cycles             2
reviewer-infrastructure retries  2
allow commit                     true
allow push/deploy                false
```

**Policy schema acceptance criteria:**

- Add server-owned `allowed_path_prefixes` and `denied_path_prefixes` to
  `agent_policy.mission_policy`.
- Require every requested bounded scope to be contained by an allowed prefix
  and no denied prefix; denied prefixes win.
- Add a read-only effective-policy/preflight surface returning build identity,
  registry hash, project policy hash, connector scope, path policy, validation,
  identities, budgets, and refusal result without creating a mission.
- Reject unknown fields and invalid/overlapping path policy that would make a
  deny ineffective.
- Preserve existing Codex-only confinement, distinct contributor/reviewer
  identity, exact validation-command matching, bounded budgets, and
  push/deploy refusal.

**Exact target policies:**

Common values:

```text
agents                            [codex]
max_wall_seconds                  1800
allow_commit                      true
allow_push                        false
git_reconcile                     disabled
mission enabled                   true
contributor_agents                [codex]
reviewer_agents                   [codex]
contributor_identity              codex-contributor
reviewer_identity                 codex-independent-reviewer
```

| Project ID | Connector invocation scope | Allowed paths | Denied paths | Targeted validation | Full validation | Budgets: seconds/focused/repair/reviewer |
|---|---|---|---|---|---|---|
| `shared-agent-scripts` | `personal` only | `bin/`, `lib/`, `tests/`, `docs/`, `package.json` | `.git/`, `.agents/`, `.codex/`, `workspace-roots/` | `npm run agent:check` | `npm run agent:check` | `3600 / 2 / 1 / 1` |
| `ucla-tdg-ip-agents` | `ucla` only | `cmd/contribution-coordinator/`, `cmd/github-review-agent/`, `internal/contributioncoordinator/`, `internal/githubreview/`, `deploy/.env.example`, `deploy/docker-compose.yml`, `docs/ARCHITECTURE.md`, `README.md`, `go.mod`, `go.sum` | `.git/`, `deploy/.env`, `data/`, `vendor/`, `web/` | `go test ./internal/contributioncoordinator ./internal/githubreview` | `go test ./...` | `7200 / 3 / 2 / 2` |
| `ucla-tdg-project-agents` | `ucla` only | `cmd/project-manager/`, `internal/projectmanager/`, `internal/proposalstore/`, `deploy/.env.example`, `deploy/docker-compose.yml`, `docs/ARCHITECTURE.md`, `docs/AGENT_CONTRACT_MATRIX.md`, `README.md`, `go.mod`, `go.sum` | `.git/`, `deploy/.env`, `data/`, `internal/projectmanager/schema/migrations/`, `internal/projectmanager/dashboard/`, `vendor/` | `go test ./internal/projectmanager ./internal/proposalstore` | `go test ./... && go build ./... && go vet ./...` | `7200 / 3 / 2 / 2` |

Path entries ending in `/` are contained directory prefixes; file entries are
exact files. The shared repository remains read-visible to both current
project scopes, but write-class mission invocation is `personal` only.

**Refusal acceptance criteria:**

Before creating a mission record or child process, refuse:

- `agent_policy: null`, disabled mission policy, aggregate root, or unknown
  project;
- `ucla` invocation of `shared-agent-scripts`;
- `personal` invocation of either UCLA repository;
- any unlisted path or denied path, including a migration, live `.env`, data,
  UI, vendor, or workspace-router path;
- caller-substituted validation command;
- caller-widened time or retry budget;
- non-Codex contributor/reviewer, identity equality, or identity omission;
- `allow_push=true`, `allow_deploy=true`, remote mutation, or credential
  inheritance;
- malformed path, symlink escape, path overlap that bypasses a deny, or unknown
  policy field.

Add table-driven tests for every positive policy and refusal case. Document the
exact Phase 0 spec revision in the policy change and produce a reviewed exact
revision eligible for, but not authorized for, `ACT-REV-01`.

**Validation:**

```bash
go test ./internal/projectsmcp
scripts/agent-check.sh
```

**Non-goals:**

- No target-repository implementation.
- No issue/claim/publisher adapter.
- No GitHub credential or external write.
- No deployment, restart, activation, or credential change.

### `GHL-002` — Restore substantive review and bound exact-head retries

**Owner:** `kehle-tdg-dev/ucla-tdg-ip-agents`

**Requirements:** `GHL-REQ-06`, `GHL-REQ-07`, `GHL-NFR-01`,
`GHL-NFR-02`, `GHL-NFR-04`

**Dependencies:** verified `ACT-REV-01`

**Acceptance criteria:**

- Remove or conditionally omit unsupported model parameters.
- Classify provider auth, credit, rate, and configuration failures explicitly.
- Preserve request timestamp and retry state after failure.
- Apply documented backoff, attempt ceiling, and age threshold per exact head.
- Emit attempt count, unique-head count, age, error class, and exhausted count.
- Produce one scoped escalation after exhaustion; do not redispatch every
  sweep indefinitely.
- Prove substantive review and packet eligibility for a current fixture head.
- Preserve reviewer/contributor/poster separation and COMMENT-only writes.
- Update the contribution-review runbook with exact evidence commands.
- Produce a reviewed exact revision eligible for, but not authorized for,
  `ACT-REV-02`.

**Validation:**

```bash
go test ./internal/contributioncoordinator ./internal/githubreview
go test ./...
```

Provider integration proof uses a controlled non-GitHub target first.

**Non-goals:**

- No automatic approval, merge, or final request-changes.
- No new review service.
- No deployment, restart, credential, funding, or live GitHub write.

### `GHL-003` — Add a versioned specification-to-issue manifest and validator

**Owner:** `joelkehle/agent-scripts`

**Requirements:** `GHL-REQ-01`, `GHL-NFR-02`, `GHL-NFR-04`

**Dependencies:** verified `ACT-REV-02`

**Acceptance criteria:**

- Define a versioned, machine-readable spec and issue-manifest schema.
- Preserve spec/requirement IDs, owners, dependencies, acceptance criteria,
  validation, non-goals, and write class.
- Detect unknown requirements, missing coverage, cycles, duplicates, and
  missing mandatory fields.
- Render stable proposed issue titles/bodies without writing GitHub.
- Emit an attributable validation receipt and content hash.
- Include fixtures for this complete issue batch.

**Validation:**

```bash
node --test tests/github-lifecycle/spec-issue-manifest.test.js
npm run agent:check
```

**Non-goals:**

- No GitHub writes.
- No issue assignment or mission launch.
- No generic project-management database.

### `GHL-004` — Add conflict-safe issue and claim adapters

**Owner:** `kehle-tdg-dev/ucla-tdg-ip-agents`

**Requirements:** `GHL-REQ-01`, `GHL-REQ-02`, `GHL-NFR-01`,
`GHL-NFR-02`

**Dependencies:** `GHL-003`; verified `ACT-REV-02`

**Acceptance criteria:**

- Implement the `github-lifecycle-claim.v1` reducer using GitHub comment server
  order, predecessor validation, legal transitions, and first-successor wins.
- Provide dry-run and explicitly write-enabled issue-batch verbs.
- Verify repository allowlist, authenticated actor, manifest hash, and existing
  issue markers before writing.
- Upsert without duplicating issues on replay.
- Implement claim, renew, bind-mission, packet-ready, published, release, and
  recovery events with stable idempotency keys.
- Authenticate issue, claim/release/recovery, assignment, and marker writes as
  `kehle-contributor-agent`.
- Confirm reducer ownership and assignment before permitting mission start.
- Enforce policy-bounded lease, renewal, expired-pending-recovery, and
  terminal-state recovery behavior.
- Detect and record conflicting claims without starting a mission.
- Record exact GitHub object URLs and write receipts.
- Never authenticate as Joel.

**Validation:**

```bash
go test ./internal/contributioncoordinator ./internal/githubreview
go test ./...
```

Use a local fake GitHub transport for the full gate. Live GitHub canary remains
separately authorized.

**Non-goals:**

- No coding mission.
- No PR publishing, review, merge, or adjudication.
- No deployment, restart, permission, or credential change.
- No GitHub Actions.

### `GHL-005` — Add idempotent claim provenance to Manager missions

**Owner:** `joelkehle/manager`

**Requirements:** `GHL-REQ-03`, `GHL-REQ-04`, `GHL-REQ-10`, `GHL-NFR-01`,
`GHL-NFR-03`

**Dependencies:** `GHL-001`

**Acceptance criteria:**

- Extend the mission request/receipt contract with issue URL/number, spec
  revision, requirement IDs, claim generation, lease ID, and stable
  `mission_request_id`.
- Return the original mission when the same request ID and payload are replayed;
  reject reuse of that request ID with a different payload.
- Make provenance immutable for a mission generation.
- Reject a mismatched repo, issue, claim, or base SHA.
- Preserve the activated `shared-agent-scripts`, `ucla-tdg-ip-agents`, and
  `ucla-tdg-project-agents` connector scopes, path policies, validation,
  identities, budgets, and refusals without widening them.
- Preserve the ban on GitHub credentials, pushes, deploys, and lifecycle state.
- Update the mission contract, runbook, and Elephant Check.
- Produce a reviewed exact revision eligible for, but not authorized for,
  `ACT-REV-03`.

**Validation:**

```bash
go test ./internal/projectsmcp
scripts/agent-check.sh
```

**Non-goals:**

- No GitHub client in Manager.
- No contributor publishing.
- No activation, deployment, or restart.
- No new lifecycle database.

### `GHL-006` — Conduct claimed issues through guarded contributor publication

**Owner:** `kehle-tdg-dev/ucla-tdg-ip-agents`

**Requirements:** `GHL-REQ-02`, `GHL-REQ-03`, `GHL-REQ-04`,
`GHL-REQ-05`, `GHL-NFR-01`, `GHL-NFR-02`, `GHL-NFR-03`,
`GHL-NFR-04`

**Dependencies:** `GHL-004`, `GHL-005`

**Acceptance criteria:**

- Add the logical lifecycle-conductor role to the existing
  `ucla.contribution-coordinator` deployable; create no new service.
- Begin only from a reducer-confirmed claim whose assignment projection
  matches.
- Call `start_agent_mission` with the stable mission request ID, persist the
  returned binding as a claim event, and poll only through
  `check_agent_mission`.
- Renew the claim lease while the mission is active.
- Treat only `ready_for_joel` with a valid immutable packet as success.
- Verify issue/spec/claim lineage, base, clean exact candidate SHA, validation,
  independent review, and packet integrity before publication.
- Continue safely after conductor restart from GitHub claim events and Manager
  mission truth.
- Accept only the verified packet's exact candidate SHA.
- Authenticate contained publication as `kehle-contributor-agent`.
- Push only to a policy-owned branch in the configured contributor fork.
- Verify local, remote fork, and PR head SHAs agree.
- Open or update one idempotent PR with full lineage and acceptance metadata.
- Fail closed on actor, repo, base, fork, head, packet, or claim mismatch.
- Emit separate branch-publish and PR-create/update receipts.
- Post a `published` claim event referencing the PR and exact head.
- Keep credentials out of model and mission environments.
- Expose conductor phase, lease age, recovery, mission status, publication
  status, exact actor, and failure metrics.
- Produce a reviewed exact revision eligible for, but not authorized for,
  `ACT-REV-04`.

**Validation:**

```bash
go test ./internal/contributioncoordinator ./internal/githubreview
go test ./...
```

Use fake Manager, Git remote, and GitHub adapters locally. Live mission and
publication remain separately authorized.

**Non-goals:**

- No base-repository branch writes.
- No force-push, merge, review, deploy, or migration.
- No GitHub credential in Manager or a mission child.
- No lifecycle database in either conductor.
- No activation, deployment, restart, or credential change.

### `GHL-007` — Add UCLA-only exact-head attention and adjudication contracts

**Owner:** `kehle-tdg-dev/ucla-tdg-project-agents`

**Requirements:** `GHL-REQ-07`, `GHL-REQ-08`, `GHL-NFR-02`,
`GHL-NFR-03`

**Dependencies:** verified `ACT-REV-02`

**Acceptance criteria:**

- Define versioned `owner-attention.v1` and adjudication-observation proposal
  payloads.
- Recognize the coordinator's `github_pr_adjudication` action as a no-PM-write
  proposal action, or replace both sides with one agreed versioned action.
- Dedupe current-head items and preserve historical heads.
- Invalidate/supersede on new head or stale packet.
- Record packet, PR, head, business scope, required Joel action, age,
  escalation, and disposition.
- Accept UCLA scope only; reject personal/shared owner-attention writes.
- Fail closed when the business-scope owner is absent.
- Report a real build identity in health.
- Produce a reviewed exact revision eligible for, but not authorized for,
  `ACT-REV-05`.

**Validation:**

```bash
go test ./internal/projectmanager ./internal/proposalstore
go test ./...
go build ./...
go vet ./...
```

**Non-goals:**

- No GitHub review or merge.
- No placement of shared/personal work into UCLA state.
- No activation, deployment, or restart.
- No generic daily-priority allocator.

### `GHL-008` — Route exact-head attention and observe Joel disposition

**Owner:** `kehle-tdg-dev/ucla-tdg-ip-agents`

**Requirements:** `GHL-REQ-06`, `GHL-REQ-07`, `GHL-REQ-08`,
`GHL-REQ-10`, `GHL-NFR-01`, `GHL-NFR-02`, `GHL-NFR-04`

**Dependencies:** `GHL-002`, `GHL-006`, `GHL-007`

**Acceptance criteria:**

- Resolve business scope from server-owned repository policy.
- For personal/shared repo-bound engineering PRs, post one logical
  `owner-attention.v1` GitHub event as `kehle-reviewer-agent`; treat the label
  as a projection.
- For UCLA PRs, upsert one UCLA Project Manager item and cite it from GitHub.
- Preserve packet/post and Project Manager receipts independently.
- Invalidate the previous item when the PR head changes.
- Surface uncovered ownership without inventing a queue.
- Align the coordinator's proposal type/action with Project Manager.
- Observe Joel's exact-head GitHub disposition and resolve/supersede the
  applicable attention state without performing the disposition.
- Add cross-scope rejection and idempotent replay tests.
- Produce a reviewed exact revision eligible for, but not authorized for,
  `ACT-REV-04`.

**Validation:**

```bash
go test ./internal/contributioncoordinator ./internal/githubreview
go test ./...
```

**Non-goals:**

- No new Project Manager implementation in this repo.
- No automatic Joel decision.
- No bus-owned workflow state.
- No activation, deployment, restart, or credential change.

### `GHL-009` — Observe Joel decisions and propose durable ruling graduation

**Owner:** `joelkehle/agent-scripts`

**Requirements:** `GHL-REQ-08`, `GHL-REQ-09`, `GHL-NFR-01`,
`GHL-NFR-02`, `GHL-NFR-03`

**Dependencies:** `GHL-005`, `GHL-008`

**Acceptance criteria:**

- Read Joel-authored GitHub adjudication evidence for the exact current head.
- Correlate decision, packet, attention item, and issue lineage.
- Never perform `APPROVE`, merge, or final `REQUEST_CHANGES`.
- Close/supersede attention through a separately authorized guarded adapter.
- When the decision changes durable doctrine, render a proposed follow-up issue
  identifying the owning canonical document and ruling IDs.
- Route graduation through the same lifecycle.
- Replays create no duplicate decision or graduation proposal.

**Validation:**

```bash
node --test tests/github-lifecycle/adjudication-observer.test.js
npm run agent:check
```

**Non-goals:**

- No inference that silence is a decision.
- No direct edits to canonical doctrine.
- No autonomous adjudication.

### `GHL-010` — Prove the agent-scripts lifecycle pilot

**Owner:** `joelkehle/agent-scripts`

**Requirements:** all

**Dependencies:** `GHL-001` through `GHL-009`; historical verified
`ACT-REV-01` and `ACT-REV-02`; current verified `ACT-REV-03` and
`ACT-REV-04`

**Acceptance criteria:**

- Pass `GHL-E2E-01` through `GHL-E2E-12` in local/fake mode.
- Refuse live mode unless exact activated build identities and checkpoint
  receipts match the approved preflight.
- After another separate canary authorization, create one bounded real issue
  and serialized claim as `kehle-contributor-agent`.
- Run one supervised coding mission.
- Prove conductor restart recovery while polling or before publication.
- Publish one exact-SHA contributor-fork PR as `kehle-contributor-agent`.
- Obtain an independent current-head review and attributed GitHub packet.
- Post one canonical personal/shared GitHub `owner-attention.v1` event as
  `kehle-reviewer-agent`; write nothing to UCLA PM.
- Stop for Joel's adjudication.
- Correlate Joel's decision without performing it.
- Produce a complete artifact and write-receipt ledger.

**Validation:**

```bash
npm run agent:check
```

Plus the documented gates from each dependency repository at the exact
selected or activated revisions, as applicable.

**Non-goals:**

- No production deploy or migration.
- No second repository.
- No automated merge or approval.

## Resolved design positions proposed for approval

### Lifecycle conductor

The existing `ucla.contribution-coordinator` deployable implements the outer
lifecycle-conductor role. Manager remains the inner local coding conductor.
No new service is proposed.

### Owner-attention ownership

The first approved specification PR deliberately amends the canonical
architecture:

- UCLA owner attention remains canonical in UCLA Project Manager.
- Personal/shared repo-bound engineering attention is canonical in versioned
  GitHub PR events.
- The GitHub exception does not cover general personal work, non-repo
  attention, or UCLA work.
- The ready label remains a rebuildable projection in both scopes.

Until that amendment is merged, personal/shared owner-attention routing fails
closed.

### Authenticated contributor-side actor and publication topology

`kehle-contributor-agent` creates approved issues, posts automated claim/renew/
release/recovery and publication events, maintains the assignment projection,
and publishes an exact mission SHA through its configured fork. It never writes
the base branch. `kehle-reviewer-agent` remains the independent review, packet,
and personal/shared attention-event actor.

### Meaning of ready-for-Joel

Ready means decision-ready, not merge-ready. A packet may recommend `merge`,
`request changes`, or `discuss`, provided review/validation evidence is
complete and unresolved judgment is explicit.

## External writes requiring separate authorization

Joel's approval authorizes the bounded local Phase 0 preservation and commit.
It does not authorize any item below.

1. Push the exact Phase 0 commit through the contributor fork and open its PR as
   `kehle-contributor-agent`.
2. Joel merges the specification/amendment PR.
3. Create the approved issue batch as `kehle-contributor-agent`.
4. Add/change issue forms, labels, dependencies, milestones, or assignment
   policy.
5. Grant or change `kehle-contributor-agent` repository permissions required
   for issue creation, claim/release comments, assignment, fork publication,
   and PR creation; configure or rotate its credential.
6. Post each claim, renew, bind-mission, packet-ready, published, release, or
   recovery event and assignment projection as `kehle-contributor-agent`.
7. Start each supervised coding mission after the claim and owning-repository
   mission policy are valid.
8. Configure or fund the review provider, change provider credentials, or
   change model runtime configuration.
9. Activate `ACT-REV-01`: deploy/restart the exact reviewed `GHL-001` Manager
    policy build, then verify build/registry hashes and all positive/refusal
    preflights without starting a target-repository mission.
10. Activate `ACT-REV-02`: deploy/restart the exact reviewed `GHL-002` review
    build, then run its provider/retry smoke and verification.
11. Activate `ACT-REV-03`: deploy/restart the exact reviewed
    `GHL-001`/`GHL-005` Manager build, then verify retained policy, build
    identity, and idempotent mission provenance.
12. Activate `ACT-REV-04`: deploy/restart/reconfigure the exact reviewed
    lifecycle-coordinator build, inject the contained contributor credential,
    update registry safety/actor scopes, and verify recovery, metrics, alert,
    and rollback.
13. Activate `ACT-REV-05` before a UCLA canary: deploy/restart the exact
    reviewed Project Manager build and verify its versioned UCLA-only contract.
14. Publish a mission candidate branch to the contributor fork and open/update
    its PR as `kehle-contributor-agent`.
15. Post reviewer requests, COMMENT reviews, ready packets, packet updates,
    personal/shared `owner-attention.v1` events, or ready-label projections as
    `kehle-reviewer-agent`.
16. Write or update UCLA Project Manager proposals and owner-attention items.
17. Run the separately authorized live `GHL-010` GitHub-write canary after the
    historical `ACT-REV-01`/`ACT-REV-02` and current
    `ACT-REV-03`/`ACT-REV-04` receipts are verified.
18. Merge, approve, or make a final request-changes adjudication; these remain
    Joel-only actions under `joelkehle`.
19. Create the follow-up issue/PR that graduates a durable ruling into its
    canonical document.

Each authorized write should name exact target, actor, verb, expected head or
manifest hash, exact reviewed build, idempotency key, rollback/disable path,
and receipt location. Checkpoint authorization is per exact revision; it does
not authorize a later rebuild or configuration change.

## Evidence and command ledger

### Startup and workspace state

Commands:

```bash
wwi
machine-compliance --agent-startup --format text
docs-list
bus-discover
git status --short --branch
```

Observed:

- active and most-recent WWI loops were surfaced;
- machine compliance: 21 passes, zero warnings, zero failures;
- the released manifest was old and a newer behavioral bundle existed, but the
  startup command emitted no `WARN` or `FAIL`;
- matching docs were read;
- the audit worktree began at the expected branch and had no uncommitted
  changes.

### Canonical revision checks

Commands, repeated in each owning repository:

```bash
git rev-parse HEAD
git rev-parse origin/main
git ls-remote origin refs/heads/main
git status --short --branch
```

Resolved remote main revisions:

```text
agent-scripts             c7b33a9e99e0e15b7315e92178b74f1c9a2c8fe2
manager                   d12dd914c66aef79bd7d68a97c7ab6cae73fbd68
ucla-tdg-ip-agents        c905a7250a8ea85189e9587912c39f143d300686
ucla-tdg-project-agents   042111a526d6ed6e60ca9d5d3f47af8f5e59f11c
```

Repositories with unrelated local changes were not modified. Origin/main
source archives were used for independent tests.

### Local validation

`agent-scripts`:

```bash
npm run agent:check
```

Result: pass, including instruction architecture, 31 Elephant tests, and
contributor-identity isolation checks.

Isolated `ucla-tdg-ip-agents` origin/main:

```bash
git archive origin/main | tar -x -C /tmp/ip-agents-origin-main.aYTNfJ
GOCACHE=/tmp/codex-go-cache-review \
  go test ./internal/contributioncoordinator ./internal/githubreview
```

Result: pass.

Isolated `ucla-tdg-project-agents` origin/main:

```bash
git archive origin/main | tar -x -C /tmp/project-agents-origin-main.dBGCXe
GOCACHE=/tmp/codex-go-cache-pm \
  go test ./internal/projectmanager ./internal/proposalstore
```

Result: pass.

These package tests prove current source behavior, not the complete lifecycle.

### Manager live mission evidence

Commands:

```bash
curl -fsS http://127.0.0.1:8228/health
curl -fsS http://127.0.0.1:8228/metrics |
  rg 'agent_mission|ready_packet|validation|reviewer'
find ~/.local/state -path '*agent-missions*' -name '*.ready.json' -print
jq . <latest-ready-packet>
```

Observed:

- twelve ready packets;
- four budget-exhausted and three system-failure missions;
- ten validation failures and two reviewer-infrastructure retries;
- latest inspected ready packet:
  - mission `ebd926...`;
  - project `shared-manager`;
  - final SHA `e98f9b...`;
  - contributor role `codex/codex-contributor`;
  - reviewer role `codex-independent-reviewer`;
  - reviewer independence true;
  - two passing current-generation validation receipts.

### Manager mission-policy bootstrap evidence

Commands:

```bash
jq '
  .projects[] |
  select(
    .id == "shared-manager" or
    .id == "shared-agent-scripts" or
    .id == "ucla-tdg-ip-agents" or
    .id == "ucla-tdg-project-agents"
  ) |
  {id, path, scopes, agent_policy}
' config/claude-projects-mcp/projects.json

git show origin/main:config/claude-projects-mcp/projects.json |
  jq '
    .projects[] |
    select(
      .id == "shared-manager" or
      .id == "shared-agent-scripts" or
      .id == "ucla-tdg-ip-agents" or
      .id == "ucla-tdg-project-agents"
    ) |
    {id, path, scopes, agent_policy}
  '
```

Observed in both inspected configuration and Manager origin/main:

| Project ID | Visible scopes | Agent policy |
|---|---|---|
| `shared-manager` | `personal`, `ucla` | Enabled for Codex mission invocation from `personal`; targeted `go test ./internal/projectsmcp`; full `scripts/agent-check.sh`; commit allowed; push denied. |
| `shared-agent-scripts` | `personal`, `ucla` | `null` |
| `ucla-tdg-ip-agents` | `ucla` | `null` |
| `ucla-tdg-project-agents` | `ucla` | `null` |

Manager refuses mission invocation when `agent_policy` or enabled
`mission_policy` is absent. Therefore `shared-manager` can conduct the
`GHL-001` bootstrap mission, but `GHL-002`, `GHL-003`, `GHL-004`, and
`GHL-007` cannot execute in their owning repositories until `ACT-REV-01`
activates the reviewed bootstrap policy. The roadmap further holds
`GHL-003`, `GHL-004`, and `GHL-007` behind `ACT-REV-02` so the active review
repair remains the first target-repository mission.

### Contribution coordinator and review runtime

Commands:

```bash
curl -fsS http://127.0.0.1:8247/health
curl -fsS http://127.0.0.1:8247/metrics
curl -fsS http://127.0.0.1:8251/health
curl -fsS http://127.0.0.1:8251/metrics
```

Initial coordinator snapshot:

```text
sweeps       152
dispatches   761
```

Initial reviewer snapshot:

```text
processed outcomes                 201
first_pass retryable_failure       196
soft outcomes                        5
ready packets                        0
GitHub writes                         5
```

Later reviewer snapshot:

```text
build                              c905a72
processed outcomes                    306
policy succeeded                      306
first_pass retryable_failure          301
first_pass not_attempted                 5
downstream stages not_attempted       306
ready packets                           0
GitHub writes                            5
```

Safe, value-redacted runtime configuration inspection:

```bash
docker exec deploy-contribution-coordinator-1 sh -lc \
  'printf "%s\n" "$CONTRIBUTION_REVIEW_SWEEP_INTERVAL" \
    "$CONTRIBUTION_REVIEW_DISPATCH_RETRY" \
    "$CONTRIBUTION_REPOSITORIES"'
docker exec deploy-github-review-agent-1 sh -lc \
  'printf "%s\n" "$GITHUB_WRITE_ENABLED" "$GITHUB_LOGIN" \
    "$SUBSTANTIVE_REVIEW_ENABLED"'
```

Observed:

```text
sweep interval       900 seconds
dispatch retry       1800 seconds
covered repos        5
write enabled        true
GitHub login         kehle-reviewer-agent
substantive review   true
```

No token or secret value was printed.

### Durable retry evidence

Read-only copies:

```bash
docker cp \
  deploy-contribution-coordinator-1:/app/data/intern-manager/github-sweep-cursor.json \
  /tmp/github-review-evidence.mUe0Rt/cursor.json
docker cp \
  deploy-contribution-coordinator-1:/app/data/intern-manager/pm-events.jsonl \
  /tmp/github-review-evidence.mUe0Rt/pm-events.jsonl
```

Cursor query:

```bash
jq '{version,updated_at,pull_request_count:(.pull_requests|length)}' \
  /tmp/github-review-evidence.mUe0Rt/cursor.json
```

Observed:

```json
{
  "version": 3,
  "updated_at": "2026-07-26T13:54:47.80674869Z",
  "pull_request_count": 21
}
```

Failure classification query:

```bash
jq -s '
  [.[] |
    select(
      .kind == "review_stage" and
      .stage == "first_pass_review" and
      .status == "retryable_failure"
    )
  ] as $f |
  {
    failed_events: ($f | length),
    unique_repo_pr_heads:
      ($f | map([.repo, (.item|tostring), .head_sha] | join("#")) |
       unique | length),
    unique_prs:
      ($f | map([.repo, (.item|tostring)] | join("#")) |
       unique | length),
    temperature_deprecated:
      ($f | map(select(.error | contains("temperature` is deprecated"))) |
       length),
    low_credit:
      ($f | map(select(.error | contains("credit balance is too low"))) |
       length)
  }' /tmp/github-review-evidence.mUe0Rt/pm-events.jsonl
```

Observed:

```json
{
  "failed_events": 14,
  "unique_repo_pr_heads": 14,
  "unique_prs": 9,
  "temperature_deprecated": 4,
  "low_credit": 10
}
```

Representative durable records:

- `pm-event-c47507d2f3b56e1aeafd8054`: Opus request rejected because
  `temperature` is deprecated;
- `pm-event-3427425d0ddcd645b2e52e13`: Sonnet request rejected for
  insufficient Anthropic credit;
- `pm-event-481601197df0ca50665930c4`: current PR #25 head redispatched as
  `pr_review_pending`;
- `pm-event-7809eccceda50615042b6c40`: latest captured sweep dispatched five
  reviews.

Container log search:

```bash
docker logs --since 24h deploy-github-review-agent-1 2>&1 |
  rg 'credit balance|temperature.*deprecated|first.pass|retryable'
```

Result: no matching lines. The durable event ledger, not the reviewed container
log, held the exact provider errors. That is itself an observability/runbook
gap.

### Retry source evidence

Commands:

```bash
git show origin/main:internal/contributioncoordinator/agent.go |
  nl -ba | sed -n '295,345p'
git show origin/main:internal/contributioncoordinator/sweep.go |
  nl -ba | sed -n '275,330p'
git show origin/main:internal/githubreview/packet.go |
  nl -ba | sed -n '1,100p'
git show origin/main:internal/githubreview/substantive.go |
  nl -ba | sed -n '165,210p'
```

Source findings at `ucla-tdg-ip-agents@c905a72`:

- `packet.go:22-32`: substantive model errors become retryable first-pass
  failures and return no packet;
- `agent.go:325-334`: failed replies clear the pending token, generation, and
  request time;
- `sweep.go:304-315`: retry suppression depends on those values remaining set;
- `substantive.go:185-195`: every Anthropic request sends
  `Temperature: anthropic.Float(0)` and returns provider errors unchanged.

### Project Manager evidence

Commands:

```bash
curl -fsS http://127.0.0.1:8223/health
curl -fsS http://127.0.0.1:8223/v1/proposals |
  jq '{
    total: length,
    github_review:
      [.[] | select(.disposition_type == "github_pr_review")] | length,
    actions:
      ([.[] | select(.disposition_type == "github_pr_review") |
        .proposed_action] | group_by(.) |
       map({action: .[0], count: length}))
  }'
bus-discover --format text |
  rg 'contribution-coordinator|github-review|project-manager'
```

Observed snapshot:

```text
all proposals                    303
GitHub review proposals           37
github_peer_review_retry           2
github_peer_review_wait           17
github_pr_review_needed            2
github_review_receipt               9
github_review_stage_retry           7
```

The runtime health reported `version=dev` with no build identity.
`ucla-tdg-project-manager` was absent from current bus discovery even though
direct HTTP health and reads worked.

### Read-only GitHub discovery

Commands:

```bash
gh api 'repos/joelkehle/agent-scripts/issues?state=open&per_page=100'
gh api repos/joelkehle/agent-scripts/labels
gh api repos/joelkehle/agent-scripts/contents/.github
gh api repos/joelkehle/agent-scripts/branches/main/protection
gh pr view 6 --repo joelkehle/agent-scripts
gh pr view 25 --repo kehle-tdg-dev/ucla-tdg-ip-agents
gh pr view 18 --repo joelkehle/pinakes
gh api repos/kehle-contributor-agent/agent-scripts
gh api repos/kehle-contributor-agent/pinakes
```

Observed:

- `agent-scripts`: zero open issues; default labels; no `.github` issue
  templates/forms; main branch not protected;
- `agent-scripts` PR #6: author `kehle-contributor-agent`; reviewer COMMENT
  evidence tied to an exact head;
- `ucla-tdg-ip-agents` PR #25: author `kehle-contributor-agent`; current head
  `4a7eb2aa...`; prior reviews target older heads and do not establish current
  readiness;
- Pinakes PR #18: authored by `joelkehle`, useful as historical state but not
  proof of the required machine-contributor path;
- contributor forks exist for `agent-scripts` and Pinakes;
- repository permissions varied, supporting the fork-first recommendation.

No GitHub mutation endpoint was called.

### Contributor wrapper evidence

Commands:

```bash
command -v contributor-agent
sha256sum "$(command -v contributor-agent)" bin/contributor-agent
```

Observed: installed and tracked wrapper hashes matched:

```text
b4a97...  installed contributor-agent
b4a97...  bin/contributor-agent
```

This proves installation integrity, not the proposed contained publisher
boundary.

### Roadmap-repair validation

Commands:

```bash
docs-list
npm run agent:check
git diff --no-index --check /dev/null \
  docs/github-native-lifecycle-read-propose-packet.md
```

Observed:

- `docs-list`: pass; this packet was discovered with its summary and
  `read_when` hints.
- `npm run agent:check`: pass; instruction architecture, 31 Elephant tests,
  loop tooling, and contributor identity/isolation checks passed.
- the exact no-index whitespace check emitted no diagnostics. Git returned
  status 1 because `/dev/null` and this new untracked file differ; for
  `git diff --no-index`, that status reports a difference, not a whitespace
  error. Any whitespace error would have been printed.

## Approval sequence

Recommended next steps:

1. Completed: systems-author review of the repaired read/propose packet.
2. Completed: Joel approved the specification, lifecycle-conductor reuse,
   claim primitive, authenticated actors, and scope-specific architecture
   amendment on 2026-07-26.
3. Preserve, validate, and locally commit the specification plus canonical
   architecture, protocol, State Architecture, and Elephant amendments in
   `agent-scripts` as the Phase 0 local slice. This step performs no GitHub or
   runtime write.
4. Separately authorize contributor-fork push/PR; Joel adjudicates and merges
   that exact Phase 0 revision. Do not create a retrospective ratification
   issue.
5. Joel approves the rendered GitHub issue batch; separately authorize its
   creation as `kehle-contributor-agent`.
6. Run `GHL-001` as the first implementation mission through the already
   enabled `shared-manager` project.
7. After its PR is reviewed and merged, separately authorize `ACT-REV-01` for
   that exact Manager build and verify all three target policies through the
   read-only preflight.
8. Only after `ACT-REV-01` passes, run `GHL-002` as the first target-repository
   mission.
9. After its PR is reviewed and merged, separately authorize `ACT-REV-02` and
   verify the active provider/retry failure has stopped.
10. Run one supervised coding mission for `GHL-003` through `GHL-009`,
    respecting the dependency graph.
11. Separately authorize current exact `ACT-REV-03` Manager and `ACT-REV-04`
    lifecycle builds. Verify they retain the earlier bootstrap and review
    repairs. Do not infer activation from merge, image creation, or local tests.
12. Run `GHL-010` local/fake scenarios and activation preflight.
13. Only after all preflight evidence is green, separately authorize one live
    `agent-scripts` GitHub-write canary.
14. Stop for Joel adjudication, then prepare `PIN-GHL-001` and
    `PIN-GHL-002`.
15. Separately authorize `ACT-REV-05` before any later UCLA live canary.
16. Broaden repository enrollment only after agent-scripts and Pinakes pilots
    are accepted.

This packet authorizes none of steps 3 through 16. Implementation, GitHub
writes, activation, deployment, restart, and credential changes remain
stopped.
