---
name: ship-loop
description: Use when implementing a bounded feature, bug fix, refactor, or docs change in Joel's Projects workspace that must be validated and handed off cleanly.
---

# Ship Loop

## Direct-session preflight

Read the user's request, the nearest `AGENTS.md`, and the relevant docs. The
request defines the scope for ordinary interactive work; use native vendor
permissions and real OS/API controls. Do not require a local ratification,
fixed contract fields, or another approval for work Joel already asked for.

Write a short plan when it helps: goal, evidence, non-goals, and a stop rule or
review budget where useful. Keep later findings in scope, defer beyond-scope
findings, and return material product choices to Joel.

Follow this implementation loop:

1. Read nearest `AGENTS.md` plus any docs whose `read_when` matches the task.
2. Check `git status --short`; preserve unrelated changes.
3. Identify the owning repo, safety class, and smallest testable slice.
4. For an ambiguous, large, or user-visible feature with material unresolved product behavior, use `feature-elicitation` and obtain agreement before editing. Skip it for small fixes and already-specific requests.
5. If the task may touch email, calendar, IP agents, llm-wiki, triage, or agentic capability, run `bus-discover` and name relevant read/propose/write agents before choosing architecture.
6. Make the narrowest useful edit within the user's scope.
7. Run the most targeted relevant check first.
8. If validation fails, switch to `repair-loop`.
9. Before handoff, run `agent-check` when feasible.
10. Inspect the diff and remove accidental churn.
11. If the slice is coherent and validation is green, commit it by default unless Joel asked not to commit or a stop rule applies.
12. Final receipt: files changed, behavior changed, checks run, failures repaired, risks, and proof-pack URL when applicable. If `feature-elicitation` was used, follow its automatic trial-evidence contract in this receipt; the agent records and counts trial evidence without asking Joel to do bookkeeping. If work was committed first, use `loop-receipt --from-head` or `loop-receipt --commit <ref>` so receipt files come from the commit, not unrelated dirty state.

Stop and ask one direct question only if a material product decision is
unresolved, the action is outside the user's authorized scope, or an
unapproved destructive write is required. Native vendor permissions and real
OS/API controls still apply.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
