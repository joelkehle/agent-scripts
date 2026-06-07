---
summary: "Canonical subagent and multi-agent delegation policy for Joel's projects."
read_when:
  - Coordinating Codex subagents, Claude Code agents, Oracle reviews, or tmux agent sessions.
  - Deciding whether a task needs independent verification.
  - Adding or updating repo-local subagent guidance.
---

# Subagent Guidance

This is the center of gravity for subagent guidance under `~/Projects`.

## Terms

- `lead`: main thread. Owns plan, decomposition, file ownership, integration, user comms, and final call.
- `explorer`: read-only discovery. Use for bounded codebase questions, bug isolation, diff review, and risk scans.
- `worker`: bounded execution. Use only with explicit file/module ownership and disjoint write scope.
- `verify`: independent validation mode, usually a worker running read-only checks. May edit tests only when assigned.
- `oracle`: second-model review fallback. Use for architecture, code smell, hard bug, or risk review when native subagents are unavailable or model diversity is useful.
- Pinakes/runtime agents: long-lived product services on the bus. They are not coding subagents.
- Claude Code custom agents: optional repo-local files under `.claude/agents/*.md`. Use them only when those files actually exist and are maintained.

## Default

Stay single-agent by default.

Split only when parallel read work, disjoint write sets, or independent verification will materially reduce time or risk. The lead keeps moving and does not delegate the immediate blocker.

Follow the active runtime's delegation rules. If a runtime requires explicit user permission before spawning subagents, get it first.

## When To Use Subagents

Use `explorer` for:

- separate code paths that can be inspected in parallel
- bug isolation where the fault could be in multiple layers
- diff/risk review
- repo-specific discovery before larger edits

Use `worker` for:

- implementation slices with disjoint write ownership
- test additions in a separate file set
- mechanical docs/code updates with narrow scope

Use `verify` for:

- migrations
- deploy, CI, or infra changes
- auth, security, permissions, or secrets work
- cross-file behavior changes
- user-visible workflows without a strong local verification path
- any change where confirmation bias is a meaningful risk

Use `oracle` when:

- native subagents are unavailable
- model diversity is useful
- the task is a one-shot architecture, test-gap, or code-smell review
- you are stuck after reading the relevant code

## When Not To Use Subagents

Usually stay local for:

- small single-file fixes
- simple docs edits
- straightforward test additions
- obvious bugs with one clear cause
- tasks where your next step depends on the delegated answer

Do not use subagents as a substitute for reading the code, running tests, or checking live runtime state.

## Assignment Contract

Every delegation should include:

- goal
- role (`explorer`, `worker`, or `verify`)
- exact files/modules owned, when writing
- whether edits are allowed
- checks to run
- expected output shape
- known constraints from `AGENTS.md` and repo docs

Worker prompts must say that the worker is not alone in the codebase, must not revert others' edits, and must adapt to existing changes.

## Output Contract

`explorer` returns:

- findings
- file refs
- open questions
- recommended next step

`worker` returns:

- changed files
- checks run
- remaining risks or blockers

`verify` returns:

- checks run
- pass/fail verdict
- regressions found
- remaining risk

## Repo-Local Guidance

Repo `AGENTS.md` may add repo-specific trigger rules, ownership boundaries, and verification commands.

Repo `docs/subagent.md` is optional. Add it only when the repo needs specific decomposition patterns or file-set recipes. Keep it short and link back here.

Do not reference `.claude/agents/*.md`, `@test-writer`, `@architect`, or similar local agents unless the repo actually contains those maintained files.

## Tool-Specific Notes

Codex native subagents are preferred for current coding delegation when available.

Claude Code custom agents are repo-local tool config. If a repo does not have `.claude/agents/*.md`, treat references to those agents as stale or historical.

Tmux is for persistent/interactive long jobs, debuggers, servers, or manual external agents. It is not the default subagent mechanism.

Pinakes bus agents are application/runtime services. Before adding agentic product capability, check existing bus agents and docs first; do not confuse bus service reuse with coding-task delegation.

For cross-host Codex / Claude Code coordination between beelink and macmini, use the shared NAS coordination layer. Read `docs/shared-agent-coordination.md`, create claims before overlapping write work, and write handoffs before switching hosts or runtimes.
