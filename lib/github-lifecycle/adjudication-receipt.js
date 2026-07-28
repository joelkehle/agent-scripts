const { contentHash } = require("./canonical-json");
const { sealReceipt } = require("./validation-receipt");
const {
  ADJUDICATION_RECEIPT_SCHEMA,
  ADJUDICATION_WRITE_BOUNDARY,
  RECORD_STATUSES,
} = require("./adjudication-schema");

// The caller injects `actor` and `timestamp`, as in the manifest receipt, so an
// observation is attributable and reproducible and the library never reads the
// wall clock.
function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function buildAdjudicationReceipt(options) {
  // `bundle` is the evidence file as loaded, so the hash covers exactly the
  // bytes an auditor can re-read, not this tool's normalization of them.
  const { bundle, report } = options;
  const actor = requireText(options.actor, "actor");
  const timestamp = requireText(options.timestamp, "timestamp");
  const graduation = options.graduation || { proposals: [] };
  const input = contentHash(bundle);
  const collection = (bundle && bundle.collection) || {};
  const decisionCount = report.records.length;

  const receipt = {
    schema: ADJUDICATION_RECEIPT_SCHEMA,
    observed_at: timestamp,
    observer: {
      actor,
      tool: options.tool || "ghl-adjudication",
      tool_version: options.tool_version || "1.0.0",
      write_class: "read",
    },
    subject: {
      source: options.source || null,
      evidence_schema: report.evidence_schema,
      bundle_version: report.bundle_version,
      collected_at: collection.collected_at || null,
      collected_by: collection.collected_by || null,
      collection_source: collection.source || null,
      owner_login: report.owner_login,
      pull_request_count: report.counts.pull_requests,
      decision_count: decisionCount,
    },
    input: {
      content_sha256: input.sha256,
      canonical_bytes: input.canonical_bytes,
    },
    outcome: {
      ok: report.ok,
      error_count: report.errors.length,
      defect_codes: sortedUnique(report.errors.map((error) => error.code)),
      warning_codes: sortedUnique(
        report.records.flatMap((record) => record.warnings.map((warning) => warning.code)),
      ),
      adjudicated: report.counts.adjudicated,
      superseded_by_head: report.counts.superseded,
      not_adjudication: report.counts.not_adjudication,
      awaiting_adjudication: report.counts.awaiting_adjudication,
      attention_resolutions_stated: report.counts.attention_resolutions,
      record_ids: report.records
        .filter((record) => record.status === RECORD_STATUSES.ADJUDICATED)
        .map((record) => record.record_id),
      ruling_ids: report.rulings.map((ruling) => ruling.ruling_id),
      proposal_ids: graduation.proposals.map((proposal) => proposal.proposal_id),
    },
    boundary: {
      no_github_write: true,
      performs_adjudication: false,
      edits_doctrine: false,
      resolves_attention: false,
      write_boundary: ADJUDICATION_WRITE_BOUNDARY,
    },
  };

  return sealReceipt(receipt);
}

module.exports = { buildAdjudicationReceipt };
