const { readFileSync } = require("node:fs");

const canonicalJson = require("./canonical-json");
const manifestSchema = require("./manifest-schema");
const renderer = require("./manifest-renderer");
const receipt = require("./validation-receipt");
const validator = require("./manifest-validator");

function parseManifest(text, source) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${source}: manifest is not valid JSON: ${error.message}`);
  }
}

function loadManifest(manifestPath) {
  let text;

  try {
    text = readFileSync(manifestPath, "utf8");
  } catch (error) {
    throw new Error(`cannot read manifest ${manifestPath}: ${error.code || error.message}`);
  }

  return parseManifest(text, manifestPath);
}

module.exports = {
  ...canonicalJson,
  ...manifestSchema,
  ...renderer,
  ...receipt,
  ...validator,
  loadManifest,
  parseManifest,
};
