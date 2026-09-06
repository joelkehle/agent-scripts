---
name: review-loop
description: Use when reviewing a local diff, branch, PR, or proposed implementation in Joel's Projects workspace without immediately editing files.
---

# Review Loop

Default mode is `read` or `propose`; do not edit files unless Joel asks or the task explicitly switches to implementation.

For a direct review, use the user's request and the changed behavior as the
scope. Do not require a local ratification or fixed definition-of-done fields
before issuing findings. Use proportionate acceptance evidence and review
budgeting when useful; see
`~/Projects/shared/agent-scripts/docs/measurable-done.md`.

Review in this order:

1. Read nearest `AGENTS.md` and relevant docs.
2. Inspect `git status --short` and the diff or PR context.
3. Check correctness, regressions, safety, secrets, auth, permission, telemetry, tests, and unnecessary scope.
4. For agentic/email/calendar/wiki/triage work, confirm existing bus affordances were considered before new local code.
5. Verify validation evidence is strong enough for the changed behavior.
6. Classify every finding as in scope, beyond scope, or a material choice.
   Link in-scope findings to the behavior or evidence they affect.

Output findings first, ordered by severity, with file/line refs. Include open questions only when they block correctness. Keep summary secondary and short.

Beyond-scope findings default to defer. Material choices return to Joel instead
of expanding the work. At the review cap, do not request another automatic
repair: present remaining P2 findings as accept/defer choices. A P1 blocks
retaining the affected behavior and presents fix/remove/narrow/stop choices;
severity does not extend the budget.

If no issues are found, say that clearly and name any residual test or runtime risk.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
