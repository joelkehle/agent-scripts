---
summary: AgentCoord CLI for validated claims, stale-claim sweeps, and handoffs on the shared NAS coordination layer.
read_when:
  - Creating, renewing, releasing, validating, or sweeping AgentCoord claims.
  - Writing a cross-host or cross-agent handoff.
  - Hardening shared coding-agent coordination conventions.
---

# AgentCoord CLI

`agentcoord` is the command-line interface for `/mnt/synology-share1/AgentCoord`.

Common commands:

```bash
agentcoord validate
agentcoord list --active
agentcoord list --stale
agentcoord claim --repo shared/agent-scripts --slug launch-ritual --scope bin/agent-start --ttl-hours 2
agentcoord renew --repo shared/agent-scripts --slug launch-ritual --ttl-hours 4
agentcoord release --repo shared/agent-scripts --slug launch-ritual
agentcoord sweep
agentcoord sweep --apply
agentcoord handoff --repo shared/agent-scripts --slug launch-ritual \
  --goal 'Ship launch ritual' \
  --state 'agent-start implemented' \
  --check 'npm run agent:check pass' \
  --next-action 'Review and commit'
```

`sweep` is dry-run by default. With `--apply` it marks stale claims released; it does not delete files.

Claims are coordination hints, not permanent locks. Expired claims should send agents to the linked handoffs/logs before proceeding, but stale claims should not block safe work forever.
