---
summary: "Canonical architecture contract for contribution intake, independent PR review, GitHub posting, ready-for-Joel packets, and owner-attention routing across Joel's repos."
read_when:
  - Designing or changing contribution routing, automated PR review, GitHub machine identities, or the ready-for-Joel queue.
  - Changing the contribution coordinator, policy evaluator, first-pass reviewer, GitHub review poster, or Project Manager integration.
  - Implementing or reviewing github-pr-review, contribution-coordinator, review-agent, or project-manager behavior.
  - Deciding whether a new review-related agent, queue, store, label, or bus capability is needed.
---

# Contribution Review Architecture Contract

Version: 0.2 (2026-07-26). This contract becomes effective when Joel merges it
into `main`.

## Outcome

One contribution pipe serves human interns, coding agents, and Joel:

```text
captured work
  -> faithful GitHub issue
  -> conflict-safe claim
  -> supervised coding mission
  -> contribution PR
  -> independent first-pass review
  -> attributed GitHub evidence
  -> scope-owned owner-attention record
  -> Joel + AI discussion
  -> Joel adjudication
```

The system spends Joel's attention on judgment, not discovery, dispatch,
credential handling, status reconstruction, or routine correction. It also
preserves the teaching value of contribution: a human contributor normally
receives and resolves feedback, while Joel may explicitly choose a
transparent expedited-completion mode when time matters.

This is the canonical cross-repo architecture for that outcome. Repo-local
specs implement it; they do not redefine its roles, identity boundaries, or
state ownership.

## Authority and scope

Global, workspace, and repo `AGENTS.md` files govern safety, authority,
validation, and writes. The Maintainer Charter governs Joel's authority and
standing rulings. This contract implements those rulings. The Contributor
Operating Protocol governs human-facing operation. The State Architecture
governs persistent fact ownership.

If these documents conflict:

1. `AGENTS.md` safety and authority rules win.
2. The Maintainer Charter wins within maintainer doctrine.
3. The State Architecture wins on canonical state ownership.
4. This contract wins on contribution-review component boundaries and
   lifecycle.
5. The Contributor Operating Protocol is reconciled to the result.

Repo docs still own repo-specific acceptance criteria, validation commands,
deployment, and rollback. The live Pinakes registry owns current runtime and
capability discovery. Neither this contract nor a static roster proves that a
runtime is live.

Normative words `MUST`, `MUST NOT`, `SHOULD`, and `MAY` express requirements.

## Architectural principles

1. **One pipe, distinct contributors.** Humans and agents use the same
   artifact flow. Their identity, availability, authority, and learning needs
   remain explicit.
2. **Roles before deployables.** A logical responsibility is not automatically
   a new long-lived agent. One deployable may perform several compatible
   roles; incompatible authority stays separated.
3. **Independence is an identity property.** The reviewer cannot be the
   contributor. A different process using the contributor's identity is not
   independent review.
4. **Judgment and transport are separate.** The reviewer creates findings.
   The poster may transmit those findings verbatim. Credential possession
   does not confer review authority.
5. **GitHub is review truth.** Private receipts and bus messages may support
   work, but review is incomplete until attributed evidence is on the PR.
6. **Attention has a scope-owned home.** A ready packet is evidence. GitHub PR
   events own personal/shared repo-bound engineering attention. UCLA Project
   Manager owns UCLA attention. Unowned routes fail closed.
7. **Projections fail closed.** Labels, dashboards, and caches never override a
   live PR head or the canonical packet.
8. **Retry partial outcomes.** Dispatch, review, posting, and queueing are
   independently observable steps. A later step failing MUST NOT make an
   earlier partial result look complete.
9. **Scope is server-authoritative.** A caller cannot grant itself scopes or
   shared access. Transport namespace does not decide business ownership.
10. **No hidden delegation.** This contract creates no merge authority and no
    autonomous GitHub `APPROVE` authority.

## Canonical vocabulary

| Term | Meaning |
|---|---|
| **contributor** | Human or agent that authors the proposed change. Preferred term; do not use `worker` for this role. |
| **human contributor** | Person contributing through the pipe, including an intern. Mentoring and availability rules apply. |
| **agent contributor** | Coding agent contributing through the pipe under a distinct machine identity. |
| **lifecycle conductor** | Owns one bounded issue from confirmed claim through supervised mission completion and guarded contributor publication. |
| **contribution coordinator** | Observes contribution state, checks coverage, dispatches review, retries partial failure, and records coordination outcomes. |
| **policy evaluator** | Runs deterministic, explainable checks: identity, scope, acceptance metadata, repository rules, and other machine-verifiable policy. |
| **first-pass reviewer** | Non-author reasoning role that evaluates correctness, safety, architecture, tests, and maintainability. |
| **peer reviewer** | Human or agent providing useful review that does not by itself complete the required first-pass review unless it satisfies this contract. |
| **GitHub review poster** | Narrow credential-bearing role that posts an attributed review or packet without changing its substance. |
| **machine account** | GitHub account used by automation. It is an authenticated actor, not an orchestrator or reasoning role. |
| **authenticated actor** | Identity GitHub records for a write action. |
| **ready-for-Joel packet** | Commit-anchored review evidence showing that a PR is prepared for adjudication. |
| **owner-attention record** | Scope-owned state saying Joel owes a defined action, with exact head, status, age, escalation, and disposition. |
| **recommended disposition** | Reviewer proposal: merge, request changes, or discuss. Never a decision. |
| **adjudication** | Joel's final merge or request-changes judgment and its recorded reasoning. |
| **write receipt** | Evidence of an attempted or completed external write, including actor, target, outcome, and source evidence. |
| **namespace** | Transport partition or address family. It is not an authorization grant. |
| **scope** | Server-authoritative business/data authorization attached to identity and enforced on reads and writes. |
| **bus** | Transport and capability-discovery substrate. It owns no durable workflow fact. |
| **Project Manager** | UCLA work-noun and owner-attention system. Do not use this term for the contribution coordinator. |
| **coding session** | Bounded Codex or Claude Code execution. Not a long-lived runtime agent. |
| **subagent** | Temporary delegated coding/review process. Not a contributor class, machine account, or standing service. |

Reserve `worker` for Pinakes runtime class or temporary execution mechanics.
Reserve `review agent` for a deployable name only when necessary; in
architecture prose, name the logical role.

## Logical components

### Lifecycle conductor

The lifecycle conductor owns this bounded outer sequence:

```text
confirmed GitHub issue claim
  -> idempotent start_agent_mission request
  -> mission polling and lease recovery
  -> successful exact-revision ready packet
  -> guarded contributor-fork publication
```

The existing `ucla.contribution-coordinator` deployable implements this role;
no second service is justified. It serializes one active claim per issue from
the versioned GitHub issue-comment event stream, renews or recovers a bounded
lease, and records attributable receipts for every requested side effect.
GitHub remains canonical for issue and claim state. Manager remains canonical
for mission state.

`start_agent_mission` is the inner local coding conductor. It holds no GitHub
credential, is not the contribution lifecycle database, and never publishes a
branch or PR. The lifecycle conductor holds no authority to approve, merge, or
perform Joel's final request-changes adjudication.

### Contribution coordinator

The coordinator:

- discovers covered repositories and eligible PR lifecycle events;
- observes draft-to-ready and new-head transitions;
- resolves repo ownership and scope before dispatch;
- selects an independent first-pass reviewer;
- dispatches review for an exact `head_sha`;
- tracks each stage separately and retries incomplete stages;
- records action/outcome history and exposes operational metrics;
- routes owner attention to its scope-owned home only when Joel owes action;
- escalates uncovered repositories, unavailable reviewers, aged failures, and
  identity-policy violations.

It MUST NOT perform final adjudication. It MUST NOT mark a head complete merely
because dispatch succeeded. Its dispatch cursor is coordination state, not
review truth.

### Policy evaluator

The evaluator produces deterministic findings that another operator can
reproduce. Examples:

- contributor and reviewer identity separation;
- allowed repository and target branch;
- exact PR head;
- draft/readiness state;
- required issue, acceptance criteria, or metadata;
- server-authoritative scope policy;
- repo-defined validation evidence;
- credentialed actor policy.

An explicitly authorized evaluator MAY post a clearly attributed, reversible
`REQUEST_CHANGES` guardrail for a deterministic blocker under Maintainer
Charter R1. That event is policy enforcement, not Joel's adjudication.

### First-pass reviewer

The reviewer evaluates what deterministic checks cannot settle:

- behavioral correctness and acceptance-criteria fit;
- security, privacy, scope, and failure modes;
- architecture and state ownership;
- regressions and test adequacy;
- maintainability, reversibility, and deployment risk;
- unresolved judgment that only Joel can decide.

The reviewer MUST be independent of the contributor and MUST identify the
evidence reviewed. Model inference may implement this role, but a formatted
policy-check result alone is not substantive review. This reasoning role is
read/propose unless it is explicitly combined with the write-capable poster.

### GitHub review poster

The poster is a guarded write adapter. It:

- accepts a structured, attributed review or packet;
- verifies repository, PR, head, actor, and idempotency;
- posts exactly the authorized payload;
- records the resulting GitHub object or exact failure;
- reports reviewer-request and review-post outcomes separately;
- never rewrites, softens, strengthens, or re-adjudicates findings.

The poster MAY post findings it generated itself only when it is also the
attributed reviewer and satisfies reviewer independence. When reviewer and
poster differ, it MUST preserve reviewer attribution and a content hash.

No general coding session receives the poster's credential.

A deployable that combines reviewer and poster roles is write-capable even
when its recommendation remains propose-only. Its Manager policy, runtime
registration, capability description, and guarded write surface MUST agree;
credential possession must not silently exceed the declared safety class.

### Project Manager

Project Manager owns UCLA work nouns, including UCLA owner-attention state. It:

- creates or updates one deduplicated item for the required Joel action;
- records readiness source, current head, age, priority, and escalation;
- invalidates or supersedes the item when readiness evidence becomes stale;
- records Joel's disposition and closes the work item.

Project Manager does not review code, post GitHub reviews, or infer readiness
from a label alone.

### GitHub repo-bound owner attention

For personal/shared repo-bound engineering, an append-only
`owner-attention.v1` PR event stream is canonical. Events name the exact head,
source packet, authenticated actor, idempotency key, state transition, and
superseded event when applicable. Server-ordered reduction yields current
attention state. The `ready-for-joel` label is only a rebuildable projection.

This ownership does not extend GitHub to non-repository personal work. UCLA
attention remains in UCLA Project Manager state. A route with no approved
scope owner fails closed.

### Adjudicator

Joel, with an AI analysis partner, is the adjudicator. Joel may merge, request
changes, ask for discussion, or explicitly select expedited
completion. Automation may recommend; it does not silently choose.

## Identity and credential contract

The three identities are distinct fields even when two roles happen to use the
same permitted machine account:

```text
contributor_identity
reviewer_identity
poster_identity
```

Required invariants:

- `reviewer_identity != contributor_identity`;
- the authenticated GitHub actor MUST equal `poster_identity`;
- every attributed review names its actual `reviewer_identity`;
- a poster acting for another reviewer transmits the reviewed payload verbatim;
- `joelkehle` is a human account and MUST NOT be used by unattended
  automation;
- credentials MUST be selected by an owning service, scoped to approved repos
  and actions, inaccessible to arbitrary model sessions, revocable, and
  auditable.

Machine-account roles:

| GitHub account | Authorized architectural purpose | Prohibited use |
|---|---|---|
| `kehle-contributor-agent` | Author agent-generated commits and PRs | Independent review of its own contributions |
| `kehle-reviewer-agent` | Post attributed first-pass reviews, packets, and guarded reviewer requests | Author product changes or contributor PRs |
| `joelkehle` | Joel's human contribution and adjudication | Unattended automation |

`kehle-contributor-agent` is the authenticated actor for automated issue
creation, claim/renew/release/recovery events, assignment projections, and
contributor-fork publication. `kehle-reviewer-agent` is the authenticated actor
for attributed review, ready-packet, and personal/shared owner-attention
events.

Account names are configuration, not schema. Renaming an account updates
identity policy and runtime configuration; it MUST NOT create a new logical
role.

Historical mixed use is migration evidence, not retroactive invalidation.
New writes after ratification MUST satisfy this table once enforcement is
declared live.

## Review lifecycle

The unit of review is `(repository, pull_request, head_sha)`. The lifecycle:

1. **Capture.** Faithful work exists in a GitHub issue with requirement IDs,
   dependencies, acceptance criteria, validation, and non-goals.
2. **Claim.** A contributor obtains the issue through the conflict-safe,
   versioned GitHub claim event stream and a bounded lease.
3. **Conduct.** The lifecycle conductor starts and polls one idempotent
   `start_agent_mission` request under the owning Manager policy.
4. **Publish.** Only a successful exact-revision mission packet may reach the
   guarded contributor adapter, which publishes from the contributor fork as
   `kehle-contributor-agent`.
5. **Observe.** The coordinator notices a review-eligible PR transition.
   Draft PRs remain visible but are not ready.
6. **Authorize.** The coordinator verifies repository coverage, ownership,
   scope, target branch, and available independent reviewer.
7. **Dispatch.** Review is requested for the exact head. A durable action event
   records success or failure; the disposable cursor supports deduplication.
8. **Evaluate.** Deterministic policy checks run.
9. **Review.** An independent first-pass reviewer analyzes the change and local
   validation evidence.
10. **Respond.** Blocking findings return to the contributor. Non-blocking
   coaching remains visible but does not manufacture a blocker.
11. **Post.** The poster places attributed findings and, when ready, the packet
   on the PR.
12. **Queue.** The coordinator appends the scope-correct owner-attention event
    or UCLA Project Manager proposal for the same head.
13. **Discuss.** Joel and an AI partner examine the packet and unresolved
    judgment.
14. **Adjudicate.** Joel records and performs the decision.
15. **Graduate.** Durable architecture or policy decisions move to their
    canonical document and are linked from the PR.

A new head invalidates steps 8 through 12 for the old head. The replacement
cycle explicitly supersedes prior evidence. A draft transition or new blocking
state likewise suppresses readiness.

## Retry and partial-state contract

Each side effect has its own status:

```text
dispatch
policy_evaluation
first_pass_review
review_post
reviewer_request
ready_packet_post
owner_attention_upsert
```

For each status, record `not_attempted`, `succeeded`, `retryable_failure`, or
`terminal_failure`, plus attempt time, actor, target, head, and receipt.

Rules:

- success at one stage MUST NOT imply success at another;
- a reviewer-request failure MUST be reported as failure even if review posting
  succeeded;
- a head is not ready until the review and packet posts succeed and the
  scope-owned owner-attention record cites them;
- retries use stable idempotency keys and MUST NOT duplicate GitHub comments,
  reviews, or PM work items;
- terminal failures become visible owner-attention work only when Joel must
  resolve authority, policy, or infrastructure;
- transient failures remain operational retries until their documented age or
  attempt threshold is exceeded.

Recommended idempotency basis:

```text
repository + pull_request + head_sha + stage + payload_hash
```

## Ready-for-Joel packet contract

The canonical marker is `ready-for-joel.v1`. The PR-posted packet MUST contain:

1. repository, PR number, and exact `head_sha`;
2. generation time;
3. `contributor_identity`, `reviewer_identity`, and `poster_identity`;
4. explicit reviewer-independence result;
5. concise change summary;
6. severity-ranked findings with file, line, or artifact citations;
7. acceptance-criteria status;
8. validation evidence, including commands and the tested head;
9. unresolved judgment calls, including `none` when empty;
10. recommended disposition;
11. risk, reversibility, and deployment state;
12. reviewer attribution and payload hash when poster and reviewer differ;
13. links to superseded packet, write receipt, and relevant work item when
    available.

The packet MUST NOT create a GitHub `APPROVE` event. A `ready-for-joel` label is
a rebuildable user-interface projection. Consumers compare the packet head to
the live PR head and fail closed on mismatch.

## State ownership

| Fact or artifact | Canonical owner | Notes |
|---|---|---|
| PR, commit, head SHA, review, comment, adjudication record | GitHub | Review is incomplete until evidence is here. |
| Repo requirements and validation contract | Owning repo | Packet cites them; it does not replace them. |
| UCLA owner-attention status, age, escalation, disposition | UCLA Project Manager | One work item per required action and current head. |
| Personal/shared repo-bound owner-attention status and disposition | GitHub PR `owner-attention.v1` events | Server-ordered event reduction for the exact head. |
| Issue claim, lease, release, and recovery | GitHub issue `issue-claim.v1` events | Assignment is a projection; the event reducer is canonical. |
| Coordinator action/outcome audit | Coordinator's State-Architecture-approved durable log | Stores attempts and outcomes, with GitHub/PM pointers. |
| Sweep and retry cursor | Coordinator repo-local working state | Disposable and rebuildable. |
| Agent role, trust, safety class, reporting line | Manager agent-org | Runtime passports and docs are projections. |
| Runtime registration and HMAC transport identity | Pinakes | Transport only; no durable workflow facts. |
| GitHub authenticated actor | GitHub account/install identity | Runtime config maps actor to allowed role. |
| Ready label and dashboards | Projection | Safe to delete and rebuild. |

The packet is canonical review evidence; the scope-owned owner-attention
record is canonical work state. Neither duplicates the other:

```text
packet: what was reviewed and why it is ready
work item: who owes what action, by when, and with what disposition
```

Personal/shared repository attention MUST NOT become UCLA work state. Its
canonical home is the GitHub PR event stream. UCLA attention MUST remain in
UCLA Project Manager. Non-repository personal attention is outside this
contract. Every write carries business scope and fails closed when no approved
owner exists.

## Human learning and expedited completion

Default for human contributors: **contributor revision**.

- Findings go to the contributor.
- The contributor gets a fair opportunity to understand and fix them.
- Feedback distinguishes required changes from preferences.
- Silence follows the documented nudge ladder, not personal judgment.

Joel may explicitly select **expedited completion** for a specific PR only when
the review and outcome are clear, the contributor has had a reasonable
opportunity to respond, the remaining change is narrow and contains no
unresolved product or architecture judgment, and delay would materially block
a release, migration, dependent contributor, or time-sensitive objective. In
that mode:

- the helper makes the smallest coherent correction;
- the contributor's commits and authorship remain in merged history;
- helper work uses a separate commit with the helper's real identity;
- the public PR record explains the intervention and reason;
- a human contributor receives a later explanation and invitation for
  questions;
- the new head receives independent review before adjudication.

This mode accelerates repair; it does not bypass the pipe or turn a reviewer
into the reviewer of its own fix. Repeated expedited completion is process
evidence: inspect specification quality, review latency, assignment fit,
contributor availability, and package size rather than normalizing takeover.

Joel-authored emergency changes use the same pipe with urgent scheduling. The
architecture introduces no automatic waiting period, but it introduces no
unreviewed merge side door either.

## Scope and topology

The capability is shared across JK, UCLA, and shared repositories. Do not build
a JK twin merely because a transport namespace or deploy host differs.

- Repository ownership determines policy and owner-attention routing.
- Server-bound identity determines allowed scope.
- Pinakes namespace determines transport addressing only.
- The current number of buses and their host placement are deployment facts,
  not this workflow's schema.
- Consolidating onto Keystone MUST preserve explicit scope enforcement,
  business-owner routing, and evidence pointers.

The future Buzz-derived identity and immutable-event design may replace HMAC
and audit internals only after Joel approves its contract. This architecture
requires stable identity anchors and attributable events, but does not choose
the Buzz-derived scheme or implement WP4.

## Deployable mapping

Logical roles are stable; deployable names may change. A current runtime MAY
map as follows:

| Logical role | Existing deployable or facility |
|---|---|
| Lifecycle conductor | `ucla.contribution-coordinator` |
| Contribution coordinator | `ucla.contribution-coordinator` |
| Policy evaluator | deterministic checks in the review pipeline |
| First-pass reviewer | `ucla-tdg-github-review-agent` plus an independent reasoning session where required |
| GitHub review poster | guarded GitHub write adapter using `kehle-reviewer-agent` |
| UCLA Project Manager | `ucla-tdg-project-manager` |
| Adjudicator | Joel with Codex or Claude Code |

This table is a convenience map, not proof of live availability or complete
implementation. Reuse an existing deployable when authorities are compatible.
Split a deployable only to enforce an otherwise impossible identity,
credential, failure, scaling, or ownership boundary.

No new long-lived agent is required by this contract.

## Required observability

The operating pipeline exposes:

- last successful repository sweep;
- covered and uncovered repositories;
- dispatch attempts, failures, and age;
- policy-evaluation results;
- first-pass-review completion and latency;
- review-post and reviewer-request outcomes separately;
- packet validity by current head;
- owner-attention upsert outcome and item reference;
- retry count, terminal failures, and escalation age;
- authenticated GitHub actor for every write.

Reachable services follow the workspace service runtime policy, including
health, metrics, auth, bounded inputs, alert, and linked runbook requirements.

## Conformance scenarios

An implementation is incomplete until it proves all four:

### Human intern PR

An intern opens a ready PR. The coordinator dispatches an independent review.
Actionable findings return to the intern. After revision, a packet for the new
head reaches the correct scope-owned attention record. Joel adjudicates.

### Agent-authored PR

`kehle-contributor-agent` authors the PR. A different reviewer analyzes it.
`kehle-reviewer-agent` posts the attributed review and packet. No automation
uses `joelkehle`; no actor reviews its own contribution.

### Joel emergency PR

Joel opens an urgent PR. The same review roles run without an artificial batch
delay. The packet records urgency and risk. Joel remains adjudicator; urgency
does not falsify review evidence.

### Scope/security change

A change touches namespace, scope, auth, or audit. Deterministic checks and
substantive review both run. Cross-scope reads and writes fail closed.
Owner-attention state lands in the approved scope-owned home.

## Implementation gates

Before claiming the architecture implemented:

1. Reconcile active Git lineages and re-audit implementation against current
   `origin/main`.
2. Align repository coverage configuration and make uncovered repos visible.
3. Enforce contributor/reviewer/poster identity policy at runtime.
4. Add the guarded attributed verbatim-poster boundary.
5. Prove a substantive first-pass review, not only deterministic checks.
6. Make partial-stage status, retries, and exact failure reporting durable.
7. Upsert and invalidate owner-attention work by exact head and business scope.
8. Add local tests for idempotency, new-head invalidation, identity separation,
   partial failure, and cross-scope routing.
9. Pass each owning repo's documented local gate.
10. Prove health, metrics, authenticated GitHub actors, GitHub artifacts, and
    scope-correct GitHub or UCLA Project Manager attention state in the live
    environment.

Documented, implemented, deployed, and proven live remain separate claims.

## Change control

Changes to roles, identity invariants, state ownership, adjudication authority,
or the lifecycle require:

- an update to this contract;
- an Elephant Check when the change is system-level;
- reconciliation with the Maintainer Charter, Contributor Operating Protocol,
  and State Architecture;
- Joel's adjudication through a PR.

Repo-local implementation detail may evolve without changing this contract
when it preserves the boundaries above.

## Open decisions

These are intentionally outside this contract:

- the final Keystone host and failover topology;
- the Buzz-derived WP4 identity, signed-event, and transactional-audit design;
- any future delegation beyond deterministic reversible guardrails.

Until Joel decides them, implementations fail closed rather than infer policy.

## Changelog

- 0.2 (2026-07-26): add the lifecycle conductor using the existing
  contribution-coordinator; define GitHub claim events; assign personal/shared
  repo-bound owner attention to GitHub PR events while retaining UCLA attention
  in UCLA Project Manager.
- 0.1 (2026-07-23): initial canonical architecture contract.
