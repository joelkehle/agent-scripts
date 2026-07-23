---
summary: "Who the maintainer is (Joel + an AI partner), what Joel alone decides, when Joel writes code, the delegation path as agents improve, and the standing cross-repo rulings."
read_when:
  - Advising Joel on his maintainer role, adjudication, or whether he should write code himself.
  - Acting as Joel's analysis partner on a PR adjudication or maintainer decision.
  - A durable cross-repo ruling is needed, contested, or being recorded.
---

# Maintainer Charter

Version: 0.4-draft (2026-07-22). Ratification = Joel merges this file into
`shared/agent-scripts/docs/`.

**Precedence.** This Charter is subordinate to global, workspace, and repo
AGENTS safety, authority, and ownership rules. Within maintainer doctrine,
its Rulings govern the Contributor Operating Protocol; if the two disagree,
the Rulings here win and the Protocol gets fixed.

## Why this exists

Two missions, both always in scope:

1. **Ship** — move the IP Agency platform and Joel's shared/personal
   infrastructure forward without depending on Joel's synchronous attention.
2. **Teach** — Joel is deliberately building competency at running an
   open-source-style team of humans and agents. When a management move rests
   on reasoning that is *novel in the current context*, explain it briefly in
   maintainer terms. Do not repeat the same lesson as running commentary.

The retired pattern — Joel assigns, checks in, unblocks, meets — made Joel's
synchronous attention the bottleneck; when his attention went elsewhere, all
work stopped. The replacement: direction lives in written artifacts,
contributors self-serve from a visible queue, coordination happens through
issues and PRs, and Joel's remaining role is judgment.

## The maintainer

The maintainer of these repos is **Joel plus an AI partner**.

- **Analysis is collaborative by design.** Specs are drafted with AI. PR
  adjudication is a three-step: (1) a first-pass review is posted on the PR;
  (2) Joel discusses the findings with an AI partner (Claude or a Codex) —
  real risks vs. cosmetics, what to request, what happens if the analysis is
  wrong; (3) Joel adjudicates.
- **Judgment is Joel's alone — today, by ruling, not by architecture.** Joel
  makes the final merge or request-changes adjudication on every PR. The
  public record shows Joel's judgment; the discussion is how he got there.
- **Disagreement between AI partners is a feature.** When two analyses
  conflict, Joel arbitrates on evidence. An AI partner Joel always agrees
  with is an autopilot, not a partner.

## Joel's standing outputs

Exactly four, each produced Joel-with-AI:

1. **Specs / feature documents** — what should exist, why, and acceptance
   criteria. An agent parses each spec into issues; Joel checks the issues
   for fidelity to intent.
2. **Decisions** — the calls only the maintainer can make: scope, policy,
   priorities, topology, delegation levels.
3. **Reviews and merges** — every PR gets Joel's adjudication via the
   three-step above. This is the maintainer's primary technical act.
4. **Rulings** — written answers to ambiguities, so no question is asked
   twice. Durable cross-repo rulings graduate into this charter; everything
   else lives at its natural home (R2).

## When Joel writes code

Four cases: **spikes** (throwaway, to inform a spec — never merged),
**exemplars** (the first instance of a new pattern), **emergencies**, and
**joy** (personal repos and spikes). Joel does not take issues from the
contributor queue — that competes with his own team and spends his scarcest
resource on work anyone can do. Anything Joel writes that is meant to merge
arrives as a PR through the same pipe as everyone else's and gets the same
review pass. No side door.

## The delegation path

Agent capability is expected to improve in step changes, and this system is
built to absorb that without redesign. **Delegation level is policy;
enforcement is architecture.** Workflow contracts accommodate new
delegation through explicit rulings without redesign — but a ruling does
not itself activate authority. Before a new level operates, the owning repo
must structurally enforce the authorized identity, credential scope,
targets, blast-radius and rate limits, audit, reversal/revocation, and
fail-closed behavior — and prove that enforcement live. The delegation
ladder for a given class of action: *propose-only* → *attributed reversible
guardrail* (R1 today) → *bounded autonomous with continuous audit* →
*broader bounded autonomy with continuous audit*. Some action classes may
never graduate; no level is ever unaudited or unbounded. Each delegation
ruling names the action class, the evidence relied on, and how it is
reversed.

## Rulings

Standing cross-repo rules. One line of reason each. Repo-shaped decisions do
not belong here — they live in the owning spec, ADR, or runbook, and any
entry that turns out to be repo-shaped is evicted there with a link.

- **R1 — Adjudication authority (2026-07-22, rev. 2).**
  Joel alone makes the final merge or request-changes adjudication. An
  explicitly authorized agent may post a clearly attributed, reversible
  REQUEST_CHANGES guardrail for deterministic policy blockers; that action
  is not Joel's ruling. *Reason: tripwires scale; judgment stays
  accountable — and the boundary moves only via the delegation path.*
- **R2 — Decision placement (2026-07-22).** PR verdicts live on PRs;
  repo/architecture decisions live in their owning spec, ADR, or runbook;
  only durable cross-repo rulings live here. Durable decisions discovered
  during review must graduate out of the PR into their owning home, linked
  from the PR. *Reason: one home per fact; copies drift.*
- **R3 — Assignment policy (2026-07-22, rev. 2).** Among eligible,
  active contributors: affinity-first, load as tiebreak; Joel may
  deliberately override for learning or rotation, with the reason recorded.
  *Reason: repeated ownership builds competence; the override prevents
  bus-factor-of-one.*
- **R4 — Review routing (2026-07-22).** Reviewer selection is separate from
  work assignment: non-author, relevant competence, current review load,
  round-robin fairness. *Reason: assignment optimizes depth; review
  optimizes independence.*
- **R5 — Ready-for-Joel packets (2026-07-22).** PRs reach Joel as prepared,
  commit-anchored packets and are adjudicated asynchronously in batches;
  the packet's recommended disposition is an input to Joel's decision,
  never a default, and never creates a GitHub APPROVE event. *Reason: keeps
  the gate cheap without letting judgment migrate to the agent.*
- **R6 — Knowledge placement is context-scoped (2026-07-22, rev. 2).** Multiple knowledge systems coexist, each canonical in
  its own context. The llm-wiki Knowledge Placement Rule governs the
  llm-wiki project and its bookmark-derived knowledge base (a work in
  progress whose backend may change). Maintainer doctrine is governed by
  this charter and lives as repo files in `shared/agent-scripts/docs/`.
  Migration of doctrine to any knowledge backend happens only by explicit
  future ruling. *Reason: a canonical home only counts if it's actually
  visited; systems in different maturity stages need different rules.*
- **R7 — Delegation path (2026-07-22).** Agent authority levels are set
  only by explicit Joel rulings based on demonstrated outcomes, never
  general capability claims. Every level is structurally enforced,
  reversible where practical, and continuously auditable. *Reason:
  capability will grow in step changes; the system absorbs turns by
  ruling — and stays safe by architecture.*

## Changelog

- 0.4-draft (2026-07-22): delegation section corrected — delegation level is
  policy, enforcement is architecture; ladder capped at bounded autonomy
  with continuous audit; R7 rewritten accordingly; erroneous 07-23 dates
  corrected (authoring date is 2026-07-22).
- 0.3-draft (2026-07-22): precedence sentence; R1 rewritten (attributed
  deterministic guardrail permitted); R2 + ADR/runbook and graduation
  requirement; R3 + eligible/active; R6 rewritten as context-scoped
  coexistence (no longer supersession of the wiki rule); delegation-path
  section and R7 added.
- 0.2-draft (2026-07-22): split out from the combined operating model.
- 0.1-draft (2026-07-22): initial combined draft. Superseded.
