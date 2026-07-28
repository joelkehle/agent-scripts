const { DEFECT_CODES, ID_PATTERN, REPOSITORY_PATTERN } = require("./manifest-schema");

// Schemas this repository owns.
const EVIDENCE_SCHEMA = "github-lifecycle-adjudication-evidence.v1";
const REPORT_SCHEMA = "github-lifecycle-adjudication-report.v1";
const RECORD_SCHEMA = "github-lifecycle-adjudication-record.v1";
const GRADUATION_SCHEMA = "github-lifecycle-graduation-proposal.v1";
const ADJUDICATION_RECEIPT_SCHEMA = "github-lifecycle-adjudication-receipt.v1";
const RULING_SCHEMA = "github-lifecycle-ruling.v1";

// Schemas other components own. This tool reads them and never emits them:
// `owner-attention.v1` and `adjudication-observation.v1` belong to the
// coordinator's attention contract, `ready-for-joel.v1` to the review packet,
// and `github-lifecycle-claim.v1` to the issue claim stream.
const ATTENTION_ITEM_SCHEMA = "owner-attention.v1";
const ATTENTION_OBSERVATION_SCHEMA = "adjudication-observation.v1";
const READY_PACKET_MARKER = "ready-for-joel.v1";
const CLAIM_SCHEMA = "github-lifecycle-claim.v1";

const MARKER_SCHEMAS = [
  READY_PACKET_MARKER,
  ATTENTION_ITEM_SCHEMA,
  ATTENTION_OBSERVATION_SCHEMA,
  RULING_SCHEMA,
  CLAIM_SCHEMA,
];

// Vocabulary mirrored from the coordinator's attention contract
// (`internal/contributioncoordinator/attention_contract.go`). Values are the
// wire strings; this repository must not widen them.
const GITHUB_DISPOSITIONS = {
  MERGED: "merged",
  CLOSED: "closed",
  CHANGES_REQUESTED: "changes_requested",
  HEAD_CHANGED: "head_changed",
};

const OBSERVED_ACTIONS = { APPROVE: "approve", DISMISS: "dismiss", SUPERSEDE: "supersede" };
const ATTENTION_DECISIONS = {
  ACKNOWLEDGED: "acknowledged",
  DISMISSED: "dismissed",
  SUPERSEDED_BY_HEAD: "superseded_by_head",
};
const ATTENTION_STATES = { OPEN: "open", SUPERSEDED: "superseded", DISPOSED: "disposed" };

// A merge accepts the item; a close or a Joel-authored request-changes disposes
// of it without acceptance. The Project Manager vocabulary has no separate
// request-changes value, so `github_disposition` keeps the precise act.
const DISPOSITION_MAP = {
  [GITHUB_DISPOSITIONS.MERGED]: {
    action: "merge",
    observed_action: OBSERVED_ACTIONS.APPROVE,
    decision: ATTENTION_DECISIONS.ACKNOWLEDGED,
    proposed_state: ATTENTION_STATES.DISPOSED,
  },
  [GITHUB_DISPOSITIONS.CLOSED]: {
    action: "close",
    observed_action: OBSERVED_ACTIONS.DISMISS,
    decision: ATTENTION_DECISIONS.DISMISSED,
    proposed_state: ATTENTION_STATES.DISPOSED,
  },
  [GITHUB_DISPOSITIONS.CHANGES_REQUESTED]: {
    action: "request_changes",
    observed_action: OBSERVED_ACTIONS.DISMISS,
    decision: ATTENTION_DECISIONS.DISMISSED,
    proposed_state: ATTENTION_STATES.DISPOSED,
  },
};

const RECORD_STATUSES = {
  ADJUDICATED: "adjudicated",
  SUPERSEDED_BY_HEAD: "superseded_by_head",
  NOT_ADJUDICATION: "not_adjudication",
};

const DEFAULT_OWNER_LOGIN = "joelkehle";

// Read/propose boundary. Nothing in these modules may reach GitHub.
const ADJUDICATION_WRITE_BOUNDARY =
  "read-only observation of recorded evidence; this tool performs no GitHub write, " +
  "no APPROVE, no merge, no request-changes, and no doctrine edit";

const ATTENTION_ADAPTER =
  "separately authorized guarded owner-attention adapter in the contribution coordinator (GHL-008)";

const HEAD_SHA_PATTERN = "^[0-9a-f]{7,40}$";
const TIMESTAMP_PATTERN = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$";
const RULING_SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";
const RULING_ID_PREFIX = "JK-RULING";

// The four canonical documents a durable ruling may own, with the change
// control each one imposes. A ruling naming anything else fails closed rather
// than inventing a home.
const OWNING_DOCUMENTS = {
  "docs/contribution-review-architecture.md": {
    title: "Contribution Review Architecture Contract",
    change_control:
      "Update the contract, run an Elephant Check when the change is system-level, reconcile with the " +
      "Maintainer Charter, Contributor Operating Protocol, and State Architecture, and take Joel's " +
      "adjudication through a PR.",
  },
  "docs/maintainer-charter.md": {
    title: "Maintainer Charter",
    change_control:
      "Add the charter changelog entry and merge to `main`; the amendment becomes effective on merge.",
  },
  "docs/contributor-operating-protocol.md": {
    title: "Contributor Operating Protocol",
    change_control:
      "Reconcile the protocol to the Maintainer Charter rulings and the architecture contract; " +
      "the protocol never wins a conflict with them.",
  },
  "docs/STATE_ARCHITECTURE.md": {
    title: "State Architecture",
    change_control: "A state-ownership move requires this document in the same commit as the move.",
  },
};

const OWNING_DOCUMENT_ALIASES = Object.keys(OWNING_DOCUMENTS).reduce((aliases, docPath) => {
  aliases[docPath.slice("docs/".length)] = docPath;
  aliases[docPath] = docPath;

  return aliases;
}, {});

function resolveOwningDocument(value) {
  if (typeof value !== "string") {
    return null;
  }

  return OWNING_DOCUMENT_ALIASES[value.trim()] || null;
}

const ADJUDICATION_DEFECT_CODES = {
  ...DEFECT_CODES,
  DUPLICATE_PULL_REQUEST: "duplicate_pull_request",
  DUPLICATE_DECISION: "duplicate_decision",
  MALFORMED_MARKER: "malformed_marker",
  UNKNOWN_OWNING_DOCUMENT: "unknown_owning_document",
  RULING_ID_COLLISION: "ruling_id_collision",
};

const ADJUDICATION_WARNING_CODES = {
  DECISION_WITHOUT_PACKET: "decision_without_packet",
  DECISION_WITHOUT_ATTENTION: "decision_without_attention",
  ATTENTION_HEAD_MISMATCH: "attention_head_mismatch",
  PACKET_HEAD_MISMATCH: "packet_head_mismatch",
  NON_OWNER_DECISION: "non_owner_decision",
  NON_OWNER_RULING: "non_owner_ruling",
  RULING_HEAD_MISMATCH: "ruling_head_mismatch",
  GRADUATION_SUPPRESSED: "graduation_suppressed_stale_head",
  ATTENTION_ALREADY_DISPOSED: "attention_already_disposed",
};

const EVIDENCE_FIELDS = {
  required: {
    schema: { type: "string", const: EVIDENCE_SCHEMA },
    bundle_version: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    collection: { type: "object" },
    pull_requests: { type: "array", minItems: 1, itemType: "object" },
  },
  optional: {
    owner_login: { type: "string", minLength: 1 },
    notes: { type: "array", itemType: "string" },
  },
};

const COLLECTION_FIELDS = {
  required: {
    collected_at: { type: "string", pattern: TIMESTAMP_PATTERN },
    collected_by: { type: "string", minLength: 1 },
    source: { type: "string", enum: ["recorded", "fixture"] },
  },
  optional: {
    note: { type: "string", minLength: 1 },
  },
};

const PULL_REQUEST_FIELDS = {
  required: {
    repository: { type: "string", pattern: REPOSITORY_PATTERN },
    pull_number: { type: "number" },
    current_head_sha: { type: "string", pattern: HEAD_SHA_PATTERN },
    state: { type: "string", enum: ["open", "closed", "merged"] },
    business_scope: { type: "string", enum: ["personal", "shared", "ucla"] },
  },
  optional: {
    url: { type: "string", minLength: 1 },
    lineage: { type: "object" },
    decisions: { type: "array", itemType: "object" },
    comments: { type: "array", itemType: "object" },
    issue_comments: { type: "array", itemType: "object" },
    note: { type: "string", minLength: 1 },
  },
};

const LINEAGE_FIELDS = {
  required: {
    issue_number: { type: "number" },
    issue_id: { type: "string", pattern: ID_PATTERN },
  },
  optional: {
    repository: { type: "string", pattern: REPOSITORY_PATTERN },
    issue_url: { type: "string", minLength: 1 },
    spec_id: { type: "string", pattern: ID_PATTERN },
    source_revision: { type: "string", pattern: "^\\S+$" },
    requirements: { type: "array", itemType: "string", itemPattern: ID_PATTERN },
  },
};

const DECISION_FIELDS = {
  required: {
    github_disposition: { type: "string", enum: Object.keys(DISPOSITION_MAP) },
    decided_by: { type: "string", minLength: 1 },
    decided_at: { type: "string", pattern: TIMESTAMP_PATTERN },
    head_sha: { type: "string", pattern: HEAD_SHA_PATTERN },
  },
  optional: {
    url: { type: "string", minLength: 1 },
    reason: { type: "string", minLength: 1 },
    observed_from: { type: "string", minLength: 1 },
  },
};

const COMMENT_FIELDS = {
  required: {
    comment_id: { type: "number" },
    author: { type: "string", minLength: 1 },
    created_at: { type: "string", pattern: TIMESTAMP_PATTERN },
    body: { type: "string", minLength: 1 },
  },
  optional: {
    url: { type: "string", minLength: 1 },
  },
};

// Fields the ruling comment payload must carry. The statement is Joel's own
// text; this tool never writes it, only cites it.
const RULING_FIELDS = {
  required: {
    schema: { type: "string", const: RULING_SCHEMA },
    owning_document: { type: "string", minLength: 1 },
    ruling_slug: { type: "string", pattern: RULING_SLUG_PATTERN },
    statement: { type: "string", minLength: 1 },
  },
  optional: {
    head_sha: { type: "string", pattern: HEAD_SHA_PATTERN },
    ruling_refs: { type: "array", itemType: "string" },
    requirement_ids: { type: "array", itemType: "string", itemPattern: ID_PATTERN },
    supersedes: { type: "array", itemType: "string", itemPattern: ID_PATTERN },
    reason: { type: "string", minLength: 1 },
  },
};

module.exports = {
  ADJUDICATION_DEFECT_CODES,
  ADJUDICATION_RECEIPT_SCHEMA,
  ADJUDICATION_WARNING_CODES,
  ADJUDICATION_WRITE_BOUNDARY,
  ATTENTION_ADAPTER,
  ATTENTION_DECISIONS,
  ATTENTION_ITEM_SCHEMA,
  ATTENTION_OBSERVATION_SCHEMA,
  ATTENTION_STATES,
  CLAIM_SCHEMA,
  COLLECTION_FIELDS,
  COMMENT_FIELDS,
  DECISION_FIELDS,
  DEFAULT_OWNER_LOGIN,
  DISPOSITION_MAP,
  EVIDENCE_FIELDS,
  EVIDENCE_SCHEMA,
  GITHUB_DISPOSITIONS,
  GRADUATION_SCHEMA,
  HEAD_SHA_PATTERN,
  LINEAGE_FIELDS,
  MARKER_SCHEMAS,
  OBSERVED_ACTIONS,
  OWNING_DOCUMENTS,
  PULL_REQUEST_FIELDS,
  READY_PACKET_MARKER,
  RECORD_SCHEMA,
  RECORD_STATUSES,
  REPORT_SCHEMA,
  RULING_FIELDS,
  RULING_ID_PREFIX,
  RULING_SCHEMA,
  RULING_SLUG_PATTERN,
  resolveOwningDocument,
};
