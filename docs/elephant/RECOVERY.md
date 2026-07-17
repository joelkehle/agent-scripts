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
4. From the governed repo root, inspect the current contract against that
   thread's stored capsule:

```bash
elephant-resume status --session-id <thread-id>
```

5. Only after confirming that the marker, receipt, and traceability changes are
   intentional, refresh that exact thread and verify freshness:

```bash
elephant-resume refresh --session-id <thread-id> --accept-current-contract
elephant-resume status --session-id <thread-id>
```

6. Resubmit the interrupted turn.
7. Verify that compaction completes and SessionStart injects a validated capsule.

If the marker or receipt changed unexpectedly, stop and reconcile the tracked
contract instead of running refresh. The acceptance flag is deliberately
required; it requires an explicit operator decision instead of automatic trust.

Changed-contract hook warnings now include the stored receipt plus copyable
thread-scoped `status` and `refresh` commands. The stop reason stays concise so
Codex can still classify the failure deterministically.

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

## Hardened after the incident

- Added first-class external `refresh --session-id` with mandatory
  `--accept-current-contract`.
- Added actionable changed-contract warnings with the stored receipt and exact
  recovery commands.
- Added `status --session-id`, including stored versus current EC pass counts
  and a `fresh`, `stale`, or `missing` capsule result.
- Added regression coverage for changed traceability -> PreCompact block ->
  explicit external refresh -> successful compact SessionStart.
- Added a regression using the documented Codex `SubagentStart` wire shape:
  parent `session_id`, `turn_id`, `agent_id`, `agent_type`, model, permission
  mode, nullable transcript path, and worktree.
- Split receipt parsing/rendering into `elephant_contract.py` so the runtime
  entrypoint remains below the shared file-size guideline.
- Missing pass-proof files now report the affected `EC-n.proof` field and the
  required `<repo-relative-file>::<optional note>` form instead of exposing a
  raw operating-system path exception during compaction.

## Live lifecycle proof

An isolated fresh Codex parent -> subagent proof passed on 2026-07-16. The real
`SubagentStart` payload used the parent session id, the shared hook returned the
validated capsule, and the tool-free child reported the capsule-only token.
See `LIVE_PROOF.md` for evidence and the `codex exec --ephemeral` caveat.

## Remaining backlog

### P1

- Add a short known-issues entry whenever an Elephant failure needs out-of-band
  recovery.

### P2

- Evaluate packaging for repositories outside Joel's managed workspace.
