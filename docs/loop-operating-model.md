---
summary: "Shared coding-agent loop model for Joel's repos: ship, review, repair, learn, validation, safety boundaries, and rollout pilots."
read_when:
  - Starting or updating reusable coding-agent workflows.
  - Adding AGENTS.md guidance, skills, hooks, automations, or validation commands.
  - Refactoring how Codex and Claude Code collaborate on implementation work.
---

# Loop Operating Model

This is the shared process contract for coding agents under `~/Projects`.

The goal is to move repeated prompt detail into durable loops. A loop is a workflow with a trigger, context, allowed actions, feedback command, stopping rule, and receipt.

## Core Loops

Use four reusable loops:

- `ship-loop`: implement a bounded code/docs change.
- `review-loop`: inspect a diff or PR in read/propose mode.
- `repair-loop`: fix failing validation with focused repair attempts.
- `learn-loop`: capture durable repo-specific lessons after work finishes.

Loops can compose. Normal implementation flow is:

```text
ship-loop -> targeted validation -> repair-loop when needed -> review-loop -> final receipt -> learn-loop when durable lesson exists
```

## Safety Classes

Use Joel's bus safety vocabulary in human-facing text:

- `read`: inspect files, logs, docs, live read-only APIs, or bus agents.
- `propose`: draft patches, recommendations, emails, wiki pages, or plans without external state changes.
- `write`: edit files, commit, label, patch, create drafts, or change external state.

Say `destructive write` when a write can send, delete, archive, label, deploy, migrate, patch production data, or otherwise create risky external effects.

Default coding work is local `write` inside the current repo. External `write` and every `destructive write` need explicit user intent.

## Loop Contract

Every loop must define:

- Trigger: user task, failing test, PR feedback, stale docs, scheduled check, or explicit skill call.
- Context: nearest `AGENTS.md`, relevant docs with `read_when`, source files, tests, issue/PR context, and live bus discovery when agentic capability is involved.
- Allowed actions: read, propose, write, or destructive write.
- Feedback: exact commands or runtime probes that prove or disprove progress.
- Repair limit: default three focused attempts on the same failure.
- Stop rule: validation passes, scope expands, risky system change is required, product behavior is unclear, or the repair limit is hit.
- Receipt: changed files, checks run, failures repaired, unresolved risks, and proof-pack URL when needed.

## Receipts And Resume

Use `loop-receipt` to turn the end of a loop into structured next-turn context. Receipts are written outside the repo by default under `~/.local/share/agent-loops/receipts/`, so they do not dirty working trees.

```bash
loop-receipt \
  --goal "Fix issue 42" \
  --status pass \
  --next-loop review-loop \
  --check "agent-check=pass" \
  --note "Ready for review"
```

Use `loop-resume` at the next turn to print the latest receipt plus current git status and a suggested next loop prompt.

```bash
loop-resume
```

This is the first automation layer: it feeds evidence from one loop into the next loop without granting unattended write capability.

## Validation Entry Point

Each repo should expose one obvious agent validation command. Preferred order:

1. `npm run agent:check`
2. `scripts/agent-check.sh`
3. `make agent-check`
4. existing repo gate such as `npm run gate`, `npm run fix:verify`, `npm run check`, or `go test ./...`

Shared helper:

```bash
agent-check
agent-check --dry-run
```

`agent-check` chooses the best available command in the current repo. Repo `AGENTS.md` should still name targeted checks for common changes, but the handoff gate should be executable through `agent-check`.

`agent-check` selects the nearest project marker from the current directory or `--root DIR`, then prints both the selected root and command before running it. Do not define `npm run agent:check` as `agent-check`; point it at the repo's real gate such as lint/build/test. The helper has a recursion guard, but repo scripts should avoid direct self-calls.

## Ship Loop

Use for implementation. Keep work narrow and verify incrementally.

Steps:

1. Inspect current git state and relevant docs/files.
2. Identify ownership boundary and smallest testable slice.
3. Use bus discovery before writing agentic/email/calendar/wiki/triage logic.
4. Edit only scoped files.
5. Run the most targeted check first.
6. If a check fails, enter `repair-loop`.
7. Run `agent-check` or the documented full gate before handoff when feasible.
8. Inspect diff and remove accidental churn.
9. Produce receipt.

## Review Loop

Use for a second pass. Default is `read` or `propose`.

Review for:

- correctness and regressions
- safety, secrets, auth, permission, and destructive write risks
- missing tests or weak validation
- unnecessary scope expansion
- docs/API/telemetry drift
- bus capability reuse before new local agentic code

Findings lead. Rank by severity. Do not edit files unless explicitly switching into `ship-loop` or `repair-loop`.

## Repair Loop

Use after a failing command, CI run, smoke test, deploy check, or review finding.

Rules:

1. Quote or name the failing command.
2. Read the exact error and nearest changed code.
3. Make one focused fix.
4. Rerun only the failed command first.
5. Repeat up to three focused attempts for the same failure.
6. Stop if the likely fix needs new scope, schema changes, secrets, deployment changes, destructive write, or unclear product behavior.

Do not convert a repair loop into a broad refactor unless the user asks.

## Learn Loop

Use when a task reveals a durable repo-specific lesson.

Only propose or write a lesson when it is:

- repo-specific or Joel-workspace-specific
- likely to recur
- not already covered by global or local AGENTS/docs
- short enough to stay instruction-budget friendly

Prefer adding `read_when` docs over growing AGENTS files. AGENTS should point to the durable doc, not absorb long domain playbooks.

## Instruction Budget

Codex loads global and project instructions up to a byte limit. Large AGENTS chains can drop later guidance.

Keep AGENTS files as routers:

- mission and ownership
- start-here docs
- one validation entrypoint
- write/destructive-write boundaries
- deploy/release rules
- links to detailed docs with `read_when`

Move long examples, templates, domain cases, and historical notes into docs.

## Hooks And Automations

Start with skills and validation commands. Add hooks only for deterministic guardrails.

Safe hook pilots:

- pre-tool secret/path guard for `.env`, credentials, production config, and destructive shell commands
- post-tool changed-file/LOC warning, building on the existing Claude bloat check
- stop-time receipt reminder when files changed but no validation command ran

Safe automation pilots:

- weekly AGENTS instruction-size audit
- daily stale WWI loop report
- recurring CI failure triage in read/propose mode
- nightly `loop-audit ~/Projects` inventory across active repos

Run unattended write-capable automations only in worktrees or isolated repos, and keep destructive write disabled unless Joel explicitly authorizes the narrow action.

## Rollout

Pilot order:

1. `shared/agent-scripts`: loop docs, skills, `agent-check`, and instruction-size guard.
2. `shared/pinakes`: Go shared infra pilot with `go test ./...`.
3. `ucla-tdg/ucla-tdg-email-triage`: bus/write-safety pilot with proof packs.
4. `ucla-tdg/ucla-tdg-assistant-db`: rich validation pilot; add explicit `agent:check`.
5. JK repos: personal-agent rollout after bus boundaries are verified.

Current shared skill source is `~/Projects/shared/agent-scripts/workspace-roots/projects/.agents/skills/`. Link it into both `~/Projects/.agents/skills/` and `~/.agents/skills/` so skills are available from the workspace root and from child repo launches.
