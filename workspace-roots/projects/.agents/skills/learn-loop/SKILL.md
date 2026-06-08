---
name: learn-loop
description: Use after a coding session reveals durable repo-specific or Joel-workspace-specific lessons that should improve future agent behavior.
---

# Learn Loop

Capture only lessons that are durable:

1. Review what caused friction, failure, rework, or repeated lookup.
2. Keep only lessons that are repo-specific or Joel-workspace-specific, likely to recur, and not already documented.
3. Prefer adding or updating a focused doc with `read_when` hints.
4. Add to `AGENTS.md` only when the instruction must be in startup context.
5. Keep new guidance short; avoid examples or historical narrative in AGENTS.
6. If the lesson changes behavior, update docs in the same change as code.

Output either:

- no durable lesson found, or
- proposed file/doc update plus why it belongs there.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
