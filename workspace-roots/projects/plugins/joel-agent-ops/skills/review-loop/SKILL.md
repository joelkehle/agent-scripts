---
name: review-loop
description: Use when reviewing a local diff, branch, PR, or proposed implementation in Joel's Projects workspace without immediately editing files.
---

# Review Loop

Default mode is `read` or `propose`; do not edit files unless Joel asks or the task explicitly switches to implementation.

For a non-trivial direct review, locate its ratified definition of done before
issuing findings. If it is missing, read only enough to draft the contract
described in `~/Projects/shared/agent-scripts/docs/measurable-done.md`, then
stop for Joel's ratification. A complete eligible lightweight request may use
the inline path defined by `ship-loop`.

Review in this order:

1. Read nearest `AGENTS.md` and relevant docs.
2. Inspect `git status --short` and the diff or PR context.
3. Check correctness, regressions, safety, secrets, auth, permission, telemetry, tests, and unnecessary scope.
4. For agentic/email/calendar/wiki/triage work, confirm existing bus affordances were considered before new local code.
5. Verify validation evidence is strong enough for the changed behavior.
6. Classify every finding as `within_dod`, `beyond_dod`, or `contract_gap`.
   Link `within_dod` findings to the criterion they prevent proving.

Output findings first, ordered by severity, with file/line refs. Include open questions only when they block correctness. Keep summary secondary and short.

Beyond-DoD findings default to defer. Contract gaps return to Joel instead of
expanding the contract. At the review cap, do not request another automatic
repair: present remaining P2 findings as accept/defer choices. A P1 blocks
retaining the affected behavior and presents fix/remove/narrow/stop choices;
severity does not extend the budget.

If no issues are found, say that clearly and name any residual test or runtime risk.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
