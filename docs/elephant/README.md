---
summary: "Canonical home, ownership boundary, and document map for the reusable Elephant Check coding-agent construct."
read_when:
  - "Working on Elephant Check policy, hooks, recovery, tests, or adoption."
  - "Adding Elephant to another repository."
  - "Deciding which Elephant artifacts are shared versus repo-local."
---

# Elephant

This directory is the canonical home for the reusable Elephant Check construct.

Elephant is coding-agent continuity and contradiction infrastructure. It keeps a
system-level implementation anchored to the whole-system design, carries bounded
acceptance conditions across compaction and delegation, and maps each condition
to code, tests, and proof.

## Documents

- `ELEPHANT_CHECK.md` — normative design, trigger, procedure, lifecycle, and
  receipt template.
- `ADOPTION.md` — shared implementation layout and the repo-local files an
  adopting repository keeps.
- `RECOVERY.md` — stuck-session recovery, incident findings, and improvement
  backlog.

## Ownership boundary

Shared `agent-scripts` owns:

- the generic Elephant policy and terminology;
- reusable hook source and tests under `lib/elephant/` and
  `tests/elephant/`;
- shared command wrappers under `bin/`;
- adoption, recovery, and maintenance guidance.

Each adopting repository owns:

- `.codex/elephant-active.json`, because it declares that worktree's active
  contract;
- `docs/elephant-checks/`, because receipts, traceability maps, and proof are
  project evidence;
- a short local router naming repo-specific required context;
- minimal hook configuration or compatibility shims when required by Codex.

Project receipts are not moved here. They are evidence about one repository,
not source material for the Elephant construct.

## Current origin and cutover

The first implementation was built inside `jk/llm-wiki`. Its reusable policy,
hook source, tests, recovery lessons, and naming now live here. The
`llm-wiki` receipts remain local, and its runtime entrypoints remain thin
compatibility shims so an active Elephant-governed session is not forced to
change contract state during the ownership cutover.

## Naming

`EC` means **Elephant Check**. `EC-10` is the tenth binding condition emitted
by a specific Elephant receipt; it is not a global condition shared by every
project.

