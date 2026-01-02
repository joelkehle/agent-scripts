# Tools

Local tool catalog for this machine.

## committer
- Purpose: commit helper; stages only listed paths before committing.
- Location: /home/joelkehle/dev/projects/agent-scripts/bin/committer
- Upstream: /home/joelkehle/dev/projects/oss/steipete/agent-scripts/scripts/committer

## trash
- Purpose: safe delete wrapper (moves files to Trash).
- Location: /home/joelkehle/dev/projects/agent-scripts/bin/trash
- Backend: uses `gio trash` (preferred) or `trash-put` if installed.
