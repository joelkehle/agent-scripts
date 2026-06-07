---
summary: "Shared NAS coordination contract for Codex and Claude Code build agents across beelink and macmini."
read_when:
  - Coordinating Codex or Claude Code sessions across beelink and macmini.
  - Starting overlapping work where multiple coding agents may edit the same project.
  - Handing off work, proof packs, or patches through the Synology shared storage layer.
---

# Shared Agent Coordination

This is the cross-host coordination layer for Codex and Claude Code build agents.

It is not the Pinakes bus. Pinakes agents are runtime/product services. This layer is for coding sessions coordinating claims, handoffs, patches, proof artifacts, and lightweight logs across beelink and macmini.

## Service Identity

- Service name: `AgentCoord`
- Backing storage: Synology `Share1`
- NAS export: `192.168.88.2:/volume1/Share1`
- Shared directory: `AgentCoord/`
- Canonical path on beelink and macmini: `/mnt/synology-share1/AgentCoord`
- macmini implements `/mnt` with `/etc/synthetic.d/joelkehle-mnt`; do not use `/Volumes/...` for this service.
- Ops doc: `~/Projects/shared/manager/docs/services/agent-coordination-share.md`

## Use It For

- Cross-host task claims.
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

## Claim Contract

Before overlapping write work, create a claim. Claims are coordination hints, not permanent locks.

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

Safety values:

- `read`: discovery only.
- `propose`: drafts, plans, or recommendations.
- `write`: file edits, commits, mounts, labels, sends, deletes, or external-state changes.

For risky write actions, say `destructive write` in human-facing text.

## Atomicity

NFS file locking is not the coordination primitive.

Preferred patterns:

- Create claim directories with `mkdir`, because mkdir is atomic on the mounted share.
- Write new files to `tmp/`, then rename into place.
- Include `expires_at` in every claim.
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
