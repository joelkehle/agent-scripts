# Issue #25: time-limited delegated authority — design sketch

This page is a design sketch for the authority grant described in manager issue #25 ("Add time-limited delegated authority for supervised coding"). It is a sketch, not a contract. Joel ratifies this shape before any mission builds it. Source of truth: `~/Projects/tmp/issue-25-design-sketch.md` (laptop, not a repo).

**Summary.** Today Joel approves work one step at a time. On 2026-08-04 he typed "merge" seven times in one day. A grant lets Joel approve one safe box of work once: which repos, which paths, which verbs, how much budget, and when it expires. The conductor then checks every action against the box instead of asking Joel. Every use is journaled and reported. Anything outside the box stops and returns to Joel. Merge to main, deploy, and money can never go in the box.

---

## 1. The grant object: `delegated-authority.v1`

One grant is one JSON document. It is the whole box — nothing outside it is allowed. Field sketch:

```json
{
  "schema": "delegated-authority.v1",
  "grant_id": "grant-2026-08-04-remediation",
  "grantor": "joel",
  "approval_evidence": {
    "channel": "terminal",
    "quote": "yes — grant approved as printed",
    "approved_at": "2026-08-04T08:00:00-07:00",
    "content_sha256": "<sha256 of this document with this field zeroed>"
  },
  "weekly_goal_id": "wg-2026-w32-harness-remediation",
  "scope": {
    "repos": ["joelkehle/manager", "joelkehle/agent-scripts", "kehle-tdg-dev/ip-agents"],
    "path_prefixes": {
      "joelkehle/manager": ["internal/", "cmd/", "docs/"],
      "joelkehle/agent-scripts": ["docs/", "bin/"],
      "kehle-tdg-dev/ip-agents": ["internal/", ".github/workflows/"]
    },
    "work_levels": ["mission", "initiative"]
  },
  "allowed_verbs": ["edit", "test", "commit", "push_branch", "open_pr", "delegated_ratify"],
  "forbidden_verbs": ["merge_main", "deploy", "install", "restart", "spend", "external_publish", "credential_change"],
  "identities": {
    "contributors": ["codex-contributor"],
    "reviewers": ["claude-reviewer"],
    "independent_review_required": true
  },
  "budgets": {
    "max_missions": 10,
    "max_repair_cycles_per_mission": 3,
    "max_open_prs": 6,
    "model_spend_ceiling_usd": 40
  },
  "not_before": "2026-08-04T08:00:00-07:00",
  "expires_at": "2026-08-04T20:00:00-07:00",
  "on_exhaustion": "stop_and_notify_joel"
}
```

Notes on the shape:

- **Verbs are named, exact, and closed.** A verb not listed is forbidden. `forbidden_verbs` is redundant on purpose — listing the dangerous ones twice makes a drafting mistake visible.
- **Budgets are ceilings the conductor decrements**, not suggestions. Hitting any ceiling behaves like expiry: stop, notify-joel.
- The grant **copies no live state** — no issue text, no git facts, no secrets — exactly as issue #25 requires. It points at them by id.
- `delegated_ratify` is the verb that powers the `delegated-ratification.v1` receipt from the issue: the conductor may accept a contract revision without Joel **only** when the revised contract still fits this grant byte-for-byte on repos, paths, verbs, identities, and budgets, and an independent review passed. A revision that grows anything returns to Joel.

## 2. Storage and tamper protection (mirroring packet sealing)

Grants get the exact treatment ready packets already get in `manager/internal/projectsmcp/agent_mission_ready.go`. The conventions to copy, with citations:

- **Immutable write via hard link.** `writeReadyPacket` (`agent_mission_ready.go:804`) writes a temp file (`CreateTemp` + `Chmod(0600)` + `Write` + `Sync`), then `os.Link(tempPath, target)` — the link fails if the file already exists, so a grant can never be overwritten, only created (`agent_mission_ready.go:825-852`). Same for grants: `~/.local/state/managerd/grants/<grant_id>.json`.
- **A separate seal marker with the content hash.** `writeReadyPacketMarker` (`agent_mission_ready.go:855`) stores `{schema: "ready-packet-generation.v1", packet_sha256}` beside the packet, itself immutable. Grants get `grant-seal.v1` with `grant_sha256`. A grant whose bytes do not hash to its marker is invalid — fail closed.
- **Paranoid reads.** `readSecureReadyPacket` (`agent_mission_ready.go:899`) opens with `O_NOFOLLOW`, requires a regular file, requires permissions exactly `0600`, and enforces a size cap. `loadAgentMissionReadyPacket` (`agent_mission_ready.go:169`) decodes with `DisallowUnknownFields` and rejects trailing JSON. Grants use the same loader shape.
- **Hash equals approval.** The grant's `content_sha256` must match the hash Joel approved (acceptance criterion 2 of the issue). The conductor recomputes it on every load, the same way `readReadyPacketMarker` recomputes `readyPacketSHA256` on every verification (`agent_mission_ready.go:1032-1056`).
- **Revocation is a second immutable record**, `grant-revocation.v1`, naming the grant id and hash, written with the same temp+link+marker dance. Grants are never edited; revocation is a new fact beside them. If the revocation directory is unreadable, the conductor treats every grant as revoked — fail closed.

## 3. How the conductor consults a grant

One function, called at every action boundary the issue lists (launcher, workspace entry, mission/initiative/campaign start, commit and push helpers, install/restart helpers, guarded GitHub writes):

1. Load grant + seal marker; verify hash; verify not revoked.
2. Check the clock: `not_before <= now < expires_at`.
3. Check the box: repo in `scope.repos`; every touched path under a listed prefix (the conductor already enforces exact path scopes per mission — same rule, one level up); the verb named in `allowed_verbs`; work level allowed; contributor and reviewer identities listed and different.
4. Check budgets: decrement-and-check atomically in the journal.
5. **Fits** → act, journal the use (section 4), skip the per-step ask to Joel.
6. **Does not fit** → do not act. Journal the refusal, stop the mission at that boundary, notify-joel with the exact reason ("verb `install` not in grant `grant-2026-08-04-remediation`"). Nothing waits silently — the standing rule from the remediation plan applies: bounded wait, then a human-visible signal.

A mission record alone still grants nothing (issue non-goal). The grant is the only source of standing authority, managerd is its only owner, and the bus and MCP remain transports.

## 4. Journaling and reporting to Joel

- **Every consult is journaled** — allows and refusals both — to an append-only `grants/<grant_id>.journal.jsonl`: timestamp, mission id, run id, verb, decision, budget remaining after. Append-only JSONL matches how run audits already work (`<run-id>.audit.jsonl`, referenced in packets at `agent_mission_ready.go:733`).
- **Every packet names its grant.** The packet's authority section (`agentMissionReadyAuthority`, `agent_mission_ready.go:117`) grows three fields: `grant_id`, `grant_sha256`, `verbs_used`. Joel can judge any packet against the box it ran in without visiting the workshop.
- **Reporting cadence:** immediate notify-joel on any refusal, revocation, expiry, or budget exhaustion; one digest text when the grant expires ("grant X: 7 missions, 6 PRs opened, $23 spend, 0 refusals"). The final campaign packet lists every used action (issue acceptance criterion 15).

## 5. Revocation

`manager-grant revoke <grant_id> --reason "..."` writes the `grant-revocation.v1` record. Effect is immediate at the next boundary: running children finish their current run, then the next consult refuses. The conductor confirms by notify-joel. Restart safety comes free: grants, revocations, and journals are durable files, so a managerd restart preserves the whole chain (acceptance criterion 13).

## 6. Ungrantable forever

These verbs can never appear in `allowed_verbs`. Grant validation rejects any grant that names them, at creation and again at every load. This is the same list as the keep-blocking gates in `hitl-audit-2026-08.md` — the two documents must stay aligned:

1. **`merge_main`** — merge to main or any default branch. Joel's final merge decision stays his (issue "Keep" list).
2. **`deploy`** — anything that changes what runs in production, including install and restart of live services.
3. **`spend`** — money, beyond the pre-priced model-usage ceiling stated inside the grant itself. No new spend authority, ever.
4. **`external_publish`** — anything leaving the machines under Joel's name: emails, DNS, public posts, GitHub merge/APPROVE events.
5. **`credential_change`** — creating or widening grants, keys, tokens, sudoers, or identities. No grant can mint authority (issue non-goal: "No agent may create or expand its own grant").
6. **`destructive_data`** — deleting or migrating data outside the mission workspace.

## 7. Worked example: the grant that would have covered 2026-08-04

What actually happened on remediation day: seven times, work finished and waited until Joel typed "merge" — WO-1 (notification), WO-1a, WO-1b (bus self-registration), WO-3 (parser removal), WO-6a (subagent doc), WO-2a (publisher core), and issue #26. Each wait was an interrupt in Joel's day; several also needed him to approve small contract revisions between attempts (WO-3 took three attempts over scope syntax alone).

The single grant replacing that supervision load is the JSON in section 1. Under it, the day runs like this:

- **08:00 — one yes.** Joel reads the printed grant, replies "yes — grant approved as printed." Hash sealed. That is his last required interaction until evening.
- **All day.** The conductor runs the missions. Contract repairs inside the box (like WO-3's scope-syntax fixes) get `delegated-ratification.v1` receipts after independent review — no Joel. Finished candidates are pushed as branches and opened as PRs under `push_branch` + `open_pr`. Budget counts down in the journal. His phone gets ✅ texts, not questions.
- **Evening — one sitting.** Seven PRs wait with sealed packets, each naming the grant hash and verbs used. Joel merges them in one batch session, because `merge_main` was never in the box and never will be.

Honest accounting: the grant does not remove any of Joel's seven merge decisions — merge is ungrantable. It removes the seven *waits* between missions, the contract-revision approvals, and the message-carrying. Seven scattered interrupts become one morning yes and one evening merge session. What it deliberately does **not** cover from that day: deploys and managerd restarts (those crash-looped once and stay ops-by-hand), the GHCR org-permission fix (credential change), and closing issues under Joel's name (external publication).

## 8. Open questions for Joel before any contract

1. Grant creation UX: printed JSON in the terminal with a typed yes (as sketched), or a `manager-grant create` wizard?
2. Should `open_pr` be in the first grant, or should the first grant stop at `push_branch` until the WO-2 publisher has more live mileage?
3. Ceiling defaults: is 12 hours the right maximum expiry, and should the schema refuse anything longer?
4. Sequencing (from the issue): this waits for the execution-reference repair to finish, and #4's no-push isolation should land first so "the box holds even against a misbehaving worker" is true at the OS level, not just at the policy level.
