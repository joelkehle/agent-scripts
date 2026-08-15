# AGENTS.MD

Joel owns this. Start with hi and one line on what we're doing.

## Plain language (always)

Write to Joel at a sixth-grade reading level. Every message, every time.
Short sentences. Everyday words. Say what happened and what it means for Joel
before any detail. Spell out consequences in real terms.
Simplify the words, never the facts. Never drop a caveat, a risk, or a number.

## Verify before asserting

Act on the thing itself, never on a proxy — a filename, a count, a survey row,
a doc that "should" describe it, an error banner. Open it, read it, run it, and
confirm before you state it or act on it. Before declaring a tool or service
dead from an error message, try a cheap probe first.

## Hard boundaries

- Never commit secrets, tokens, keys, or raw email bodies — and never put them
  in AgentCoord handoffs or proof packs. Use Infisical.
- A request for an answer, diagnosis, review, or draft stays read-and-propose.
  No sends, deletes, or other external writes unless Joel clearly asks.
- `~/Projects/shared/operations` is read-only for agents.

## Session Start

Run `agent-start --root .` before the first reply. Surface every WARN and FAIL.
If it is missing, say so once and continue.

## Local conventions the model cannot guess

- Delete with `trash`, never `rm`.
- Commit with `committer`. Conventional Commits.
- Push right after you commit. Commit-without-push is the anomaly.
  Done means merged to `main` and pushed, unless Joel waives it.
- Branch switching, force-push, deploys, migrations, tags: ask first.
  Never `reset --hard`, `clean`, `restore`, or broad checkout.
- Give Joel the full PR URL every time — never a bare number — and repeat it
  in later summaries.
- HTTPS remotes under `~/Projects`. No amend unless asked.
- Validate with `agent-check` or the repo's gate. GitHub Actions are not the
  validation surface.
- Between machines, use the agent-* aliases or `agent-ssh <target>` as shown
  by `agent-start`. Never use Joel's personal keys or accounts for automation.

## Workspace

`~/Projects`. Joel's repos under `jk`, `ucla-tdg`, `shared`. Third-party under
`oss`. Files belong to the owning repo or `shared/agent-scripts` — do not
create state or policy files somewhere convenient.

## Finding everything else

Run `docs-list` in the repo you are working in and follow the `read_when` hints.
That is the routing table. Core routers in this repo:

- docs/instruction-architecture.md — who reads which instruction file
- docs/loop-operating-model.md — coding-agent loops
- docs/elephant/README.md — elephant protocol
- docs/STATE_ARCHITECTURE.md — where state lives
- docs/bus-discovery.md — live bus capabilities (`bus-discover`)
- docs/shared-agent-coordination.md — overlapping or cross-host work
- docs/service-runtime-policy.md — running services
- docs/oracle.md, tools.md, and the design-walkthrough skill — oracle and tools

Assume commercial LLM inference, local tools, and Joel as the only human gate.
Do not invent reviewers, attorneys, or physicians as available. Name outside
expertise as an unbuilt need.
