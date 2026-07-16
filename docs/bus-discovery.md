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

These are local access endpoints, not durable ownership or deployment facts.
Read `~/Projects/shared/manager/docs/services/port-allocations.md` before
changing or reasoning from bus topology.

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
- class / safety class / mode when available
- description
- capabilities
- known request-shape hints for common capabilities

Safety classes:

- `read` reads or summarizes only.
- `propose` drafts or proposes actions/artifacts.
- `write` can change external state and requires explicit user intent.

Use `write`, `write-capable`, and `write action` in human-facing prose. Use `destructive write` when a write can send, delete, archive, label, patch, or otherwise make a risky external change. Older bus payloads may still expose legacy field names or values; display them as `read` / `propose` / `write`.

The bus registry is live state, not the whole contract. For exact request/reply
schemas and side effects, read the repo-local capability docs before implementing
new producers.

## Workflow Routing

For calendar work:

- Outlook is Joel's canonical calendar.
- Query generic and Outlook-specific affordances:
  `calendar-list`, `events-list`, `calendar-agenda`, and `outlook-calendar`.
- Expect separate read and guarded write/scheduler roles. Name the agents and
  their discovered safety classes in the thread.
- Do not add a parallel calendar adapter without explaining why the shared
  Outlook runtime cannot own the capability.

For email work, query both source and workflow affordances:
`email-fetch`, `email-thread-get`, `inbox-sync`, `inbox-triage`,
`query:inbox-status`, and `inbox-act`.

Before selecting an architecture:

1. Call an existing bus agent when its contract fits.
2. Reuse an existing shared package or sibling-repo implementation.
3. Write new local agent/service code only when the first two are not viable;
   state why.

## Before Changing Bus Behavior

- Read `~/Projects/shared/pinakes/docs/BUS_HTTP_CONTRACT.md` and the owning
  repo's bus docs.
- Read `port-allocations.md` before changing host ports, `BUS_URL`,
  `host.docker.internal`, or Compose port mappings.
- Inspect current Compose/network topology. Do not assume JK and UCLA share a
  Docker network or deployment authority.
- Do not rebuild an existing bus-backed service locally without explicit
  approval.
- New agents need the correct allowlist and owning stack. The auditable
  allowlist source lives in
  `~/Projects/shared/manager/ops/config/allowlist.txt`.
- Mount the manager config directory, not a single allowlist file; file-level
  mounts break hot reload after atomic renames.
- New persistent stores must follow `docs/STATE_ARCHITECTURE.md` first.

## Agent Startup Use

When working under `~/Projects`, run `bus-discover` early if the task might touch email, calendar, IP agents, llm-wiki, triage, or any agentic capability. Prefer an existing bus agent before writing new local code.

This is separate from Codex / Claude Code build-agent coordination. For cross-host coding claims, handoffs, patches, and proof packs on beelink/macmini, read `~/Projects/shared/agent-scripts/docs/shared-agent-coordination.md`.

If `bus-discover` is missing, use the raw fallback:

```bash
curl -fsS http://localhost:8081/v1/agents | jq '.agents'
curl -fsS http://localhost:8080/v1/agents | jq '.agents'
```
