const { canonicalize, sha256Hex } = require("./canonical-json");

// Every versioned lifecycle comment GitHub carries uses the same framing: an
// HTML marker naming the schema plus its identity attributes, then the
// canonical payload in a ```json fence. `github-lifecycle-claim.v1`,
// `owner-attention.v1`, `adjudication-observation.v1`, and `ready-for-joel.v1`
// all share it, so the reader lives here once. Prose outside a valid marker is
// never lifecycle state.
const MARKER_PATTERN = /<!--([\s\S]*?)-->/g;
const FENCE_OPEN = "```json";
const FENCE_CLOSE = "```";

function parseAttributes(tokens) {
  const attributes = {};

  for (const token of tokens) {
    const separator = token.indexOf("=");

    if (separator > 0) {
      attributes[token.slice(0, separator)] = token.slice(separator + 1);
    }
  }

  return attributes;
}

// Returns the first marker whose leading token is `schema`, with everything
// after the marker so the caller can find its payload fence.
function findHtmlMarker(body, schema) {
  if (typeof body !== "string") {
    return null;
  }

  MARKER_PATTERN.lastIndex = 0;

  for (let match = MARKER_PATTERN.exec(body); match; match = MARKER_PATTERN.exec(body)) {
    const tokens = match[1].trim().split(/\s+/);

    if (tokens[0] !== schema) {
      continue;
    }

    return {
      schema,
      attributes: parseAttributes(tokens.slice(1)),
      remainder: body.slice(match.index + match[0].length),
    };
  }

  return null;
}

function extractJsonFence(text, schema) {
  const open = text.indexOf(FENCE_OPEN);

  if (open === -1) {
    throw new Error(`${schema} comment carries no \`\`\`json payload fence`);
  }

  const start = open + FENCE_OPEN.length;
  const close = text.indexOf(`\n${FENCE_CLOSE}`, start);

  if (close === -1) {
    throw new Error(`${schema} comment has an unterminated \`\`\`json payload fence`);
  }

  return text.slice(start, close).trim();
}

// A marker key that disagrees with the payload is a parse failure rather than
// state, so a hand-edited comment cannot impersonate an event.
function checkMarkerAgreement(schema, attributes, payload) {
  for (const key of ["idempotency_key", "item_key", "event_id", "head_sha"]) {
    const declared = attributes[key];
    const actual = payload[key];

    if (declared === undefined || actual === undefined) {
      continue;
    }

    if (String(declared) !== String(actual)) {
      throw new Error(
        `${schema} marker ${key} ${JSON.stringify(declared)} does not match its payload ${JSON.stringify(String(actual))}`,
      );
    }
  }
}

function parseMarkedComment(body, schema) {
  const marker = findHtmlMarker(body, schema);

  if (!marker) {
    return null;
  }

  const raw = extractJsonFence(marker.remainder, schema);
  let payload;

  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${schema} payload is not valid JSON: ${error.message}`);
  }

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${schema} payload must be a JSON object`);
  }

  if (payload.schema !== undefined && payload.schema !== schema) {
    throw new Error(`${schema} payload declares schema ${JSON.stringify(payload.schema)}`);
  }

  checkMarkerAgreement(schema, marker.attributes, payload);

  return {
    schema,
    attributes: marker.attributes,
    payload,
    payload_sha256: sha256Hex(canonicalize(payload)),
  };
}

function detectMarkerSchema(body, schemas) {
  for (const schema of schemas) {
    if (findHtmlMarker(body, schema)) {
      return schema;
    }
  }

  return null;
}

module.exports = { detectMarkerSchema, extractJsonFence, findHtmlMarker, parseMarkedComment };
