---
summary: "Weekly-focus resolution, fail-closed repository preflight, and atomic local workspace-run manifests for coding-agent launches."
read_when:
  - Starting write-capable Codex or Claude work in a repository.
  - Validating or resolving the weekly-focus registry.
  - Diagnosing a refused repository launch, abandoned run, or quarantined run.
  - Integrating a launcher with shared agent-scripts launch-safety primitives.
---

# Launch Safety And Weekly Focus

The launch-safety tools provide three local CLI surfaces:

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
schema: agentcoord-weekly-focus.v2
week_ending: 2026-08-09
goals:
  - id: W32-EXAMPLE
    done: The gradeable weekly outcome.
    required_milestone: The minimum enabling milestone.
    fallback: The bounded fallback when the milestone is unavailable.
    supervised_execution:
      required: true
    active_execution_ref:
      kind: mission
      id: opaque-active-id
    proof_execution_refs:
      - kind: mission
        id: opaque-proof-id
not_this_week:
  - Explicit non-goal
```

Version 2 has three goal fields for supervised work:

- `supervised_execution.required` is a Boolean. It says whether write-capable
  repository work needs an open active execution. When the object is absent,
  the value defaults to `false`.
- `active_execution_ref` is optional and singular. It names the one open
  execution allowed to support current work.
- `proof_execution_refs` is an optional list. It names finished work used as
  evidence. Proof does not grant write authority.

Each reference has a `kind` of `mission`, `initiative`, or `campaign`, plus an
opaque `id`. The tools check only its shape. They do not infer status from the
ID or contact Manager.

Files without `schema` use the old format. Its optional `execution_refs` list
remains readable for display and migration. One file cannot mix old and new
fields. The validator also refuses unknown or duplicate fields, duplicate proof
references, the same reference in active and proof roles, malformed lists, and
missing or invalid IDs.

The Manager supervised coding control plane remains authoritative for
existence, repository compatibility, status, descendants, budgets, and
evidence. Weekly focus carries priority metadata above that hierarchy. It does
not add an execution layer.

`week_ending` remains current through that complete calendar date in
`America/Los_Angeles`. On the next Los Angeles calendar date, validation and
list output mark the registry `EXPIRED`. Routine delegated-helper workspace
begins may continue with a warning when the selected goal has no supervised
execution requirement or execution reference. Mission, initiative, and
campaign work still fails closed. Structurally valid emergency exceptions
remain available to this primitive after expiry; the higher-level Manager
launcher may apply a narrower exception policy.

Commands:

```bash
agent-focus validate
agent-focus list
agent-focus resolve W32-EXAMPLE
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
file, unsupported execution kind, missing execution ID, or mixed format is
refused. The command never creates or repairs the weekly file.

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

- any existing non-Git directory, because repository write checks are unavailable;
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
and sets `shouldSurface=true`. The default session kind is `repository`, so a
non-Git root normally refuses in both modes. `agent-start` recognizes the
caller's exact `~/Projects` directory as the normal cross-repository workspace
without requiring another flag. It uses read safety for that workspace root
and leaves Git status and validation to the child repository being changed.
Other operator admission is explicit through `agent-workspace begin
--session-kind workspace` or `agent-start --session-kind workspace`. Workspace
paths always use read safety and grant no code-write authority. Missing paths
and non-directories remain refusals. No fake repository is made.

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
  --goal W32-EXAMPLE \
  --tool codex \
  --pid "$$"
```

An operator session for an existing non-Git directory must be requested:

```bash
agent-workspace begin \
  --session-kind workspace \
  --root /path/to/workspace \
  --goal W32-EXAMPLE \
  --tool codex \
  --pid "$$"
```

Without `--session-kind workspace`, `begin` keeps repository behavior and
refuses a non-Git root. Workspace admission runs read preflight. It never runs
write preflight against the operator directory.

An optional supervised-execution binding is syntactically validated but not
looked up or mutated:

```bash
agent-workspace begin \
  --root /path/to/repo \
  --goal W32-EXAMPLE \
  --execution-kind mission \
  --execution-id opaque-existing-id \
  --tool codex \
  --pid "$$"
```

`begin` first requires a successful preflight. Repository sessions acquire a
short-lived entrance claim keyed by the canonical Git common directory.
Explicit workspace sessions use a separate claim domain keyed by the exact resolved
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
agent-start --root . --goal W32-EXAMPLE
agent-start --root . --mode read
```

The full packet shows weekly goal definitions of done, required milestones,
supervision requirements, active bindings, proof references, actual origin,
preflight result, and active or quarantined run state. It labels old references,
active work, and proof separately. `--notice` stays silent when clean and
surfaces focus, origin, uncommitted-work, collision, or quarantine failures for
launch wrappers.

Manager may later validate that an opaque execution ID exists and belongs to
the selected repository. Its future launcher wrapper must remain alive as the
controller across `begin`, child-agent execution, and `seal`; it must not invoke
begin and seal from unrelated short-lived processes. That integration is
outside this version.

## Manager Mission Operator

The `manager-mission-operator` skill uses the local `manager-mission` command
as its primary path. It does not need native MCP tool discovery. The four
operator commands are `preflight`, `start`, `check`, and `watch`. If
`manager-mission` is not installed, the skill reports that fact and stops. It
does not use the old plugin bridge or raw MCP JSON as a fallback.

Start is a write action. The skill requires Joel's approved exact mission
contract before start. It runs preflight first and sends the same contract to
start. It never sends a second start after Manager accepted the request, after
an unclear reply, or after a transport error without a clear refusal. A clear
Manager refusal may be corrected and submitted again when the corrected
contract still has Joel's approval.

After start succeeds, the skill reads `data.mission_id` and immediately runs
watch for that exact ID. Watch polls every 10 seconds, follows the Manager
deadline plus two minutes, and prints a heartbeat every minute. It succeeds
only when the terminal result is `ready_for_joel`. It stops at any other
terminal result or at the CLI timeout.
