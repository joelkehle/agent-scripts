const { HEAD_SHA_PATTERN } = require("./adjudication-schema");
const { DEFECT_CODES, REPOSITORY_PATTERN, VERSION_PATTERN } = require("./manifest-schema");

const TIMESTAMP_PATTERN = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$";

// Schemas this repository owns.
const SCENARIO_MAP_SCHEMA = "github-lifecycle-e2e-scenarios.v1";
const LEDGER_SCHEMA = "github-lifecycle-pilot-ledger.v1";
const LEDGER_RECEIPT_SCHEMA = "github-lifecycle-pilot-receipt.v1";
const ACTIVATION_SPEC_SCHEMA = "github-lifecycle-activation-spec.v1";
const BUILD_IDENTITY_SCHEMA = "github-lifecycle-build-identity.v1";
const PREFLIGHT_SCHEMA = "github-lifecycle-pilot-preflight.v1";

// The twelve acceptance scenarios defined by JK-SPEC-GHLIFE-001. The map must
// bind every one of them exactly once; a map that omits or invents a scenario
// fails validation rather than quietly shrinking the contract.
const SCENARIO_IDS = [
  "GHL-E2E-01",
  "GHL-E2E-02",
  "GHL-E2E-03",
  "GHL-E2E-04",
  "GHL-E2E-05",
  "GHL-E2E-06",
  "GHL-E2E-07",
  "GHL-E2E-08",
  "GHL-E2E-09",
  "GHL-E2E-10",
  "GHL-E2E-11",
  "GHL-E2E-12",
];

const SCENARIO_ID_PATTERN = "^GHL-E2E-(0[1-9]|1[0-2])$";

// How much of a scenario the checked-in suites actually prove.
// `executable`  every clause listed in `proves` is asserted by a command here;
// `partial`     some clauses are proven, and `gaps` names the rest;
// `missing`     nothing executable exists yet, and `gaps` says what would prove it.
const EVIDENCE_CLASSES = {
  EXECUTABLE: "executable",
  PARTIAL: "partial",
  MISSING: "missing",
};

// Per-scenario outcome of one `ghl-pilot run`.
const SCENARIO_STATUSES = {
  PASSED: "passed",
  FAILED: "failed",
  STALE_REVISION: "stale_revision",
  GAP_ONLY: "gap_only",
  SKIPPED: "skipped",
};

// Per-command outcome. `no_tests_matched` and `test_count_mismatch` exist so a
// mistyped or renamed test selector fails loudly: `go test -run` exits 0 when a
// regex matches nothing, which would otherwise be a silent fabricated pass.
const COMMAND_STATUSES = {
  PASSED: "passed",
  FAILED: "failed",
  NO_TESTS_MATCHED: "no_tests_matched",
  TEST_COUNT_MISMATCH: "test_count_mismatch",
  NOT_RUN: "not_run",
};

// The runner spawns without a shell and only ever executes a test runner.
const COMMAND_KINDS = {
  GO_TEST: "go_test",
  NODE_TEST: "node_test",
};

const COMMAND_PROGRAMS = {
  [COMMAND_KINDS.GO_TEST]: ["go"],
  [COMMAND_KINDS.NODE_TEST]: ["node"],
};

const PILOT_DEFECT_CODES = {
  ...DEFECT_CODES,
  DUPLICATE_SCENARIO_ID: "duplicate_scenario_id",
  UNKNOWN_SCENARIO_ID: "unknown_scenario_id",
  MISSING_SCENARIO: "missing_scenario",
  DUPLICATE_WORKTREE_ID: "duplicate_worktree_id",
  UNKNOWN_WORKTREE: "unknown_worktree",
  EVIDENCE_CONTRADICTION: "evidence_contradiction",
  FORBIDDEN_PROGRAM: "forbidden_program",
};

const PREFLIGHT_REFUSAL_CODES = {
  SERVICE_ABSENT: "service_absent",
  DUPLICATE_SERVICE: "duplicate_service",
  COMMIT_UNKNOWN: "commit_unknown",
  COMMIT_MISMATCH: "commit_mismatch",
  DIRTY_BUILD: "dirty_build",
  NOT_ACTIVATED: "not_activated",
  MISSING_CHECKPOINT_RECEIPT: "missing_checkpoint_receipt",
};

// Read/propose boundary, stated the same way GHL-003 and GHL-009 state theirs.
const PILOT_WRITE_BOUNDARY =
  "read-only execution of checked-in local test suites; this tool reaches no network, " +
  "performs no GitHub write, activates no build, and authorizes no live canary";

const PREFLIGHT_WRITE_BOUNDARY =
  "offline comparison of reported build identity against the required activation spec; " +
  "this tool never activates, deploys, restarts, or probes a service, and a pass is a " +
  "precondition for the live canary, never an authorization for it";

const CHECKPOINT_ID_PATTERN = "^ACT-REV-[0-9]{2}$";
const SERVICE_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";
const MIN_COMMIT_LENGTH = 7;

const MAP_FIELDS = {
  required: {
    schema: { type: "string", const: SCENARIO_MAP_SCHEMA },
    map_version: { type: "string", pattern: VERSION_PATTERN },
    specification: { type: "object" },
    worktrees: { type: "array", minItems: 1, itemType: "object" },
    scenarios: { type: "array", minItems: 1, itemType: "object" },
  },
  optional: {
    notes: { type: "array", itemType: "string" },
    known_environment_issues: { type: "array", itemType: "object" },
  },
};

const MAP_SPECIFICATION_FIELDS = {
  required: {
    spec_id: { type: "string", minLength: 1 },
    source_revision: { type: "string", pattern: "^\\S+$" },
    source_document: { type: "string", minLength: 1 },
    scenarios_section: { type: "string", minLength: 1 },
  },
  optional: {
    title: { type: "string", minLength: 1 },
  },
};

const WORKTREE_FIELDS = {
  required: {
    worktree_id: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" },
    repository: { type: "string", pattern: REPOSITORY_PATTERN },
    path: { type: "string", minLength: 1 },
    head_sha: { type: "string", pattern: HEAD_SHA_PATTERN },
  },
  optional: {
    // `pinned` (the default) requires the checked-out HEAD to equal `head_sha`
    // exactly. `self` is for the repository holding this tool: its revision
    // advances as the pilot itself is committed, so the run records the
    // observed HEAD instead of failing on it. Dependency evidence is always
    // pinned.
    revision_policy: { type: "string", enum: ["pinned", "self"] },
    contains: { type: "array", itemType: "string" },
    note: { type: "string", minLength: 1 },
  },
};

const SCENARIO_FIELDS = {
  required: {
    scenario_id: { type: "string", pattern: SCENARIO_ID_PATTERN },
    title: { type: "string", minLength: 1 },
    evidence: { type: "string", enum: Object.values(EVIDENCE_CLASSES) },
    proves: { type: "array", itemType: "string" },
    gaps: { type: "array", itemType: "object" },
    commands: { type: "array", itemType: "object" },
  },
  optional: {
    summary: { type: "string", minLength: 1 },
    notes: { type: "array", itemType: "string" },
  },
};

const COMMAND_FIELDS = {
  required: {
    worktree_id: { type: "string", minLength: 1 },
    kind: { type: "string", enum: Object.values(COMMAND_KINDS) },
    argv: { type: "array", minItems: 2, itemType: "string" },
    expects_tests: { type: "number" },
  },
  optional: {
    label: { type: "string", minLength: 1 },
    proves: { type: "array", itemType: "string" },
  },
};

// A gap must say which clause is unproven and what would prove it, so an
// auditor never has to guess whether coverage was forgotten or is impossible.
const GAP_FIELDS = {
  required: {
    clause: { type: "string", minLength: 1 },
    why: { type: "string", minLength: 1 },
    would_be_proven_by: { type: "string", minLength: 1 },
  },
  optional: {
    tracked_as: { type: "string", minLength: 1 },
  },
};

const ENVIRONMENT_ISSUE_FIELDS = {
  required: {
    issue_id: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
  },
  optional: {
    worktree_id: { type: "string", minLength: 1 },
    detail: { type: "string", minLength: 1 },
    excluded_tests: { type: "array", itemType: "string" },
  },
};

const ACTIVATION_SPEC_FIELDS = {
  required: {
    schema: { type: "string", const: ACTIVATION_SPEC_SCHEMA },
    spec_version: { type: "string", pattern: VERSION_PATTERN },
    checkpoints: { type: "array", minItems: 1, itemType: "object" },
  },
  optional: {
    notes: { type: "array", itemType: "string" },
  },
};

const CHECKPOINT_FIELDS = {
  required: {
    checkpoint_id: { type: "string", pattern: CHECKPOINT_ID_PATTERN },
    service: { type: "string", pattern: SERVICE_PATTERN },
    repository: { type: "string", pattern: REPOSITORY_PATTERN },
    required_commit: { type: "string", pattern: HEAD_SHA_PATTERN },
    contains_issues: { type: "array", minItems: 1, itemType: "string" },
    requires_receipts: { type: "array", itemType: "string" },
    rollback: { type: "string", minLength: 1 },
  },
  optional: {
    title: { type: "string", minLength: 1 },
    smoke_checks: { type: "array", itemType: "string" },
    note: { type: "string", minLength: 1 },
  },
};

const BUILD_IDENTITY_FIELDS = {
  required: {
    schema: { type: "string", const: BUILD_IDENTITY_SCHEMA },
    observed_at: { type: "string", pattern: TIMESTAMP_PATTERN },
    observed_by: { type: "string", minLength: 1 },
    source: { type: "string", enum: ["health_endpoint", "fixture"] },
    services: { type: "array", itemType: "object" },
  },
  optional: {
    checkpoint_receipts: { type: "array", itemType: "object" },
    note: { type: "string", minLength: 1 },
  },
};

// Exactly the shape a service health endpoint reports.
const SERVICE_IDENTITY_FIELDS = {
  required: {
    service: { type: "string", pattern: SERVICE_PATTERN },
    commit: { type: "string", minLength: 0 },
    dirty: { type: "boolean" },
    activated_at: { type: "string", minLength: 0 },
  },
  optional: {
    endpoint: { type: "string", minLength: 1 },
    note: { type: "string", minLength: 1 },
  },
};

const CHECKPOINT_RECEIPT_FIELDS = {
  required: {
    checkpoint_id: { type: "string", pattern: CHECKPOINT_ID_PATTERN },
    receipt_ref: { type: "string", minLength: 1 },
  },
  optional: {
    recorded_at: { type: "string", minLength: 1 },
    note: { type: "string", minLength: 1 },
  },
};

// Health endpoints report short or full SHAs for the same build, so a match is
// a case-insensitive prefix relation with enough characters to be meaningful.
function commitMatches(required, observed) {
  if (typeof required !== "string" || typeof observed !== "string") {
    return false;
  }

  const left = required.trim().toLowerCase();
  const right = observed.trim().toLowerCase();

  if (left.length < MIN_COMMIT_LENGTH || right.length < MIN_COMMIT_LENGTH) {
    return false;
  }

  return left.startsWith(right) || right.startsWith(left);
}

module.exports = {
  ACTIVATION_SPEC_FIELDS,
  ACTIVATION_SPEC_SCHEMA,
  BUILD_IDENTITY_FIELDS,
  BUILD_IDENTITY_SCHEMA,
  CHECKPOINT_FIELDS,
  CHECKPOINT_ID_PATTERN,
  CHECKPOINT_RECEIPT_FIELDS,
  COMMAND_FIELDS,
  COMMAND_KINDS,
  COMMAND_PROGRAMS,
  COMMAND_STATUSES,
  ENVIRONMENT_ISSUE_FIELDS,
  EVIDENCE_CLASSES,
  GAP_FIELDS,
  LEDGER_RECEIPT_SCHEMA,
  LEDGER_SCHEMA,
  MAP_FIELDS,
  MAP_SPECIFICATION_FIELDS,
  MIN_COMMIT_LENGTH,
  PILOT_DEFECT_CODES,
  PILOT_WRITE_BOUNDARY,
  PREFLIGHT_REFUSAL_CODES,
  PREFLIGHT_SCHEMA,
  PREFLIGHT_WRITE_BOUNDARY,
  SCENARIO_FIELDS,
  SCENARIO_ID_PATTERN,
  SCENARIO_IDS,
  SCENARIO_MAP_SCHEMA,
  SCENARIO_STATUSES,
  SERVICE_IDENTITY_FIELDS,
  SERVICE_PATTERN,
  WORKTREE_FIELDS,
  commitMatches,
};
