# AGENTS.MD

Joel owns this. Start: say hi + one motivating line.
Style: telegraph; noun phrases okay; minimum useful words.

## Hard Boundaries

- `~/MedProjects/` is off-limits. Never read, write, `cd`, grep, glob, open a
  terminal there, or follow a pointer into it.
- Explicitly off-limits repos remain off-limits even when named elsewhere:
  `rapamycin-kb`, `kidney-radar`, and `patient-care-dashboard`.
- Ordinary calendar, email, contact, and logistics work is not off-limits unless
  it requires opening an off-limits path or repo.
- Fleet infrastructure may treat an off-limits service as an opaque endpoint
  (host, port, health probe) so the fleet runs. Never inspect its repo, data,
  source docs, or contents.
- If work appears to require an off-limits source: stop and tell Joel.

## Vocabulary And Authority

- Human-facing safety classes: `read`, `propose`, `write`.
- Say `read-only`, `write-capable`, or `write action` when useful.
- Say `destructive write` for sends, deletes, archives, labels, production
  patches, or other risky external-state changes.
- Local repo edits requested by Joel authorize ordinary `write` work in scope.
  External writes and destructive writes require explicit intent for that
  action.
- Answer, explain, diagnose, and review requests remain read/propose unless Joel
  also asks for implementation.

## Session Start

1. Before the first response or other tool, run `wwi`. Surface active loops and
   the most recent one. If unavailable, mention it once and continue.
2. Run `machine-compliance --agent-startup --format text` once per session.
   Fallback:
   `~/Projects/shared/manager/bin/machine-compliance --agent-startup --format text`.
   Surface every `WARN` and `FAIL`.
3. Read the nearest `AGENTS.md`, run `docs-list` (or the repo equivalent),
   follow matching `read_when` hints, and inspect `git status --short`.
4. For email, calendar, IP, llm-wiki, triage, or other agentic capability work,
   run `bus-discover` early and summarize relevant agent IDs, capabilities,
   safety classes, and read-only/write-capable status before architecture or
   code.

`agent-start --root .` may collect this startup evidence, but does not excuse
surfacing warnings or reading task-matched docs.

## Instruction Routing

Keep this file a stable cross-repo router. Detailed procedures belong in
conditional docs, skills, hooks, or live discovery:

- Instruction placement and byte budgets:
  `docs/instruction-architecture.md`.
- Coding loops: `docs/loop-operating-model.md` and the `ship-loop`,
  `review-loop`, `repair-loop`, `learn-loop`, and `hygiene-loop` skills.
- System-level continuity and contract drift: `docs/elephant/README.md`;
  read `docs/elephant/ELEPHANT_CHECK.md` when its `read_when` matches.
- State-store choices or fact ownership: `docs/STATE_ARCHITECTURE.md`.
- Bus-backed capabilities: `docs/bus-discovery.md`, then the Pinakes HTTP
  contract and owning repo docs.
- Cross-host or overlapping coding-agent work:
  `docs/shared-agent-coordination.md`.
- User-visible UI or walkthroughs: use the `design-walkthrough` skill.
- Services, ports, auth, HTTP ingress, telemetry, and alerts:
  `docs/service-runtime-policy.md`.
- Local commands and special tools: `tools.md`.

Before building intake, routing, content-buffer, background-processing, or
cross-agent prioritization workflows, read
`~/Projects/shared/brainstorm/collective-intelligence-north-star.md`.
Before building anything that answers “what should Joel do today?”, read
`~/Projects/shared/brainstorm/chief-of-staff-agent.md`. Do not duplicate that
boundary with a narrower briefing agent without explaining why.

Assume commercially available LLM inference, local tools/agents, and Joel as the
only human gate. Do not invent human reviewers, operators, attorneys, physicians,
or other authorities as available workflow components. Name outside expertise as
an unbuilt recruitment/vendor need.

## Workspace And Repo Ownership

- Contact: Joel Kehle (`@joelkehle`, `joel@kehle.com`).
- Workspace: `~/Projects`. Joel-owned repos live under `jk`, `ucla-tdg`, or
  `shared`; third-party OSS lives under `~/Projects/oss`.
- Missing Joel repo: clone `https://github.com/joelkehle/<repo>.git`.
- New Joel repo missing instructions: first commit `AGENTS.md` plus the
  standard three-line `CLAUDE.md` pointer. The repo AGENTS file should name
  purpose, start docs, validation, and deploy rules; use a sibling as template.
- Files belong in the owning repo or `shared/agent-scripts`. Do not create new
  state, policy, or source-of-truth files in an arbitrary convenient repo.
- From beelink, reach the laptop guest with
  `ssh -p 2222 joelkehle@laptop`; do not rely on `JoelSurface5` mDNS.

## Work Loop

- Use the applicable loop skill for non-trivial work. Keep the slice bounded;
  read before editing; preserve unrelated changes.
- Subagents are allowed only when parallel read, disjoint writes, or independent
  verification materially reduce risk or time. Read `docs/subagent.md` first.
- Prefer existing bus agents, shared packages, and repo patterns before new
  services or dependencies.
- For a new dependency, check current maintenance, releases, and adoption.
- Fix root causes. Add a regression test for bugs when practical.
- Run the targeted check first, then `agent-check` or the repo's documented
  full local gate. GitHub Actions are not the validation surface while UCLA
  Enterprise GitHub is in use; do not inspect, create, rerun, or repair Actions.
- Update docs when behavior, API, operating procedure, or ownership changes.
- Apps, agents, dashboards, recurring checks, and leverage software need a
  launch path: service manager, cron/launchd, Compose, runbook command, skill, or
  agent-discoverable CLI. Manual-only is smoke/debug, not finished operation.
- Prefer current primary sources for facts that can drift. Model/version choices
  are current-fact questions; verify them instead of pinning a stale list here.
- Keep implementation files around 500 lines when practical; split by
  responsibility rather than mechanically.
- Avoid repo-wide search/replace. Keep edits small and reviewable.

## Git And Delivery

- Safe read commands: `git status`, `git diff`, `git log`.
- Check status/diff before edits and again before commit. Unexpected changes
  belong to another agent/user; preserve them and stop only if scopes overlap.
- Use Conventional Commits. Prefer `committer`, which stages only listed paths.
- A green coherent local write slice should be committed. Push immediately after
  committing; commit-without-push is the anomaly. Definition of done is merged
  to `main` and pushed to `origin/main` unless Joel explicitly waives it.
- Branch creation/switching, force-push, deploys, migrations, tags, and
  destructive Git commands require explicit consent. Never use
  `reset --hard`, `clean`, `restore`, or broad checkout to discard work.
- Prefer HTTPS remotes under `~/Projects`. No amend unless asked. Use
  `trash`, not `rm`, for deletions.
- Stage an upstream file in `/tmp` and integrate it deliberately; never
  overwrite tracked work blindly.
- Use `gh pr view/diff` for PRs. Address review threads only after fixes land.

## State And Secrets

- Read `docs/STATE_ARCHITECTURE.md` before creating or choosing any persistent
  store. A state-ownership move requires that doc in the same commit.
- Canonical host identity: `/etc/manager-host-id` when present.
- Human operations checkout: `~/Projects/shared/operations`. Agents do not
  commit there or write `intent/`, `manifests/`, or `waivers/`.
- Agent-written machine observations belong in the dedicated clone at
  `~/.local/share/ops-state/observations/`. Read released manifests from
  `~/.local/share/ops-state/manifests/<host_id>/current.json`; the matching
  operations-checkout path is transitional fallback only.
- Never commit or place on AgentCoord raw email bodies, secrets, tokens, private
  keys, or sensitive source data. Use the documented Infisical runtime path.

## Bus And Agentic Work

- The live registry is authority for available agents; static names and
  topology are hints only.
- Outlook is Joel's canonical calendar. Discover generic and Outlook-specific
  calendar affordances before proposing a new adapter.
- Prefer: existing bus agent, then existing shared package, then new local code.
  Explain why reuse is not viable before implementing a new agent/service.
- Read `docs/bus-discovery.md` before changing an agent, capability, bus URL,
  network, allowlist, or registration behavior.

## Service Safety And Telemetry

For any new or changed reachable service, read
`docs/service-runtime-policy.md`. Blocking minimums:

- `GET /health` and Prometheus `GET /metrics`;
- bearer auth, failing closed, for endpoints that write, spend LLM resources, or
  return sensitive data;
- bounded request bodies, server-managed contained paths, pinned upstream
  content types, and no internal-path/error disclosure;
- port inventory updated before host-facing port changes;
- dashboard plus alert plus linked runbook for critical signals.

## Proof, UI, And Handoff

- Default to a browser-viewable proof pack for user-visible work, live-data
  writes, dashboards, or remote inspection. Put the substance in chat too.
- Standard viewer: `~/Projects/shared/dev-dashboard/codex-output/` and
  `http://beelink:8091/codex-output/`; use a unique task directory. Do not
  expose sensitive artifacts publicly.
- For UI work, present the clean product canvas before reviewer annotations or
  rationale; observe before explaining. Use `design-walkthrough`.
- For non-trivial loops, record WWI breadcrumbs after meaningful progress and
  before interruption. End with `loop-receipt`; use `--from-head` or
  `--commit <ref>` after committing.
