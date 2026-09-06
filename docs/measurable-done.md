---
summary: "Scope, evidence, and stop rules for bounded agent work."
read_when:
  - Starting any non-trivial task, review loop, repair loop, or agent delegation.
  - Designing intake gates, review processes, or agent-to-agent workflows.
  - An agent says "one more round," "almost done," or proposes work beyond the user's scope.
---

# Measurable Done: Give Every Loop A Ceiling

*A lesson paid for on 2026-07-28. Written for agents and agent sessions. Share
freely.*

## What Happened

A simple bridge letting one coding model delegate bounded tasks to another
worked by early afternoon. It then entered an adversarial author-reviewer loop
with no written definition of done. Ten review rounds and roughly forty-five
reproduced findings later, the bridge had become a fleet-installed,
signal-safe, identity-verified batch-execution platform.

Every retained finding was real. Reality was not the missing test. The missing
test was whether each finding had to be fixed for the requested artifact to be
fit for use. Much of the surface under review had been manufactured by the
preceding repair rounds.

The same failure can appear as low-quality unsupervised drift or high-quality
overbuilding. Quality gates raise the floor; they do not supply a ceiling.

## Why Loops Do Not Reliably Stop

- Each author, reviewer, and verifier has a locally reasonable reason to
  continue.
- Reproducible does not mean must-fix.
- An in-loop prediction that work is "almost done" is not a stopping rule.
- Fixes create new review surface. Repeated churn in one subsystem is a signal
  to reduce scope or change approach, not merely to iterate harder.

Treat these as operational constraints. Do not rely on an in-loop model,
including yourself, to supply proportionality after momentum has formed.

## Scope And Evidence

Before work, read the user's request, the nearest instructions, and the
relevant source. The request defines the scope for ordinary interactive work.
Use a short working brief when it helps keep a larger task bounded. It may name:

1. **Goal:** the requested outcome in one sentence.
2. **Acceptance criteria:** each criterion names the evidence or command that
   proves it and the exact passing result.
3. **Non-goals:** behavior and hardening explicitly outside the slice.
4. **Stop rule or review budget:** when the task needs one.

This is planning and evidence, not a second permission system. Do not require
a fixed field list, a local ratification receipt, or another Joel approval for
work he already asked for. Use the product's native permission controls and
real OS/API limits. Ask only when a material product choice is unclear or an
action is outside the user's scope or is an unapproved destructive write.

## Rules During Work

1. **Keep the stated scope.** When useful details are missing, make the
   narrowest reasonable choice or ask one question if it would materially
   change the result.
2. **Classify every finding:** in scope, beyond scope, or a material choice.
   Beyond-scope findings default to deferred; material choices return to Joel
   rather than silently expanding scope.
3. **Enforce a chosen budget.** At a review cap, stop automatic repair
   and present the remaining choices to Joel.
4. **A serious defect blocks retained unsafe behavior; it does not authorize unlimited
   engineering.** Joel chooses among fixing it, removing the affected
   capability, narrowing the guarantee, or stopping the release.
5. **Scope reduction is a successful outcome.** Deleting a feature,
   documenting a limitation, changing language, or deferring machinery may be
   the correct repair.
6. **Price Joel's attention.** Escalate proportionality decisions once with
   evidence and choices; do not spend repeated human turns asking whether to
   continue.

The gate belongs at every path into work: issue claims, direct sessions,
review-to-repair transitions, and resumed loops. An issue-only gate can be
bypassed by chat-started work and would not have stopped PR #20.

## What Good Looks Like

For a review loop, a useful stopping rule is:

```text
acceptance evidence passes
AND no unresolved P1 affects retained behavior
AND review budget is not exceeded
```

After the budget, lower-severity or beyond-scope findings become explicit
accept/defer decisions. A newly discovered P1 triggers a maintainer decision,
not an automatic new repair round.

The safeguards around PR #20 prevented unreviewed drift from merging. The
artifact was correct and reversible; the process was expensive. The lesson is
not to lower the floor. It is to add the ceiling before work starts.

Provenance: agent-scripts PR #20 retrospective — Joel Kehle, Fable, and Codex,
2026-07-28. Structural follow-ups:
[GHL-013 definition-of-done gate](https://github.com/joelkehle/agent-scripts/issues/26)
and
[csub supervisor language port](https://github.com/joelkehle/agent-scripts/issues/25).
