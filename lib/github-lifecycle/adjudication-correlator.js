const { normalizeLogin, normalizeSha, sameHead } = require("./adjudication-evidence");
const { collectRulings, dedupeRulings, identityHash, sealRulings } = require("./adjudication-rulings");
const {
  ADJUDICATION_WARNING_CODES,
  ADJUDICATION_WRITE_BOUNDARY,
  ATTENTION_ADAPTER,
  ATTENTION_STATES,
  DISPOSITION_MAP,
  READY_PACKET_MARKER,
  RECORD_SCHEMA,
  RECORD_STATUSES,
  REPORT_SCHEMA,
} = require("./adjudication-schema");

// Correlates one Joel decision with the packet, owner-attention item, and issue
// lineage that belong to the same `(repository, pull_request, head_sha)`. A
// decision at a head the pull request has moved past is recorded and marked
// inapplicable; it never resolves attention and never graduates doctrine.

const RECORD_ID_LENGTH = 32;

function decisionIdentity(pullRequest, decision) {
  return [
    RECORD_SCHEMA,
    normalizeLogin(pullRequest.repository),
    pullRequest.pull_number,
    normalizeSha(decision.head_sha),
    decision.github_disposition,
    normalizeLogin(decision.decided_by),
    decision.decided_at,
  ];
}

function lastMatchingHead(entries, headSha) {
  let found = null;

  for (const entry of entries) {
    if (sameHead(entry.payload.head_sha, headSha)) {
      found = entry;
    }
  }

  return found;
}

function packetBlock(entry) {
  const payload = entry.payload;

  return {
    marker: payload.marker || READY_PACKET_MARKER,
    head_sha: payload.head_sha || null,
    declared_payload_hash: payload.payload_hash || null,
    observed_payload_sha256: entry.payload_sha256,
    recommended_disposition: payload.recommended_disposition || null,
    contributor_identity: payload.contributor_identity || null,
    reviewer_identity: payload.reviewer_identity || null,
    poster_identity: payload.poster_identity || null,
    reviewer_independent: payload.reviewer_independent === true,
    generated_at: payload.generated_at || null,
    comment_id: entry.comment_id,
    url: entry.url,
  };
}

function attentionBlock(entry) {
  const payload = entry.payload;

  return {
    item_key: payload.item_key || null,
    idempotency_key: payload.idempotency_key || null,
    event_id: payload.event_id || null,
    state: payload.state || null,
    head_sha: payload.head_sha || null,
    required_action: payload.required_action || null,
    posted_by: payload.posted_by || null,
    business_scope: payload.business_scope || null,
    comment_id: entry.comment_id,
    url: entry.url,
  };
}

function decisionAnalysis(payload) {
  const analysis = payload.decision_analysis;

  if (!analysis || typeof analysis !== "object") {
    return { confidence: null, reversibility: null };
  }

  const recommendation = analysis.recommendation && typeof analysis.recommendation === "object" ? analysis.recommendation : null;
  const confidence = recommendation && recommendation.confidence !== undefined ? recommendation.confidence : analysis.confidence;

  return {
    confidence: typeof confidence === "number" ? confidence : null,
    reversibility: typeof analysis.reversibility === "string" ? analysis.reversibility : null,
  };
}

// Stated confidence is a forecast scored against the adjudicated outcome. It is
// calibration input for the reviewer identity, never adjudication authority.
function calibrationBlock(packet, action) {
  if (!packet) {
    return null;
  }

  const recommended = packet.payload.recommended_disposition || null;
  const analysis = decisionAnalysis(packet.payload);
  let followed = null;

  if (recommended === "merge") {
    followed = action === "merge";
  } else if (recommended === "request_changes") {
    followed = action === "request_changes";
  }

  return {
    reviewer_identity: packet.payload.reviewer_identity || null,
    recommended_disposition: recommended,
    stated_confidence: analysis.confidence,
    reversibility: analysis.reversibility,
    decided_action: action,
    recommendation_followed: followed,
    note: "decision quality and outcome quality are scored separately",
  };
}

function alreadyObserved(observations, decision) {
  return observations.some(
    (entry) =>
      sameHead(entry.payload.head_sha, decision.head_sha) &&
      entry.payload.github_disposition === decision.github_disposition &&
      normalizeLogin(entry.payload.decided_by) === normalizeLogin(decision.decided_by),
  );
}

function attentionResolution(attention, decision, mapping, observations, warnings) {
  const payload = attention.payload;
  const disposed = payload.state === ATTENTION_STATES.DISPOSED || Boolean(payload.disposition);
  const observed = alreadyObserved(observations, decision);

  if (disposed) {
    warnings.push({
      code: ADJUDICATION_WARNING_CODES.ATTENTION_ALREADY_DISPOSED,
      message: `owner-attention item ${payload.item_key} already records a disposition`,
    });
  }

  return {
    item_key: payload.item_key || null,
    item_idempotency_key: payload.idempotency_key || null,
    item_state: payload.state || null,
    proposed_state: mapping.proposed_state,
    observed_action: mapping.observed_action,
    decision: mapping.decision,
    github_disposition: decision.github_disposition,
    already_observed: observed,
    already_disposed: disposed,
    write_needed: !observed && !disposed,
    performed: false,
    performed_by: null,
    adapter: ATTENTION_ADAPTER,
    statement:
      `owner-attention item ${payload.item_key} resolves as ${mapping.proposed_state} ` +
      `(${mapping.observed_action}/${mapping.decision}); the ${ATTENTION_ADAPTER} owns that write`,
  };
}

function buildRecord(context, errors) {
  const { pullRequest, decision, owner_login: ownerLogin } = context;
  const warnings = [];
  const isOwner = normalizeLogin(decision.decided_by) === normalizeLogin(ownerLogin);
  const currentHead = sameHead(decision.head_sha, pullRequest.current_head_sha);
  const mapping = DISPOSITION_MAP[decision.github_disposition];
  const packet = lastMatchingHead(pullRequest.packets, decision.head_sha);
  const attention = lastMatchingHead(pullRequest.attention_items, decision.head_sha);

  let status = RECORD_STATUSES.ADJUDICATED;
  let classification = "owner_adjudication";
  let blocked = null;

  if (!isOwner) {
    status = RECORD_STATUSES.NOT_ADJUDICATION;
    classification = "non_owner_action";
    blocked = `${decision.decided_by} is not the adjudicating owner; a policy guardrail is not Joel's adjudication`;
    warnings.push({
      code: ADJUDICATION_WARNING_CODES.NON_OWNER_DECISION,
      message: `${decision.github_disposition} by ${decision.decided_by} is recorded but is not adjudication`,
    });
  } else if (!currentHead) {
    status = RECORD_STATUSES.SUPERSEDED_BY_HEAD;
    classification = "stale_decision";
    blocked =
      `decided head ${normalizeSha(decision.head_sha)} is not the current head ` +
      `${normalizeSha(pullRequest.current_head_sha)}; a changed head makes a stale decision inapplicable`;
  }

  if (!packet) {
    warnings.push({
      code: pullRequest.packets.length > 0
        ? ADJUDICATION_WARNING_CODES.PACKET_HEAD_MISMATCH
        : ADJUDICATION_WARNING_CODES.DECISION_WITHOUT_PACKET,
      message: `no ready-for-joel.v1 packet is recorded for head ${normalizeSha(decision.head_sha)}`,
    });
  }

  if (!attention) {
    warnings.push({
      code: pullRequest.attention_items.length > 0
        ? ADJUDICATION_WARNING_CODES.ATTENTION_HEAD_MISMATCH
        : ADJUDICATION_WARNING_CODES.DECISION_WITHOUT_ATTENTION,
      message: `no owner-attention.v1 item is recorded for head ${normalizeSha(decision.head_sha)}`,
    });
  }

  const resolvable = status === RECORD_STATUSES.ADJUDICATED && attention !== null;
  const resolution = resolvable
    ? attentionResolution(attention, decision, mapping, pullRequest.observations, warnings)
    : null;

  if (!resolution && !blocked && !attention) {
    blocked = `no owner-attention.v1 item is recorded for head ${normalizeSha(decision.head_sha)}`;
  }

  let rulings = [];

  if (status === RECORD_STATUSES.ADJUDICATED) {
    rulings = sealRulings(collectRulings({ ...context, packet }, warnings, errors), pullRequest, decision, errors);
  } else {
    const candidates = collectRulings({ ...context, packet }, [], []);

    if (candidates.length > 0) {
      warnings.push({
        code: ADJUDICATION_WARNING_CODES.GRADUATION_SUPPRESSED,
        message: `${candidates.length} doctrine ruling(s) are attached to a decision that is not a current-head adjudication`,
      });
    }
  }

  const identity = decisionIdentity(pullRequest, decision);
  const idempotencyKey = identityHash(identity);

  return {
    schema: RECORD_SCHEMA,
    record_id: idempotencyKey.slice(0, RECORD_ID_LENGTH),
    idempotency_key: idempotencyKey,
    repository: pullRequest.repository,
    pull_number: pullRequest.pull_number,
    pull_request_url: pullRequest.url,
    business_scope: pullRequest.business_scope,
    status,
    classification,
    decision: {
      action: mapping ? mapping.action : null,
      github_disposition: decision.github_disposition,
      decided_by: decision.decided_by,
      decided_at: decision.decided_at,
      head_sha: normalizeSha(decision.head_sha),
      url: decision.url || null,
      reason: decision.reason || null,
      observed_from: decision.observed_from || null,
    },
    head: {
      decided: normalizeSha(decision.head_sha),
      current: normalizeSha(pullRequest.current_head_sha),
      matches_current: currentHead,
    },
    packet: packet ? packetBlock(packet) : null,
    attention: attention ? attentionBlock(attention) : null,
    attention_resolution: resolution,
    attention_resolution_blocked: resolution ? null : blocked,
    calibration: status === RECORD_STATUSES.ADJUDICATED ? calibrationBlock(packet, mapping ? mapping.action : null) : null,
    lineage: pullRequest.lineage,
    claim_events: pullRequest.claims.length,
    rulings,
    warnings,
    no_github_write: true,
    write_boundary: ADJUDICATION_WRITE_BOUNDARY,
  };
}

function awaitingEntry(pullRequest, records, ownerLogin) {
  const forPullRequest = records.filter(
    (record) => record.repository === pullRequest.repository && record.pull_number === pullRequest.pull_number,
  );

  if (forPullRequest.some((record) => record.status === RECORD_STATUSES.ADJUDICATED)) {
    return null;
  }

  let reason = `no ${ownerLogin} decision is recorded for head ${normalizeSha(pullRequest.current_head_sha)}; silence is not a decision`;

  if (forPullRequest.some((record) => record.status === RECORD_STATUSES.SUPERSEDED_BY_HEAD)) {
    reason =
      `the recorded decision applies to an earlier head; head ` +
      `${normalizeSha(pullRequest.current_head_sha)} has no adjudication`;
  } else if (forPullRequest.length > 0) {
    reason = `only non-owner actions are recorded for head ${normalizeSha(pullRequest.current_head_sha)}`;
  }

  return {
    repository: pullRequest.repository,
    pull_number: pullRequest.pull_number,
    current_head_sha: normalizeSha(pullRequest.current_head_sha),
    state: pullRequest.state,
    reason,
  };
}

function correlateAdjudications(evidence) {
  const errors = [...evidence.errors];
  const records = [];

  for (const pullRequest of evidence.pull_requests) {
    for (const decision of pullRequest.decisions) {
      if (!DISPOSITION_MAP[decision.github_disposition]) {
        continue;
      }

      records.push(buildRecord({ pullRequest, decision, owner_login: evidence.owner_login }, errors));
    }
  }

  const rulings = dedupeRulings(records, errors);
  const awaiting = evidence.pull_requests
    .map((pullRequest) => awaitingEntry(pullRequest, records, evidence.owner_login))
    .filter((entry) => entry !== null);

  return {
    schema: REPORT_SCHEMA,
    evidence_schema: evidence.schema,
    bundle_version: evidence.bundle_version,
    source: evidence.source,
    evidence_sha256: evidence.evidence_sha256 || null,
    owner_login: evidence.owner_login,
    write_boundary: ADJUDICATION_WRITE_BOUNDARY,
    no_github_write: true,
    ok: errors.length === 0,
    errors,
    records,
    awaiting_adjudication: awaiting,
    rulings,
    counts: {
      pull_requests: evidence.pull_requests.length,
      records: records.length,
      adjudicated: records.filter((record) => record.status === RECORD_STATUSES.ADJUDICATED).length,
      superseded: records.filter((record) => record.status === RECORD_STATUSES.SUPERSEDED_BY_HEAD).length,
      not_adjudication: records.filter((record) => record.status === RECORD_STATUSES.NOT_ADJUDICATION).length,
      attention_resolutions: records.filter((record) => record.attention_resolution !== null).length,
      awaiting_adjudication: awaiting.length,
      rulings: rulings.length,
      warnings: records.reduce((total, record) => total + record.warnings.length, 0),
    },
  };
}

module.exports = { correlateAdjudications };
