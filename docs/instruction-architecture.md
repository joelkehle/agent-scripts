---
summary: "Layering, ownership, byte budgets, and maintenance rules for Joel's Codex and Claude agent instructions."
read_when:
  - "Adding, removing, or reorganizing AGENTS.md guidance."
  - "Deciding whether behavior belongs in AGENTS, a doc, skill, hook, or live discovery."
  - "Investigating instruction truncation, duplication, drift, or stale agent behavior."
---

# Instruction Architecture

The instruction system is a routing hierarchy, not a single handbook. Always-
loaded context should contain only stable cross-repo constraints and enough
routing to find conditional detail.

## Layers

| Layer | Owns | Must not own |
|---|---|---|
| Current prompt/thread | one-task intent, temporary scope, explicit authority | durable policy |
| Global `AGENTS.MD` | stable safety boundaries, startup order, authority, cross-repo delivery rules, routers | tool catalogs, live topology, long checklists, model snapshots |
| `~/Projects/AGENTS.md` | workspace ownership and cross-project navigation | per-repo commands, service inventory, secrets examples, runtime status |
| Repo/nested `AGENTS.md` | purpose, start docs, local validation, deploy/release rules, narrow overrides | repeated global policy or domain playbooks |
| `read_when` docs | conditional domain policy, runbooks, examples, checklists | rules that must apply before the doc can be discovered |
| Skills | reusable task workflows, references, scripts, output contracts | universal safety policy |
| Hooks/checkers | deterministic lifecycle or mechanical enforcement | judgment-heavy product decisions |
| Live discovery | agents, ports, health, runtime topology, current models | durable prose snapshots |

Closer repo instructions may specialize global defaults. They should not copy
the global file merely to make a rule visible.

## Canonical Paths

- Global source: `~/Projects/shared/agent-scripts/AGENTS.MD`.
- Codex global link: `~/.codex/AGENTS.md` -> the global source.
- Workspace source: `workspace-roots/projects/AGENTS.md`.
- Workspace link: `~/Projects/AGENTS.md` -> the workspace source.
- `~/AGENTS.MD` is a compatibility symlink to the global source. If a platform
  requires a copy instead, verify byte equality after updates.
- Shared skill source:
  `workspace-roots/projects/.agents/skills/`; installed links live under
  `~/Projects/.agents/skills/` and `~/.agents/skills/`.

## Byte Budgets

Targets are deliberately below Codex's configured maximum. A larger maximum is
headroom for layered repo guidance, not permission to fill global context.

- Global AGENTS: target <= 12 KiB.
- Workspace-root AGENTS: target <= 4 KiB.
- New/refactored repo AGENTS: target <= 12 KiB.
- Any single AGENTS file above 16 KiB: `loop-audit` warning and refactor review.
- Combined chain: design for Codex's documented 32 KiB default even when a host
  raises `project_doc_max_bytes` to 64 KiB.

The repository gate enforces the global and workspace targets. `loop-audit`
finds large repo-local files across the wider workspace.

## Placement Test

Before adding an instruction, ask in order:

1. Is it one-task intent? Keep it in the prompt or WWI receipt.
2. Is it stable and required in almost every repo? Global AGENTS.
3. Is it specific to one repo or subtree? Nearest repo AGENTS.
4. Is it a conditional policy, example, checklist, or runbook? A `read_when`
   doc with one short router in AGENTS.
5. Is it a repeatable multi-step workflow? A skill.
6. Is it mechanically decidable at a lifecycle boundary? A hook/checker.
7. Can it drift at runtime? Discover it live; do not freeze it in instructions.

Hard safety boundaries stay global even when detailed remediation lives in a
doc. A router must name both the trigger and the destination; a bare link is not
enough for reliable progressive disclosure.

## Anti-Bloat Rules

- No version-pinned "current model" lists in AGENTS.
- No service status tables, host IPs, soak windows, or live agent inventories.
- No duplicate startup, Git, WWI, or validation sections.
- No full tool help in AGENTS; route to `tools.md` or `--help`.
- No historical narrative unless it changes current behavior.
- Resolve contradictions before adding exceptions. One rule, one owner.
- Remove superseded text in the same commit that adds its replacement doc.

## Change Checklist

1. Inventory the active global, workspace, repo, skill, hook, and live-state
   layers affected by the request.
2. Preserve hard boundaries and explicit authority.
3. Move detail to an existing owner when possible; create a new doc only when
   no current owner fits.
4. Run `bash tests/instruction-architecture.sh`, `loop-audit`, and `agent-check`.
5. Verify canonical links/mirrors and inspect the rendered instruction chain.
6. Commit and push the coherent policy slice.

Official Codex behavior: [AGENTS discovery and layering](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
and [skill progressive disclosure](https://learn.chatgpt.com/docs/build-skills).
