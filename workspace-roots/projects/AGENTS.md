READ ~/Projects/shared/agent-scripts/AGENTS.MD BEFORE ANYTHING (skip if missing).

# Workspace: ~/Projects

This is the root workspace. It contains all of Joel's projects and infrastructure.
When launched here, you have cross-project context. Use it for multi-repo ops, planning, and infra work.

Loop workflows are available from `~/Projects/.agents/skills/`: use `ship-loop`, `review-loop`, `repair-loop`, and `learn-loop`. Use `loop-receipt` to capture loop evidence and `loop-resume` to feed it into the next turn. Shared policy lives in `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.

## Project Inventory

### Core Platform

| Project | Type | Lang/Runtime | Deploy | Status |
|---------|------|-------------|--------|--------|
| **ucla-tdg-assistant-db** | SaaS — email triage + project mgmt for UCLA TDG | TS/Next.js 15, React 19 | Vercel + Supabase | Production |
| **pinakes** | Reusable agent bus — HTTP+SSE message routing + Go client SDK | Go | Docker / local binary | Active |
| **ucla-tdg-ip-agents** | SME agents — patent-screen, prior-art-search | Go | Docker → bus | Active |
| **jk-email-agents** | Personal email processing — per-sender agents on pinakes bus | Go | Docker → shared bus | Active |

### Infrastructure & Config

| Project | Purpose |
|---------|---------|
| **agent-scripts** | Master AGENTS.MD, tools (committer, trash), collaboration patterns |
| **manager** | Fleet control plane: host provisioning, compliance, monitoring, DNS/service inventory |
| **operations** | Per-host notebooks plus intent/manifests/waivers/observations for machine state |
| **workbench** (dir: `shared/workbench`) | Dev portal — launch/manage agent terminals per project (Go + SQLite + xterm.js) |
| **brainstorm** | Roadmap, project scoring, tool inventory, planning docs |
| **AgentCoord** | NAS-backed coordination layer for Codex / Claude Code claims, handoffs, patches, proof packs |

### TDG Variants (support surfaces around `ucla-tdg-assistant-db`)

| Repo | Role |
|------|------|
| **ucla-tdg-assistant-db-nightly** | Dedicated staging automation checkout; active host nightly timer runs here on `staging` |
| **worktrees/ucla-tdg-assistant-db-release-lane** | Parked `ucla-tdg-assistant-db` worktree for release prep / validation |

### Inactive

- **agent-scripts-steipete-backup** — archive; reference only
- **tdg-assistant-staging-runner** — archived salvage checkout; superseded by `ucla-tdg-assistant-db-nightly` for live staging automation
- **techtransfer-agency** — archived legacy bus/operator repo; local copy lives in `~/Projects/archive/techtransfer-agency`

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│         ucla-tdg-assistant-db                 │
│  Next.js 15 · Supabase · Anthropic Claude    │
│  Email intake → triage → project routing     │
└──────────────────┬──────────────────────────┘
                   │ (future integration)
┌──────────────────▼──────────────────────────┐
│           pinakes (shared bus)               │
│  Go · HTTP+SSE · HMAC-SHA256 auth            │
│  Agent registration · message routing        │
└──┬────────────┬────────────┬────────────────┘
   │            │            │
┌──▼─────────┐ ┌▼──────────┐ ┌▼──────────────┐
│patent-screen│ │prior-art  │ │jk-email-agents│
│(Go agent)  │ │search (Go)│ │ gmail-ingest  │
└────────────┘ └───────────┘ │ polsia-agent  │
                             │ travel-agent  │
                             │ email-operator│
                             └───────────────┘
```

## Key Infrastructure Details

### Environments (`ucla-tdg-assistant-db`)

| Env | DB | Secrets Path | Command |
|-----|----|-------------|---------|
| mock | None (mocked) | `/mock` | `npm run dev` |
| local | Local Supabase | `/local` | `npm run dev:local` |
| staging | Supabase `riceuuhoisqqgzqbkewm` | staging | `npm run dev:staging` |
| prod | Production Supabase | prod | `npm run dev:prod` |

### Secrets: Infisical (not .env.local)

```bash
# Login
infisical login --domain https://app.infisical.com/api
# Run with secrets
scripts/infisical-run.sh --env=dev --path=/mock -- <cmd>
```

### Hosts (from manager)

- **beelink** — primary dev machine (this machine when on Linux)
  - Tailscale IP: `100.110.64.120`
  - MagicDNS: `beelink`
- **macmini** — secondary host
- **laptop** (Surface/WSL) — access from beelink: `ssh -p 2222 joelkehle@laptop`
- Fleet bootstrap: `~/Projects/shared/manager/bin/bootstrap.sh`
- Host details: `~/Projects/shared/manager/docs/infra/hosts.md`

### Services on Beelink (Tailscale-accessible from laptop)

Canonical host-port source of truth: `~/Projects/shared/manager/docs/services/port-allocations.md`.
Current bus note: UCLA uses `http://beelink:8080`; JK uses `http://beelink:8081`.

| Service | URL | Auth | Status |
|---------|-----|------|--------|
| **UCLA TDG Operator UI** | `http://beelink:3000` | App auth | Active (`ucla-tdg/ucla-tdg-ip-agents/deploy/`) |
| **Langfuse** | `http://beelink:3010` | App login | Active |
| **Workbench** (dev portal) | `http://beelink:8090` | Bearer token (`WORKBENCH_API_TOKEN`) | Prototype |
| **Dev Dashboard** | `http://beelink:8091` | App auth | Active |
| **Grafana** (ops portal) | `http://beelink:3400` | Admin login (`shared/manager/ops/.env`) | Active (`shared/manager/ops/`) |
| **Prometheus** | `http://beelink:9095` | None (internal) | Active (`shared/manager/ops/`) |
| **Ops Exporter** | `http://beelink:9808` | None | Active (`manager/ops/`) |
| **gmail-ingest** | `http://beelink:8201` | HMAC (bus) | Active (`jk/jk-email-agents/`) |
| **polsia-agent** | `http://beelink:8202` | HMAC (bus) | Active (`jk/jk-email-agents/`) |
| **travel-agent** | `http://beelink:8203` | HMAC (bus) | Active (`jk/jk-email-agents/`) |
| **email-operator** | `http://beelink:8205` | None | Active (`jk/jk-email-agents/`) |

All services bind `0.0.0.0` when exposed. No public internet access — Tailscale only.

### Ops Portal API Access (for agents)

Credentials in `~/Projects/shared/manager/ops/.env` (gitignored). Read the file to get tokens.

```bash
# Grafana API (needs agent token from .env GRAFANA_AGENT_TOKEN)
TOKEN=$(grep GRAFANA_AGENT_TOKEN ~/Projects/shared/manager/ops/.env | cut -d= -f2)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3400/api/dashboards/uid/tdg-ops-overview

# Prometheus (no auth)
curl 'http://localhost:9095/api/v1/query?query=ops_project_overall_health_code'

# Exporter metrics (no auth)
curl http://localhost:9808/metrics

# Ops stack management
cd ~/Projects/shared/manager/ops
docker compose up -d --build   # start
docker compose down             # stop
docker compose logs -f          # tail logs
```

### Git Conventions

- Conventional Commits: `feat|fix|refactor|build|ci|chore|docs|style|perf|test`
- Commit helper: `committer` (on PATH) — stages only listed paths
- Remotes: prefer HTTPS under ~/Projects
- Trunk-based: feat/* → staging (force-push) → main (after validation)
- Never push main/staging without Joel's approval

### Testing (`ucla-tdg-assistant-db`)

- General validation entrypoint: run `agent-check` from the owning repo when a repo-specific gate is not already named below.
- Smoke: `npm run test:smoke` (vitest) / `npm run pw:smoke` (playwright)
- Unit: `npm run test:unit`
- E2E mock: `PW_SCOPE=e2e:mock npx playwright test --project=e2e:mock`
- E2E local: `scripts/infisical-run.sh --env=dev --path=/local -- PW_SCOPE=e2e:local npx playwright test --project=e2e:local`
- Full gate: lint + typecheck + tests + docs

### Testing (pinakes)

- Gate: `go test ./...`
- Run locally: `go run ./cmd/pinakes`

### Testing (`jk-email-agents`)

- Gate: `go test ./...`
- Run stack: `cd ~/Projects/jk/jk-email-agents && docker compose up -d`
- Query: `curl -s -X POST http://beelink:8205/query -H 'Content-Type: application/json' -d '{"question":"..."}'`
- Query specific agent: add `"agent":"travel-agent"` to the JSON body

### Running Locally

```bash
# TDG Assistant
cd ~/Projects/ucla-tdg/ucla-tdg-assistant-db && npm install && npm run dev

# pinakes bus
cd ~/Projects/shared/pinakes && go run ./cmd/pinakes

# IP Agents (need bus running + env vars)
cd ~/Projects/ucla-tdg/ucla-tdg-ip-agents
export ANTHROPIC_API_KEY=... PATENT_SCREEN_AGENT_SECRET=...
go run ./cmd/patent-screen --bus-url http://localhost:8080 --agent-id patent-screen

# Email Agents (shares the pinakes bus from ucla-tdg-ip-agents)
cd ~/Projects/jk/jk-email-agents && docker compose up -d
# Creds in .env (gitignored). Gmail OAuth for joel@kehle.com.
```

### CI/CD

- All repos: GitHub Actions
- Check: `gh run list/view` — rerun/fix til green
- ucla-tdg-assistant-db: 20+ workflows (ci, preflight, security nightly, docs lint, metrics)
- pinakes: Go tests + GH Actions

### Key Docs Paths

| What | Where |
|------|-------|
| Agent protocol | `~/Projects/shared/agent-scripts/AGENTS.MD` |
| Subagent guidance | `~/Projects/shared/agent-scripts/docs/subagent.md` |
| Shared agent coordination | `~/Projects/shared/agent-scripts/docs/shared-agent-coordination.md` |
| Collaboration patterns | `~/Projects/shared/agent-scripts/collaboration.md` |
| Tool catalog | `~/Projects/shared/agent-scripts/tools.md` |
| Fleet/host docs | `~/Projects/shared/manager/docs/infra/` |
| TDG onboarding | `~/Projects/ucla-tdg/ucla-tdg-assistant-db/docs/01-foundations/` |
| TDG architecture | `~/Projects/ucla-tdg/ucla-tdg-assistant-db/docs/02-systems/` |
| TDG operations | `~/Projects/ucla-tdg/ucla-tdg-assistant-db/docs/04-operations/` |
| Bus contract | `~/Projects/shared/pinakes/docs/BUS_HTTP_CONTRACT.md` |
| Email agents | `~/Projects/jk/jk-email-agents/README.md` |
| Legacy agency archive | `~/Projects/archive/techtransfer-agency/` |
| Roadmap | `~/Projects/shared/brainstorm/roadmap.md` |
| Private ops/DNS | `~/Projects/shared/manager/docs/` |

## Cross-Project Dependencies

```
shared/agent-scripts ─► ALL projects (global protocol)
ucla-tdg/ucla-tdg-ip-agents ─► shared/pinakes (bus client via go module)
jk/jk-email-agents ───► shared/pinakes (bus client via go module)
jk/jk-email-agents ───► Gmail API (OAuth2, joel@kehle.com)
jk/jk-email-agents ───► Anthropic API (Claude, via polsia/travel agents)
ucla-tdg/ucla-tdg-assistant-db ─► Supabase (PostgreSQL)
ucla-tdg/ucla-tdg-assistant-db ─► Anthropic API (Claude)
shared/pinakes ───────► ucla-tdg/ucla-tdg-ip-agents (registers as external agents)
shared/pinakes ───────► jk/jk-email-agents (registers as external agents)
shared/manager ───────► ALL hosts (bootstrap, SSH, fleet config)
```

## Model Preferences

Latest only. OK: Anthropic Opus 4.5 / Sonnet 4.5, OpenAI GPT-5.2, xAI Grok-4.1 Fast, Google Gemini 3 Flash.
No `gpt-5.1-pro` / `grok-4.1` on Joel's keys yet.
