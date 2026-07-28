const { readFileSync } = require("node:fs");

const adjudicationCorrelator = require("./adjudication-correlator");
const adjudicationEvidence = require("./adjudication-evidence");
const adjudicationReceipt = require("./adjudication-receipt");
const adjudicationRenderer = require("./adjudication-renderer");
const adjudicationRulings = require("./adjudication-rulings");
const adjudicationSchema = require("./adjudication-schema");
const canonicalJson = require("./canonical-json");
const commentMarkers = require("./comment-markers");
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

function loadEvidenceBundle(bundlePath) {
  let text;

  try {
    text = readFileSync(bundlePath, "utf8");
  } catch (error) {
    throw new Error(`cannot read evidence bundle ${bundlePath}: ${error.code || error.message}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${bundlePath}: evidence bundle is not valid JSON: ${error.message}`);
  }
}

module.exports = {
  ...canonicalJson,
  ...commentMarkers,
  ...manifestSchema,
  ...renderer,
  ...receipt,
  ...validator,
  ...adjudicationSchema,
  ...adjudicationEvidence,
  ...adjudicationRulings,
  ...adjudicationCorrelator,
  ...adjudicationRenderer,
  ...adjudicationReceipt,
  loadEvidenceBundle,
  loadManifest,
  parseManifest,
};
