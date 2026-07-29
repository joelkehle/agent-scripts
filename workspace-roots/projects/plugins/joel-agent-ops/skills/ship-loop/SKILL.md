---
name: ship-loop
description: Use when implementing a bounded feature, bug fix, refactor, or docs change in Joel's Projects workspace that must be validated and handed off cleanly.
---

# Ship Loop

## Direct-session preflight

Before non-trivial write work, locate the ratified definition of done in the
issue, current request, or durable receipt. Read
`~/Projects/shared/agent-scripts/docs/measurable-done.md`.

- If no ratified contract exists, read only enough to draft it, then stop before
  editing. Joel is the only ratifier; an agent may not infer or self-ratify the
  missing contract.
- Treat a task as lightweight only when it is reversible, confined to one
  repository, and has no schema, auth, credential, deployment, migration, new
  dependency, reachable-service, or destructive external-write impact.
- A lightweight direct request may proceed without another confirmation only
  when Joel already supplied the outcome, exact proof and passing result,
  explicit non-goal, stop rule, one-round review cap, and standing defer policy.
  Record Joel's request as the ratification evidence.
- Everything else requires the full contract: gradeable acceptance criteria,
  non-goals, kill criteria, budget, defer policy, and ratification evidence.

Carry the contract through the receipt. Classify later findings as
`within_dod`, `beyond_dod`, or `contract_gap`; do not silently expand the
ratified slice.

Follow this implementation loop:

1. Read nearest `AGENTS.md` plus any docs whose `read_when` matches the task.
2. Check `git status --short`; preserve unrelated changes.
3. Identify the owning repo, safety class, and smallest testable slice.
4. For an ambiguous, large, or user-visible feature with material unresolved product behavior, use `feature-elicitation` and obtain agreement before editing. Skip it for small fixes and already-specific requests.
5. If the task may touch email, calendar, IP agents, llm-wiki, triage, or agentic capability, run `bus-discover` and name relevant read/propose/write agents before choosing architecture.
6. Complete the direct-session preflight, then make the narrowest useful edit.
7. Run the most targeted relevant check first.
8. If validation fails, switch to `repair-loop`.
9. Before handoff, run `agent-check` when feasible.
10. Inspect the diff and remove accidental churn.
11. If the slice is coherent and validation is green, commit it by default unless Joel asked not to commit or a stop rule applies.
12. Final receipt: files changed, behavior changed, checks run, failures repaired, risks, and proof-pack URL when applicable. If `feature-elicitation` was used, follow its automatic trial-evidence contract in this receipt; the agent records and counts trial evidence without asking Joel to do bookkeeping. If work was committed first, use `loop-receipt --from-head` or `loop-receipt --commit <ref>` so receipt files come from the commit, not unrelated dirty state.

Stop and ask one direct question if the work needs a product decision, secrets, production config, schema migration, deployment, force-push, or destructive write not explicitly requested by Joel.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
