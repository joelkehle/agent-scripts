# AGENTS.MD

Joel owns this. Start: say hi + 1 motivating line.
Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

## Session Start
- On Joel's machines, run `machine-compliance --format text` once per session when available.
- If the wrapper is missing, fallback to `~/Projects/manager/bin/machine-compliance --format text`.
- Surface every `FAIL` and `WARN` item before normal work starts. `FAIL` means non-compliant now; `WARN` means backlog/drift.

## Agent Protocol
- Contact: Joel Kehle (@joelkehle, joel@kehle.com).
- Workspace: `~/Projects`. Missing joelkehle repo: clone `https://github.com/joelkehle/<repo>.git`.
- New repo or cloned repo missing `CLAUDE.md` / `AGENTS.md`: create both before doing any work.
  - `CLAUDE.md` is always the same 3-line stub pointing to `AGENTS.md`. Copy from any sibling repo.
  - `AGENTS.md` first line: `READ ~/Projects/agent-scripts/AGENTS.MD BEFORE ANYTHING (skip if missing).` Then add repo-specific purpose, start-here pointers, testing strategy, and deploy rules. Use `~/Projects/tdg-ip-agents/AGENTS.md` or `~/Projects/email-agents/AGENTS.md` as a template.
  - Commit both files before other work.
- 3rd-party/OSS (non-joelkehle): clone under `~/Projects/oss`.
- `~/Projects/manager`: private ops (domains/DNS, redirects/workers, runbooks).
- `~/Projects/operations`: host notebooks plus released manifests, waivers, and observations.
- Surface access from beelink to the laptop guest: use `ssh -p 2222 joelkehle@laptop`. Do not rely on `JoelSurface5` mDNS from beelink.
- Files: repo or `~/Projects/agent-scripts`.
- PRs: use `gh pr view/diff` (no URLs).
- “Make a note” => edit AGENTS.md (shortcut; not a blocker). Ignore `CLAUDE.md`.
- No `./runner`. Guardrails: use `trash` for deletes.
- Need upstream file: stage in `/tmp/`, then cherry-pick; never overwrite tracked.
- Bugs: add regression test when it fits.
- Keep files <~500 LOC; split/refactor as needed.
- Commits: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- Subagents: read `docs/subagent.md`.
- Editor: `code <path>`.
- CI: `gh run list/view` (rerun/fix til green).
- Prefer end-to-end verify; if blocked, say what’s missing.
- New deps: quick health check (recent releases/commits, adoption).
- Slash cmds: `~/.codex/prompts/` (Codex), `~/.claude/commands/` (Claude Code).
- Web: search early; quote exact errors; prefer 2024–2025 sources; fallback Firecrawl (`pnpm mcp:*`) / `mcporter`.
- Oracle: run `npx -y @steipete/oracle --help` once/session before first use.
- Style: telegraph. Drop filler/grammar. Min tokens (global AGENTS + replies).

## State And Compliance
- Canonical host identity comes from `/etc/manager-host-id` on Linux/macOS/WSL when present.
- Human working checkout: `~/Projects/operations`.
- Agent state clone: `~/.local/share/ops-state`.
- Agents should read released manifests from `~/.local/share/ops-state/manifests/<host_id>/current.json` when present.
- Transitional fallback only: if the agent clone is missing, read manifests from `~/Projects/operations/manifests/<host_id>/current.json`.
- Agents must not commit to `~/Projects/operations`.
- Agents do not write `intent/`, `manifests/`, or `waivers/`.
- Agent-written state belongs under `observations/` from the dedicated agent clone only.

## Screenshots (“use a screenshot”)
- Pick newest PNG in `~/Desktop` or `~/Downloads`.
- Verify it’s the right UI (ignore filename).
- Size: `identify -format "%wx%h" <file>` (prefer 2×).
- Optimize: `optipng <file>` (PNG) or `jpegoptim <file>` (JPEG).
- Replace asset; keep dimensions; commit; run gate; verify CI.

## Important Locations
- Blog repo: `~/Projects/joelkehle.me`
- Fleet policy/docs: `~/Projects/manager/docs/`
- Host notes/runbooks: `~/Projects/operations/machines/`
- LLM limits tracking: `~/Documents/joelkehle/codex limits.md`
- Obsidian vault: `$HOME/.local/share/obsidian/joelkehle-notes`
- `tdg-ip-agents` Langfuse follow-ups: `~/Projects/tdg-ip-agents/docs/TELEMETRY_TODOS.md`

## Docs
- Start: run docs list (`docs:list` script, or `bin/docs-list` here if present; ignore if not installed); open docs before coding.
- Follow links until domain makes sense; honor `Read when` hints.
- Keep notes short; update docs when behavior/API changes (no ship w/o docs).
- Add `read_when` hints on cross-cutting docs.
- Model note (2025-11-23): no `gpt-5.1-pro` / `grok-4.1` on Joel’s keys yet.
- Model preference: latest only. OK: Anthropic Opus 4.5 / Sonnet 4.5 (Sonnet 3.5 = old; avoid), OpenAI GPT-5.2, xAI Grok-4.1 Fast, Google Gemini 3 Flash.

## PR Feedback
- Active PR: `gh pr view --json number,title,url --jq '"PR #\\(.number): \\(.title)\\n\\(.url)"'`.
- PR comments: `gh pr view …` + `gh api …/comments --paginate`.
- Replies: cite fix + file/line; resolve threads only after fix lands.
- When merging a PR: thank the contributor in `CHANGELOG.md`.

## Flow & Runtime
- Use repo’s package manager/runtime; no swaps w/o approval.
- Long jobs: Codex background, Claude Code Task tool, or tmux. tmux only when persistence/interaction needed (debugger/server).

## Build / Test
- Before handoff: run full gate (lint/typecheck/tests/docs).
- CI red: `gh run list/view`, rerun, fix, push, repeat til green.
- Keep it observable (logs, panes, tails, MCP/browser tools).
- Release: read `docs/RELEASING.md` (or find best checklist if missing).

## Telemetry Contract
- Source of truth (policy/plan): `~/Projects/manager/docs/decisions/telemetry-strategy-rollout-plan-2026-03.md`.
- Source of truth (this file): `~/Projects/agent-scripts/AGENTS.MD`. Keep `~/AGENTS.MD` mirrored.
- New runtime service: ship `GET /health` + `GET /metrics` (Prometheus). No merge without both unless explicit temporary exception (owner + expiry).
- Add service to ops visibility: update `~/Projects/manager/ops/config/projects.json` (URL probe + nightly/job probes if applicable).
- Critical signals require dashboard + alert pair (availability, errors, saturation, delivery quality).
- Every new/changed alert must link a runbook in annotations. Start from `~/Projects/manager/docs/runbooks/ops-alert-runbook-template.md`.

Telemetry PR checklist (required when telemetry-affecting):
- Metrics changed/added; labels reviewed for low cardinality.
- Grafana dashboard/provisioning updated.
- Prometheus alert rules updated (or explicitly not needed).
- Runbook link added/updated for each alert touched.
- Validation run (`promtool check rules` or equivalent config validation).

- CI/merge policy: treat missing telemetry checklist items or missing runbook links as blocking.

## Pinakes Bus
- Applies to all repos under `~/Projects`.
- Shared message bus: `localhost:8080`, owned by `~/Projects/pinakes`.
- Bus container runs in `~/Projects/tdg-ip-agents/deploy/docker-compose.yml` (will move to `~/Projects/pinakes/deploy/` in a future fix).
- Three agent stacks share one bus: `tdg-ip-agents`, `email-agents`, `email-triage`. All connect to the same Docker network (`tta-agentnet`).
- Agent allowlist: source of truth is `~/Projects/manager/ops/config/allowlist.txt`. Bind-mounted into the bus container as `/etc/pinakes/allowlist.txt`. Bus hot-reloads on file change — no restart needed to add agents.
- To add a new agent: add its ID to `allowlist.txt`, commit in manager. Bus picks it up automatically.
- Agent registration: agents heartbeat every 60s. If the bus restarts, agents re-register on next heartbeat. No manual intervention needed.
- Bus protocol: HTTP + HMAC-SHA256 signatures. See `~/Projects/pinakes/docs/BUS_HTTP_CONTRACT.md`.
- Ops page: `techtransfer.agency/ops` shows all registered agents, bus health, and submission status.
- Before implementing any agentic capability, first determine whether the capability already exists on the shared bus.
- Bus discovery steps:
  - read `~/Projects/pinakes/docs/BUS_HTTP_CONTRACT.md` plus any repo-local bus docs before adding new agent/service logic
  - check bus health and registry: `curl -fsS http://localhost:8080/v1/health` and `curl -fsS http://localhost:8080/v1/agents`
  - check the ops page and documented agent ids in `~/Projects/pinakes`, `~/Projects/tdg-ip-agents`, `~/Projects/email-agents`, and the current repo
  - query the bus or available local docs before writing new agent/service code
- Preferred order:
  1. call an existing bus agent
  2. reuse an existing shared package / sibling-repo implementation
  3. write new local code only if 1 and 2 are not viable
- Do not rebuild an existing bus-backed service/agent locally without explicit user approval.
- If bus reuse is not viable, say why before implementing new agent/service logic.
- When adding a new agent to any stack: add the agent ID to the allowlist file, add the agent to the stack's docker-compose.yml, and ensure it connects to the `tta-agentnet` network.
- Do NOT put the allowlist in a Docker volume. It lives in `manager/ops/config/` so it's git-tracked and auditable.
- Mount the config directory, not the file: `manager/ops/config:/etc/pinakes:ro`. File-level mounts break fsnotify on atomic renames.

## Git
- Safe by default: `git status/diff/log`. Push only when user asks.
- `git checkout` ok for PR review / explicit request.
- Branch changes require user consent.
- Destructive ops forbidden unless explicit (`reset --hard`, `clean`, `restore`, `rm`, …).
- Remotes under `~/Projects`: prefer HTTPS; flip SSH->HTTPS before pull/push.
- Commit helper on PATH: `committer` (bash). Prefer it; if repo has `./scripts/committer`, use that.
- Don’t delete/rename unexpected stuff; stop + ask.
- No repo-wide S/R scripts; keep edits small/reviewable.
- Avoid manual `git stash`; if Git auto-stashes during pull/rebase, that’s fine (hint, not hard guardrail).
- If user types a command (“pull and push”), that’s consent for that command.
- No amend unless asked.
- Big review: `git --no-pager diff --color=never`.
- Multi-agent: check `git status/diff` before edits; ship small commits.

## Language/Stack Notes
- Swift: use workspace helper/daemon; validate `swift build` + tests; keep concurrency attrs right.
- TypeScript: use repo PM; run `docs:list`; keep files small; follow existing patterns.


## Critical Thinking
- Fix root cause (not band-aid).
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.
- Leave breadcrumb notes in thread.

## Tools

Read `~/Projects/agent-scripts/tools.md` for the full tool catalog if it exists.

### bird
- X CLI: `~/Projects/bird/bird`. Cmds: `tweet`, `reply`, `read`, `thread`, `search`, `mentions`, `whoami`.
- Uses Firefox cookies by default (`--firefox-profile` to switch).

### sonoscli
- Sonos CLI: `~/Projects/sonoscli/bin/sonos`. Cmds: `discover`, `status`, `play/pause/stop`, `volume set`, `group`.
- SSDP can fail: use `--ip <speaker-ip>`.
- Spotify SMAPI: `sonos smapi search --service "Spotify" --category tracks "query"`.

### peekaboo
- Screen tools: `~/Projects/Peekaboo`. Cmds: `capture`, `see`, `click`, `list`, `tools`, `permissions status`.
- Needs Screen Recording + Accessibility. Docs: `~/Projects/Peekaboo/docs/commands/`.

### sweetistics
- X analytics app: `~/Projects/sweetistics`.

### committer
- Commit helper (PATH). Stages only listed paths; required here. Repo may also ship `./scripts/committer`.

### trash
- Move files to Trash: `trash …` (system command).

### machine-compliance
- Machine drift checker. Run at session start. Wrapper lives in `~/Projects/agent-scripts/bin/machine-compliance`; real implementation lives in `~/Projects/manager/bin/machine-compliance`.

### bin/docs-list / scripts/docs-list.ts
- Optional. Lists `docs/` + enforces front-matter. Ignore if `bin/docs-list` not installed. Rebuild: `bun build scripts/docs-list.ts --compile --outfile bin/docs-list`.

### bin/browser-tools / scripts/browser-tools.ts
- Chrome DevTools helper. Cmds: `start`, `nav`, `eval`, `screenshot`, `pick`, `cookies`, `inspect`, `kill`.
- Rebuild: `bun build scripts/browser-tools.ts --compile --target bun --outfile bin/browser-tools`.


### lldb
- Use `lldb` inside tmux to debug native apps; attach to the running app to inspect state.


### oracle
- Bundle prompt+files for 2nd model. Use when stuck/buggy/review.
- Run `npx -y @steipete/oracle --help` once/session (before first use).

### mcporter / iterm / firecrawl
- MCP launcher: `npx mcporter <server>` (see `npx mcporter --help`). Common: `iterm`, `firecrawl`.

### gh
- GitHub CLI for PRs/CI/releases. Given issue/PR URL (or `/pull/5`): use `gh`, not web search.
- Examples: `gh issue view <url> --comments -R owner/repo`, `gh pr view <url> --comments --files -R owner/repo`.

### Slash Commands
- Global: `~/.codex/prompts/`. Repo-local: `docs/slash-commands/`.
- Common: `/handoff`, `/pickup`.

### tmux
- Use only when you need persistence/interaction (debugger/server).
- Quick refs: `tmux new -d -s agent-shell`, `tmux attach -t agent-shell`, `tmux list-sessions`, `tmux kill-session -t agent-shell`.

<frontend_aesthetics>
Avoid “AI slop” UI. Be opinionated + distinctive.

Do:
- Typography: pick a real font; avoid Inter/Roboto/Arial/system defaults.
- Theme: commit to a palette; use CSS vars; bold accents > timid gradients.
- Motion: 1–2 high-impact moments (staggered reveal beats random micro-anim).
- Background: add depth (gradients/patterns), not flat default.

Avoid: purple-on-white clichés, generic component grids, predictable layouts.
</frontend_aesthetics>
