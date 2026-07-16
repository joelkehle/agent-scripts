---
summary: "Cross-repo safety and telemetry policy for reachable services, ports, HTTP handlers, health, metrics, alerts, and deployment verification."
read_when:
  - "Creating or changing a reachable runtime service, agent, API, dashboard, or worker."
  - "Changing host ports, ingress, authentication, health, metrics, alerts, or deployment metadata."
  - "Reviewing externally supplied paths, request bodies, proxy routes, or sensitive endpoints."
---

# Service Runtime Policy

This is the conditional detail behind the blocking service-safety summary in
the global AGENTS file.

## Sources Of Truth

- Telemetry rollout:
  `~/Projects/shared/manager/docs/decisions/telemetry-strategy-rollout-plan-2026-03.md`.
- Endpoint authentication:
  `~/Projects/shared/manager/docs/decisions/endpoint-auth-policy-2026-06.md`.
- Host-port ownership:
  `~/Projects/shared/manager/docs/services/port-allocations.md`.
- Ops probes/services:
  `~/Projects/shared/manager/ops/config/projects.json`.
- Compose/deploy metadata:
  `~/Projects/shared/manager/docs/decisions/promotion-verification-spec.md`.
- Alert runbook template:
  `~/Projects/shared/manager/docs/runbooks/ops-alert-runbook-template.md`.

Read the current source before implementing. This file states the common bar;
manager owns changing fleet details.

## Every Reachable Runtime

New runtime services ship:

- `GET /health` for inexpensive availability/readiness;
- `GET /metrics` in Prometheus format;
- a defined launch/wake path;
- an ops visibility entry in `projects.json` when host- or fleet-operated;
- local validation and a post-start probe.

An explicit temporary exception requires an owner and expiry.

## Endpoint Authentication

Any Tailscale-reachable endpoint that writes, triggers LLM spend, or returns
sensitive data requires at least a static bearer token supplied by environment.
Fail closed when the token is absent.

Open endpoints are limited to read-only, non-sensitive metadata such as health,
metrics, and public-safe registries. Authentication does not grant authority for
a destructive write; retain the workflow's separate user/policy gate.

## HTTP Ingress Safety

Every handler accepting external input must satisfy all four:

1. Never pass a caller-supplied filesystem path to file or exec operations.
   Prefer server-managed identifiers. When a path is unavoidable, use
   Clean/Abs/EvalSymlinks containment under a configured root.
2. Bound request-body size before reading it.
3. Pin upstream `Content-Type` in proxy/relay routes; do not forward the
   caller's value blindly.
4. Never echo attempted paths, internal paths, stack traces, or internal errors
   in responses.

Treat violations as blocking. These are recurring LLM-built-handler failures.

## Ports And Runtime Metadata

Before changing a host-facing port, `BUS_URL`, `host.docker.internal` target, or
Compose `ports:` mapping, update `port-allocations.md` in the same slice.

`internal_port` is container metadata only. It is not an implied host port or
probe target. Probe the documented host URL and keep compose/deploy metadata
consistent with the promotion-verification spec.

## Telemetry Contract

Critical signals require a dashboard and alert pair for the relevant dimensions:
availability, errors, saturation, and delivery quality. Metrics labels must be
bounded and low cardinality.

Every changed alert must include a runbook link in annotations. Validate rules
with `promtool check rules` or the owning stack's equivalent.

Telemetry-affecting handoff checklist:

- metrics added/changed and labels reviewed;
- Grafana dashboard/provisioning updated;
- Prometheus alert rules updated, or "not needed" justified;
- runbook link added/updated for every alert touched;
- configuration validation and live/post-start probes recorded.

Missing required telemetry, auth, ingress protection, or runbook linkage blocks
completion.
