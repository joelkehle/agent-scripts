---
summary: "Entry point for UCLA TDG work: Airtable TDG Docket is the shared state every agent (Claude, ChatGPT, Codex, Patch/GrokBot) reads and signs."
read_when:
  - Joel asks about UCLA TDG work: a case, invention, patent, agreement, licensee, inventor, or a licensing program such as OFRAS.
  - Drafting TDG email, creating or updating a TDG task, or recording a TDG decision.
  - Starting work on a matter another agent may have touched.
---

# TDG Docket

UCLA Technology Development Group work is shared across agents through:

- Airtable base **TDG Docket** `appK0m7kX7kiYxxy4`: Cases, Tasks, Log, Agent
  Rules, SOPs & Norms, Agreements, Patents, Agenda Items. This is the canonical
  operational state.
- Google Drive folder **TDG Reference** `1SsmcchA_fPT28nHkmF302yCWIEw94JUj`
  (jkehle@g.ucla.edu): long-form guides and notes. Status lives in Airtable,
  not in these docs.
- Non-TDG tasks go in the separate base "Agent Operations - Non-TDG"
  `appsBKshOi1JPamUR`, never in TDG Docket.

## Before any TDG work

1. Read every Active record in the Agent Rules table. They are the operating
   contract and override this page.
2. Rule `global.work-attribution`: find the matter's Case or Agreement, read its
   linked Log and Tasks, and see which agent did the latest work. If it was a
   different agent (or a different Claude surface), tell Joel in one line and
   ask whether to continue with you or switch back.
3. Rule `global.system-budget`: no new rules, SOPs, tables, fields, or dropdown
   options unless Joel asks; one fact lives in one place.

## While working

- Sign Log entries with your agent family first: `Claude Code (<model>)`,
  `Claude Fable`, `ChatGPT`, `Codex`, `Patch/GrokBot`.
- End additions to Task Notes or Case Latest Development with
  `Worked by: <Actor>, YYYY-MM-DD`.
- Put durable TDG to-dos in TDG Docket Tasks, not in local agent memory; local
  memory is invisible to every other agent and to other folders on the same
  machine.
- UCLA blocks the Box MCP connector. Box work goes through the Box Drive sync
  folder on Joel's Windows laptop (`C:\Users\joel\Box`); agents cannot see Box
  sharing settings.
