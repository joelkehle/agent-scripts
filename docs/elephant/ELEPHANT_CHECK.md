---
summary: "System-context gate preventing a current example or vertical slice from replacing Joel Inc's goals, learning model, state ownership, and live implementation truth."
read_when:
  - "Designing or implementing system-level architecture or a cross-domain workflow."
  - "Changing intake, routing, background processing, attention allocation, learning, memory, or goal-aware behavior."
  - "Using one domain example or vertical slice to prove a general platform capability."
  - "Preparing to deploy a system-level change."
---

# Elephant Check

## Purpose

The Elephant Check is a model-led context and contradiction review. It prevents
an immediate example from becoming the system boundary and prevents documented
intent, implemented code, and live behavior from being conflated.

It answers five questions before system-level code rolls:

1. What whole system is this slice serving?
2. Which Joel Inc goals, priors, and feedback should shape the work?
3. Where does every fact, artifact, decision, and learned update belong?
4. What is documented, what is implemented, and what is proven live?
5. Would the design still work for materially different goals and domains?

The check does not replace domain review, tests, or Joel's authority. It makes
their relationship visible.

## Trigger

Run the Elephant Check before proposing or implementing:

- system-level architecture;
- new or changed intake, routing, subconscious-processing, attention, memory,
  learning, or goal-aware behavior;
- a new persistent store or a change in state ownership;
- a new long-lived agent or processor boundary;
- a vertical slice presented as proof of a general capability;
- a change that spans multiple approved specifications or runtime services.

Run it again before deployment or a claim of production readiness. A repair
that changes the architecture reruns the check; a narrow repair within an
already checked design does not need to restart it from zero.

## Parent and subagent operating model

One top-level Elephant-governed Codex owns one Git worktree. That parent may
delegate to multiple subagents, and every subagent must receive the same
validated Elephant capsule. Codex supplies the parent session id to
`SubagentStart`, so the hook deliberately reuses the parent's session-scoped
state rather than creating a second Elephant contract.

The tracked active marker is a single-worktree contract, not a multi-session
coordination lock. An independent top-level Codex may inspect the worktree in
read-only mode. Any independent write work uses another worktree and a separate
AgentCoord claim. Do not run two top-level Elephant parents in one worktree.

Before delegation, the parent validates its current capsule:

```bash
python3 .codex/hooks/elephant_resume.py show
```

`show` revalidates the receipt, marker, traceability map, checked revision, and
worktree before printing the capsule. If validation fails during
`SubagentStart`, current Codex cannot cancel the child process at that lifecycle
event. The hook instead injects blocking developer context: the child must not
inspect, edit, test, or invoke tools and must return `BLOCKED` with the reason.
The parent repairs or refreshes the contract before delegating again.

## Compaction and resume enforcement

After a receipt reaches **PASS TO IMPLEMENTATION**, declare the continuing loop
in `.codex/elephant-active.json`. The marker names the receipt, pins its accepted
SHA-256 fingerprint, names its traceability map, and records the Git commit at
which the loop was accepted. It contains no receipt content and stays small
enough to load on every lifecycle event.

With that marker present, repo-local Codex hooks automatically create the
session capsule on startup, resume, clear, and compaction. No remembered setup
command is required. Manual activation remains available for a receipt that has
no tracked active marker:

Codex does not retroactively add a newly installed project hook to an already
running parent process. On first install or after a hook-definition change,
review and trust the exact hook with `/hooks`, then start or resume the work
from a fresh Codex process before relying on enforcement. A subagent spawned by
a parent that predates the hook is not a valid propagation test.

```bash
python3 .codex/hooks/elephant_resume.py activate \
  --receipt docs/elephant-checks/<receipt>.md
```

After an intentional marker, receipt, or traceability change, inspect and
refresh only the affected thread:

```bash
elephant-resume status --session-id <thread-id>
elephant-resume refresh --session-id <thread-id> --accept-current-contract
elephant-resume status --session-id <thread-id>
```

The acceptance flag is mandatory. If the change was not expected, reconcile
the tracked contract instead of refreshing it.

The hooks validate the receipt before compaction and restore a session-scoped
context capsule after every supported session lifecycle event and subagent
start. If disposable session state is missing, the tracked active marker
reconstructs it. The capsule contains only the objective, receipt identity,
checked revision, numbered `EC-n` conditions, traceability summary, and next
action. It is capped at 4,096 UTF-8 bytes. The hook never reads the transcript,
invokes a model, or causes compaction.

Recovery for a stopped full-context session is documented in `RECOVERY.md`.

The hook fails closed when the active marker, receipt, or traceability map
changes after capsule creation; when the checked revisions no longer anchor
the current `HEAD`; when the capsule exceeds its size limit; or when a session
reaches four compactions within ten minutes. Each validated `PreCompact` arms
exactly one compact-sourced `SessionStart`; duplicate restart delivery without
a new pre-compaction event is a no-op. This prevents repeated capsule injection
from looking like independent compactions while preserving the fuse for real
compaction loops. `SessionStart` and `PreCompact` can stop on failure.
`SubagentStart` uses the blocking-context
behavior above because Codex does not stop the child when that event returns
`continue: false`.

Every binding condition must map to code, tests, and proof. Validate the map's
shape during implementation, then use the strict gate before claiming the loop
complete:

```bash
python3 .codex/hooks/elephant_traceability.py verify --structure-only
python3 .codex/hooks/elephant_traceability.py verify
```

The strict command succeeds only when every exact receipt `EC-n` condition is
`pass`, no proof remains pending, and referenced code, test, and proof artifact
files exist.
Use `<repo-relative-file>::<optional note>` for proof references that need a
human-readable result summary. The file anchor must exist inside the worktree;
the note may contain slashes or URLs. Free-form proof descriptions without a
file anchor are invalid.

The capsule is deterministic continuity infrastructure, not semantic review.
Inference still decides whether the design satisfies the receipt. Deterministic
traceability proves that every condition has an implementation and evidence
path; it does not judge their adequacy. Re-open the full receipt before changing
architecture or claiming completion. After strict validation and final review,
close the tracked contract by setting `active` to `false` and committing that
marker change. Then delete the current parent's disposable session projection:

```bash
python3 .codex/hooks/elephant_resume.py deactivate
```

`deactivate` clears only the current session projection. It does not edit or
commit the tracked marker. This two-step close is intentional: durable loop
status stays reviewable in Git, while disposable session state stays outside
the repository.

## Character of the check

Semantic judgment remains inference-led. Do not turn this checklist into a
keyword parser that pretends to understand goals or architecture.

Deterministic helpers may verify objective facts such as:

- required documents exist and were opened;
- cited revisions, hashes, capabilities, and paths resolve;
- required receipt sections are present;
- tests and runtime probes actually ran;
- a proposal did not add an undeclared store, port, agent, or write surface.

They do not decide whether a goal is truly served, whether evidence changes a
belief, or whether a consequence merits Joel's attention.

## Fixed context backbone

Every Elephant-governed repo reads these before selecting domain-specific docs:

1. The nearest `AGENTS.md` plus shared agent instructions.
2. `docs-list .` output and every matching `read_when` document.
3. The repo's architecture, ownership, data-boundary, threat-model, and
   approved-specification docs that constrain the proposed slice.
4. `~/Projects/shared/agent-scripts/docs/STATE_ARCHITECTURE.md` when the work
   creates, moves, copies, or reclassifies durable state.
5. `~/Projects/shared/brainstorm/collective-intelligence-north-star.md` when
   the work changes signal intake, routing, processing, learning, or attention.
6. Live bus discovery and relevant runtime health when an agentic capability is
   in scope.
7. Current Git state, runtime state, active coordination claims, and the latest
   loop receipt.

A repo may keep a short local Elephant router with additional required sources.
Repo-specific context belongs there or in the applicable receipt; it does not
belong in this shared construct. The fixed backbone is a floor, not a complete
reading list.

## Procedure

### 1. Context receipt

Record:

- Joel's actual objective in plain language;
- the current vertical slice or example;
- canonical documents read and the controlling principle taken from each;
- live processor affordances with agent id, capability, and safety class;
- current Git/runtime state and known degraded conditions;
- unresolved conflicts or stale sources.

Reading a filename is not enough. State how each source constrains the design.

### 2. Whole-system model

Describe the general loop without using the current domain's nouns. At minimum:

```text
signal
  -> retrieve relevant goals, priors, context, and belief state
  -> select the optimal available processor or processor-chain
  -> acquire and apply knowledge
  -> place evidence, memory, proposals, and work in their canonical owners
  -> determine the consequence for goals and decisions
  -> record outcomes and attributable feedback
  -> improve future knowledge or processing
```

Name what reaches Joel and what remains below the waterline. Promotion to
Joel's attention is not the default success state.

### 3. Platform versus slice

Produce a table with these columns:

| Concern | General platform contract | Current slice instance | Forbidden coupling |
| --- | --- | --- | --- |

The current domain, named expert, source, person, or goal specialization must be
data/configuration unless it truly owns a distinct reusable judgment boundary.
If the same behavior would require a new code branch for an unrelated goal,
the check fails.

### 4. Goals and relationships

Account for the complete Joel-owned collective-goals artifact, not merely the
goal most visible in the current example.

For every asserted relationship:

- identify the parent collective goal;
- distinguish `act-on` from `track`;
- identify any more specific configured goal instance;
- state what uncertainty the signal could reduce;
- state what action, model, memory, or coordination could change.

Agents read the Joel-owned goals artifact. They never silently rewrite it.
Self-modification remains a Joel-gated proposal.

### 5. Learning contract

Keep at least these learning loops separate:

| Learning loop | Evidence | May change | Must not change |
| --- | --- | --- | --- |
| Epistemic | Sources, claims, contradictions, stronger studies | Claims, confidence, synthesis, applicability, uncertainty | Taste or routing merely because presentation was liked |
| Policy | Attributable outcomes and Joel reactions with lineage | Future processor, channel, prominence, framing, ask-Joel policy | Factual truth |

For each processed signal, name:

- the epistemic result, including `no material change`;
- the possible policy-learning event and its attribution path;
- the owner of each durable update;
- the revisit condition;
- whether the learning is live, shadow-only, or merely specified.

Do not call a system self-learning merely because it stores output. Demonstrate
that recorded experience can cause a durable, attributable change in future
judgment, or label that path honestly as incomplete/shadow-only.

### 6. State and processor ownership

Map every artifact and action to its canonical owner. Check the shared state
architecture before adding a table, file family, queue, or database.

At minimum, distinguish:

- immutable source evidence and provenance;
- claims/evidence edges and extraction/research artifacts;
- synthesized personal knowledge and wiki projections;
- work nouns, tasks, and project state;
- attention candidates and presentation projections;
- append-only dialogue;
- feedback/reward lineage and learned policy projections.

Run bus discovery before adding an agentic capability. Prefer, in order:

1. an existing bus agent;
2. an existing shared package or sibling implementation;
3. new local code when the first two are not viable.

Adding a new long-lived agent requires a distinct judgment boundary and Joel's
explicit approval.

### 7. Three-state truth

Produce a table with separate columns:

| Capability | Documented/spec | Implemented | Proven live | Evidence/gap |
| --- | --- | --- | --- | --- |

Never use a specification as proof of implementation or a passing unit test as
proof of production behavior. Unknown is an acceptable status; silently
upgrading unknown to complete is not.

### 8. Generalization and contradiction probes

Test the proposed contract against at least three materially different cases,
including one outside the current domain and one that should remain silent or
dormant. For Joel Inc work, prefer cases spanning different collective goals.

For each probe, show that the system can vary:

- goal and `act-on`/`track` relationship;
- processor or processor-chain;
- artifact owner;
- attention consequence;
- epistemic and policy-learning result;

without adding domain-specific platform branches.

Then attempt to falsify the proposal:

- What relevant goal or prior is absent?
- What current example has leaked into the platform schema?
- What state is duplicated or homeless?
- What documented capability is not live?
- What learned output cannot affect future behavior?
- What user-visible completion could conceal failed specialist work?
- What new agent/store exists only because existing affordances were missed?

### 9. Proof and stop rule

Define evidence that disproves the original failure at the user-visible level.
Include targeted tests, the repository gate, independent review, live runtime
probes, and a browser-visible proof when applicable.

The result is one of:

- **PASS TO IMPLEMENTATION**: no unresolved architectural contradiction;
  required conditions are explicit implementation acceptance criteria.
- **FAIL — REVISE**: the proposal drops a controlling principle, confuses the
  slice with the platform, misplaces state, or lacks a credible learning/proof
  path. No implementation begins.
- **BLOCKED**: a required fact, authority decision, live dependency, or source
  of truth is unavailable. State exactly what is missing.

Before deployment, rerun the check against the diff and live proof. Any
documented/implemented/live mismatch that affects the promised behavior blocks
the production-ready claim.

## Automatic failure conditions

The check fails when any of these are true:

- The current domain or example becomes a hard-coded platform workflow without
  a distinct reusable judgment boundary.
- Only the most obvious current goal is loaded or represented.
- `act-on` and `track` are conflated.
- New knowledge is stored but has no retrieval, belief-update, action, or
  learning consequence.
- Agent self-output is treated as Joel feedback.
- Learned policy is described as live when it is shadow-only.
- State has no canonical owner or duplicates another owner's truth.
- A new long-lived agent or store is proposed without proving existing
  capabilities cannot own the work.
- Binding `EC-n` conditions or controlling documents contain an unresolved
  semantic contradiction, even when each statement could pass in isolation.
  Resolving that contradiction remains inference-led; do not add keyword
  parsers or hook/capsule semantic automation that pretends to supply judgment.
- Deterministic phrase matching substitutes for conversational or semantic
  judgment.
- A stage-complete message can pass while the substantive specialist result is
  missing, generic, contaminated, or self-routing.
- No materially different generalization probe passes.
- The proposed proof stops at unit tests when the failure was user-visible or
  runtime-dependent.

## Receipt template

Store completed checks under `docs/elephant-checks/` when they govern committed
architecture or a continuing implementation. Keep private source content out of
the receipt.

```markdown
# Elephant Check: <subject>

Status: PASS TO IMPLEMENTATION | FAIL — REVISE | BLOCKED
Checked revision/runtime: <commit and live snapshot>

## Objective and slice
## Governing context receipt
## Whole-system contract
## Platform versus slice
## Goals and relationships
## Learning contract
## State and processor ownership
## Documented / implemented / live
## Generalization probes
## Findings and required conditions

1. **EC-1 — <short name>.** <binding condition>
2. **EC-2 — <short name>.** <binding condition>
## Proof plan
## Handoff and stop rule
```
