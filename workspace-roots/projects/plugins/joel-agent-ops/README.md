# Joel Agent Ops

Dual-runtime package for the shared Codex and Claude Code operating skills.

Codex also gets a small Manager mission operator. It offers only three tools:

- Check whether a mission may start.
- Start one supervised mission.
- Check that mission's progress.

The start tool is a write action. Codex asks before it runs. The other two
tools are read-only. The bridge uses the local Manager at
`http://127.0.0.1:8228/mcp`. It does not store a token or start a service.

Codex may defer these tools until it searches for them by exact name. The
packaged `manager-mission-operator` skill tells Codex to search first and then
use the native tool call. It also forbids running the bridge from a shell or
sending raw MCP JSON through standard input. The skill declares the Manager
MCP server as a tool dependency, so Codex loads that native tool surface when
the skill is used.

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
It also checks the three-tool Manager bridge and a copied plugin bundle.
