---
name: ship-loop
description: Use when implementing a bounded feature, bug fix, refactor, or docs change in Joel's Projects workspace that must be validated and handed off cleanly.
---

# Ship Loop

Follow this implementation loop:

1. Read nearest `AGENTS.md` plus any docs whose `read_when` matches the task.
2. Check `git status --short`; preserve unrelated changes.
3. Identify the owning repo, safety class, and smallest testable slice.
4. If the task may touch email, calendar, IP agents, llm-wiki, triage, or agentic capability, run `bus-discover` and name relevant read/propose/write agents before choosing architecture.
5. Make the narrowest useful edit.
6. Run the most targeted relevant check first.
7. If validation fails, switch to `repair-loop`.
8. Before handoff, run `agent-check` when feasible.
9. Inspect the diff and remove accidental churn.
10. Final receipt: files changed, behavior changed, checks run, failures repaired, risks, and proof-pack URL when applicable. If work was committed first, use `loop-receipt --from-head` or `loop-receipt --commit <ref>` so receipt files come from the commit, not unrelated dirty state.

Stop and ask one direct question if the work needs a product decision, secrets, production config, schema migration, deployment, force-push, or destructive write not explicitly requested by Joel.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
