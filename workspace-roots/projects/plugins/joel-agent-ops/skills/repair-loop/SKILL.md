---
name: repair-loop
description: Use when a command, test, CI run, smoke check, deploy check, or reviewer finding fails and needs focused repair.
---

# Repair Loop

Inherit the active task's ratified definition of done before editing. If a
non-trivial direct repair has no contract, read enough to draft the contract in
`~/Projects/shared/agent-scripts/docs/measurable-done.md`, then stop before the
write. Do not treat a reproducible finding as authorization.

Before repairing a reviewer finding:

- require its `within_dod`, `beyond_dod`, or `contract_gap` classification;
- repair only `within_dod` findings linked to a ratified criterion;
- defer `beyond_dod`; stop for Joel on `contract_gap`;
- count validation and review repairs against one continuation budget;
- at the cap, make no further automatic edit—present P2 accept/defer choices
  and P1 fix/remove/narrow/stop choices.

Repair one failure at a time:

1. Name the failing command or reviewer finding.
2. Read the exact error and nearest changed code.
3. Identify the smallest likely cause.
4. Make one focused fix.
5. Rerun only the failed command first.
6. Repeat only while both the ratified continuation budget and the default
   three-attempt ceiling permit it.
7. If the targeted check passes, rerun broader validation with `agent-check` when feasible.
8. If this repair belongs to an active write task and validation is green, commit the focused fix unless Joel asked not to commit.
9. If the repair is committed before the receipt, use `loop-receipt --from-head` or `loop-receipt --commit <ref>` so receipt files come from the commit, not unrelated dirty state.

Stop if the repair requires new scope, secrets, production config, schema migration, deployment, destructive write, or unclear product behavior.

Do not broaden a repair into a refactor unless Joel asks.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
