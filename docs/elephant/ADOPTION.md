---
summary: "How repositories adopt the shared Elephant implementation while keeping contracts and proof local."
read_when:
  - "Installing Elephant in a repository."
  - "Moving an existing repo-local Elephant implementation to shared ownership."
  - "Reviewing Elephant file placement or lifecycle."
---

# Elephant adoption

## Shared implementation

Canonical reusable files:

- `~/Projects/shared/agent-scripts/lib/elephant/elephant_resume.py`
- `~/Projects/shared/agent-scripts/lib/elephant/elephant_contract.py`
- `~/Projects/shared/agent-scripts/lib/elephant/elephant_traceability.py`
- `~/Projects/shared/agent-scripts/tests/elephant/test_elephant_resume.py`
- `elephant-resume` and `elephant-traceability` on the shared `bin/` path

The shared source is authoritative. Do not fork substantive hook logic into an
adopting repository.

## Repo-local contract

An adopting repo keeps:

```text
.codex/
  elephant-active.json
  hooks.json
  hooks/
    elephant_resume.py          # optional compatibility shim
    elephant_traceability.py    # optional compatibility shim
docs/
  ELEPHANT_CHECK.md             # short repo-specific router
  elephant-checks/
    <receipt>.md
    <receipt>.traceability.json
    <proof>.md
```

The active marker and receipts must stay in the worktree they govern. Disposable
session projections stay outside Git under
`~/.codex/hook-state/elephant-resume/`.

## Runtime entrypoint

Preferred hook command on Joel's managed machines:

```json
{
  "type": "command",
  "command": "elephant-resume hook",
  "timeout": 5
}
```

A compatibility shim may execute the shared script when a trusted Codex process
already loaded a repo-local hook command. Keep shims mechanical; no policy or
validation logic belongs in them.

## Activation lifecycle

1. Run the semantic check and commit its receipt.
2. Create the project traceability map and tracked active marker.
3. Start or resume a fresh trusted Codex process after installing hook
   definitions.
4. Let startup create the disposable session capsule.
5. After an intentional receipt or traceability edit, explicitly refresh that
   session before its next compaction:

   ```bash
   elephant-resume status --session-id <thread-id>
   elephant-resume refresh --session-id <thread-id> --accept-current-contract
   elephant-resume status --session-id <thread-id>
   ```

   Never refresh an unexpected change merely to clear a stop.
6. Run structure-only validation during implementation.
7. Run strict traceability and semantic review before completion.
8. Commit `active: false`, then clear the disposable projection.

See `RECOVERY.md` when step 5 was missed and PreCompact is already stopping.

## Lifecycle verification

Codex supplies the parent `session_id` to `SubagentStart`. The shared regression
uses the documented payload fields and proves that the child receives the same
validated capsule as the parent. After installing or changing a project hook,
also review it in `/hooks` and run one fresh parent -> subagent smoke; an
already-running process does not retroactively load or trust changed hook code.
Use a normal persisted Codex thread for that proof: current
`codex exec --ephemeral` sessions cannot start native collaborators. See
`LIVE_PROOF.md` for the isolated end-to-end evidence.

## Portability

Elephant is currently Joel-workspace infrastructure: the shared
`agent-scripts` checkout is a machine prerequisite. A repository intended to
run outside that workspace needs an explicit vendoring or packaging decision;
do not silently duplicate the implementation.
