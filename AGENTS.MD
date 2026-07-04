# AGENTS.MD

Joel owns this. Start: say hi + 1 motivating line.
Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

## Off-Limits (hard boundary — read first)
- `~/MedProjects/` is OFF-LIMITS. Never read, write, `cd`, grep, glob, or open a terminal there. Never follow a pointer into it.
- Explicitly off-limits repos remain off-limits even if a pointer appears inside `~/Projects`. Known: `rapamycin-kb`, `kidney-radar`, `patient-care-dashboard` (the last two live in `~/MedProjects`).
- Do not infer an off-limits boundary from ordinary calendar, email, contact, or logistics work. If Joel asks for calendar/email handling involving a person, meeting, address, or appointment, treat it as normal workspace work unless it requires opening an explicitly off-limits path/repo.
- Fleet infra (`manager`) may name such a service as an opaque endpoint (host/port/health-probe) so the fleet runs — but never read its repo, data, source docs, or contents. Existence is OK; content is not.
- If a task appears to require any of the above: STOP and tell Joel. Do not improvise, do not "just fix it."

## Vocabulary
- Write capability: say `write`, `write-capable`, or `write action`.
- Read capability: say `read-only` or `read`.
- Recommendation capability: say `propose`, `draft`, or `recommend`.
- Bus safety classes in human-facing text: `read` / `propose` / `write`.
- Use `destructive write` when the action can send, delete, archive, patch, label, or otherwise change external state in a risky way.
- Avoid legacy mutation jargon except when quoting an existing API field, code symbol, or historical text.

## Session Start
- On Joel's machines, run `machine-compliance --agent-startup --format text` once per session when available.
- If the wrapper is missing, fallback to `~/Projects/shared/manager/bin/machine-compliance --agent-startup --format text`.
- Surface every `FAIL` and `WARN` item from startup mode before normal work starts. Startup mode suppresses `manifest_staleness` so Joel is interrupted for real machine drift, not stale manifest paperwork.
- Under `~/Projects`, run `bus-discover` early when the task may touch email, calendar, IP agents, llm-wiki, triage, or any agentic capability. If missing, fallback to `curl -fsS http://localhost:8081/v1/agents` and `curl -fsS http://localhost:8080/v1/agents`.
- For email/calendar/agentic tasks, do not merely run discovery. Before recommending architecture or writing code, state the relevant discovered agent ids, capabilities, safety class, and whether each one is read-only or write-capable.
- Calendar reminder: Joel uses Outlook as the canonical calendar. Live calendar agents — `jk-outlook-calendar-agent` (read-only personal Outlook, JK bus), `ucla-tdg-outlook-calendar-agent` (read-only UCLA Outlook profile, UCLA bus), `ucla-tdg-outlook-calendar-write-agent` (write, guard blocks / working holds / travel blocks only, UCLA bus), `jk-calendar-guard-agent` (dual-bus policy agent, LIVE since 2026-06-10 — creates guard blocks), and `ucla-tdg-scheduler-agent` (write-capable scheduler/travel orchestrator, UCLA bus). Do not add a parallel calendar adapter without first explaining why the shared Outlook runtime is not the right home.
- Joel Inc collective-intelligence north star: before building or recommending intake, routing, content-buffer, subconscious-processing, or cross-agent prioritization workflows, read `~/Projects/shared/brainstorm/collective-intelligence-north-star.md`. The system goal is to convert environmental signal into better collective action using the optimal processor under bounded resources.
- Chief of Staff concept in development: before building or recommending any agent, operator, dashboard, briefing, or workflow that answers "what should Joel do today?", read `~/Projects/shared/brainstorm/chief-of-staff-agent.md`. That concept is a cross-domain attention allocator over email urgency, deals, IP Agency, project-manager state, calendar constraints, and engineering recovery. Do not duplicate it as a new daily-briefing, inbox-only, deal-only, or IP-only agent without first explaining why the Chief of Staff boundary is not the right home.
- Joel Inc processor reality: assume the system is commercially available LLM inference, local tools/agents, and Joel as the only human gate. Do not invent human authorities such as coaches, physicians, attorneys, editors, reviewers, interns, or operators as available workflow boxes unless a real discovered person/service exists or Joel explicitly asks to recruit one. Prefer stronger LLMs, source retrieval, local proposal artifacts, and sparse Joel review. If outside human expertise is truly needed, call it an unbuilt recruitment/vendor task, not an existing processor.

## Agent Protocol
- Contact: Joel Kehle (@joelkehle, joel@kehle.com).
- Workspace: `~/Projects`. Missing joelkehle repo: clone `https://github.com/joelkehle/<repo>.git`.
- New repo or cloned repo missing `CLAUDE.md` / `AGENTS.md`: create both before doing any work.
  - `CLAUDE.md` is always the same 3-line stub pointing to `AGENTS.md`. Copy from any sibling repo.
  - `AGENTS.md` first line: `READ ~/Projects/shared/agent-scripts/AGENTS.MD BEFORE ANYTHING (skip if missing).` Then add repo-specific purpose, start-here pointers, testing strategy, and deploy rules. Use `~/Projects/ucla-tdg/ucla-tdg-ip-agents/AGENTS.md` or `~/Projects/jk/jk-email-agents/AGENTS.md` as a template.
  - Commit both files before other work.
- 3rd-party/OSS (non-joelkehle): clone under `~/Projects/oss`.
- `~/Projects/shared/manager`: private ops (domains/DNS, redirects/workers, runbooks).
- `~/Projects/shared/operations`: host notebooks plus released manifests, waivers, and observations.
- Surface access from beelink to the laptop guest: use `ssh -p 2222 joelkehle@laptop`. Do not rely on `JoelSurface5` mDNS from beelink.
- Files: repo or `~/Projects/shared/agent-scripts`.
- PRs: use `gh pr view/diff` (no URLs).
- “Make a note” => edit AGENTS.md (shortcut; not a blocker). Ignore `CLAUDE.md`.
- No `./runner`. Guardrails: use `trash` for deletes.
- Need upstream file: stage in `/tmp/`, then cherry-pick; never overwrite tracked.
- Bugs: add regression test when it fits.
- Keep files <~500 LOC; split/refactor as needed.
- Commits: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- Push immediately after committing to main. No separate approval step; commit-without-push is the anomaly, not the default (Joel, 2026-07-03).
- Subagents: Codex native subagents are authorized for non-trivial work that
  benefits from parallel read, disjoint write, or independent verify; read
  `docs/subagent.md` before delegating.
- Editor: `code <path>`.
- GitHub Actions are not the standard CI surface while UCLA Enterprise GitHub is
  in use. Treat all GitHub-hosted repos the same: validate locally with
  `agent-check` or the repo's documented local full gate. Do not inspect, rely
  on, create, rerun, or repair Actions. Missing Actions are expected, not a
  blocker. If Joel later changes this policy, update this document first.
- Prefer end-to-end verify; if blocked, say what’s missing.
- New deps: quick health check (recent releases/commits, adoption).
- Slash cmds: `~/.codex/prompts/` (Codex), `~/.claude/commands/` (Claude Code).
- Web: search early; quote exact errors; prefer 2024–2025 sources; fallback Firecrawl (`pnpm mcp:*`) / `mcporter`.
- Oracle: run `npx -y @steipete/oracle --help` once/session before first use.
- Style: telegraph. Drop filler/grammar. Min tokens (global AGENTS + replies).

## State And Compliance
- State ownership doctrine: `~/Projects/shared/agent-scripts/docs/STATE_ARCHITECTURE.md`. Read before creating/choosing any state store or deciding where a fact lives (noun DB vs PM vs wiki vs source vs repo `data/`). Changes that move state ownership must update that doc in the same commit.
- Canonical host identity comes from `/etc/manager-host-id` on Linux/macOS/WSL when present.
- Human working checkout: `~/Projects/shared/operations`.
- Agent state clone: `~/.local/share/ops-state`.
- Agents should read released manifests from `~/.local/share/ops-state/manifests/<host_id>/current.json` when present.
- Transitional fallback only: if the agent clone is missing, read manifests from `~/Projects/shared/operations/manifests/<host_id>/current.json`.
- Agents must not commit to `~/Projects/shared/operations`.
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
- Chief of Staff concept/spec: `~/Projects/shared/brainstorm/chief-of-staff-agent.md`
- Fleet policy/docs: `~/Projects/shared/manager/docs/`
- Host notes/runbooks: `~/Projects/shared/operations/machines/`
- LLM limits tracking: `~/Documents/joelkehle/codex limits.md`
- Obsidian vault: `$HOME/.local/share/obsidian/joelkehle-notes`
- `tdg-ip-agents` Langfuse follow-ups: `~/Projects/ucla-tdg/ucla-tdg-ip-agents/docs/TELEMETRY_TODOS.md`

## Docs
- Start: run docs list (`docs:list` script, shared `docs-list` on PATH, or repo-local `bin/docs-list`; ignore if unavailable); open docs before coding.
- Follow links until domain makes sense; honor `Read when` hints.
- Keep notes short; update docs when behavior/API changes (no ship w/o docs).
- Add `read_when` hints on cross-cutting docs.
- Model note (2025-11-23): no `gpt-5.1-pro` / `grok-4.1` on Joel’s keys yet.
- Model preference: latest only. OK: Anthropic Opus 4.5 / Sonnet 4.5 (Sonnet 3.5 = old; avoid), OpenAI GPT-5.2, xAI Grok-4.1 Fast, Google Gemini 3 Flash.

## Coding Loops
- Shared loop model: `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
- Prefer durable skills over long repeated prompts. Skills are linked at `~/.agents/skills/` and `~/Projects/.agents/skills/`; tracked source lives under `workspace-roots/projects/.agents/skills/`.
- Use `ship-loop` for bounded implementation, `review-loop` for read/propose review, `repair-loop` for focused validation failures, `learn-loop` for durable repo lessons, and `hygiene-loop` for reducing dirty repo state in small safe batches.
- Local write loops that reach green should usually commit before handoff. `ship-loop` commits green coherent slices by default; `hygiene-loop` commits coherent cleanup; `repair-loop` commits focused fixes inside an active write task. `review-loop` stays read/propose, and `learn-loop` proposes unless explicitly asked to write.
- Use `loop-receipt` at the end of non-trivial loops to capture goal, checks, risks, files, and next-loop recommendation; use `loop-resume` at the next turn to feed that evidence back into context.
- Each repo should expose one validation entrypoint. Prefer `agent-check`; add `npm run agent:check` or `scripts/agent-check.sh` when a repo needs a custom gate. Do not define `npm run agent:check` as `agent-check`; point it at the repo's real gate.
- Keep AGENTS files as routers. Move long examples, templates, historical notes, and domain playbooks into docs with `read_when` hints.

## PR Feedback
- Active PR: `gh pr view --json number,title,url --jq '"PR #\\(.number): \\(.title)\\n\\(.url)"'`.
- PR comments: `gh pr view …` + `gh api …/comments --paginate`.
- Replies: cite fix + file/line; resolve threads only after fix lands.
- When merging a PR: thank the contributor in `CHANGELOG.md`.

## Flow & Runtime
- Use repo’s package manager/runtime; no swaps w/o approval.
- Leverage software needs a launch path. When creating an app, agent, dashboard, workflow, or recurring checker, define how it wakes/starts: systemd/cron/launchd/compose, runbook command, slash/skill, or agent-discoverable CLI. If no auto-launch or agent-launch path exists, call it unfinished; manual-only is smoke/debug, not the operating model.
- Long jobs: Codex background, Claude Code Task tool, or tmux. tmux only when persistence/interaction needed (debugger/server).

## Shared Agent Coordination
- Applies to Codex / Claude Code build agents on beelink and macmini. Pinakes bus agents are runtime services, not this layer.
- Preferred architecture: launch Codex / Claude Code from beelink. Treat macmini as a remote macOS execution target reached by SSH for mac-only repos, launchd jobs, GUI/TCC-adjacent checks, Photos/Voice Memos/Keychain workflows, and other Apple-specific runtime work.
- Do not start an independent long-running Codex on macmini unless Joel explicitly asks or beelink cannot reach the needed macOS surface. When using macmini, run commands from beelink with `ssh macmini 'cd ~/Projects/<repo> && ...'` and commit in the repo where the work lives.
- Shared NAS root: `/mnt/synology-share1/AgentCoord` on both beelink and macmini.
  - NAS export: `192.168.88.2:/volume1/Share1`
  - macmini implements `/mnt` via `/etc/synthetic.d/joelkehle-mnt`; use `/mnt/synology-share1`, not `/Volumes/...`.
- Read `~/Projects/shared/agent-scripts/docs/shared-agent-coordination.md` before cross-host or multi-agent work.
- Keep repo checkouts, `.git`, deps, and builds local. Use NAS for claims, handoffs, patches, proof packs, logs, and registry only.
- Before overlapping write work, create a claim under `claims/<repo>/<slug>.<agent>.<host>.json` with scope, safety (`read`/`propose`/`write`), start time, next action, and expiry.
- Before switching hosts/agents, write a handoff under `handoffs/<repo>/`.
- Prefer Git/PRs as source of truth. Use NAS patch files only when branch/push state is blocked or intentionally local.
- Do not store secrets, tokens, private keys, raw email bodies, or sensitive source data on the share unless Joel explicitly approves that location.
- Use atomic create/rename or mkdir claims; do not rely on NFS file locking. Expire stale claims instead of blocking forever.

## WWI / Where Was I
- Use `wwi` for continuity on non-trivial multi-step work.
- At task start, run `wwi` when a prior active loop might exist.
- Create a loop with `wwi new <slug>` when starting new work that may span interruptions.
- Add breadcrumbs after meaningful progress, before interruption, when blocked, and before handoff: `wwi add <slug> "<state; next action; blocker if any>"`.
- Use `wwi add "<note>"` only for inbox notes that are not tied to a loop.
- Use `wwi park <slug>` for paused but still relevant work; use `wwi kill <slug>` for obsolete or completed loops.
- Do not create loops for tiny one-shot answers.

## Build / Test
- Before handoff: run `agent-check` or the repo's documented full gate (lint/typecheck/tests/docs).
- Do not use GitHub Actions as CI by default. Local validation is the required
  gate across all GitHub repos.
- Keep it observable (logs, panes, tails, MCP/browser tools).
- Release: read `docs/RELEASING.md` (or find best checklist if missing).

## Proof Packs
- Default: make a proof pack for user-visible work, live-data writes, dashboard/UI changes, or anything Joel will likely inspect remotely. Skip only for trivial asks or explicit user direction.
- Joel is almost never on beelink. Do not hand off Beelink-local paths as the primary answer. Put the important substance directly in chat, or create a browser-viewable page and give Joel the reachable URL.
- Put proof artifacts where Joel can open them in a browser from another machine. Prefer served HTML/video/report assets over local-only files.
- When sharing inspect/report URLs, prefer Tailscale hostnames (`beelink`, `laptop`, etc.), not `localhost`, unless Joel explicitly says he is on the same machine.
- Standard Codex review output viewer:
  - filesystem root: `~/Projects/shared/dev-dashboard/codex-output/`
  - Tailscale URL root: `http://beelink:8091/codex-output/`
  - create a unique task subdirectory and write `index.html`; prefer HTML over Markdown/JSON for Joel review
  - for repo-specific work, use `<repo-name>/<task-slug>-<YYYYMMDDThhmmssZ>/`
  - multiple Codex sessions may write there concurrently, so never reuse a slug unless intentionally updating the same review packet
  - treat this as Tailscale-facing only; do not expose email/sensitive artifacts through public Cloudflare hostnames without explicit approval

## Telemetry Contract
- Source of truth (policy/plan): `~/Projects/shared/manager/docs/decisions/telemetry-strategy-rollout-plan-2026-03.md`.
- Source of truth (this file): `~/Projects/shared/agent-scripts/AGENTS.MD`. Keep `~/AGENTS.MD` mirrored.
- New runtime service: ship `GET /health` + `GET /metrics` (Prometheus). No merge without both unless explicit temporary exception (owner + expiry).
- Endpoint auth bar (decided 2026-06-10, `manager/docs/decisions/endpoint-auth-policy-2026-06.md`): any Tailscale-reachable endpoint that writes/mutates, triggers LLM spend, or returns sensitive data (email, contacts, private records) requires at least a static bearer token from env. Fail closed when the token is unset. Open endpoints are allowed only for read-only, non-sensitive metadata (`/health`, `/metrics`, registries). No merge for violations.
- HTTP ingress safety bar (added 2026-06-10 after the ip-agents operator LFI, fleet audit 2026-06-09): any handler accepting external input must (a) never pass a caller-supplied filesystem path to file or exec operations — server-managed paths only, with Clean/Abs/EvalSymlinks containment under a configured root when a path is unavoidable; (b) bound request body size explicitly before reading; (c) pin upstream Content-Type in proxy/relay routes rather than forwarding the caller's; (d) never echo attempted paths or internal errors in responses. No merge for violations. When reviewing LLM-built handlers, check these four explicitly — they are the recurring failure mode.
- Add service to ops visibility: update `~/Projects/shared/manager/ops/config/projects.json` (URL probe + nightly/job probes if applicable).
- Ops project/service table lives in `~/Projects/shared/manager/ops/config/projects.json`.
- Port/runtime model:
  - host-port ownership lives in `~/Projects/shared/manager/docs/services/port-allocations.md`
  - ops health/probe URLs live in `~/Projects/shared/manager/ops/config/projects.json`
  - compose/deploy metadata rules live in `~/Projects/shared/manager/docs/decisions/promotion-verification-spec.md`
  - `internal_port` is compose/container metadata only; do not treat it as an implicit host port or probe target
- Critical signals require dashboard + alert pair (availability, errors, saturation, delivery quality).
- Every new/changed alert must link a runbook in annotations. Start from `~/Projects/shared/manager/docs/runbooks/ops-alert-runbook-template.md`.

Telemetry PR checklist (required when telemetry-affecting):
- Metrics changed/added; labels reviewed for low cardinality.
- Grafana dashboard/provisioning updated.
- Prometheus alert rules updated (or explicitly not needed).
- Runbook link added/updated for each alert touched.
- Validation run (`promtool check rules` or equivalent config validation).

- CI/merge policy: treat missing telemetry checklist items or missing runbook links as blocking.

## Pinakes Bus
- Applies to all repos under `~/Projects`.
- Canonical host-port inventory: `~/Projects/shared/manager/docs/services/port-allocations.md`.
- Tailscale-facing subset: `~/Projects/shared/manager/docs/services/beelink-services.md`.
- Current beelink runtime split:
  - `ucla-tdg-bus`: `localhost:8080`
  - `jk-bus`: `localhost:8081`
- `ucla-tdg-bus` is hosted by `~/Projects/ucla-tdg/ucla-tdg-ip-agents/deploy/docker-compose.yml`.
- `jk-bus` is hosted by `~/Projects/jk/jk-email-agents/docker-compose.yml`.
- Check `port-allocations.md` before assuming a bus URL or changing host ports.
- Bus container runs in `~/Projects/ucla-tdg/ucla-tdg-ip-agents/deploy/docker-compose.yml` (will move to `~/Projects/shared/pinakes/deploy/` in a future fix).
- Three agent stacks share one bus: `ucla-tdg-ip-agents`, `jk-email-agents`, `ucla-tdg-email-triage`. All connect to the same Docker network (`tta-agentnet`).
- Agent allowlist: source of truth is `~/Projects/shared/manager/ops/config/allowlist.txt`. Bind-mounted into the bus container as `/etc/pinakes/allowlist.txt`. Bus hot-reloads on file change — no restart needed to add agents.
- To add a new agent: add its ID to `allowlist.txt`, commit in manager. Bus picks it up automatically.
- Agent registration: agents heartbeat every 60s. If the bus restarts, agents re-register on next heartbeat. No manual intervention needed.
- Bus protocol: HTTP + HMAC-SHA256 signatures. See `~/Projects/shared/pinakes/docs/BUS_HTTP_CONTRACT.md`.
- Ops page: `techtransfer.agency/ops` shows all registered agents, bus health, and submission status.
- Before implementing any agentic capability, first determine whether the capability already exists on the shared bus, and explicitly name the discovered affordances in the thread.
- Before changing any host-facing service port, `BUS_URL`, `host.docker.internal` target, or compose `ports:` mapping, update `~/Projects/shared/manager/docs/services/port-allocations.md`.
- Bus discovery steps:
  - run `bus-discover` when available; use `bus-discover --capability <name>` for focused checks
  - for calendar work, check both generic calendar capabilities and Outlook-specific affordances: `calendar-list`, `events-list`, `calendar-agenda`, `outlook-calendar`
  - for email work, check both source and workflow affordances: `email-fetch`, `email-thread-get`, `inbox-sync`, `inbox-triage`, `query:inbox-status`, `inbox-act`
  - summarize relevant discovered agents before choosing "new agent", "reuse existing agent", or "extend existing agent"
  - read `~/Projects/shared/pinakes/docs/BUS_HTTP_CONTRACT.md` plus any repo-local bus docs before adding new agent/service logic
  - read `~/Projects/shared/manager/docs/services/port-allocations.md` before assuming host port ownership
  - check bus health and registry: `curl -fsS http://localhost:8080/v1/health` and `curl -fsS http://localhost:8080/v1/agents`
  - check the ops page and documented agent ids in `~/Projects/shared/pinakes`, `~/Projects/ucla-tdg/ucla-tdg-ip-agents`, `~/Projects/jk/jk-email-agents`, and the current repo
  - query the bus or available local docs before writing new agent/service code
- Preferred order:
  1. call an existing bus agent
  2. reuse an existing shared package / sibling-repo implementation
  3. write new local code only if 1 and 2 are not viable
- New persistent store (table/schema/file family): conform to `docs/STATE_ARCHITECTURE.md` first; new stores require a same-commit doc update there.
- Do not rebuild an existing bus-backed service/agent locally without explicit user approval.
- If bus reuse is not viable, say why before implementing new agent/service logic.
- When adding a new agent to any stack: add the agent ID to the allowlist file, add the agent to the stack's docker-compose.yml, and ensure it connects to the `tta-agentnet` network.
- Do NOT put the allowlist in a Docker volume. It lives in `shared/manager/ops/config/` so it's git-tracked and auditable.
- Mount the config directory, not the file: `shared/manager/ops/config:/etc/pinakes:ro`. File-level mounts break fsnotify on atomic renames.

## Git
- Safe by default: `git status/diff/log`. Push only when user asks.
- Definition of done always includes merged to `main` and pushed to `origin/main`, unless Joel explicitly waives it.
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
- TypeScript: use repo PM; run `docs:list` or `docs-list`; keep files small; follow existing patterns.


## Critical Thinking
- Fix root cause (not band-aid).
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.
- Leave breadcrumb notes in thread.

## Tools

Read `~/Projects/shared/agent-scripts/tools.md` for the full tool catalog if it exists.

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
- Machine drift checker. Run at session start. Wrapper lives in `~/Projects/shared/agent-scripts/bin/machine-compliance`; real implementation lives in `~/Projects/shared/manager/bin/machine-compliance`.

### docs-list / bin/docs-list / scripts/docs-list.ts
- Shared helper on PATH: `~/Projects/shared/agent-scripts/bin/docs-list`. Defaults to `./docs` in the current repo, or accepts a repo root / docs dir argument.
- Repo-local `bin/docs-list` or `docs:list` script also fine when present.

### agent-check
- Validation helper: `~/Projects/shared/agent-scripts/bin/agent-check`.
- Runs the best available repo gate; use `agent-check --dry-run` to see what it would run.

### loop-audit
- Read/propose audit helper: `~/Projects/shared/agent-scripts/bin/loop-audit`.
- Checks loop skill links, Codex instruction budget, AGENTS sizes, and `agent-check --dry-run` coverage.

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

## Session start: surface open loops via `wwi`

At the start of every session — before responding to the user's first request, before running other tools — execute:

    wwi

`wwi` ("Where Was I?") prints active open loops with slug, project, title, last-touched time, next action, and recommendation. Each loop represents work in progress that the user may want to resume.

Surface the output to the user. If there are active loops, show them and briefly note which is most recent. If there are none, briefly note that and proceed normally.

If the user's first request relates to an existing loop — by topic, slug, or project — treat the loop's `Current state` and `Next action` sections as authoritative session context. If the match is ambiguous (multiple plausible loops), ask which one before proceeding. Example: "you have `brainfeed-rdap-fixes` touched 3h ago and `tdg-logitech-2023-266` touched 2d ago — which one?"

After completing meaningful work on a loop, record a breadcrumb before the session ends:

    wwi add <slug> "<one-line description of what was done or where work stopped>"

If the user discovers new work that doesn't fit any existing loop, suggest:

    wwi new <slug> --project <name>

(or interactive-prompt form, depending on installed version)

If `wwi` is not installed or `WWI_LOOPS_DIR` resolution fails, mention this once and proceed normally. Do not block the session on `wwi` being unavailable. The user can install via `go install github.com/<their-module>/cmd/wwi` from `~/Projects/shared/wwi/`.
