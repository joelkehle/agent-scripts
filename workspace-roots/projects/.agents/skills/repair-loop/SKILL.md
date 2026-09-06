---
name: repair-loop
description: Use when a command, test, CI run, smoke check, deploy check, or reviewer finding fails and needs focused repair.
---

# Repair Loop

Inherit the user's active scope before editing. A reproducible finding does not
expand that scope. Do not require a local ratification or fixed contract before
a repair already covered by the request. Read
`~/Projects/shared/agent-scripts/docs/measurable-done.md` for proportionate
evidence and stopping guidance.

Before repairing a reviewer finding:

- classify it as in scope, beyond scope, or a material choice;
- repair only in-scope findings linked to the requested behavior or evidence;
- defer beyond-scope findings; stop for Joel on a material choice;
- count validation and review repairs against a chosen continuation budget;
- at the cap, make no further automatic edit—present P2 accept/defer choices
  and P1 fix/remove/narrow/stop choices.

Repair one failure at a time:

1. Name the failing command or reviewer finding.
2. Read the exact error and nearest changed code.
3. Identify the smallest likely cause.
4. Make one focused fix.
5. Rerun only the failed command first.
6. Repeat only while the chosen continuation budget and the default
   three-attempt ceiling permit it.
7. If the targeted check passes, rerun broader validation with `agent-check` when feasible.
8. If this repair belongs to an active write task and validation is green, commit the focused fix unless Joel asked not to commit.
9. If the repair is committed before the receipt, use `loop-receipt --from-head` or `loop-receipt --commit <ref>` so receipt files come from the commit, not unrelated dirty state.

Stop if the repair needs a material product decision, is outside the user's
authorized scope, or requires an unapproved destructive write. Native vendor
permissions and real OS/API controls still apply.

Do not broaden a repair into a refactor unless Joel asks.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
