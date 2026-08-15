---
summary: "The L0–L5 stack-priority model: how to layer-tag issues and pick the next piece of work so Joel's paid output beats infrastructure weeds."
read_when:
  - Picking the next issue to work on, planning an overnight run, or triaging a backlog.
  - Filing a new issue (it needs a layer:* label).
  - An infra task is tempting and you need to decide if it jumps the queue.
---

# Stack Priority: Higher Layers Win

Adopted by Joel on 2026-08-15. The problem it solves: infrastructure work is
tractable and self-generating, so it crowds out the work Joel gets paid for.
This model biases every "what next?" decision toward the top of the stack.

## The stack

Every issue gets exactly one `layer:*` label. The test for the top of the
stack is "does someone pay for this output" — not where the code sits.

| Label | Layer | What lives here |
|---|---|---|
| `layer:L5` | Deliverables | Paid client output: UCLA TDG tech-transfer work, IP Agency work. Closing it directly produces or protects client-facing work product. |
| `layer:L4` | Applications | Tools that do Joel's work: email triage, mail-mirror, briefings, dashboards. Still tooling — not deliverables. |
| `layer:L3` | Agents | Claude/Codex harness, manager missions, agent-scripts, orchestration. |
| `layer:L2` | Platform | Buses, databases, deploys, watchers, monitoring, backups. |
| `layer:L1` | Network & access | Cloudflare, tunnels, Access, DNS, secrets, auth. |
| `layer:L0` | Metal & OS | Machines, VMs, operating systems, disks. |

`priority:P0`–`priority:P3` labels exist in every repo for urgency within a
layer. Layer and priority are separate dimensions; never encode one in the
other.

## The rule

1. **Higher layer wins by default.** An open L5 issue beats any L4 issue,
   and so on down.
2. **The only exception is a current blocker.** A lower-layer issue jumps
   the queue only when it *currently blocks* a specific, named piece of
   higher-layer work. "Could be cleaner," "should be hardened," and "will
   bite us someday" never jump. If an infra issue cannot name what it
   blocks today, it waits.
3. **Watch the L4/L5 line.** Polishing a tool feels like top-of-stack work.
   It is not. Only L5 is the job.

## Standing queries

```
is:open label:"layer:L5"                      # the real work
is:open label:"layer:L4"                      # tooling
is:open label:"layer:L3" label:"priority:P0"  # harness fires only
```

## Known gap

As of 2026-08-15, Joel's paid work mostly does not live in GitHub issues at
all — it lives in email, dockets, and memory. Until L5 work is represented
in the tracker, "pick from the top" finds an empty shelf. When you notice
live L5 work with no issue, say so; whether to file placeholder L5 issues
is an open decision of Joel's, not yours to make unilaterally.

## Discipline

This model is itself L2/L3 tooling. Keep it minimal: one layer label, one
priority label, sorted picks. Do not build scoring engines, dashboards, or
automation on top of it without Joel asking.
