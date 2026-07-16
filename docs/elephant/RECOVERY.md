---
summary: "Elephant stopped-session recovery, July 2026 incident findings, and prioritized hardening backlog."
read_when:
  - "Elephant reports a changed marker, receipt, or traceability map."
  - "A Codex session repeatedly stops during PreCompact or SessionStart."
  - "Hardening Elephant recovery behavior or tests."
---

# Elephant recovery

## Safety rule

Elephant fails closed when its saved capsule no longer matches the active
marker, receipt, or traceability map. Do not blindly refresh. First establish
whether the change was intentional and belongs to the same worktree and task.

Automatic acceptance of changed contract state would defeat the guardrail.
Recovery must remain explicit.

## Stuck full-context session

Typical symptom:

```text
PreCompact hook (stopped)
Elephant resume blocked: Elephant traceability map changed after capsule creation
```

A full-context session cannot invoke the repair itself because every submitted
turn attempts compaction first. Recover from a second shell or supervising
Codex:

1. Identify the exact YOLO/Codex thread id and worktree.
2. Inspect `.codex/elephant-active.json`, the named receipt, the traceability
   diff, and the session projection under
   `~/.codex/hook-state/elephant-resume/`.
3. Confirm the change was intentional and the receipt still authorizes it.
4. From the governed repo root, refresh only that thread:

```bash
CODEX_THREAD_ID=<thread-id> elephant-resume activate \
  --receipt docs/elephant-checks/<receipt>.md
CODEX_THREAD_ID=<thread-id> elephant-resume show
```

5. Resubmit the interrupted turn.
6. Verify that compaction completes and SessionStart injects a validated capsule.

If the marker or receipt changed unexpectedly, stop and reconcile the tracked
contract instead of running activation.

## July 2026 incident

The first NOUS walkthrough session updated its traceability map from 0/10 to
9/10, then reached compaction before refreshing the capsule. Elephant correctly
detected stale context and preserved the worktree, but repeated user messages
could not reach the model. Recovery required an external thread-scoped
activation.

What worked:

- fail-closed detection;
- deterministic receipt and traceability hashes;
- no transcript dependency and no lost work;
- successful explicit refresh followed by compaction and SessionStart restore.

What failed:

- the stop response was not actionable;
- the documented refresh assumed the current session could still run a command;
- no test covered intentional change, explicit refresh, then successful resume;
- a live fresh-context verifier did not receive the parent's validated capsule,
  despite the isolated parent/subagent propagation test passing;
- `EC` was used without an explicit expansion.

## Improvement backlog

### P0

- Add a first-class external `refresh --session-id <id>` command or equivalent
  safe interface.
- Include the governed receipt and a copyable recovery command in changed-map
  stop output.
- Keep a regression test for changed traceability -> block -> explicit refresh
  -> successful SessionStart/PreCompact.
- Capture the real Codex `SubagentStart` payload and add a live-shape regression
  for parent capsule propagation; isolated synthetic payload coverage is not
  sufficient.

### P1

- Show stored versus current traceability summaries in diagnostics without
  dumping internal paths or unrelated state.
- Require an explicit capsule refresh immediately after intentional receipt or
  traceability edits.
- Add a short known-issues entry whenever an Elephant failure needs out-of-band
  recovery.

### P2

- Evaluate packaging for repositories outside Joel's managed workspace.
- Add a small status command that reports active receipt, EC pass count, and
  whether the current session capsule is fresh.
