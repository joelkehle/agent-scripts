# Tools

Local tool catalog for this machine.

## committer
- Purpose: commit helper; stages only listed paths before committing.
- Location: ~/dev/projects/agent-scripts/bin/committer
- Upstream: ~/dev/projects/oss/steipete/agent-scripts/scripts/committer

## trash
- Purpose: safe delete wrapper (moves files to Trash).
- Location: ~/dev/projects/agent-scripts/bin/trash
- Backend: uses `gio trash` (preferred) or `trash-put` if installed.
