---
name: repair-loop
description: Use when a command, test, CI run, smoke check, deploy check, or reviewer finding fails and needs focused repair.
---

# Repair Loop

Repair one failure at a time:

1. Name the failing command or reviewer finding.
2. Read the exact error and nearest changed code.
3. Identify the smallest likely cause.
4. Make one focused fix.
5. Rerun only the failed command first.
6. Repeat up to three focused attempts for the same failure.
7. If the targeted check passes, rerun broader validation with `agent-check` when feasible.
8. If this repair belongs to an active write task and validation is green, commit the focused fix unless Joel asked not to commit.
9. If the repair is committed before the receipt, use `loop-receipt --from-head` or `loop-receipt --commit <ref>` so receipt files come from the commit, not unrelated dirty state.

Stop if the repair requires new scope, secrets, production config, schema migration, deployment, destructive write, or unclear product behavior.

Do not broaden a repair into a refactor unless Joel asks.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
