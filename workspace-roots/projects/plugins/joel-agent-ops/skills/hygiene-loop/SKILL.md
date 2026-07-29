---
name: hygiene-loop
description: Use when reducing dirty Git state across Joel's Projects workspace by inventorying, classifying, and cleaning repos in small safe batches.
---

# Hygiene Loop

Default mode starts as `read` or `propose`. Switch to local `write` only for repos with a clear, coherent cleanup action.

Process:

1. Refresh dirty inventory with `git status --short --branch` per repo.
2. Classify each dirty repo as one of:
   - finish + commit
   - park as WIP
   - trash generated/proof junk
   - ignore via `.gitignore`
   - leave alone
3. Prefer 1-3 low-risk repos per pass.
4. Before touching a repo, read its nearest `AGENTS.md`, check WWI for overlapping loops, and inspect the diff/untracked files.
5. Commit coherent completed cleanup after validation. Do not bundle unrelated files just to make the tree clean.
6. For generated proof artifacts, do not commit raw email bodies, secrets, tokens, private keys, or sensitive source data. Use `trash` for discarded files.
7. Run `agent-check` when a repo has a gate; for docs-only repos without a gate, run `docs-list` and `git diff --check`.
8. After commit, write `loop-receipt --from-head` so receipt files come from the committed work.

Stop and ask if cleanup would require deleting tracked files, changing branches, force-pushing, deploying, rewriting history, or deciding whether ambiguous WIP belongs to Joel or another agent.

For detailed policy, read `~/Projects/shared/agent-scripts/docs/loop-operating-model.md`.
