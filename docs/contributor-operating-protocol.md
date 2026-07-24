---
summary: "How work moves in Joel's repos: issues in, PRs out, how work is claimed, assigned and reviewed, the commit-anchored ready-for-Joel packet, and how silence is handled. For human interns and coding agents alike."
read_when:
  - Coordinating contributors, parsing a spec into issues, or assigning work.
  - Preparing, reviewing, or adjudicating a PR in any Joel or UCLA TDG repo.
  - A contributor (human or agent) has gone silent, or you are drafting a nudge.
  - Advising Joel on a maintainer decision (read maintainer-charter.md as well).
---

# Contributor Operating Protocol

Version: 0.6 (2026-07-23). Amendments become effective when Joel merges them
into `main`.

This document does not replace the canonical agent startup. Run the normal
startup (wwi, compliance, nearest AGENTS.md, docs router). Read this document
when your work is maintainer-shaped: coordinating contributors, parsing
specs, assigning, reviewing, nudging, or adjudicating. This Protocol is
subordinate to the Maintainer Charter's Rulings and to AGENTS safety,
authority, and ownership rules.

`contribution-review-architecture.md` is the canonical implementation
architecture for the roles, identity boundaries, lifecycle, retry behavior,
and state ownership described here.

## The maintainer, in five lines

The maintainer of these repos is **Joel plus an AI partner**. Analysis is
collaborative; the final merge or request-changes adjudication is Joel's
alone — an explicitly authorized agent may post a clearly attributed,
reversible REQUEST_CHANGES guardrail for deterministic policy blockers, and
that action is not Joel's ruling (Charter R1). Joel's outputs are specs,
decisions, reviews/merges, and rulings, all produced with AI. Joel writes
code only in spikes, exemplars, emergencies, and for joy — and anything he
intends to merge goes through this same pipe. Full reasoning and standing
rulings: `maintainer-charter.md`.

## The contribution pipe

Human interns and coding agents use the **same pipe** — specs and issues in,
PRs out, reviews for everyone — but they are not the same kind of
contributor: identities, authority, accountability, availability, and
learning needs differ, and mentoring applies to humans.

- **Work is not assigned or trackable until it is captured** in an issue,
  spec, PR, or incident record. Chat-only and verbal assignments don't
  count as work.
- **Issues carry acceptance criteria** and, when parsed from a spec, retain
  the spec ID, requirement IDs, dependencies, non-goals, and validation
  criteria — parsing distributes context, it must not destroy it. A
  contributor should be able to start without a synchronous conversation.
- **Claims prevent collisions.** Contributors self-select unless the
  assignment policy routes work. A human claims by GitHub assignment or
  claim comment; a coding agent claims by the same GitHub mechanism plus
  WWI/AgentCoord registration where the owning repo requires it. Unclaimed
  work is fair game. An active, unexpired claim is not. A stale claim is
  advisory: inspect its handoff and current state before recovering or
  reassigning the work (per `shared-agent-coordination.md`).
- **PRs are the only unit of delivered repository code or documentation.**
  Deployments, incidents, and operational actions are delivered through
  receipts and runbooks per their owning repo, not necessarily PRs.
- Before a PR enters Joel's queue it must pass the **repo-documented local
  validation gate** (each repo's AGENTS.md / handoff docs define it).
  GitHub Actions are not the validation surface here.

## Assignment and review routing

Two different questions, two different rules (Charter R3, R4):

- **Assignment — among eligible, active contributors: affinity-first, load
  as tiebreak.** Route work to the contributor with the strongest ownership
  of the affected area; among equals, prefer lower current load. Joel may
  deliberately override for learning or rotation, with the reason recorded
  on the issue.
- **Review routing — independence-first.** Reviewers are selected by:
  non-author, relevant competence, current review load, round-robin
  fairness. Reviewer identity must differ from contributor identity. Never
  route review automatically by the assignment algorithm. Use a live,
  authorized first-pass reviewer when one is discovered; otherwise perform
  or request read-only analysis, but the review remains incomplete until its
  attributed findings are posted on the PR.

## The ready-for-Joel queue

When a PR has passed validation, a non-author reviewer prepares first-pass
analysis and a **packet**. The attributed findings and packet must be posted
on the PR through a repo-authorized, write-capable identity before the PR
enters Joel's queue. The reviewer may post directly, or a separate
credential-bearing poster may transmit the reviewer's output verbatim. The
poster may not modify or re-adjudicate it. If no authorized identity can post,
the review is incomplete and the PR is blocked; private delivery to Joel is
not a substitute. No session or agent posts through Joel's GitHub identity.
The authorized poster may manage the `ready-for-joel` label only when repo
policy and the current task authorize that write action.

The packet contains, in order:

1. Concise change summary (what and why, a few sentences).
2. First-pass review findings (blockers vs. non-blockers, with citations).
3. Validation evidence (what was run, what passed).
4. Unresolved judgment calls (may be "none").
5. Recommended disposition (merge / request changes / discuss) —
   propose-only; it never creates a GitHub APPROVE event.
6. Risk, reversibility, and deployment status.

**Commit anchoring.** Every packet records the exact reviewed `head_sha`,
validation evidence produced against that SHA, generation time,
`contributor_identity`, `reviewer_identity`, `poster_identity`, an explicit
`reviewer_identity != contributor_identity` check, and an idempotency marker
(`ready-for-joel.v1`). When poster and reviewer differ, the posted findings
must be the reviewer's attributed output transmitted verbatim. A packet is
automatically invalid — and the label must be removed or suppressed — when the
head changes, the PR becomes draft, or blocking review state changes. A
replacement packet explicitly supersedes the old one. A green label may never
outlive the commit it reviewed. The `ready-for-joel` label is a
rebuildable projection, never readiness truth: every consumer must compare
the packet's `head_sha` with the live PR head and fail closed on mismatch,
even when stale-label removal failed.

Joel adjudicates asynchronously and in batches. **The recommended
disposition is an input to Joel's decision, never a default.** For
non-trivial PRs — security- or scope-touching, low reversibility, or a
non-empty judgment-calls section — Joel discusses with an AI partner before
ruling (Charter R5). Adjudication reasoning goes in the PR comment; if the
adjudication creates durable architecture or policy, update the owning
spec/ADR and link it from the PR (Charter R2).

## Revision and expedited completion

**Default — contributor-owned revision.** Review findings return to the
contributor, who updates and validates the PR. For a human contributor, the
reviewer should explain the important reasoning without taking away the
problem-solving work.

**Expedited — transparent maintainer completion.** The maintainer may finish a
narrow remaining blocker when all of these hold:

- the review and requested outcome are clear;
- the contributor has had a reasonable opportunity to respond;
- the remaining change does not require unresolved product or architecture
  judgment; and
- delay would materially block a release, migration, dependent contributor, or
  time-sensitive objective.

The expedited change must preserve the contributor's commits in merged history,
use a separate attributed maintainer commit, and record the reason on the PR.
For a human contributor, the maintainer follows up afterward to explain the
change and invite questions. Expedited completion is not a negative performance
signal.

Repeated expedited completion is process evidence. Inspect issue clarity,
review latency, assignment fit, contributor availability, and package size
instead of normalizing maintainer takeover.

## Silence and nudges

Silence on assigned work is a workflow event, not a personal failing. The
nudge ladder (JK-SPEC-INTERNPM-001, Mission A8): friendly reminder →
follow-up → escalation to Joel, with each step recorded in the PM event
log. Verify the nudge ladder's deployed state before relying on it; when it
is not proven live, prepare the nudge for an authorized sender. Nudges are
courteous and assume good faith; contributors have lives.

## Roster — convenience map only

This table helps you find things. It is **not authoritative** and says
nothing about current availability. If it disagrees with an authoritative
source, the source wins.

| Agent / identity | Role | Home |
|---|---|---|
| `ucla-tdg-intern-manager` | Contribution coordination: GitHub sweep, roster/check-in state, review dispatch, action/outcome log | `ucla-tdg-ip-agents` |
| `ucla-tdg-github-review-agent` | Policy evaluation, first-pass review, and guarded GitHub review posting where configured | `ucla-tdg-ip-agents` |
| `ucla-tdg-project-manager` | Tasks, deadlines, proposals, escalation runtime | `ucla-tdg-project-agents` |
| `kehle-contributor-agent` | Dedicated GitHub machine account for agent-authored contributions | GitHub account, not an orchestrator |
| `kehle-reviewer-agent` | Dedicated GitHub machine account for attributed reviews and ready packets | GitHub account, not an orchestrator |
| Coding agents (Codex, Claude Code) | Contributors and analysis partners | launched per-repo |

**Which system answers which question:**

| Question | Authority |
|---|---|
| Is this an organizationally authorized role? Reporting, trust, escalation | Manager (`shared/manager/ops/config/agent-org.json`) |
| Is a runtime registered and alive right now? What are its capabilities? | Pinakes registry (live) |
| Live runtime absent from Manager? | Governance drift — report both facts |
| What may be written here, and how is it validated? | The owning repo (AGENTS.md, specs, handoff docs) |
| Who submitted/reviewed/merged what? | GitHub |

## Live-state discipline

Never assert current topology, PR status, deployment state, or agent
availability from doctrine, handoff docs, or session memory. Consult the
live sources — GitHub, the Pinakes registry, wwi — before stating live
facts or acting on them. Dated readiness and state files prove historical
state only; a present-tense claim requires a current probe. Doctrine
describes how the system works; only live sources describe how it is.

## Changelog

- 0.6 (2026-07-23): link the canonical contribution-review architecture;
  use contribution-coordinator vocabulary; correct the GitHub machine-account
  roster and separate contributor from reviewer identities.
- 0.5 (2026-07-23): added the contributor-owned default and the guarded,
  transparent expedited-completion mode; clarified that merged doctrine is
  effective rather than perpetually draft.
- 0.4-draft (2026-07-22): label declared a rebuildable projection with
  fail-closed head_sha comparison; stale claims made advisory per
  shared-agent-coordination; erroneous 07-23 dates corrected; packet metadata
  now records contributor, reviewer, and poster identities with an explicit
  independence check; PR-posted attributed findings are mandatory and private
  delivery is not a substitute.
- 0.3-draft (2026-07-22): packet authority narrowed to repo-authorized
  identities (no posting through Joel's identity); commit anchoring and
  automatic invalidation added; APPROVE prohibition; delivered-work
  wording scoped to repository code/documentation with receipts/runbooks
  for ops; claim-collision rules; spec-context retention in parsed issues;
  adjudication-graduation link rule; two live-state leaks replaced with
  capability-neutral wording; authority table corrected with
  governance-drift row; eligible/active added to assignment.
- 0.2-draft (2026-07-22): split from the combined operating model.
- 0.1-draft (2026-07-22): initial combined draft. Superseded.
