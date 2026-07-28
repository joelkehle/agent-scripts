const { contentHash } = require("./canonical-json");
const { sealReceipt } = require("./validation-receipt");
const {
  PREFLIGHT_REFUSAL_CODES,
  PREFLIGHT_SCHEMA,
  PREFLIGHT_WRITE_BOUNDARY,
  commitMatches,
} = require("./pilot-schema");

function refusal(code, checkpoint, message, extra) {
  return {
    code,
    checkpoint_id: checkpoint.checkpoint_id,
    service: checkpoint.service,
    message,
    ...extra,
  };
}

function indexServices(observed) {
  const byName = new Map();
  const duplicates = new Set();

  for (const service of observed.services || []) {
    if (byName.has(service.service)) {
      duplicates.add(service.service);
      continue;
    }

    byName.set(service.service, service);
  }

  return { byName, duplicates };
}

function observedReceiptIds(observed) {
  return new Set((observed.checkpoint_receipts || []).map((receipt) => receipt.checkpoint_id));
}

// Every clause is checked and every failure is reported, rather than stopping
// at the first one, so the operator sees the whole distance to activation.
function evaluateCheckpoint(checkpoint, context) {
  const { byName, duplicates, receipts } = context;
  const refusals = [];
  const service = byName.get(checkpoint.service);

  for (const required of checkpoint.requires_receipts || []) {
    if (!receipts.has(required)) {
      refusals.push(
        refusal(PREFLIGHT_REFUSAL_CODES.MISSING_CHECKPOINT_RECEIPT, checkpoint, `historical ${required} receipt is not recorded`, {
          required_receipt: required,
        }),
      );
    }
  }

  if (duplicates.has(checkpoint.service)) {
    refusals.push(
      refusal(PREFLIGHT_REFUSAL_CODES.DUPLICATE_SERVICE, checkpoint, `service ${checkpoint.service} is reported more than once`, {}),
    );
  }

  if (!service) {
    refusals.push(
      refusal(PREFLIGHT_REFUSAL_CODES.SERVICE_ABSENT, checkpoint, `no observed build identity reports service ${checkpoint.service}`, {
        required_commit: checkpoint.required_commit,
      }),
    );

    return {
      checkpoint_id: checkpoint.checkpoint_id,
      service: checkpoint.service,
      repository: checkpoint.repository,
      required_commit: checkpoint.required_commit,
      contains_issues: [...checkpoint.contains_issues],
      observed_commit: null,
      observed_dirty: null,
      observed_activated_at: null,
      rollback: checkpoint.rollback,
      satisfied: false,
      refusals,
    };
  }

  const commit = typeof service.commit === "string" ? service.commit.trim() : "";

  if (commit.length === 0) {
    refusals.push(
      refusal(PREFLIGHT_REFUSAL_CODES.COMMIT_UNKNOWN, checkpoint, `service ${checkpoint.service} reports no build commit`, {
        required_commit: checkpoint.required_commit,
      }),
    );
  } else if (!commitMatches(checkpoint.required_commit, commit)) {
    refusals.push(
      refusal(
        PREFLIGHT_REFUSAL_CODES.COMMIT_MISMATCH,
        checkpoint,
        `deployed ${checkpoint.service} is at ${commit}, not the required ${checkpoint.required_commit} ` +
          `(the build containing ${checkpoint.contains_issues.join(", ")})`,
        { required_commit: checkpoint.required_commit, observed_commit: commit },
      ),
    );
  }

  if (service.dirty === true) {
    refusals.push(
      refusal(PREFLIGHT_REFUSAL_CODES.DIRTY_BUILD, checkpoint, `deployed ${checkpoint.service} reports a dirty build`, {}),
    );
  }

  const activatedAt = typeof service.activated_at === "string" ? service.activated_at.trim() : "";

  if (activatedAt.length === 0) {
    refusals.push(
      refusal(PREFLIGHT_REFUSAL_CODES.NOT_ACTIVATED, checkpoint, `deployed ${checkpoint.service} reports no activation time`, {}),
    );
  }

  return {
    checkpoint_id: checkpoint.checkpoint_id,
    service: checkpoint.service,
    repository: checkpoint.repository,
    required_commit: checkpoint.required_commit,
    contains_issues: [...checkpoint.contains_issues],
    observed_commit: commit || null,
    observed_dirty: service.dirty === true,
    observed_activated_at: activatedAt || null,
    rollback: checkpoint.rollback,
    satisfied: refusals.length === 0,
    refusals,
  };
}

// Pure comparison of a reported build identity against the required activation
// spec. Live mode is permitted only when every checkpoint matches exactly;
// anything unknown, absent, dirty, or unactivated refuses.
function evaluateActivation(options) {
  const { spec, observed } = options;
  const { byName, duplicates } = indexServices(observed);
  const receipts = observedReceiptIds(observed);
  const checkpoints = spec.checkpoints.map((checkpoint) =>
    evaluateCheckpoint(checkpoint, { byName, duplicates, receipts }),
  );

  const refusals = checkpoints.flatMap((checkpoint) => checkpoint.refusals);
  const unmatched = (observed.services || [])
    .map((service) => service.service)
    .filter((name) => !spec.checkpoints.some((checkpoint) => checkpoint.service === name));

  return {
    schema: PREFLIGHT_SCHEMA,
    spec_version: spec.spec_version,
    observed_at: observed.observed_at,
    observed_by: observed.observed_by,
    observed_source: observed.source,
    write_boundary: PREFLIGHT_WRITE_BOUNDARY,
    checkpoints,
    refusals,
    refusal_codes: [...new Set(refusals.map((entry) => entry.code))].sort(),
    services_not_in_spec: [...new Set(unmatched)].sort(),
    live_mode_permitted: refusals.length === 0,
    // A satisfied preflight is a precondition, never the authorization; the
    // canary still requires Joel's separate go-ahead.
    still_requires_owner_authorization: true,
  };
}

function buildPreflightReceipt(options) {
  const { preflight, spec, observed } = options;
  const actor = options.actor;
  const timestamp = options.timestamp;

  if (typeof actor !== "string" || actor.trim().length === 0) {
    throw new Error("actor is required");
  }

  if (typeof timestamp !== "string" || timestamp.trim().length === 0) {
    throw new Error("timestamp is required");
  }

  const specHash = contentHash(spec);
  const observedHash = contentHash(observed);

  const receipt = {
    schema: `${PREFLIGHT_SCHEMA}-receipt`,
    evaluated_at: timestamp,
    evaluator: {
      actor,
      tool: options.tool || "ghl-pilot",
      tool_version: options.tool_version || "1.0.0",
      write_class: "read",
    },
    subject: {
      spec_source: options.spec_source || null,
      observed_source: options.observed_source || null,
      spec_version: spec.spec_version,
      observed_at: observed.observed_at,
      observed_by: observed.observed_by,
      observed_kind: observed.source,
    },
    input: {
      spec_sha256: specHash.sha256,
      observed_sha256: observedHash.sha256,
    },
    outcome: {
      live_mode_permitted: preflight.live_mode_permitted,
      refusal_count: preflight.refusals.length,
      refusal_codes: [...preflight.refusal_codes],
      checkpoints: preflight.checkpoints.map((checkpoint) => ({
        checkpoint_id: checkpoint.checkpoint_id,
        service: checkpoint.service,
        required_commit: checkpoint.required_commit,
        observed_commit: checkpoint.observed_commit,
        satisfied: checkpoint.satisfied,
      })),
    },
    boundary: {
      no_network: true,
      activates_nothing: true,
      authorizes_no_canary: true,
      write_boundary: PREFLIGHT_WRITE_BOUNDARY,
    },
  };

  return sealReceipt(receipt);
}

module.exports = { buildPreflightReceipt, evaluateActivation };
