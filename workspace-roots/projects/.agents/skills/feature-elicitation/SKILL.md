---
name: feature-elicitation
description: Interview Joel and turn an ambiguous, large, or user-visible feature request into an agreed implementation specification before coding. Use when product behavior, success criteria, scope, constraints, examples, or tradeoffs remain materially unresolved; skip for small fixes and already-specific requests.
---

# Feature Elicitation

Separate deciding what to build from implementing it. Resolve only the
uncertainty that could change the solution, then preserve the agreement as the
implementation contract.

## Workflow

1. Read the applicable product and repository context before asking questions.
2. State the current understanding in plain language: user, problem, desired
   outcome, and the material unknowns.
3. Ask one to three focused questions at a time. Prefer concrete alternatives,
   examples, and observable behavior over abstract preference questions.
4. Continue until the remaining uncertainty would not materially change the
   implementation. Do not prolong elicitation for completeness alone.
5. Produce a compact specification containing:
   - goal and user-visible outcome;
   - in-scope behavior and non-goals;
   - representative examples or acceptance scenarios;
   - constraints, authority boundaries, and important failure behavior;
   - verification criteria;
   - unresolved assumptions, if any.
6. Show the specification and obtain explicit agreement before editing code.
7. Preserve the agreed specification in the owning repo when it is durable
   product behavior. Otherwise keep it in the active loop or handoff.
8. For a large feature or a context-heavy elicitation, hand implementation to a
   clean session using the specification and current repository state. For a
   bounded feature with ample clean context, continue directly into `ship-loop`.

## Stop rules

- Do not edit code while a material product decision is unresolved.
- Do not ask questions whose answers are already available in the repository,
  current product, or conversation.
- Do not turn a straightforward bug fix into a product-design exercise.
- Do not treat the specification as permission for writes outside the user's
  requested scope.

## Handoff contract

The implementation handoff must include the agreed specification, owning repo,
current revision and dirty state, validation entrypoint, known risks, and the
first implementation step. The receiving agent must treat the specification as
authoritative unless new evidence creates a material conflict.
