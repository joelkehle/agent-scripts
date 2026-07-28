const { canonicalize, sha256Hex } = require("./canonical-json");
const { detectMarkerSchema, parseMarkedComment } = require("./comment-markers");
const { checkObject } = require("./manifest-validator");
const {
  ADJUDICATION_DEFECT_CODES,
  ATTENTION_ITEM_SCHEMA,
  ATTENTION_OBSERVATION_SCHEMA,
  CLAIM_SCHEMA,
  COLLECTION_FIELDS,
  COMMENT_FIELDS,
  DECISION_FIELDS,
  DEFAULT_OWNER_LOGIN,
  EVIDENCE_FIELDS,
  EVIDENCE_SCHEMA,
  LINEAGE_FIELDS,
  MARKER_SCHEMAS,
  PULL_REQUEST_FIELDS,
  READY_PACKET_MARKER,
  RULING_FIELDS,
  RULING_SCHEMA,
  resolveOwningDocument,
} = require("./adjudication-schema");

// Reads a recorded evidence bundle and turns each GitHub comment into the
// lifecycle payload its marker declares. Nothing here contacts GitHub: live
// collection belongs to the deployed coordinator, and this reader only sees
// what an authorized collector already wrote down.

function defect(errors, code, path, message) {
  errors.push({ code, path, message });
}

function normalizeSha(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeLogin(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// Heads are compared as exact lowercase strings. A bundle that abbreviates one
// head and spells out another is a collection defect, not a near match.
function sameHead(left, right) {
  const a = normalizeSha(left);
  const b = normalizeSha(right);

  return a.length > 0 && a === b;
}

function checkPositiveInteger(value, path, errors) {
  if (typeof value !== "number") {
    return false;
  }

  if (!Number.isInteger(value) || value <= 0) {
    defect(errors, ADJUDICATION_DEFECT_CODES.INVALID_FIELD, path, "must be a positive integer");
    return false;
  }

  return true;
}

function readMarkedComment(comment, schema, path, errors) {
  try {
    return parseMarkedComment(comment.body, schema);
  } catch (error) {
    defect(errors, ADJUDICATION_DEFECT_CODES.MALFORMED_MARKER, path, error.message);
    return null;
  }
}

function commentEnvelope(comment, parsed) {
  return {
    comment_id: comment.comment_id,
    author: comment.author,
    created_at: comment.created_at,
    url: comment.url || null,
    attributes: parsed.attributes,
    payload: parsed.payload,
    payload_sha256: parsed.payload_sha256,
  };
}

function checkRulingPayload(payload, path, errors) {
  checkObject(payload, RULING_FIELDS, path, errors);

  const owningDocument = resolveOwningDocument(payload.owning_document);

  if (!owningDocument) {
    defect(
      errors,
      ADJUDICATION_DEFECT_CODES.UNKNOWN_OWNING_DOCUMENT,
      `${path}.owning_document`,
      `${JSON.stringify(payload.owning_document)} is not a canonical doctrine document`,
    );
    return null;
  }

  return owningDocument;
}

function readComments(comments, basePath, errors) {
  const read = { packets: [], attention_items: [], observations: [], rulings: [], claims: [], prose: 0 };

  comments.forEach((comment, index) => {
    const path = `${basePath}[${index}]`;

    checkObject(comment, COMMENT_FIELDS, path, errors);
    checkPositiveInteger(comment.comment_id, `${path}.comment_id`, errors);

    if (typeof comment.body !== "string") {
      return;
    }

    const schema = detectMarkerSchema(comment.body, MARKER_SCHEMAS);

    if (!schema) {
      read.prose += 1;
      return;
    }

    const parsed = readMarkedComment(comment, schema, path, errors);

    if (!parsed) {
      return;
    }

    const envelope = commentEnvelope(comment, parsed);

    switch (schema) {
      case READY_PACKET_MARKER:
        read.packets.push(envelope);
        break;
      case ATTENTION_ITEM_SCHEMA:
        read.attention_items.push(envelope);

        if (parsed.payload.disposition) {
          read.observations.push({ ...envelope, payload: parsed.payload.disposition, embedded_in_item: true });
        }

        break;
      case ATTENTION_OBSERVATION_SCHEMA:
        read.observations.push({ ...envelope, embedded_in_item: false });
        break;
      case RULING_SCHEMA: {
        const owningDocument = checkRulingPayload(parsed.payload, `${path}.payload`, errors);

        read.rulings.push({ ...envelope, owning_document: owningDocument });
        break;
      }
      case CLAIM_SCHEMA:
        read.claims.push(envelope);
        break;
      default:
        read.prose += 1;
    }
  });

  return read;
}

function readDecisions(decisions, basePath, errors) {
  const seen = new Set();

  return decisions.map((decision, index) => {
    const path = `${basePath}[${index}]`;

    checkObject(decision, DECISION_FIELDS, path, errors);

    // Two identical decision entries would reduce to one record identity, so a
    // replayed bundle must not carry the same act twice.
    const identity = [
      normalizeSha(decision.head_sha),
      decision.github_disposition,
      normalizeLogin(decision.decided_by),
      decision.decided_at,
    ].join("\u0000");

    if (seen.has(identity)) {
      defect(errors, ADJUDICATION_DEFECT_CODES.DUPLICATE_DECISION, path, "is recorded more than once");
    }

    seen.add(identity);

    return { ...decision, index };
  });
}

function readPullRequest(pullRequest, index, errors) {
  const path = `pull_requests[${index}]`;

  checkObject(pullRequest, PULL_REQUEST_FIELDS, path, errors);
  checkPositiveInteger(pullRequest.pull_number, `${path}.pull_number`, errors);

  if (pullRequest.lineage) {
    checkObject(pullRequest.lineage, LINEAGE_FIELDS, `${path}.lineage`, errors);
    checkPositiveInteger(pullRequest.lineage.issue_number, `${path}.lineage.issue_number`, errors);
  }

  const comments = Array.isArray(pullRequest.comments) ? pullRequest.comments : [];
  const issueComments = Array.isArray(pullRequest.issue_comments) ? pullRequest.issue_comments : [];
  const decisions = Array.isArray(pullRequest.decisions) ? pullRequest.decisions : [];
  const read = readComments(comments, `${path}.comments`, errors);
  const issueRead = readComments(issueComments, `${path}.issue_comments`, errors);

  return {
    path,
    repository: pullRequest.repository,
    pull_number: pullRequest.pull_number,
    url: pullRequest.url || null,
    current_head_sha: pullRequest.current_head_sha,
    state: pullRequest.state,
    business_scope: pullRequest.business_scope,
    lineage: pullRequest.lineage || null,
    decisions: readDecisions(decisions, `${path}.decisions`, errors),
    packets: read.packets,
    attention_items: read.attention_items,
    observations: read.observations,
    rulings: read.rulings,
    claims: [...issueRead.claims, ...read.claims],
    unmarked_comments: read.prose + issueRead.prose,
  };
}

function readEvidence(bundle, source) {
  const errors = [];

  if (bundle === null || typeof bundle !== "object" || Array.isArray(bundle)) {
    defect(errors, ADJUDICATION_DEFECT_CODES.INVALID_FIELD, "<evidence>", "must be a JSON object");

    return { schema: EVIDENCE_SCHEMA, source: source || null, ok: false, errors, pull_requests: [] };
  }

  checkObject(bundle, EVIDENCE_FIELDS, "", errors);

  if (bundle.collection && typeof bundle.collection === "object" && !Array.isArray(bundle.collection)) {
    checkObject(bundle.collection, COLLECTION_FIELDS, "collection", errors);
  }

  const pullRequests = Array.isArray(bundle.pull_requests) ? bundle.pull_requests : [];
  const seen = new Set();
  const read = pullRequests.map((pullRequest, index) => {
    if (pullRequest === null || typeof pullRequest !== "object" || Array.isArray(pullRequest)) {
      return null;
    }

    const key = `${normalizeLogin(pullRequest.repository)}#${pullRequest.pull_number}`;

    if (seen.has(key)) {
      defect(
        errors,
        ADJUDICATION_DEFECT_CODES.DUPLICATE_PULL_REQUEST,
        `pull_requests[${index}]`,
        `${key} is recorded more than once`,
      );
    }

    seen.add(key);

    return readPullRequest(pullRequest, index, errors);
  });

  return {
    schema: EVIDENCE_SCHEMA,
    bundle_version: bundle.bundle_version || null,
    source: source || null,
    collection: bundle.collection || null,
    owner_login: bundle.owner_login || DEFAULT_OWNER_LOGIN,
    notes: Array.isArray(bundle.notes) ? [...bundle.notes] : [],
    evidence_sha256: sha256Hex(canonicalize(bundle)),
    ok: errors.length === 0,
    errors,
    pull_requests: read.filter((entry) => entry !== null),
  };
}

module.exports = { normalizeLogin, normalizeSha, readEvidence, sameHead };
