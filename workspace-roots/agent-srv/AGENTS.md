READ ~/agent-scripts/AGENTS.MD BEFORE ANYTHING (the agent account's own
checkout of shared/agent-scripts; skip only if missing).

# Workspace: /srv/agent-workspaces (agent-native root, dev)

This root belongs to the `agent` Unix account. It exists so agents never work
inside Joel's checkouts or as Joel's user. Governing decision:
`manager/docs/decisions/agent-access-architecture-2026-08.md`.

## Layout

- `/srv/agent-repositories/*.git` — agent-owned bare clones of the canonical
  `kehle-tdg-dev` repos plus `agent-scripts`. These are the only clone bases.
- `/srv/agent-workspaces/<repo>-<purpose>` — one leased worktree per claimed
  piece of work, created from the bare clone with `git worktree add`.
  Never clone from, or add worktrees onto, anything under `/home/joelkehle`
  (it is unreadable to this account by design — do not work around that).
- `~/agent-scripts` — standing tooling checkout. Treat as read-only; it
  updates by fetch/pull, never by local edits.

## Identity (hard rules)

- You are the `agent` Unix account. GitHub writes happen only as
  `kehle-contributor-agent` (later: the GitHub App from manager#112).
  Never as `joelkehle`, never with Joel's keys, tokens, or email.
- Until the agent account gets its own Infisical wiring (manager#98 lane),
  this account cannot mint the contributor token. Do not copy, move, or
  read credential files to work around that — pushes wait for the wiring
  or happen from a properly launched session that injects a token.

## Branches and pull requests (overrides the global push-to-main habit)

For work in this root: branch + pull request only. **No direct push to
`main` on any `kehle-tdg-dev` repo** — Joel's directive, 2026-08-16. This is
binding policy even where GitHub's plan cannot enforce it server-side.
"Done" here means: PR opened, checks and independent review pass, PR merged
by policy — not a local commit, and not a push to main.

## Workspace lifecycle

- Begin every worktree with a claim/lease (`agent-workspace begin`); seal it
  with commits plus a receipt; on interruption, quarantine — never discard.
- Run `agent-start --root <worktree>` before the first action in a session.
- `workspace-preflight --root <worktree> --mode write` before write work.
- Never `reset --hard`, `clean`, `stash`, `restore`, or delete branches.
- Delete files with `trash`, never `rm`.
- Never deploy from a worktree. Deploys go through the broker
  (manager#110) once it exists; nothing in this root is a deploy source.

## State

Runtime state lives in `~/.local/state/agent-workspaces` (the tools'
default). Do not create state or policy files inside this root or inside
the bare clones.
