---
summary: "Dev-owned source writes plus optional NAS handoffs for Codex and Claude Code across dev, beelink, and macmini."
read_when:
  - Coordinating Codex or Claude Code sessions across dev, beelink, and macmini.
  - Starting overlapping work where multiple coding agents may edit the same project.
  - Handing off work, proof packs, or patches through the Synology shared storage layer.
  - Hardening shared coding-agent coordination rules.
---

# Shared Agent Coordination

Dev is the only source-writing host for Codex and Claude Code build agents.
Beelink and Mac Mini are remote check targets. AgentCoord is an optional
cross-host handoff layer.

It is not the Pinakes bus. Pinakes agents are runtime/product services. This
layer carries old claims, handoffs, patches, proof artifacts, and lightweight
logs. It is not a source-write authority service.

## Control Plane Model

Default architecture:

```text
Codex / Claude Code runs on dev
  -> edits and tests projects on dev
  -> uses agent-ssh macmini 'cd ~/Projects/<repo> && ...' for macOS-specific work
  -> may store handoffs, patches, and proof packs in AgentCoord when writable
  -> commits in the repo where the work actually lives
```

`agent-ssh` uses Joel's normal SSH identity for interactive helper work. A
separate Unix account is only for a named service or untrusted workload whose
runbook requires one.

Prefer launching coding agents from Dev. Use Mac Mini as a remote execution target from Dev for macOS-only repos and workflows: launchd, TCC/GUI-adjacent checks, Photos, Voice Memos, Keychain, Apple app automation, and hardware-local probes.

Do not start an independent source-writing Codex or Claude Code session on Mac
Mini or Beelink. A host-local helper may run checks that Dev cannot run, but it
must return findings to the Dev session. Source changes happen on Dev. If that
model cannot support a real task, stop the pilot and move to a small
coordination service; do not add a bypass flag.

## Service Identity

- Service name: `AgentCoord`
- Backing storage: Synology `Share1`
- NAS export: `192.168.88.2:/volume1/Share1`
- Shared directory: `AgentCoord/`
- Canonical path on Dev, Beelink, and Mac Mini: `/mnt/synology-share1/AgentCoord`
- macmini implements `/mnt` with `/etc/synthetic.d/joelkehle-mnt`; do not use `/Volumes/...` for this service.
- Ops doc: `~/Projects/shared/manager/docs/services/agent-coordination-share.md`

## Use It For

- Reading old cross-host task claims during the pilot.
- Handoffs between Codex and Claude Code sessions.
- Patch transfer when Git branch/push state is blocked.
- Proof packs meant for another host to inspect.
- Small logs, command transcripts, and status snapshots.
- Registry files that describe active conventions.

## Do Not Use It For

- Live repo working trees.
- `.git` directories.
- `node_modules`, build artifacts, virtualenvs, package caches, or database files.
- Lock-heavy coordination databases.
- Secrets, tokens, private keys, raw email bodies, or sensitive source data without explicit approval.

Git remains source of truth for source code. Local disks remain source of truth for active builds.

## Before Resuming A Stale Branch

Claims stop two agents editing the same tree at the same time. They do not stop
one lane from building on ground another lane later renamed, deleted, or
reinvented under a different name. That damage shows up weeks later, when the
branch is finally landed.

Run `branch-collision` before investing in any branch whose base has moved:

```bash
git -C <repo> fetch origin
branch-collision <branch> --base origin/main --repo <repo>
```

Act on the verdict:

- `REDUNDANT` - the work already landed under a different hash. Drop the branch;
  do not re-land it. Confirm with the `redundancy` list before deleting.
- `STRUCTURAL COLLISION` - base deleted or renamed files the branch builds on.
  This is a port onto the new location, not a merge, and usually needs a product
  decision first about whether the branch's goal is still live.
- `DIVERGENT REFACTOR` - both sides named the same ground differently. Mergeable,
  but budget for hand-unioning interfaces, fakes, and tests.
- `CONFLICTS` / `CLEAN` - ordinary drift.

A clean verdict is not a safety guarantee. The probe cannot see a policy gate one
side added that the other side's output violates, a behaviour change behind an
unchanged signature, or a base-side fix the branch silently reverts. Read the
diff of anything the probe flags as co-edited, and re-run the owning repo's gate
after resolving.

## Directory Contract

```text
AgentCoord/
  README.md
  claims/
  handoffs/
  patches/
  proof-packs/
  logs/
  registry/
  tmp/
```

Use repo names as the first subdirectory when practical:

```text
claims/<repo>/<slug>.<agent>.<host>.json
handoffs/<repo>/<slug>-<YYYYMMDDThhmmssZ>.md
patches/<repo>/<slug>-<YYYYMMDDThhmmssZ>.patch
proof-packs/<repo>/<slug>-<YYYYMMDDThhmmssZ>/
logs/<repo>/<slug>-<YYYYMMDDThhmmssZ>.log
```

Use `agentcoord` for claim work instead of hand-writing JSON when possible.

See [AgentCoord CLI](agentcoord.md) for commands, flags, and examples.

Local launch/run ownership is the source-write gate. `workspace-preflight`
refuses source writes outside Dev, and `agent-workspace` records PID/start-token
ownership under `~/.local/state/agent-workspaces/`. In write mode, these tools
do not read AgentCoord. Read mode can still show old cross-host claims and
quarantine records. Local process entrance, exit, and dead-owner reconciliation
are documented in `docs/launch-safety.md`.

## Legacy Claim Contract

Do not create a NAS claim for normal source work during the Dev-owned pilot.
Do not overlap source-writing sessions in the same repository. Serialize them
on Dev and use local workspace run state. Existing claims remain readable for
transition checks. Claims are coordination hints, not permanent locks.

Example:

```json
{
  "repo": "shared/agent-scripts",
  "slug": "shared-agent-coordination",
  "agent": "codex",
  "host": "beelink",
  "safety": "write",
  "scope": ["AGENTS.MD", "docs/shared-agent-coordination.md"],
  "started_at": "2026-06-06T17:30:00Z",
  "expires_at": "2026-06-06T19:30:00Z",
  "next_action": "document AgentCoord and commit docs",
  "contact": "Joel Kehle <joel@kehle.com>"
}
```

Canonical schema: `docs/schemas/agentcoord-claim.schema.json`.

Safety values:

- `read`: discovery only.
- `propose`: drafts, plans, or recommendations.
- `write`: file edits, commits, mounts, labels, sends, deletes, or external-state changes.

For risky write actions, say `destructive write` in human-facing text.

## Legacy NAS Atomicity

NFS file locking is not the coordination primitive.

Preferred patterns:

- Create claim directories with `mkdir`, because mkdir is atomic on the mounted share.
- Write new files to `tmp/`, then rename into place.
- Include `expires_at` in every claim.
- Use ISO-8601 UTC timestamps with colons, for example `2026-06-28T06:50:58Z`.
- Treat stale claims as advisory: read the handoff/logs, then proceed or ask Joel if the scope is risky.

## Handoff Contract

Write a handoff before switching hosts, delegating work, pausing, or ending an interrupted multi-step task.

Include:

- Goal.
- Current state.
- Files changed.
- Commands run.
- Checks passed/failed.
- Open claims.
- Next action.
- Blockers.

Use `wwi` as the local continuity tool. Use `AgentCoord/handoffs/` when another host or another coding runtime should see the state.

## Patch Contract

Use patches only when Git is not the better transfer path.

```bash
git diff --binary > /mnt/synology-share1/AgentCoord/patches/<repo>/<slug>-$(date -u +%Y%m%dT%H%M%SZ).patch
```

Receiving agent:

```bash
git status --short
git apply --check <patch>
git apply <patch>
```

Do not apply a patch over unknown local edits without reading the diff and preserving other agents' work.

## Proof Packs

Use proof packs for user-visible work, UI/dashboard changes, live-data writes, or remote inspection.

Preferred beelink review viewer remains:

- filesystem: `~/Projects/shared/dev-dashboard/codex-output/`
- URL: `http://beelink:8091/codex-output/`

Use `AgentCoord/proof-packs/` for cross-host transfer or artifacts not intended for the dev-dashboard viewer.

## Verification

beelink:

```bash
findmnt -rn /mnt/synology-share1
ls -la /mnt/synology-share1/AgentCoord
```

macmini:

```bash
showmount -e 192.168.88.2
mount | grep '192.168.88.2:/volume1/Share1'
ls -la /mnt/synology-share1/AgentCoord
```

Network probes:

```bash
ping -c 3 192.168.88.2
nc -vz 192.168.88.2 111
nc -vz 192.168.88.2 2049
```
