---
summary: "Block hosted Gmail connectors in coding assistants while keeping ChatGPT and Claude web connected."
read_when:
  - Setting up Codex or Claude Code for Joel.
  - A coding assistant sees direct Gmail tools or the mail app cannot answer.
  - Changing vendor apps, local coding config, or mail access checks.
---

# Gmail access in coding assistants

Joel approved this boundary on 2026-09-10. ChatGPT and Claude **web** keep their
Gmail connectors. Do not disconnect those account-level apps or revoke OAuth.
Local Codex and Claude Code must use the approved mail app, not hosted Gmail
tools. This user-level block also covers coding sessions started at Projects
root, where TDG repo-only settings would not apply.

TDG reads use POSTMASTER through `gmail-query`, the approved read-only
mail-mirror projection, or registrar `mcp-read`. Missing agents, stale coverage,
or rate limits are reported as gaps. Never fall back to direct Gmail, a browser
mailbox, a direct API client, or a token fetched from the environment or
Infisical. Approved mail writes still require the existing authority and
POSTMASTER/MARSHAL path. A connector block does not grant write authority.

## Install and check

Python 3.11+ is required. Run from this repo:

```sh
python3 lib/gmail-boundary.py install
python3 lib/gmail-boundary.py check
```

Installation preserves other settings and saves private `*.before-gmail-boundary`
backups beside changed config files. It honors `CODEX_HOME` and
`CLAUDE_CONFIG_DIR`. Review existing conflicting Gmail settings rather than
overwriting them. Never commit home-directory settings or backups.

- Codex: set `[apps.connector_2128aebfecb84f64a069897515042a44] enabled = false`
  in its local config. The ID was read from the installed app inventory, not
  guessed from the tool name. Leave `features.apps` and other apps unchanged.
- Claude Code: add `mcp__claude_ai_Gmail__*` to `permissions.deny`, plus the
  matching `PreToolUse` command hook in its local settings. The hook blocks with
  exit 2. It logs only a timestamp and fixed event name under
  `$XDG_STATE_HOME/joel-agent/gmail-boundary.log` (default `~/.local/state`).
  Audit failure must not allow the call. It logs no arguments or email data.
- `agent-start` runs the offline config check and surfaces failures. That checks
  local files only; it does not prove the active session loaded those files.

These are coding-client controls, not an OS-wide network or credential fence.
Settings can be changed or overridden, and a renamed/new Gmail connector may
need another rule. Do not claim that arbitrary shell/API access is mechanically
blocked by these settings. The existing no-direct-API policy still applies.

## Verify at each assistant setup and after connector changes

1. Run the offline check. Missing config or hooks is a failure, not a pass.
2. Start a **fresh** coding runtime with the same account and working directory.
   Existing sessions may retain old tools; do not test them by calling Gmail.
3. Codex: initialize its app-server, then read `app/installed` with
   `forceRefresh: true`. This reads hosted tool metadata, not a mailbox. Gmail
   must be `enabled: false` and `callable: false`; Drive and Airtable must remain
   enabled and callable. Inspect actual model tool inventory too when available.
4. Claude Code: inspect its fresh tool inventory. No Gmail tool may be offered.
   Check that other connectors remain. Test the hook offline with fake
   `tool_name` input: Gmail must exit 2, Drive/Airtable must exit 0. Do **not**
   invoke any real Gmail action, even an intended-to-be-refused one.
5. Verify the approved mail app through its health endpoint. For mailbox
   coverage questions, use the approved mirror or app. An absent bus target
   must produce a gap; it must never trigger a connector fallback.
6. Record the client versions, config paths, results and any missing proof.
   Do not claim web Gmail was tested: preserving the web connector is shown by
   making no vendor disconnect or credential change. Joel can use web as before.

Offline regression gate: `python3 tests/gmail-boundary.py`. The full repo gate
includes these tests. No test contacts Gmail. Retest fresh runtime inventory
after updating Codex, Claude Code, their connector catalogs, or their settings.

References: [Codex app settings](https://developers.openai.com/codex/config-reference/),
[Claude permissions](https://code.claude.com/docs/en/permissions),
[Claude hooks](https://code.claude.com/docs/en/hooks).

## Dev verification, 2026-09-10

Installed in `/home/joelkehle/.codex/config.toml` and
`/home/joelkehle/.claude/settings.json`. Fable independently reviewed the diff,
ran the six offline tests, and read Airtable and Drive through its native tools.
No direct Gmail calls or account-level changes were made.

- Codex 0.153.4 fresh app-server: Gmail disabled and not callable; Drive and
  Airtable enabled and callable. Its raw `mcpServerStatus/list` catalog still
  includes 21 Gmail schemas; that catalog is **not** evidence of model access.
  A fresh model session reported no Gmail tools; treat that report as supporting
  evidence, not a substitute for the app-server policy result.
- Claude Code 2.1.263 fresh `system/init`: 187 tools, zero Gmail tools,
  11 Drive tools, 46 Airtable tools. The Gmail MCP server remained connected.
- Fable's already-open Claude session also withdrew its Gmail tools after the
  change. Do not assume every other open runtime reloads its config.
- Six offline tests passed: preservation/idempotence, conflict refusal, missing
  guard detection, Gmail denial and non-Gmail pass-through, private logging,
  audit-failure denial, backup preservation. Some tests cover multiple cases.

For rollout beyond Dev, install and verify on each machine before calling it
covered. No fleet-wide installation or OS-wide network block is claimed.
