const { sha256Hex } = require("./canonical-json");
const { normalizeLogin, normalizeSha, sameHead } = require("./adjudication-evidence");
const {
  ADJUDICATION_DEFECT_CODES,
  ADJUDICATION_WARNING_CODES,
  RULING_ID_PREFIX,
  RULING_SCHEMA,
  resolveOwningDocument,
} = require("./adjudication-schema");

// Finds the durable rulings an adjudication carries and gives each one a stable
// ID. A decision graduates doctrine only through an explicit marker: an
// owner-authored ruling comment, or a ready packet judgment call flagged for
// graduation. Nothing is inferred from prose.

const RULING_SEQUENCE_MODULUS = 100;

function identityHash(parts) {
  return sha256Hex(parts.map((part) => String(part)).join("\u0000"));
}

function utcDateStamp(timestamp) {
  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10).replace(/-/g, "");
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A ruling ID is derived from the decision it belongs to, never from the clock
// or from bundle composition, so the same evidence always yields the same ID
// and another pull request in the bundle cannot renumber an existing ruling.
function deriveRulingId(identity) {
  const rulingKey = identityHash([
    RULING_SCHEMA,
    normalizeLogin(identity.repository),
    identity.pull_number,
    normalizeSha(identity.head_sha),
    identity.owning_document,
    identity.ruling_slug,
  ]);
  const stamp = utcDateStamp(identity.decided_at);

  if (!stamp) {
    return null;
  }

  const sequence = String(parseInt(rulingKey.slice(0, 4), 16) % RULING_SEQUENCE_MODULUS).padStart(2, "0");

  return { ruling_id: `${RULING_ID_PREFIX}-${stamp}-${sequence}`, ruling_key: rulingKey };
}

function listOf(value) {
  return Array.isArray(value) ? [...value] : [];
}

function ownerRulingComments(pullRequest, decision, ownerLogin, warnings) {
  const rulings = [];

  for (const entry of pullRequest.rulings) {
    if (normalizeLogin(entry.author) !== normalizeLogin(ownerLogin)) {
      warnings.push({
        code: ADJUDICATION_WARNING_CODES.NON_OWNER_RULING,
        message: `comment ${entry.comment_id} carries a ${RULING_SCHEMA} marker but ${entry.author} is not the owner`,
      });
      continue;
    }

    if (entry.payload.head_sha && !sameHead(entry.payload.head_sha, decision.head_sha)) {
      warnings.push({
        code: ADJUDICATION_WARNING_CODES.RULING_HEAD_MISMATCH,
        message: `ruling comment ${entry.comment_id} cites head ${entry.payload.head_sha}, not the decided head`,
      });
      continue;
    }

    if (!entry.owning_document) {
      continue;
    }

    rulings.push({
      source: "owner_ruling_comment",
      owning_document: entry.owning_document,
      ruling_slug: entry.payload.ruling_slug,
      statement: entry.payload.statement,
      reason: entry.payload.reason || null,
      ruling_refs: listOf(entry.payload.ruling_refs),
      requirement_ids: listOf(entry.payload.requirement_ids),
      supersedes: listOf(entry.payload.supersedes),
      evidence_url: entry.url,
      evidence_comment_id: entry.comment_id,
    });
  }

  return rulings;
}

function packetJudgmentCalls(pullRequest, packet, errors) {
  const entries = packet && Array.isArray(packet.payload.unresolved_judgment) ? packet.payload.unresolved_judgment : [];
  const rulings = [];

  entries.forEach((entry, index) => {
    if (entry === null || typeof entry !== "object" || entry.graduates_to_doctrine !== true) {
      return;
    }

    const path = `${pullRequest.path}.packet.unresolved_judgment[${index}]`;
    const owningDocument = resolveOwningDocument(entry.owning_document);

    if (!owningDocument) {
      errors.push({
        code: ADJUDICATION_DEFECT_CODES.UNKNOWN_OWNING_DOCUMENT,
        path: `${path}.owning_document`,
        message: `${JSON.stringify(entry.owning_document)} is not a canonical doctrine document`,
      });
      return;
    }

    const slug = slugify(entry.id || entry.summary || "");

    if (!slug) {
      errors.push({
        code: ADJUDICATION_DEFECT_CODES.MISSING_FIELD,
        path: `${path}.id`,
        message: "a graduating unresolved judgment call needs a stable id",
      });
      return;
    }

    rulings.push({
      source: "packet_unresolved_judgment",
      owning_document: owningDocument,
      ruling_slug: slug,
      statement: entry.summary || entry.statement || "",
      reason: entry.reason || null,
      ruling_refs: listOf(entry.ruling_refs),
      requirement_ids: listOf(entry.requirement_ids),
      supersedes: listOf(entry.supersedes),
      evidence_url: packet.url,
      evidence_comment_id: packet.comment_id,
    });
  });

  return rulings;
}

function collectRulings(context, warnings, errors) {
  const { pullRequest, decision, packet, owner_login: ownerLogin } = context;

  return [
    ...ownerRulingComments(pullRequest, decision, ownerLogin, warnings),
    ...packetJudgmentCalls(pullRequest, packet, errors),
  ];
}

// Fills the derived identity and the decision context each ruling cites, so a
// rendered proposal never has to reach back into the bundle.
function sealRulings(rulings, pullRequest, decision, errors) {
  return rulings
    .map((ruling) => {
      const derived = deriveRulingId({
        repository: pullRequest.repository,
        pull_number: pullRequest.pull_number,
        head_sha: decision.head_sha,
        owning_document: ruling.owning_document,
        ruling_slug: ruling.ruling_slug,
        decided_at: decision.decided_at,
      });

      if (!derived) {
        errors.push({
          code: ADJUDICATION_DEFECT_CODES.INVALID_FIELD,
          path: `${pullRequest.path}.decisions[${decision.index}].decided_at`,
          message: "is not a parseable timestamp, so no ruling ID can be derived",
        });

        return null;
      }

      return {
        ...derived,
        ...ruling,
        repository: pullRequest.repository,
        pull_number: pullRequest.pull_number,
        head_sha: normalizeSha(decision.head_sha),
        decided_at: decision.decided_at,
        decided_by: decision.decided_by,
        github_disposition: decision.github_disposition,
        lineage: pullRequest.lineage,
      };
    })
    .filter((ruling) => ruling !== null);
}

// A ruling may be cited by more than one record on the same head. Identical
// rulings collapse onto one entry; two different rulings that derive the same
// ID are a defect rather than a silent merge.
function dedupeRulings(records, errors) {
  const byKey = new Map();
  const byId = new Map();

  for (const record of records) {
    for (const ruling of record.rulings) {
      if (byKey.has(ruling.ruling_key)) {
        continue;
      }

      const collision = byId.get(ruling.ruling_id);

      if (collision && collision !== ruling.ruling_key) {
        errors.push({
          code: ADJUDICATION_DEFECT_CODES.RULING_ID_COLLISION,
          path: `${record.repository}#${record.pull_number}`,
          message: `${ruling.ruling_id} is derived by two different rulings`,
        });
        continue;
      }

      byId.set(ruling.ruling_id, ruling.ruling_key);
      byKey.set(ruling.ruling_key, { ...ruling, record_id: record.record_id });
    }
  }

  return [...byKey.values()].sort((left, right) =>
    left.ruling_id === right.ruling_id
      ? left.ruling_key.localeCompare(right.ruling_key)
      : left.ruling_id.localeCompare(right.ruling_id),
  );
}

module.exports = { collectRulings, dedupeRulings, deriveRulingId, identityHash, sealRulings, slugify };
