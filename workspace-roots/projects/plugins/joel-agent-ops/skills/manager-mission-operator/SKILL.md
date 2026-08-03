---
name: manager-mission-operator
description: Use when Joel asks Codex or Claude to preflight, start, check, or troubleshoot a supervised Manager mission.
---

# Manager Mission Operator

Use the local `manager-mission` command. It is the primary path for every
mission operation. Do not require or search for native MCP tools.

Before any operation, check that the command is installed:

```bash
command -v manager-mission
```

If it is absent, report `manager-mission not installed; cannot operate Manager
missions.` Then stop. Fail closed. Do not run the old
`manager-mission-bridge.mjs` or send raw MCP JSON as a fallback.

## Commands

Use these four commands:

- `manager-mission preflight` checks an exact mission contract.
- `manager-mission start` submits that same exact contract.
- `manager-mission check` reads the state of one mission ID.
- `manager-mission watch` follows one mission ID to a terminal result or the
  CLI timeout.

Pass each command the needed contract or mission ID in the form shown by the
local command help. Do not change the contract while moving from preflight to
start.

## Safe Start

Starting a mission is a write action. Require Joel's approved exact mission
contract before `manager-mission start`. Preflight, check, and watch are
read-only. Do not widen the contract or its authority.

Run preflight first. Start only after it passes. Run start at most once unless
Manager clearly refuses the request. If Manager clearly refuses it, correct the
stated problem and submit again only when the corrected contract still has
Joel's approval.

Do not run a second start after Manager accepted the request. Do not run a second
start when the reply is unclear. A transport error without a clear
Manager refusal also stops the workflow for recovery. Treat those cases as
possibly accepted. Report what is known and recover the existing request or
mission instead of creating another one.

## Watch The Accepted Mission

After a successful start, read `data.mission_id` from the reply. Immediately
run `manager-mission watch` for that exact ID. Keep it running until the mission
has a terminal result or the CLI timeout is reached.

The watch command polls every 10 seconds. It follows Manager's mission deadline
plus two minutes. It prints a heartbeat every minute. It returns success only
when the terminal result is `ready_for_joel`. Every other terminal result and a
CLI timeout are failures.
