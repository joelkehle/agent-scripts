const { sealReceipt } = require("./validation-receipt");
const { LEDGER_RECEIPT_SCHEMA, PILOT_WRITE_BOUNDARY, SCENARIO_STATUSES } = require("./pilot-schema");

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function scenarioIdsWithStatus(ledger, status) {
  return ledger.scenarios.filter((scenario) => scenario.status === status).map((scenario) => scenario.scenario_id);
}

// Wall-clock durations and failure excerpts stay in the ledger and out of the
// receipt, so two runs that observed the same test output seal identically and
// the receipt identifies evidence rather than timing.
function summarizeScenario(scenario) {
  return {
    scenario_id: scenario.scenario_id,
    evidence: scenario.evidence,
    status: scenario.status,
    drift_allowed: scenario.drift_allowed === true,
    stale_worktrees: [...scenario.stale_worktrees].sort(),
    gap_count: (scenario.gaps || []).length,
    commands: scenario.commands.map((command) => ({
      worktree_id: command.worktree_id,
      command: command.command,
      status: command.status,
      exit_code: command.exit_code,
      expects_tests: command.expects_tests,
      tests_run: command.tests_run,
      tests_passed: command.tests_passed,
      tests_failed: command.tests_failed,
      output_sha256: command.output_sha256,
      output_bytes: command.output_bytes,
    })),
  };
}

// The caller injects `actor` and `timestamp`, as in the manifest and
// adjudication receipts, so a run is attributable and the library never reads
// the wall clock.
function buildPilotLedgerReceipt(options) {
  const { ledger } = options;
  const actor = requireText(options.actor, "actor");
  const timestamp = requireText(options.timestamp, "timestamp");

  const receipt = {
    schema: LEDGER_RECEIPT_SCHEMA,
    recorded_at: timestamp,
    runner: {
      actor,
      tool: options.tool || "ghl-pilot",
      tool_version: options.tool_version || "1.0.0",
      write_class: "read",
    },
    subject: {
      source: options.source || ledger.map.source || null,
      ledger_schema: ledger.schema,
      map_schema: ledger.map.schema,
      map_version: ledger.map.map_version,
      spec_id: ledger.map.spec_id,
      source_revision: ledger.map.source_revision,
      started_at: ledger.started_at,
    },
    input: {
      content_sha256: ledger.map.content_sha256,
      canonical_bytes: ledger.map.canonical_bytes,
    },
    revisions: ledger.worktrees.map((worktree) => ({
      worktree_id: worktree.worktree_id,
      repository: worktree.repository,
      pinned: worktree.pinned,
      expected_head_sha: worktree.expected_head_sha,
      observed_head_sha: worktree.observed_head_sha,
      matches: worktree.matches,
    })),
    outcome: {
      ok: ledger.ok,
      allow_drift: ledger.options.allow_drift,
      scenario_filter: [...ledger.options.scenario_filter],
      counts: { ...ledger.counts },
      passed: scenarioIdsWithStatus(ledger, SCENARIO_STATUSES.PASSED),
      failed: scenarioIdsWithStatus(ledger, SCENARIO_STATUSES.FAILED),
      stale_revision: scenarioIdsWithStatus(ledger, SCENARIO_STATUSES.STALE_REVISION),
      gap_only: scenarioIdsWithStatus(ledger, SCENARIO_STATUSES.GAP_ONLY),
      skipped: scenarioIdsWithStatus(ledger, SCENARIO_STATUSES.SKIPPED),
      scenarios: ledger.scenarios.map(summarizeScenario),
    },
    boundary: {
      no_network: true,
      no_github_write: true,
      activates_no_build: true,
      authorizes_no_canary: true,
      write_boundary: PILOT_WRITE_BOUNDARY,
    },
  };

  return sealReceipt(receipt);
}

module.exports = { buildPilotLedgerReceipt };
