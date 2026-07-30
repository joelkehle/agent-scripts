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
agent-start --notice
agent-start --root ~/Projects/shared/agent-scripts
agent-start --root . --goal W31-EXAMPLE
agent-start --root . --mode read
```

The packet includes:

- active weekly goals, definitions of done, required milestones, and optional
  mission/initiative/campaign bindings;
- the actual `origin` URL and `workspace-preflight` result for `read` or
  `write` mode;
- active and quarantined local workspace-run manifests;
- command availability for the core agent workbench tools;
- `wwi` open loops;
- `machine-compliance --agent-startup --format text`;
- `bus-discover` when available;
- AgentCoord validation plus active and stale claims;
- docs-list output;
- git status;
- `agent-check --dry-run` validation entrypoint.
- the latest daily coding-agent workbench summary, when present.

Use `--skip-bus` only when bus probing is unrelated or temporarily noisy. The normal startup path should keep bus visibility because many Joel workflows should reuse existing Pinakes agents before new local code.

## Named Codex Threads

Codex 0.146 can name new threads. Keep WWI as the work authority and use the
loop slug as the human-readable thread name when it is unique:

```text
/rename <wwi-loop-slug>
/new <child-mission-slug>
/clear <child-mission-slug>
```

`/rename` labels the current thread. `/new <name>` and `/clear <name>` start a
fresh named thread. Pin active threads in the Codex app; archive only after the
loop receipt is complete. Do not bulk rename or archive historical threads.

Names improve browsing, but UUIDs remain the unambiguous recovery key. For an
operational restart or duplicate name, use:

```bash
yolo resume -C <cwd> <session-id>
```

## Launcher Notice

`agent-start --notice` is for Codex/Claude launch wrappers. It reads the latest
workbench summary and runs the local weekly-focus/workspace safety collection.
Clean state is silent.

When the workbench requests attention, notice mode prints:

```text
Agent workbench warning: 2 issues
- missing tool: codex
- Machine Compliance failed
Proof: http://beelink:8091/codex-output/agentic-software-ops/agent-workbench/latest/
```

Notice mode does not run the full startup packet. It is intentionally cheap and
safe to call before handing control to `codex` or `claude`. It defaults to
`--mode write`; use `--mode read` for a deliberately read-only launch.

See `docs/launch-safety.md` for focus validation, repository authority,
preflight refusal reasons, and atomic begin/seal/reconcile manifests.

The default workbench summary is:

```text
/home/joelkehle/Projects/shared/dev-dashboard/codex-output/agentic-software-ops/agent-workbench/latest/summary.json
```

Override it with `AGENT_WORKBENCH_SUMMARY`, `AGENT_WORKBENCH_URL`,
`--workbench-summary`, or `--workbench-url`.

## Production Install

Noninteractive SSH does not source Joel's interactive shell PATH. Install stable shims into `/usr/local/bin`:

```bash
~/Projects/shared/agent-scripts/bin/agent-env-install --sudo
```

Manager wraps this via `~/Projects/shared/manager/bin/install-agent-system-links` so bootstrap and runbooks do not depend on the agent-scripts implementation path.

On beelink, the manager installer also wires the `codex` and `claude` shims to
run `agent-start --notice` before execing the real launcher. Set
`CODEX_SKIP_AGENT_START=1` or `AGENT_LAUNCH_PREFLIGHT=0` for debugging.
