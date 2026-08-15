---
summary: AgentCoord CLI commands, flags, examples, stale-claim sweeps, and handoffs.
read_when:
  - Creating, renewing, releasing, validating, or sweeping AgentCoord claims.
  - Writing a cross-host or cross-agent handoff.
---

# AgentCoord CLI

`agentcoord` manages claims and handoffs from the command line.

For the coordination model, shared rules, and directory layout, see
[Shared Agent Coordination](shared-agent-coordination.md).

Common commands:

```bash
agentcoord validate
agentcoord check
agentcoord list --all
agentcoord list --active
agentcoord list --stale
agentcoord claim --repo shared/agent-scripts --slug launch-ritual \
  --safety write --scope bin/agent-start --ttl-hours 2
agentcoord renew --repo shared/agent-scripts --slug launch-ritual --ttl-hours 4
agentcoord release --repo shared/agent-scripts --slug launch-ritual
agentcoord sweep
agentcoord sweep --stale-after-days 7
agentcoord sweep --apply --stale-after-days 7
agentcoord archive
agentcoord archive --apply --older-than-days 30
agentcoord handoff --repo shared/agent-scripts --slug launch-ritual \
  --goal 'Ship launch ritual' \
  --state 'agent-start implemented' \
  --check 'npm run agent:check pass' \
  --next-action 'Review and commit'
```

`sweep` is dry-run by default. It is the safe claim janitor.

The janitor splits expired claims into:

- recent stale claims: expired, but younger than `--stale-after-days`;
- eligible stale claims: expired at least `--stale-after-days` ago;
- invalid claims: malformed claim files.

With `--apply`, eligible stale claims are marked released. Invalid claims are
also released when their file has not changed for `--stale-after-days` days.
The janitor rewrites those as valid JSON with
`release_reason: "invalid-expired"`. If the old content was parseable JSON, it
is kept under an `original` key. If not, the raw bytes are kept next to the
claim as `<name>.json.corrupt`. Fresh invalid claims are left alone.

Claim files are never deleted; released claims are archived to
`claims-archive/` after 30 days. The original claim fields stay in place and
janitor metadata is added:

```json
{
  "released_at": "2026-06-28T08:00:00Z",
  "released_by": "agentcoord-janitor",
  "release_reason": "expired without renewal after 10.0 day(s); threshold 7 day(s)",
  "previous_status": "stale",
  "stale_since": "2026-06-18T08:00:00Z"
}
```

## Archive tier

`archive` moves released claims out of the way once they are old news.
It is dry-run by default, like `sweep`.

- It moves claims whose `released_at` is older than `--older-than-days`
  (default 30) from `claims/` into `claims-archive/`.
- The path under `claims-archive/` mirrors the path under `claims/`.
- Nothing is deleted. `list`, `validate`, `sweep`, and preflight never read
  `claims-archive/`.

## Janitor timer

A weekly systemd user timer runs the janitor: first `sweep --apply
--stale-after-days 7`, then `archive --apply --older-than-days 30`.
The units live in `systemd/`. Install them with:

```bash
install-agentcoord-janitor
```

The installer copies the units to `~/.config/systemd/user/`, reloads the user
daemon, and enables the timer. It is safe to run again. It refuses cleanly if
there is no systemd user session.

## Canonical repo names

`claim`, `list`, `sweep`, `release`, and `renew` normalize the repo name
before use, so old spellings and the canonical one see the same claims:

- `__` in a name becomes `/` (for example `shared__manager` ->
  `shared/manager`);
- a short static alias list maps known drifted names (`manager`,
  `shared-manager` -> `shared/manager`; `llm-wiki` -> `jk/llm-wiki`;
  `shared-agent-scripts` -> `shared/agent-scripts`; `shared-hall-monitor` ->
  `shared/hall-monitor`);
- anything else passes through unchanged. There is no fuzzy matching.
