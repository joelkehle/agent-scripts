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
- invalid claims: malformed claim files, never auto-released.

With `--apply`, only eligible stale claims are marked released. Claim files are
never deleted. The original claim fields stay in place and janitor metadata is
added:

```json
{
  "released_at": "2026-06-28T08:00:00Z",
  "released_by": "agentcoord-janitor",
  "release_reason": "expired without renewal after 10.0 day(s); threshold 7 day(s)",
  "previous_status": "stale",
  "stale_since": "2026-06-18T08:00:00Z"
}
```
