---
summary: "Versioned specification-to-issue manifest schema, coverage validator, stable issue renderer, and attributable validation receipt for JK-SPEC-GHLIFE-001."
read_when:
  - Adding, editing, or validating a github-lifecycle-manifest.v1 manifest.
  - Proposing a GitHub issue batch from a ratified specification.
  - Implementing GHL-004's issue adapter or any consumer of rendered issue payloads.
---

# GitHub lifecycle specification-to-issue manifest

Implements `GHL-REQ-01` (faithful issue projection) from
[`JK-SPEC-GHLIFE-001`](github-native-lifecycle-read-propose-packet.md), plus the
proposal/receipt obligations of `GHL-NFR-02` and `GHL-NFR-04`.

A manifest is the machine-readable bridge between an approved specification and
the GitHub issue batch that implements it. Validation and rendering are
read/propose work. Creating or updating issues is a separately authorized
external write and lives outside this repository.

## Artifacts

| Artifact | Path |
|---|---|
| Ratified `GHL-001`..`GHL-010` manifest | `docs/github-lifecycle/jk-spec-ghlife-001.v1.json` |
| Generated JSON Schema | `docs/schemas/github-lifecycle-manifest.v1.schema.json` |
| Structured DoD JSON Schema | `docs/schemas/github-lifecycle-manifest.v2.schema.json` |
| Library | `lib/github-lifecycle/` |
| CLI | `bin/ghl-manifest` |
| Tests | `tests/github-lifecycle/spec-issue-manifest.test.js` |

## Commands

```bash
ghl-manifest validate                    # defaults to the ratified manifest
ghl-manifest validate path/to/manifest.json --format json
ghl-manifest render --issue GHL-003
ghl-manifest receipt --actor codex-contributor --at 2026-07-27T00:00:00.000Z
ghl-manifest schema
ghl-manifest schema --schema-version v2
```

Exit codes are `0` for a clean run, `1` for validation defects, and `2` for a
usage or input error. `render` refuses an invalid manifest.

## Schema `github-lifecycle-manifest.v1`

Top level: `schema`, `manifest_version`, `specification`, `requirements`,
`issues`, and optional `notes`.

`specification` carries `spec_id`, `source_revision`, and `source_document`;
optional `title`, `ratified_on`, and `status`. Every rendered issue body cites
the spec ID and revision, so a re-ratified specification means a new revision
and a new render.

Each `requirements[]` entry is `id` plus `title`, with optional `summary` and
`normative`. A requirement marked `normative: false` is exempt from the coverage
check.

Each `issues[]` entry MUST carry the fields `GHL-REQ-01` requires:

| Field | Meaning |
|---|---|
| `issue_id` | Stable ID such as `GHL-003` |
| `title` | Issue title without the ID prefix |
| `owner_repository` | `owner/repo` that owns the slice |
| `requirements` | Requirement IDs this issue covers, at least one |
| `depends_on` | Issue IDs only; may be empty but must be present |
| `acceptance_criteria` | At least one criterion |
| `validation_commands` | Exact local gate commands, at least one |
| `non_goals` | Explicit exclusions; may be empty |
| `write_class` | `read`, `propose`, or `write` |

Optional: `summary`, `manager_project`, `external_dependencies`,
`validation_notes`, `labels`. Unknown fields are rejected.

## Schema `github-lifecycle-manifest.v2`

Version 2 retains every v1 field and makes `issues[].definition_of_done`
mandatory. Existing v1 manifests remain valid and render exactly as before;
consumers select behavior from the manifest's `schema` value.

The structured contract contains:

| Field | Contract |
|---|---|
| `proof_requirements[]` | Stable `id`, gradeable `requirement`, and named `evidence` |
| `pass_criteria[]` | Declared `proof_id`, criterion, and exact `expected_result` |
| `budget` | Non-negative integer `max_review_rounds` and `max_continuation_attempts` |
| `kill_criteria[]` | Measurable `trigger`, required `action`, and `decision_time` |
| `finding_policy` | Fixed `fix`/`defer`/`escalate` classifications and `accept_or_defer` at budget |

Pass criteria may reference only proof IDs declared in the same issue.
Objectively vague standalone values such as `TBD`, `robust`, `clean`, or
`works well` fail validation. The narrow vocabulary is deliberately
deterministic; the validator does not attempt probabilistic prose grading.

`write_class` is the highest external-write class the issue's own execution is
authorized to reach, using the `read`/`propose`/`write` vocabulary from
`AGENTS.MD`. In the ratified batch, `GHL-001` through `GHL-009` are `propose`
because they implement dry-run or fake-transport behavior only; `GHL-010` is
`write` because its canary creates a real issue, claim, and pull request under
separate authorization.

`depends_on` holds issue IDs so the graph stays checkable.
`external_dependencies` holds prose gates that are not issues, such as
`Verified \`ACT-REV-02\`` or the merged Phase 0 revision.

## Validator

`validateManifest(manifest)` returns `{ok, errors, requirement_coverage,
uncovered_requirements, issue_order}` and fails closed. `issue_order` is a
deterministic topological order, empty when the dependency graph is unusable.

Defect codes:

| Code | Detects |
|---|---|
| `schema_mismatch` | Manifest written against another schema version |
| `missing_field` | A mandatory field is absent |
| `invalid_field` | Wrong type, empty required list, bad enum, or bad ID/repo pattern |
| `unknown_field` | A field outside the schema |
| `duplicate_issue_id` | The same issue ID declared twice |
| `duplicate_requirement_id` | The same requirement ID declared twice |
| `unknown_requirement` | An issue references an undeclared requirement |
| `missing_coverage` | A normative requirement no issue covers |
| `unknown_dependency` | A dependency on an undeclared issue |
| `self_dependency` | An issue depends on itself |
| `dependency_cycle` | A cycle in `depends_on`, reported once per cycle |
| `vague_dod_field` | A mandatory DoD statement is a named vague placeholder |
| `malformed_dod_budget` | A DoD budget is not a non-negative integer contract |
| `unknown_dod_proof` | A pass criterion references an undeclared proof ID |

The JSON Schema is generated from the same field tables the validator uses, so
the two cannot drift; a test asserts the checked-in file matches. JSON Schema
cannot express coverage, cycles, or cross-references, so the validator is
authoritative for those.

## Renderer

`renderManifest(manifest)` produces proposed titles and bodies with no
timestamps, no randomness, and no network access, so output is byte-stable
across runs. Titles are `<issue_id> — <title>`. Each body opens with a marker
that lets a downstream adapter find and upsert its issue without duplicating it:

```text
<!-- github-lifecycle-manifest.v1 spec=JK-SPEC-GHLIFE-001 revision=<rev> issue=GHL-003 payload_sha256=<hex> -->
```

`payload_sha256` covers the canonical issue entry only, so editing one issue
does not churn the other bodies. An omitted optional list and an empty one hash
alike.

For v2, the rendered issue body includes every DoD field and the render payload
also exposes the unchanged `definition_of_done` object. Validation receipts
carry the same per-issue objects under `subject.definition_of_done`. Both are
sealed or hashed through canonical JSON, so key order and formatting cannot
produce byte drift.

`tests/github-lifecycle/fixtures/ghl-003.expected.md` is the byte-stability
anchor. An intended manifest edit that changes `GHL-003` regenerates it with:

```bash
ghl-manifest render --issue GHL-003 --format json |
  node -e 'const d=JSON.parse(require("node:fs").readFileSync(0,"utf8")).issues[0];
process.stdout.write(`${d.title}\n\n${d.body}`)' \
  > tests/github-lifecycle/fixtures/ghl-003.expected.md
```

Regenerate the JSON Schema the same way with `ghl-manifest schema >
docs/schemas/github-lifecycle-manifest.v1.schema.json`.

## Validation receipt

`buildValidationReceipt` emits `github-lifecycle-validation-receipt.v1`
recording the validating actor and tool, the subject spec ID and revision, the
sha256 of the canonicalized manifest, and the outcome with its defect codes. The
caller injects `actor` and `timestamp`; the library never reads the wall clock,
which keeps receipts reproducible and testable. `receipt_id` is derived from the
receipt body, so `verifyReceipt` detects tampering.

Canonicalization sorts object keys, so two semantically identical manifests
always hash the same regardless of formatting or key order.

## Boundaries

- No GitHub reads or writes, no network access, and no credentials.
- No issue assignment, claim event, or mission launch; those belong to
  `GHL-004` through `GHL-006` in the coordinator repository.
- Not a project-management database. GitHub stays canonical for issue state.
