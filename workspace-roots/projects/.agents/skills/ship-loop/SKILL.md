---
name: ship-loop
description: Use when implementing a bounded feature, bug fix, refactor, or docs change in Joel's Projects workspace that must be validated and handed off cleanly.
---

# Ship Loop

Follow this implementation loop:

1. Read nearest `AGENTS.md` plus any docs whose `read_when` matches the task.
2. Check `git status --short`; preserve unrelated changes.
3. Identify the owning repo, safety class, and smallest testable slice.
4. For an ambiguous, large, or user-visible feature with material unresolved product behavior, use `feature-elicitation` and obtain agreement before editing. Skip it for small fixes and already-specific requests.
5. If the task may touch email, calendar, IP agents, llm-wiki, triage, or agentic capability, run `bus-discover` and name relevant read/propose/write agents before choosing architecture.
6. Make the narrowest useful edit.
7. Run the most targeted relevant check first.
8. If validation fails, switch to `repair-loop`.
9. Before handoff, run `agent-check` when feasible.
10. Inspect the diff and remove accidental churn.
11. If the slice is coherent and validation is green, commit it by default unless Joel asked not to commit or a stop rule applies.
12. Final receipt: files changed, behavior changed, checks run, failures repaired, risks, and proof-pack URL when applicable. If `feature-elicitation` was used, follow its automatic trial-evidence contract in this receipt; the agent records and counts trial evidence without asking Joel to do bookkeeping. If work was committed first, use `loop-receipt --from-head` or `loop-receipt --commit <ref>` so receipt files come from the commit, not unrelated dirty state.

Stop and ask one direct question if the work needs a product decision, secrets, production config, schema migration, deployment, force-push, or destructive write not explicitly requested by Joel.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
