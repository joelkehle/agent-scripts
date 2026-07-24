---
summary: "Elephant Check receipt for the canonical contribution-review architecture, including system boundaries, state ownership, generalization probes, and implementation gates."
read_when:
  - Implementing or changing the canonical contribution-review architecture.
  - Claiming the contribution-review pipeline is implemented, deployed, or live.
  - Revisiting its authority, state ownership, scope routing, or identity boundaries.
---

# Elephant Check: Contribution Review Architecture

Date: 2026-07-23
Status: **PASS TO IMPLEMENTATION, with explicit gates**
Contract: `docs/contribution-review-architecture.md`

## 1. Proposal

Create one canonical, cross-repo contribution-review architecture. Preserve one
pipe for human interns, agent contributors, and Joel while separating:

- contribution coordination;
- deterministic policy evaluation;
- substantive first-pass review;
- credentialed GitHub posting;
- owner-attention work state;
- Joel's adjudication.

No new long-lived agent is proposed.

## 2. Context and objective

Immediate trigger: PR review automation existed, but a weak review, partial
reviewer-request failure, account attribution, and repository-coverage drift
made the pipeline appear absent. The narrow repair is useful, but the durable
objective is larger:

> Joel receives only prepared, commit-anchored PR decisions; contributors
> receive useful feedback; no automation silently assumes Joel's identity or
> judgment.

This serves both Maintainer Charter missions:

- **ship:** reduce discovery and coordination cost at the human gate;
- **teach:** preserve review feedback and contributor responsibility.

## 3. Whole-system chain

```text
captured intent
  -> contributor and PR
  -> coordinator observation and authorization
  -> deterministic policy evidence
  -> independent substantive review
  -> guarded attributed GitHub write
  -> commit-anchored packet
  -> scope-correct Project Manager work item
  -> Joel + AI discussion
  -> Joel adjudication
  -> durable decisions graduate to owning docs
```

The proposal does not confuse:

- a GitHub label with readiness truth;
- a bus message with durable workflow state;
- a machine account with a reasoning role;
- a successful dispatch with a completed review;
- a recommended disposition with adjudication;
- a transport namespace with business authorization.

## 4. Platform versus slice

| Layer | Stable platform concern | Current slice |
|---|---|---|
| Contributor | Human or agent author identity | Intern and coding-agent PRs |
| Coordination | Observation, routing, retry, audit | Existing contribution-coordinator sweep |
| Policy | Deterministic reproducible checks | Repo, head, scope, identity, validation |
| Review | Independent semantic analysis | Existing review runtime plus reasoning session |
| Write boundary | Guarded attributed transport | Reviewer machine account |
| Attention | Canonical owner action and aging | Project Manager proposal/work item |
| Adjudication | Joel's accountable decision | Merge/request-changes/discuss |
| Transport | Capability discovery and delivery | Pinakes bus topology |

The architecture remains valid if the named deployables, bus count, or host
changes.

## 5. State and processor ownership

| State/action | Owner | Classification |
|---|---|---|
| PR, head, review, packet, adjudication record | GitHub | canonical source |
| Owner action, age, escalation, disposition | Project Manager | canonical work noun |
| Coordination action/outcome history | approved coordinator event log | durable audit |
| Sweep/retry cursor | coordinator repo-local state | disposable projection |
| Agent authority and reporting | Manager agent-org | canonical governance |
| Runtime registration | Pinakes | live transport state |
| Ready label/dashboard | GitHub/UI | rebuildable projection |
| Repo requirements and validation | owning repo | canonical contract |

No new database, queue, bus, port, or long-lived service is introduced.

## 6. Documented, implemented, live

Dated assessment; not a substitute for a current runtime probe.

| Capability | Documented | Implemented evidence known at review | Proven live at review |
|---|---|---|---|
| Coordinator sweep and dispatch | yes | yes | live registration discovered |
| Deterministic review checks | partial | yes | live registration discovered |
| Independent semantic first pass | now required | ad hoc / incomplete in pipeline | not proven |
| Reviewer-account GitHub posting | partial | own-output posting exists | actor used on prior PRs |
| Attributed verbatim poster boundary | now required | not proven | not proven |
| Commit-anchored ready packet | protocol + contract | not proven end to end | not proven |
| Owner-attention queue ingestion | state owner exists | Project Manager capability exists | exact PR flow not proven |
| Contributor/reviewer account split | now explicit | both accounts exist | enforcement not proven |
| Single Keystone scoped topology | separate migration work | in progress | not claimed |

Therefore the result is not “architecture deployed.” It is “architecture
coherent; implementation gates explicit.”

## 7. Generalization probes

### Human intern

Pass. Default contributor-owned revision preserves learning. Joel may
explicitly choose expedited completion under R8 without erasing attribution or
skipping independent review.

### Agent contributor

Pass. Contributor, reviewer, and poster are separate identities. The
contributor machine account cannot review its own work.

### Joel emergency contribution

Pass. Urgency changes scheduling, not evidence or identity rules. No artificial
batch wait and no automated unreviewed-merge authority.

### Scope/security change

Pass with implementation gate. Deterministic and semantic review both run;
server-authoritative scope and scope-correct attention routing fail closed.

## 8. Learning contract

The system records attributable outcomes without self-authorizing policy
changes:

- which findings Joel accepted, rejected, or reframed;
- which validation gaps predicted later repair;
- review latency and retry causes;
- false-positive and missed-blocker evidence.

These observations may support a future policy or model proposal. They MUST NOT
silently change delegation, identity, severity, or routing policy. Such changes
remain Joel-gated and update the owning contract.

## 9. Contradictions resolved

1. **“Review agent” ambiguity:** split logical reviewer from credentialed
   poster.
2. **“Project manager” ambiguity:** Project Manager owns work state;
   contribution coordinator owns review orchestration.
3. **Packet versus queue:** packet is GitHub evidence; work item is attention
   state.
4. **Identity versus process:** machine accounts authenticate writes; they do
   not create independence by themselves.
5. **Shared capability versus UCLA runtime:** shared logical architecture;
   business-scope routing remains explicit.
6. **Fast repair versus mentoring:** two explicit operating modes; neither
   bypasses independent review.
7. **Buzz timing:** identity-anchor compatibility retained; WP4 design remains
   blocked on Joel's discussion and approval.

## 10. Implementation acceptance conditions

- **EC-1 — Lineage:** reconcile deployed/local/origin Git lineages before
  reusing current implementation claims.
- **EC-2 — Coverage:** reviewed configuration names covered repos; uncovered
  repos and drift are visible.
- **EC-3 — Identity:** enforce contributor, reviewer, poster, and human-account
  boundaries; prove the authenticated actor; align Manager policy and runtime
  safety declarations with the real write surface.
- **EC-4 — Review quality:** demonstrate substantive semantic analysis in
  addition to deterministic checks.
- **EC-5 — Poster:** transmit attributed findings verbatim with content hash,
  exact head, idempotency, and guarded credentials.
- **EC-6 — Partial state:** reviewer request, review post, packet post, and PM
  upsert report and retry independently.
- **EC-7 — State:** GitHub and Project Manager retain their distinct canonical
  facts; labels and cursors stay projections.
- **EC-8 — Scope:** route owner attention by business scope and fail closed when
  no approved owner exists.
- **EC-9 — Proof:** pass local repo gates and live end-to-end probes without
  relying on GitHub Actions.

## 11. Stop rule

Implementation may begin. Do not claim completion until all EC conditions have
artifact pointers and live evidence. A future change to authority, state
ownership, or cross-scope routing reopens this Elephant Check.
