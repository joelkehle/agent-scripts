const { canonicalize, contentHash, sha256Hex } = require("./canonical-json");
const { RECEIPT_SCHEMA } = require("./manifest-schema");

const RECEIPT_ID_LENGTH = 32;

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}

// Derives `receipt_id` from the receipt body so any receipt in this family can
// be verified with `verifyReceipt` and tampering is detectable.
function sealReceipt(body) {
  return { ...body, receipt_id: sha256Hex(canonicalize(body)).slice(0, RECEIPT_ID_LENGTH) };
}

// The caller injects `timestamp` and `actor` so a receipt is attributable and
// reproducible; the library never reads the wall clock.
function buildValidationReceipt(options) {
  const { manifest, validation } = options;
  const actor = requireText(options.actor, "actor");
  const timestamp = requireText(options.timestamp, "timestamp");
  const tool = options.tool || "ghl-manifest";
  const toolVersion = options.tool_version || "1.0.0";
  const input = contentHash(manifest);
  const defectCodes = [...new Set(validation.errors.map((error) => error.code))].sort();

  const receipt = {
    schema: RECEIPT_SCHEMA,
    validated_at: timestamp,
    validator: {
      actor,
      tool,
      tool_version: toolVersion,
      write_class: "read",
    },
    subject: {
      source: options.source || null,
      manifest_schema: manifest && manifest.schema ? manifest.schema : null,
      manifest_version: manifest && manifest.manifest_version ? manifest.manifest_version : null,
      spec_id: manifest && manifest.specification ? manifest.specification.spec_id : null,
      source_revision: manifest && manifest.specification ? manifest.specification.source_revision : null,
      issue_count: manifest && Array.isArray(manifest.issues) ? manifest.issues.length : 0,
      requirement_count: manifest && Array.isArray(manifest.requirements) ? manifest.requirements.length : 0,
      ...(manifest && manifest.schema === "github-lifecycle-manifest.v2"
        ? {
            definition_of_done: manifest.issues.map((issue) => ({
              issue_id: issue.issue_id,
              contract: issue.definition_of_done || null,
            })),
          }
        : {}),
    },
    input: {
      content_sha256: input.sha256,
      canonical_bytes: input.canonical_bytes,
    },
    outcome: {
      ok: validation.ok,
      error_count: validation.errors.length,
      defect_codes: defectCodes,
      uncovered_requirements: [...validation.uncovered_requirements],
    },
  };

  return sealReceipt(receipt);
}

function verifyReceipt(receipt) {
  const { receipt_id: receiptId, ...body } = receipt;

  return receiptId === sha256Hex(canonicalize(body)).slice(0, RECEIPT_ID_LENGTH);
}

module.exports = { buildValidationReceipt, sealReceipt, verifyReceipt };
