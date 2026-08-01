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

`week_ending` remains current through that complete calendar date in
`America/Los_Angeles`. On the next Los Angeles calendar date, validation and
list output mark the registry `EXPIRED`, goal resolution fails closed, and a
goal-based workspace begin is refused. Structurally valid emergency exceptions
remain available after expiry so urgent incidents are not forced to masquerade
as weekly goals.

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

Every result reports the actual `origin` fetch URL and every effective
`origin` push URL. `canonical_remote` remains the machine-readable fetch URL
for v1 compatibility. Local directory names never establish repository
authority.

For write mode, preflight refuses:

- a detached current worktree;
- a primary checkout with uncommitted changes;
- another linked worktree with uncommitted or ambiguous changes and no living
  PID/start-token run owner;
- an explicit quarantine-registry match;
- missing or divergent canonical `origin/*` tracking state;
- an active overlapping AgentCoord writer;
- a living, stale, or quarantined local run collision;
- an `origin` fetch URL or any effective `origin` push URL under
  `github.com/ucla-tdg/*`, which is a read-only mirror namespace.

`github.com/kehle-tdg-dev/*` is the TDG development namespace. AgentCoord
relative scopes are interpreted only after the claim repository matches the
repository being checked. `agentcoord` and preflight share one claim validator.
Claims require at least one scope entry.
An unreadable or invalid claim blocks write preflight only when either its
parsed repository identity or its claim-directory identity matches the checked
repository. Mirror policy applies to parsed GitHub URL identity, including
standard URL forms with explicit ports. Quarantine entries use exact normalized
repository or absolute-path identity across the current and linked worktrees;
prefix siblings do not collide. Preflight only diagnoses. It never modifies a
remote or checkout.

Read mode does not block on repository write hazards, but still reports them
and sets `shouldSurface=true`. A directory inside a Git repository keeps these
rules. An existing directory outside Git starts a read-only operator session.
It grants no code-write authority. Missing paths and non-directories remain
refusals. No fake repository is made.

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

`begin` first requires a successful preflight. Repository sessions acquire a
short-lived entrance claim keyed by the canonical Git common directory.
Workspace sessions use a separate claim domain keyed by the exact resolved
workspace path. A workspace root and a child repository do not collide. The
command reruns preflight while holding the claim, then records `starting`
and atomically advances to `active` before releasing the entrance claim. The
claim carries PID/start-token ownership; a complete dead claim is reclaimed,
while an unreadable claim fails closed. The manifest records schema,
run ID, repository root and Git common directory, actual origin, goal or
exception, optional single execution reference, tool, PID/start token, host,
branch, starting HEAD, timestamp, state, exit code, ending HEAD, and any
quarantine reason. Goal and exception arguments are mutually exclusive.

New manifests use the `agent-workspace-run.v2` union with
`session_kind=repository|workspace`. Old v1 repository manifests remain
readable. Workspace records contain the exact resolved `workspace_root`, the
chosen goal, optional execution context, process and state fields. They state
`authority=operator` and `safety_class=read`. They omit all repository and Git
fields, including remotes, branch, and HEAD values.

Seal with the process exit code:

```bash
agent-workspace seal --run-id RUN_ID --exit-code 0
```

The launcher/controller process recorded by `begin` owns the run. The same
living controller must remain the parent of the later `seal`, or its PID may be
passed explicitly with `--pid`. Seal verifies the exact PID, process-start
token, and host. Another controller is refused. A dead owner must go through
`reconcile`, not `seal`. A readable checkout without uncommitted changes becomes
`sealed`. Uncommitted or ambiguous repository state becomes `quarantined`; no
cleanup is attempted. Workspace sessions seal from controller identity and exit
code only. They make no Git drift claim.

Resolve a quarantined observation only after the controller has exited and the
repository has been inspected:

```bash
agent-workspace resolve \
  --run-id RUN_ID \
  --reason "Repository inspected; intended changes committed."
```

Resolution requires a dead recorded owner, a readable clean repository, no
other living run for the same Git common directory, and a nonempty reason. It
atomically records terminal state `resolved`, `resolved_at`,
`resolution_reason`, `resolved_head`, and resolver PID/start-token/host while
preserving the original quarantine reason. It never deletes the manifest or
changes repository contents. Resolved runs no longer block preflight.

Reconcile dead owners explicitly:

```bash
agent-workspace reconcile
```

Every manifest is fully validated on every read. A relevant malformed,
unreadable, or ambiguous manifest fails closed in preflight and is reported by
reconciliation without being rewritten.

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
- `resolved`

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
the selected repository. Its future launcher wrapper must remain alive as the
controller across `begin`, child-agent execution, and `seal`; it must not invoke
begin and seal from unrelated short-lived processes. That integration is
outside this version.
