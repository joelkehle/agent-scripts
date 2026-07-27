const { createHash } = require("node:crypto");

// Key-order-independent serialization so two semantically identical manifests
// always produce the same bytes and therefore the same content hash.
function canonicalize(value) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  const type = typeof value;

  if (type === "string" || type === "boolean") {
    return JSON.stringify(value);
  }

  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("cannot canonicalize a non-finite number");
    }

    return JSON.stringify(value);
  }

  if (type === "object") {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);

    return `{${pairs.join(",")}}`;
  }

  throw new Error(`cannot canonicalize a value of type ${type}`);
}

function sha256Hex(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function contentHash(value) {
  const canonical = canonicalize(value);

  return {
    canonical,
    canonical_bytes: Buffer.byteLength(canonical, "utf8"),
    sha256: sha256Hex(canonical),
  };
}

module.exports = { canonicalize, contentHash, sha256Hex };
