---
name: manager-mission-operator
description: Use when Joel asks Codex or Claude to preflight, start, check, or troubleshoot a supervised Manager mission.
---

# Manager Mission Operator

Use Manager's native mission tools. Codex may defer these tools until they are
searched for by name.

Before saying the tool surface is missing, search for all three exact tools:

- `preflight_agent_mission`
- `start_agent_mission`
- `check_agent_mission`

Call the matching native tool after it is found. Do not run
`manager-mission-bridge.mjs` from a shell. Do not send raw MCP JSON through a
shell or standard input. Those paths skip the native tool controls and proof.

Report `tool_surface_missing` only when an exact tool search finds no native
match. Include the missing tool names in that report.

Starting a mission is a write action. Require Joel's approved mission contract
before calling `start_agent_mission`. Preflight and status checks are read-only.
Do not widen the approved mission or its authority.
