---
name: review-loop
description: Use when reviewing a local diff, branch, PR, or proposed implementation in Joel's Projects workspace without immediately editing files.
---

# Review Loop

Default mode is `read` or `propose`; do not edit files unless Joel asks or the task explicitly switches to implementation.

Review in this order:

1. Read nearest `AGENTS.md` and relevant docs.
2. Inspect `git status --short` and the diff or PR context.
3. Check correctness, regressions, safety, secrets, auth, permission, telemetry, tests, and unnecessary scope.
4. For agentic/email/calendar/wiki/triage work, confirm existing bus affordances were considered before new local code.
5. Verify validation evidence is strong enough for the changed behavior.

Output findings first, ordered by severity, with file/line refs. Include open questions only when they block correctness. Keep summary secondary and short.

If no issues are found, say that clearly and name any residual test or runtime risk.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
