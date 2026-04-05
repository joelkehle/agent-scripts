# Tools

Local tool catalog for this machine.

## committer
- Purpose: commit helper; stages only listed paths before committing.
- Location: ~/Projects/shared/agent-scripts/bin/committer
- Upstream: ~/Projects/oss/steipete/agent-scripts/scripts/committer

## trash
- Purpose: safe delete wrapper (moves files to Trash).
- Location: ~/Projects/shared/agent-scripts/bin/trash
- Backend: uses `gio trash` (preferred) or `trash-put` if installed.

## machine-compliance
- Purpose: machine drift/compliance checker used by Codex and Claude at session start.
- Wrapper: ~/Projects/shared/agent-scripts/bin/machine-compliance
- Source of truth: ~/Projects/shared/manager/bin/machine-compliance
