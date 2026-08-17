READ ~/Projects/shared/agent-scripts/AGENTS.MD BEFORE ANYTHING (skip if missing).

# Workspace: ~/Projects

This layer is for cross-project navigation. Keep implementation work inside the
owning Git repository and let its nearest `AGENTS.md` provide local commands,
tests, and deployment rules.

## Ownership

- `~/Projects/jk`: Joel's personal products and agents.
- `~/Projects/ucla-tdg`: UCLA Technology Development Group products and agents.
- `~/Projects/shared`: cross-domain capabilities, infrastructure, operations,
  policy, and reusable tooling.
- `~/Projects/oss`: third-party/open-source checkouts.

Do not infer ownership from a bus URL, deploy host, adapter, or historical agent
ID. Shared capabilities may serve JK, UCLA, or both.

## Cross-Project Routing

- Current project/capability map:
  `~/Projects/shared/brainstorm/project-capability-index.md`.
- Fleet, hosts, services, ports, DNS, and monitoring:
  `~/Projects/shared/manager/docs/`.
- Human host notebooks and released machine state:
  `~/Projects/shared/operations/`; agents must follow the global read/write
  boundary before using it.
- Coding-agent loops and shared instructions:
  `~/Projects/shared/agent-scripts/docs/instruction-architecture.md`.
- Live bus capabilities: run `bus-discover`, then read
  `~/Projects/shared/agent-scripts/docs/bus-discovery.md`.
- Cross-host/overlapping coding work:
  `~/Projects/shared/agent-scripts/docs/shared-agent-coordination.md`.

Before work that prioritizes environmental signal, intake, routing, background
processing, or cross-agent attention, read
`~/Projects/shared/brainstorm/collective-intelligence-north-star.md`.
Before work that answers “what should Joel do today?”, read
`~/Projects/shared/brainstorm/chief-of-staff-agent.md`.

## Cross-Repo Work

- Interactive Codex and Claude sessions are Joel's delegated helpers. Run them
  under Joel's operating-system account in these normal checkouts. Use separate
  Unix accounts only for persistent services or untrusted work. Keep GitHub
  attribution separate through the repo-approved contributor identity.
- Identify the owning repo before editing. Run its `docs-list`, inspect its Git
  state, and use its local validation entrypoint.
- Do not maintain service status, secrets commands, dependency diagrams, model
  versions, or environment inventories in this always-loaded file. Resolve live
  facts from their authoritative docs or runtime.
- Keep changes, validation, commits, and receipts separated by repo. Do not
  bundle unrelated repositories into one commit or proof claim.
- For overlapping edits, create an AgentCoord claim before writing. For
  cross-host handoff, write the handoff before switching runtimes.
- Prefer launching Codex/Claude from dev. Use macmini through SSH from dev for
  macOS-only execution unless Joel explicitly requests a macmini-local agent.
  The fleet SSH grid blocks beelink from starting a macmini shell.
- Validate locally with `agent-check` or the repo's documented full gate.
  GitHub Actions are not the standard validation surface.
