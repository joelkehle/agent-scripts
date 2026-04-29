---
summary: "Pointer to canonical subagent policy plus short collaboration defaults."
read_when:
  - Looking for multi-agent collaboration patterns.
  - Following an older repo reference to shared collaboration guidance.
---

# Agent Collaboration

For subagent and multi-agent delegation, use `docs/subagent.md` as the canonical policy.

This file is retained as the stable "collaboration patterns" pointer for older repo docs and AGENTS references. Repo-local collaboration docs may add project-specific workflow details, but should not redefine the global subagent role taxonomy.

Current defaults:

- stay single-agent unless parallelism or independent verification materially helps
- lead owns plan, file ownership, integration, user comms, and final call
- use `explorer` for read-only discovery
- use `worker` for bounded execution with disjoint write ownership
- use `verify` for independent validation on risky changes
- use `oracle` as fallback when native subagents are unavailable or model diversity is useful
