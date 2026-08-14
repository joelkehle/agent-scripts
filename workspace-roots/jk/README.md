# jk meta repo

Minimal meta repo for the `~/Projects/jk` workspace root.

Purpose:

- track workspace-level instruction files
- keep the assistant launch boundary explicit
- avoid polluting git status with nested child repos

Canonical instruction files live in `workspace-root/`.

Root `AGENTS.md` and `CLAUDE.md` should remain symlinks to those tracked files so agents launched from `~/Projects/jk` read the right instructions immediately.
