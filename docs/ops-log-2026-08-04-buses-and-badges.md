# Ops log 2026-08-04: two buses, expiring badges

Written by Claude at the end of remediation day one. Plain language on purpose.

## The bus map (as it actually is tonight)

- **Pinakes** is the bus software (our own, repo `shared/pinakes`).
- There are **two separate buses**, split by business scope, and both brains run on **keystone**:
  - **JK bus** (personal scope): primary `keystone-pinakes-jk-bus`, reachable on beelink at
    `http://localhost:8081` through a relay container. Used by: notify-joel (macmini), managerd
    terminal notifications.
  - **UCLA bus** (work scope): primary `keystone-pinakes-ucla-bus`, reachable on beelink at
    `http://localhost:8080` through a socat relay. Used by: the UCLA TDG agents, including
    `ucla-tdg-project-manager` (the tracker).
- The bus is a **shared service, not per-developer**. One instance per scope serves every agent
  and every machine. There is **no dev/stage/prod separation**: the "staging" UCLA stack on
  beelink and Joel's real day-job tracker traffic share the same bus. The long-discussed bus
  merge never happened; merging and environment separation are the same design decision and
  should be decided together.

## What broke tonight (one disease, three patients)

Agents register on a bus with a lease ("badge"). The fleet treats registration as a one-time
event; nothing renews badges or screams when they lapse. Tonight:

1. **managerd** (JK bus): badge lapsed hours after a "7-day" registration; two mission texts to
   Joel died with 401. The WO-1b auto-re-register fix did not fire because the bus has two
   different 401 messages and the code matches only one.
2. **ucla-tdg-project-manager** (UCLA bus): badge lapsed; it was failing its own deadline-alert
   dispatches with 401s, silently. Joel's tracker alerts were dead for an unknown period. Its
   registered health URL is also malformed (trailing "/health}").
3. The new `pm_create_project` connector tool was additionally pointed at the wrong bus
   (8081 instead of 8080) by Claude — fixed in config, takes effect at next managerd restart.

## Fixes applied tonight (temporary vs real)

- Temporary: cron on beelink re-registers managerd hourly (`~/.local/bin/reregister-managerd`).
- Temporary: PM container restarted to force fresh registration.
- Config: `CLAUDE_PROJECTS_MCP_PM_BUS_URL` now points at the UCLA bus (applies at next restart).
- Real fixes queued: WO-1e (re-register on ANY 401, hard timeouts, heartbeat log), a new
  ip-agents issue for the PM lease renewal + malformed health URL, and the standing proposal:
  **one bus, self-renewing badges, loud lease expiry** — for Joel to rank.

## Where the fuller record lives

Plan + assessment: `~/Projects/tmp/harness-remediation-plan-2026-08-03.md` and
`harness-assessment-2026-08-03.md` (both machines). Docs site: http://beelink:8300.
