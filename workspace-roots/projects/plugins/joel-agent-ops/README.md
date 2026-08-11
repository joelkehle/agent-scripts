# Joel Agent Ops

Dual-runtime package for the shared Codex and Claude Code operating skills.

The packaged `manager-mission-operator` skill uses the installed
`manager-mission` command. The plugin does not start a Manager MCP bridge or
connect to a local web service. The command fails closed when the Manager
client is not installed.

The Codex chat stays read-only. Manager starts a separate child to change code.
This first version does not add the new mission to weekly focus.

The canonical skill source remains `workspace-roots/projects/.agents/skills/`.
Package copies are required because Codex 0.146 does not carry external skill
symlinks into its plugin cache. After changing a canonical tracked skill, run:

```bash
scripts/sync-plugin-skills
bash tests/plugin-marketplace.sh
```

The regression test compares every packaged skill to its canonical directory.
It also checks that the Codex plugin stays free of the retired Manager MCP
bridge.
