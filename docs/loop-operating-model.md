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

Use five reusable loops:

- `ship-loop`: implement a bounded code/docs change.
- `review-loop`: inspect a diff or PR in read/propose mode.
- `repair-loop`: fix failing validation with focused repair attempts.
- `learn-loop`: capture durable repo-specific lessons after work finishes.
- `hygiene-loop`: reduce dirty workspace state through inventory, classification, and small safe cleanup batches.

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

## Scope And Proportionality

The direct user request, nearest instructions, and native vendor permissions
govern ordinary interactive work. Do not add a local ratification or fixed
definition-of-done gate. Use a short plan when it helps: goal, evidence,
non-goals, and a stop rule or review budget where useful. See
`docs/measurable-done.md`.

Ask only when a material product choice is unclear or an action is outside the
user's scope or is an unapproved destructive write. Preserve real OS/API
controls, product permission prompts, tests, backups, data checks, and any
explicit mailbox-action limit. These are safety controls, not a replacement
approval ceremony.

Every loop must define:

- Trigger: user task, failing test, PR feedback, stale docs, scheduled check, or explicit skill call.
- Context: nearest `AGENTS.md`, relevant docs with `read_when`, source files, tests, issue/PR context, and live bus discovery when agentic capability is involved.
- Allowed actions: read, propose, write, or destructive write.
- Definition of done: proportionate acceptance evidence, explicit non-goals,
  and a stop rule or review budget when useful.
- Feedback: exact commands or runtime probes that prove or disprove progress.
- Repair limit: default three focused attempts on the same failure.
- Stop rule: validation passes, scope expands, risky system change is required, product behavior is unclear, or the repair limit is hit.
- Receipt: changed files, checks run, failures repaired, unresolved risks, and proof-pack URL when needed.

During review and repair, classify new findings as in scope, beyond scope, or
a material choice. Beyond-scope findings default to deferred. A P1 blocks
retaining the affected behavior, but the
maintainer may fix it, remove the capability, narrow the guarantee, or stop the
release; severity does not silently authorize unbounded repair.

## Commit Defaults

For local `write` loops, green coherent work should usually be committed before
handoff. "Green" means the targeted check and the repo gate pass, or an explicit
reason is recorded for any skipped gate.

Default behavior:

- `ship-loop`: commit the completed slice when validation is green unless Joel
  asked not to commit.
- `hygiene-loop`: commit coherent cleanup slices after validation; do not bundle
  unrelated files just to make the tree clean.
- `repair-loop`: commit a focused repair when it belongs to an active write task
  and validation is green.
- `review-loop`: do not commit; stay read/propose unless Joel switches the task
  into a write loop.
- `learn-loop`: propose by default; write and commit only when Joel asked for a
  durable doc/instruction update.

Stop and ask before committing only when a material product decision is
unresolved, the action is outside the user's authorized scope, an unapproved
destructive write is required, or ownership of dirty files is ambiguous. Keep
using native vendor permissions and real OS/API controls for every action.

## Receipts And Resume

Use `loop-receipt` to turn the end of a loop into structured next-turn context. Receipts are written outside the repo by default under `~/.local/share/agent-loops/receipts/`, so they do not dirty working trees.

Use `agent-start` at the beginning of non-trivial coding sessions when the
runtime has not already provided equivalent startup context. It prints the
weekly focus, workspace preflight, source-host ownership, run state, bus
discovery, docs, git state, validation dry-run, and workbench summary in one
read-only packet. Read mode also shows legacy AgentCoord claims.

```bash
agent-start --root .
agent-start --root . --json
```

```bash
loop-receipt \
  --goal "Fix issue 42" \
  --status pass \
  --next-loop review-loop \
  --check "agent-check=pass" \
  --note "Ready for review"
```

After committing a loop, prefer `--from-head` or `--commit <ref>` so the receipt records the committed files instead of unrelated dirty worktree state.

```bash
loop-receipt \
  --goal "Fix issue 42" \
  --status pass \
  --next-loop review-loop \
  --commit HEAD
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
9. Commit the green coherent slice unless Joel asked not to commit or a stop rule applies.
10. Produce receipt; use `--from-head` after committing.

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
6. Stop if the likely fix needs a material product decision, is outside the
   user's authorized scope, or requires an unapproved destructive write.

Do not convert a repair loop into a broad refactor unless the user asks.
When the repair belongs to an active write task, commit the focused green fix
before handoff unless Joel asked not to commit.

## Learn Loop

Use when a task reveals a durable repo-specific lesson.

Only propose or write a lesson when it is:

- repo-specific or Joel-workspace-specific
- likely to recur
- not already covered by global or local AGENTS/docs
- short enough to stay instruction-budget friendly

Prefer adding `read_when` docs over growing AGENTS files. AGENTS should point to the durable doc, not absorb long domain playbooks.

## Hygiene Loop

Use when reducing dirty Git state across repos. Start read/propose: run `dirty-audit ~/Projects`, classify each dirty repo, and process only 1-3 low-risk repos per pass.

Cleanup classes:

- finish + commit
- park as WIP
- trash generated/proof junk
- ignore via `.gitignore`
- leave alone

Before touching a repo, read its `AGENTS.md`, check WWI for overlapping work, inspect diffs/untracked files, and decide whether the cleanup is coherent. Commit only completed work with the repo gate when available. Use `trash` for generated proof junk and do not commit raw email bodies, secrets, tokens, private keys, or sensitive source data.

## Instruction Budget

Canonical layering, placement rules, and byte targets live in
`docs/instruction-architecture.md`. In short: keep AGENTS files as routers for
mission, ownership, validation, authority, and release rules; move conditional
policy and examples into `read_when` docs; use skills for workflows, hooks for
mechanical enforcement, and live discovery for facts that drift.

Do not treat a raised `project_doc_max_bytes` as a content budget. Design the
combined instruction chain to remain useful under Codex's documented default.

## Hooks And Automations

Start with skills and validation commands. Add hooks only for deterministic guardrails.

Elephant is the shared system-context and compaction-continuity guard for
system-level work. Its canonical policy, adoption map, recovery procedure, and
implementation live under `docs/elephant/` and `lib/elephant/`. Repositories
keep only their active marker, receipts, traceability/proof, and minimal hook
entrypoints. Do not fork the reusable Elephant implementation into product
repos.

Safe hook pilots:

- pre-tool secret/path guard for `.env`, credentials, production config, and destructive shell commands
- post-tool changed-file/LOC warning, building on the existing Claude bloat check
- stop-time receipt reminder when files changed but no validation command ran

Safe automation pilots:

- weekly AGENTS instruction-size audit
- read-only `dirty-audit ~/Projects` report for hygiene-loop batch selection
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
