# Agent Scripts

Shared tools for working with AI coding agents across a multi-repository workspace.
These scripts support project discovery, local checks, Git contributions, and
session handoffs for Codex and Claude Code.

This is Joel Kehle's working toolkit. Some commands rely on his workspace layout,
host names, and service setup. Read each tool's help and documentation before
adapting it to another environment.

## What's here

| Tool | Purpose |
| --- | --- |
| `agent-start` | Show workspace context and startup checks. |
| `docs-list` | Find project docs and their “read when” hints. |
| `agent-check` | Run the repository's validation command. |
| `workspace-preflight` | Inspect Git state, ownership, and workspace conflicts. |
| `agent-workspace` | Track local coding sessions and their handoffs. |
| `committer` | Commit an explicit list of files with a supplied message. |
| `agent-ssh` | Connect to hosts through the configured SSH grid. |
| `loop-receipt` | Record the result of a bounded piece of work. |

The repository also includes coding-agent skills, Git hooks, service setup
scripts, and tests. Upstream material is kept under
[`vendor/steipete-agent-scripts`](vendor/steipete-agent-scripts).

## Start reading

- [Instruction architecture](docs/instruction-architecture.md): where shared and
  project-specific guidance belongs.
- [Coding loops](docs/loop-operating-model.md): how changes are built, reviewed,
  and checked.
- [Workspace checks](docs/launch-safety.md): Git and session checks before work.
- [Shared coordination](docs/shared-agent-coordination.md): source ownership and
  handoffs between machines.
- [Tool reference](tools.md): additional tools and usage notes.

## Validation

With Node.js, npm, Bash, and Python 3 available, run the repository gate:

```bash
npm run agent:check
```

The gate checks shell and JavaScript syntax, instruction files, and the workspace
tools' tests. Some checks exercise local process and Git behavior.
