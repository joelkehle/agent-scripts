---
summary: "Canonical GitHub issue conventions for all Joel repos: the label schema (one layer, one priority, one type, plus cross-cutting tags), filing rules, and what is deliberately not used yet."
read_when:
  - Filing, labeling, or triaging a GitHub issue in any Joel-owned repo.
  - Deciding which labels an issue needs or whether to invent a new one.
  - Wondering whether to use GitHub Issue Types or Issue Fields.
---

# GitHub Issues: Canonical Conventions

Adopted by Joel on 2026-08-15. This is the one document for how issues are
labeled and managed across all Joel repos. If a repo's practice disagrees
with this document, this document wins; flag the drift.

## The label schema

Every issue gets exactly one label from each of the first three groups,
plus any number of cross-cutting tags.

1. **Layer** — exactly one `layer:L0`–`layer:L5`. What part of the stack
   the issue lives in. Definitions and the pick-next-work rule:
   docs/stack-priority.md.
2. **Priority** — exactly one `priority:P0`–`priority:P3`. How soon, within
   its layer. P0 = drop everything in this layer; P3 = whenever. Priority
   and layer are separate dimensions; never encode one in the other.
3. **Type** — exactly one of `bug`, `enhancement`, `documentation`.
   Broken vs. better vs. written-down. `question` is allowed for issues
   that are purely a question for Joel.
4. **Cross-cutting tags** — zero or more, many-to-many attributes:
   - `security` — touches auth, secrets, identity, or exposure.
   - `blocked` — cannot proceed; the body must name what unblocks it.
   - `decision-needed` — waiting on a Joel ruling; the body must state
     the question and a recommendation.
   - Workstream tags — lowercase short slugs tying issues to a spec or
     campaign (e.g. `busft` = JK-SPEC-BUSFT-001, the fault-tolerant
     Pinakes bus work). Create one only when a spec or named campaign
     spans multiple issues.

Do not invent combinatorial labels (`P0-bug`, `L2-security`). One label
per dimension, tags for the rest.

## Filing rules

- File in the repo that owns the affected code or doc.
- Reference other issues and PRs by full URL, never a bare number, when
  the reference crosses repos. Same-repo `#NN` references are fine.
- Never put secrets, tokens, or raw email bodies in an issue.
- If an issue defers or waives previously requested work, link the Joel
  comment that agreed. "Per agreed scope" without a link does not count.
- Title status markers like `[PLANNED]`, `[DECISION NEEDED]`,
  `[WAITING UNTIL yyyy-mm-dd]`, `[LATER]` are optional but must match the
  labels (`decision-needed`, `blocked`) when both are present.

## Deliberately not used (yet)

GitHub Issue Types and Issue Fields (GA mid-2026) are Joel's preferred
target state — one typed field per dimension, labels only for tags. They
are not wired up in any repo. Do not use them until Joel runs a migration;
until then, the label schema above is canonical.

## Related documents

- docs/stack-priority.md — layer definitions and how to pick work.
- docs/github-lifecycle-manifest.md and siblings — the separate machinery
  for generating approved issue batches from ratified specs
  (JK-SPEC-GHLIFE-001). That pipeline emits issues that must conform to
  this document's schema.

## Discipline

Keep it minimal: this schema plus sorted picks. Do not add label
taxonomies, bots, or dashboards on top without Joel asking.
