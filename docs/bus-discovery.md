---
summary: Startup discovery flow for Codex and Claude Code to see live Pinakes bus agents and safe affordances.
read_when:
  - Starting agent work under ~/Projects that may reuse Pinakes bus capabilities.
  - Adding or changing bus-backed agents, capabilities, or startup instructions.
  - Deciding whether to call an existing agent before writing new agent/service code.
---

# Bus Discovery

Use `bus-discover` to inspect live Pinakes buses from an LLM coding session.

```bash
bus-discover
bus-discover --capability events-list
bus-discover --format json
```

Defaults:

- `jk` -> `http://localhost:8081`
- `ucla-tdg` -> `http://localhost:8080`

Override defaults with:

```bash
BUS_DISCOVER_BUSES="jk=http://beelink:8081,ucla-tdg=http://beelink:8080" bus-discover
bus-discover --bus jk=http://localhost:8081 --bus ucla-tdg=http://localhost:8080
```

## Output Semantics

`bus-discover` queries:

- `GET /v1/health`
- `GET /v1/agents`
- `GET /v1/agents?capability=<name>` when filtered

It prints each live agent with:

- `agent_id`
- class / mutation class / mode when available
- description
- capabilities
- known request-shape hints for common capabilities

Safety classes:

- `observe` reads or summarizes only.
- `recommend` drafts or proposes actions/artifacts.
- `mutate` can change external state and requires explicit user intent.

The bus registry is live state, not the whole contract. For exact request/reply schemas and side effects, read the repo-local capability docs before implementing new producers.

## Agent Startup Use

When working under `~/Projects`, run `bus-discover` early if the task might touch email, calendar, IP agents, llm-wiki, triage, or any agentic capability. Prefer an existing bus agent before writing new local code.

If `bus-discover` is missing, use the raw fallback:

```bash
curl -fsS http://localhost:8081/v1/agents | jq '.agents'
curl -fsS http://localhost:8080/v1/agents | jq '.agents'
```
