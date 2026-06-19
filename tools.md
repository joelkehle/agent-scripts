# Tools

Local tool catalog for this machine.

## committer
- Purpose: commit helper; stages only listed paths before committing.
- Location: ~/Projects/shared/agent-scripts/bin/committer
- Upstream: ~/Projects/oss/steipete/agent-scripts/scripts/committer

## trash
- Purpose: safe delete wrapper (moves files to Trash).
- Location: ~/Projects/shared/agent-scripts/bin/trash
- Backend: uses `gio trash` (preferred) or `trash-put` if installed.

## machine-compliance
- Purpose: machine drift/compliance checker used by Codex and Claude at session start.
- Wrapper: ~/Projects/shared/agent-scripts/bin/machine-compliance
- Source of truth: ~/Projects/shared/manager/bin/machine-compliance

## bus-discover
- Purpose: summarize live Pinakes buses, registered agents, capabilities, and safe affordance hints for LLM startup.
- Location: ~/Projects/shared/agent-scripts/bin/bus-discover
- Defaults: JK bus on `localhost:8081`, UCLA TDG bus on `localhost:8080`
- Examples: `bus-discover`, `bus-discover --capability events-list`, `bus-discover --format json`

## codex-bg
- Purpose: durable background runner for long Codex-adjacent jobs; captures logs, writes resume metadata, and can send completion email through `jk-gmail-ingest`.
- Location: ~/Projects/shared/agent-scripts/bin/codex-bg
- Default state: `~/.local/share/codex-bg/runs/`
- Email path: registers short-lived `codex-bg-notifier` and sends through the JK bus at `localhost:8081`.
- Examples: `codex-bg start --name long-check --timeout 2h -- ./scripts/check`, `codex-bg status <run-id>`, `codex-bg current-session-id`

## agent-check
- Purpose: run the best available validation command for the current repo.
- Location: ~/Projects/shared/agent-scripts/bin/agent-check
- Resolution order: `npm run agent:check`, `scripts/agent-check.sh`, `make agent-check`, `npm run gate`, `npm run fix:verify`, `npm run check`, `npm test`, `go test ./...`, then `pytest`.
- Output: prints `agent-check: root=...` and `agent-check: command=...` before running.
- Guardrail: do not define `npm run agent:check` as `agent-check`; point it at the repo's real gate.
- Examples: `agent-check`, `agent-check --dry-run`, `agent-check --root ~/Projects/shared/pinakes --dry-run`

## loop-audit
- Purpose: read/propose audit for loop rollout drift: skills availability, Codex instruction budget, AGENTS sizes, and validation entrypoint coverage.
- Location: ~/Projects/shared/agent-scripts/bin/loop-audit
- Examples: `loop-audit`, `loop-audit ~/Projects`

## dirty-audit
- Purpose: read-only dirty repo inventory for hygiene loops: branch/ahead state, file counts, generated/proof hints, validation command, and suggested next action.
- Location: ~/Projects/shared/agent-scripts/bin/dirty-audit
- Examples: `dirty-audit`, `dirty-audit ~/Projects`, `dirty-audit ~/Projects --json`

## loop-receipt
- Purpose: write structured evidence from a completed loop for the next turn.
- Location: ~/Projects/shared/agent-scripts/bin/loop-receipt
- Default state: `~/.local/share/agent-loops/receipts/` (override with `AGENT_LOOP_STATE_DIR`).
- Examples: `loop-receipt --goal "Fix issue 42" --status pass --next-loop review-loop --check "agent-check=pass"`, `loop-receipt --goal "Fix issue 42" --status pass --next-loop review-loop --from-head`

## loop-resume
- Purpose: print the latest loop receipt plus current git status and a suggested next loop prompt.
- Location: ~/Projects/shared/agent-scripts/bin/loop-resume
- Default state: `~/.local/share/agent-loops/receipts/` (override with `AGENT_LOOP_STATE_DIR`).
- Examples: `loop-resume`, `loop-resume --root ~/Projects/shared/pinakes`
