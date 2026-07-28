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
const pilotLedger = require("./pilot-ledger");
const pilotPreflight = require("./pilot-preflight");
const pilotRunner = require("./pilot-runner");
const pilotSchema = require("./pilot-schema");
const pilotValidator = require("./pilot-validator");
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

function loadJsonDocument(documentPath, label) {
  let text;

  try {
    text = readFileSync(documentPath, "utf8");
  } catch (error) {
    throw new Error(`cannot read ${label} ${documentPath}: ${error.code || error.message}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${documentPath}: ${label} is not valid JSON: ${error.message}`);
  }
}

function loadScenarioMap(mapPath) {
  return loadJsonDocument(mapPath, "scenario map");
}

function loadActivationSpec(specPath) {
  return loadJsonDocument(specPath, "activation spec");
}

function loadBuildIdentities(identitiesPath) {
  return loadJsonDocument(identitiesPath, "observed build identities");
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
  ...pilotSchema,
  ...pilotValidator,
  ...pilotRunner,
  ...pilotLedger,
  ...pilotPreflight,
  loadActivationSpec,
  loadBuildIdentities,
  loadEvidenceBundle,
  loadManifest,
  loadScenarioMap,
  parseManifest,
};
