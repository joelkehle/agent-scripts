# Joel Agent Ops

Dual-runtime package for the shared Codex and Claude Code operating skills.

The canonical skill source remains `workspace-roots/projects/.agents/skills/`.
Package copies are required because Codex 0.146 does not carry external skill
symlinks into its plugin cache. After changing a canonical tracked skill, run:

```bash
scripts/sync-plugin-skills
bash tests/plugin-marketplace.sh
```

The regression test compares every packaged skill to its canonical directory.
