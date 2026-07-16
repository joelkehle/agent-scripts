---
summary: "Fresh Codex parent-to-subagent proof that the shared Elephant capsule reaches real child developer context."
read_when:
  - "Validating Elephant after hook or lifecycle changes."
  - "Investigating whether SubagentStart receives the parent capsule."
  - "Running Codex collaboration from a noninteractive session."
---

# Elephant live lifecycle proof

Status: **PASS**

Verified: 2026-07-16 on Beelink with a disposable Git repository under `/tmp`.
No product repository, runtime service, or external state was read or changed.

## Contract

The isolated receipt contained two passing conditions and a token known only to
the injected Elephant context. The fresh parent was instructed to launch one
default child. The child was forbidden from tools and file reads and could only
report the token from its initial developer context.

## Evidence

- Strict fixture traceability: `pass`, 2/2 EC conditions.
- Parent thread: `019f6cf5-d029-7993-bef7-6c78cfe8a6ac`.
- Subagent: `019f6cf5-ef7f-7602-9b62-6dff58df5884`.
- Captured `SubagentStart` payload used the parent `session_id` and named the
  child `agent_id`, `agent_type`, and turn.
- Shared hook response supplied `hookEventName: SubagentStart` plus the same
  validated capsule injected into the parent.
- The child rollout recorded the capsule as developer context, invoked no
  tools, and returned `TOKEN=TUSK-ORANGE-7319`.
- The parent received that exact child result and returned
  `CHILD=TOKEN=TUSK-ORANGE-7319`.

This closes the live parent-to-subagent propagation gap from the July 2026
incident. Deterministic tests remain the repeatable gate; this proof establishes
that the current Codex lifecycle wiring also works end to end.

## Noninteractive caveat

The first attempt used `codex exec --ephemeral`. `SessionStart` received its
Elephant capsule, but native collaboration failed before `SubagentStart` with:

```text
collab spawn failed: no thread with id
```

The same vetted command without `--ephemeral` started the child and passed.
Until Codex changes this behavior, use a normal persisted fresh thread for any
live parent-to-subagent proof, then explicitly clean up its disposable session
state.
