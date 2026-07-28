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
- Claude Code custom agents: user-level `~/.claude/agents/*.md` (`mech`, `grunt` — always available, see Model Tiers And Cost) plus optional repo-local `.claude/agents/*.md`. Use repo-local ones only when those files actually exist and are maintained.

## Default

Use Codex native subagents when available for non-trivial work that benefits from parallel read, disjoint write, or independent verification.

Stay single-agent only for small, obvious, single-threaded work. When a task is broad, context-heavy, risky to verify in one thread, or likely to generate noisy logs/search output, split early so the lead thread stays focused on requirements, decisions, integration, and user comms.

The lead keeps moving and does not delegate the immediate blocker. Follow the active runtime's delegation rules. If a runtime requires explicit user permission before spawning subagents and the current task does not already authorize delegation, get it first.

## When To Use Subagents

Use `explorer` for:

- separate code paths that can be inspected in parallel
- bug isolation where the fault could be in multiple layers
- diff/risk review
- repo-specific discovery before larger edits
- large log, search, or docs scans that would pollute the lead context

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
- validating a worker's result before the lead integrates or hands off

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

## Model Tiers And Cost

All Claude Code subagents share Joel's weekly usage limits; the Fable bucket is
the scarce one. Pick the cheapest capable tier:

- `grunt` (Haiku, user-level `~/.claude/agents/grunt.md`): read-heavy sweeps,
  search, collation, counting. Explorer-class grunt work.
- `mech` (Sonnet, user-level `~/.claude/agents/mech.md`): mechanical worker
  slices — batch edits, well-specified transforms, running checks.
- `general-purpose` / inherit: judgment, review, integration, anything
  ambiguous. Default for `verify`.
- Fable subagents: only when the lead can name why the task needs top-tier
  reasoning. Never for fan-out.

`csub "brief"` delegates to Codex (`codex exec`) instead of a Claude subagent.
Billing lands on the OpenAI plan, preserving Claude weekly limits.

Use `csub` only when all hold:

- task is mechanical and fully specifiable in one self-contained brief
- result is cheaply verifiable (tests pass, schema matches, diff is mechanical)
- work is repo/filesystem-bound — Codex has no claude.ai connectors (Gmail,
  Calendar, Joel Projects) and no shared conversation context
- the lead verifies the output before integrating or committing

Never `csub` judgment, review, or connector work. Default sandbox is
`workspace-write`; logs land in `~/.local/state/csub/`. Under weekly-limit
pressure, prefer `csub` for eligible fan-out and keep Claude subagents for
verification.

## Repo-Local Guidance

Repo `AGENTS.md` may add repo-specific trigger rules, ownership boundaries, and verification commands.

Repo `docs/subagent.md` is optional. Add it only when the repo needs specific decomposition patterns or file-set recipes. Keep it short and link back here.

Do not reference `.claude/agents/*.md`, `@test-writer`, `@architect`, or similar local agents unless the repo actually contains those maintained files.

## Tool-Specific Notes

Codex native subagents are preferred for current coding delegation when available.

In Codex, explicit user requests such as "use subagents", "delegate this",
"parallel agents", "split this up", "use one agent per area", or "keep the main
context clean" should trigger native subagent use when the task is non-trivial.
Use `/agent` in the CLI to inspect or steer active subagent threads.

Claude Code custom agents resolve user-level (`~/.claude/agents/` — `mech` and `grunt` live there) and repo-local. Treat references to repo-local agents as stale unless the repo actually contains those maintained files.

In Claude Code, `csub` is the Codex delegation path (see Model Tiers And Cost); Codex native subagents apply only when Codex itself is the lead runtime.

Tmux is for persistent/interactive long jobs, debuggers, servers, or manual external agents. It is not the default subagent mechanism.

Pinakes bus agents are application/runtime services. Before adding agentic product capability, check existing bus agents and docs first; do not confuse bus service reuse with coding-task delegation.

For cross-host Codex / Claude Code coordination between beelink and macmini, use the shared NAS coordination layer. Read `docs/shared-agent-coordination.md`, create claims before overlapping write work, and write handoffs before switching hosts or runtimes.
