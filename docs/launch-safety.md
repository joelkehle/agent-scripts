---
summary: "Weekly-focus resolution, fail-closed repository preflight, and atomic local workspace-run manifests for coding-agent launches."
read_when:
  - Starting write-capable Codex or Claude work in a repository.
  - Validating or resolving the weekly-focus registry.
  - Diagnosing a refused repository launch, abandoned run, or quarantined run.
  - Integrating a launcher with shared agent-scripts launch-safety primitives.
---

# Launch Safety And Weekly Focus

Version 1 provides three local CLI surfaces:

- `agent-focus`: validate, list, and resolve weekly priority metadata.
- `workspace-preflight`: read-only Git, worktree, origin-authority, AgentCoord,
  and quarantine diagnosis.
- `agent-workspace`: atomic begin, seal, and dead-owner reconciliation records.

These commands are primitives, not an orchestrator, daemon, database, bus
agent, dashboard, scheduler, planner, or mission conductor. They never create
or remove a worktree and never stash, reset, clean, commit, change a remote,
push, deploy, or mutate a supervised execution object.

## Weekly Focus

The default file is:

```text
/mnt/synology-share1/AgentCoord/registry/weekly-focus.yaml
```

Required shape:

```yaml
week_ending: 2026-08-02
goals:
  - id: W31-EXAMPLE
    done: The gradeable weekly outcome.
    required_milestone: The minimum enabling milestone.
    fallback: The bounded fallback when the milestone is unavailable.
    execution_refs:
      - kind: mission
        id: opaque-existing-id
not_this_week:
  - Explicit non-goal
```

`execution_refs` is optional. It may be empty or contain several opaque
references with `kind: mission|initiative|campaign`. The Manager supervised
coding control plane remains authoritative for existence, repository
compatibility, status, descendants, budgets, and evidence. Weekly focus carries
priority metadata above that hierarchy; it does not add an execution layer.

Commands:

```bash
agent-focus validate
agent-focus list
agent-focus resolve W31-EXAMPLE
agent-focus exception \
  --category production_incident \
  --reason "Production is unavailable."
```

Allowed exception categories:

- `production_incident`
- `security_exposure`
- `data_loss_risk`
- `immovable_external_deadline`

An exception requires a human-readable reason. An unknown goal, malformed
file, unsupported execution kind, or missing execution ID is refused. The
command never creates or repairs the weekly file.

## Workspace Preflight

Always supply the intended safety mode:

```bash
workspace-preflight --root /path/to/repo --mode read
workspace-preflight --root /path/to/repo --mode write
workspace-preflight --root /path/to/repo --mode write --json
```

Every result reports the actual `origin` URL as `canonical_remote`. Local
directory names never establish repository authority.

For write mode, preflight refuses:

- a primary checkout with uncommitted changes;
- another linked worktree with uncommitted or ambiguous changes and no living
  PID/start-token run owner;
- an explicit quarantine-registry match;
- missing or divergent canonical `origin/*` tracking state;
- an active overlapping AgentCoord writer;
- a living, stale, or quarantined local run collision;
- `github.com/ucla-tdg/*`, which is a read-only mirror namespace.

`github.com/kehle-tdg-dev/*` is the TDG development namespace. Preflight only
diagnoses. It never modifies a remote or checkout.

Fixture/test overrides:

- `AGENT_FOCUS_FILE`
- `AGENTCOORD_ROOT`
- `AGENT_QUARANTINE_ROOT`
- `AGENT_WORKSPACE_STATE_ROOT`

## Run Manifests

The default state root is:

```text
~/.local/state/agent-workspaces/
```

Begin requires either a declared weekly goal or a valid exception:

```bash
agent-workspace begin \
  --root /path/to/repo \
  --goal W31-EXAMPLE \
  --tool codex \
  --pid "$$"
```

An optional supervised-execution binding is syntactically validated but not
looked up or mutated:

```bash
agent-workspace begin \
  --root /path/to/repo \
  --goal W31-EXAMPLE \
  --execution-kind mission \
  --execution-id opaque-existing-id \
  --tool codex \
  --pid "$$"
```

`begin` first requires a successful write preflight, atomically records
`starting`, then atomically advances to `active`. The manifest records schema,
run ID, repository root and Git common directory, actual origin, goal or
exception, optional single execution reference, tool, PID/start token, host,
branch, starting HEAD, timestamp, state, exit code, ending HEAD, and any
quarantine reason.

Seal with the process exit code:

```bash
agent-workspace seal --run-id RUN_ID --exit-code 0
```

A readable checkout without uncommitted changes becomes `sealed`. Uncommitted
or ambiguous repository state becomes `quarantined`; no cleanup is attempted.

Reconcile dead owners explicitly:

```bash
agent-workspace reconcile
```

PID plus process-start-token identity prevents PID reuse from impersonating the
original owner. A dead owner with a clean checkout becomes `abandoned`.
Uncommitted or ambiguous state becomes `quarantined`. A living owner remains
active.

States:

- `starting`
- `active`
- `sealed`
- `quarantined`
- `abandoned`

These local manifests are disposable coordination observations. Git owns source
and commits; AgentCoord owns cross-host claims; weekly focus owns current
priority metadata; Manager owns supervised mission, initiative, and campaign
truth.

## Agent Start

`agent-start` defaults to write-mode visibility:

```bash
agent-start --root . --goal W31-EXAMPLE
agent-start --root . --mode read
```

The full packet shows weekly goal definitions of done, required milestones,
declared execution bindings, actual origin, preflight result, and active or
quarantined run state. `--notice` stays silent when clean and surfaces focus,
origin, uncommitted-work, collision, or quarantine failures for launch wrappers.

Manager may later validate that an opaque execution ID exists and belongs to
the selected repository. That integration is outside this version.
