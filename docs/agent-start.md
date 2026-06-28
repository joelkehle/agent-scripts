---
summary: Coding-agent launch ritual that prints the same startup packet for Codex and Claude Code on beelink/macmini.
read_when:
  - Starting Codex or Claude Code work from beelink.
  - Debugging missing startup context, PATH drift, AgentCoord claims, bus visibility, or validation entrypoints.
  - Updating shared coding-agent launch instructions or workbench reports.
---

# Agent Start

`agent-start` is the shared coding-agent launch ritual. It turns the session-start checklist into one command so Codex and Claude Code see the same operating surface.

Run from a repo or workspace:

```bash
agent-start
agent-start --json
agent-start --root ~/Projects/shared/agent-scripts
```

The packet includes:

- command availability for the core agent workbench tools;
- `wwi` open loops;
- `machine-compliance --agent-startup --format text`;
- `bus-discover` when available;
- AgentCoord validation plus active and stale claims;
- docs-list output;
- git status;
- `agent-check --dry-run` validation entrypoint.

Use `--skip-bus` only when bus probing is unrelated or temporarily noisy. The normal startup path should keep bus visibility because many Joel workflows should reuse existing Pinakes agents before new local code.

## Production Install

Noninteractive SSH does not source Joel's interactive shell PATH. Install stable shims into `/usr/local/bin`:

```bash
~/Projects/shared/agent-scripts/bin/agent-env-install --sudo
```

Manager wraps this via `~/Projects/shared/manager/bin/install-agent-system-links` so bootstrap and runbooks do not depend on the agent-scripts implementation path.
