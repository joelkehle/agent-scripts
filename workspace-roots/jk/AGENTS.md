READ ~/Projects/shared/agent-scripts/AGENTS.MD BEFORE ANYTHING (skip if missing).

# Repo Purpose

`~/Projects/jk` is the personal assistant workspace root.

It is not a single runtime repo. It is the operator surface for Joel's personal bus-connected agent collection:

- Codex launched from here = personal assistant CLI surface
- web apps launched elsewhere = browser surface
- child repos = implementation/runtime surfaces

Primary current child repos:

- `jk-email-agents`
- `jk-meeting-agents`
- `jk-shopping-agents`

# Start Here

- Read this file first when launched from `~/Projects/jk`.
- If Joel wants to use Codex as the personal assistant over the JK bus, stay rooted at `~/Projects/jk`.
- If Joel is editing or debugging one specific subsystem, move into that child repo and follow its local `AGENTS.md`.

# Launch Model

- Correct launch dir for the JK personal assistant CLI surface: `~/Projects/jk`
- Correct launch dir for web product work: the relevant app repo, for example `~/Projects/jk/jk-assistant-bus` when it exists
- Correct launch dir for runtime implementation work: the specific child repo such as `~/Projects/jk/jk-email-agents`

Correction rule:

- if Joel launches Codex from a child repo but asks for the broad personal assistant behavior, tell him the better launch dir is `~/Projects/jk`
- if Joel launches Codex from `~/Projects/jk` but the task is clearly repo-local implementation, either continue carefully in place or recommend shifting into the child repo when that will reduce confusion

# Boundary Rules

- Do not treat `jk-email-agents` as the whole personal assistant product boundary.
- Product/assistant boundary lives at `~/Projects/jk`.
- Child repos own domain logic, bus agents, polling loops, and side effects.
- Future web UI repos own browser UX, not agent logic.
- Personal-only capabilities belong under `jk`; capabilities used by both
  personal and professional contexts belong under `~/Projects/shared`.
- Joel's primary calendar, scheduling, and travel-time blocks are shared
  capabilities. Do not treat them as personal-only merely because some current
  implementation lives under `jk`.
- Local `llm-wiki` MediaWiki pages should be opened from Joel's browser via `http://beelink:8221/wiki/...`, not `http://localhost:8221/wiki/...`.

# Testing Strategy

- No single root gate here.
- Run tests/builds in the child repo(s) you touch.
- Before handoff, say which child repo gates were run and which were not applicable.

# Deploy Rules

- No root deploy from `~/Projects/jk`.
- Deploy and release rules live in each child repo.
- If a task spans multiple child repos, call out the affected deploy surfaces explicitly.
