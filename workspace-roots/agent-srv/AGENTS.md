READ ~/Projects/shared/agent-scripts/AGENTS.MD BEFORE ANYTHING (skip if missing).

# Workspace: /srv/agent-workspaces (legacy)

This was the short-lived dedicated-account workspace design from 2026-08-16.
It is not the default place for interactive Codex or Claude work.

Interactive helpers run as Joel and use `~/Projects`. Do not create a new
interactive worktree or clone here. Do not delete or migrate an existing file
from this root without a specific cleanup task; it may be evidence or service
state.

A persistent service or untrusted workload may use a separate Unix account and
an isolated workspace. Its own service runbook must name that identity, path,
credentials, and cleanup rules. This legacy file grants none of those rights.
