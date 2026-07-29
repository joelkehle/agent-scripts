const MANIFEST_SCHEMA = "github-lifecycle-manifest.v1";
const MANIFEST_SCHEMA_V2 = "github-lifecycle-manifest.v2";
const VALIDATION_SCHEMA = "github-lifecycle-validation.v1";
const RECEIPT_SCHEMA = "github-lifecycle-validation-receipt.v1";
const RENDER_SCHEMA = "github-lifecycle-issue-proposal.v1";

// Human-facing safety classes from AGENTS.MD. `write_class` is the highest
// external-write class the issue's own execution is authorized to reach.
const WRITE_CLASSES = ["read", "propose", "write"];

const ID_PATTERN = "^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$";
const REPOSITORY_PATTERN = "^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$";
const VERSION_PATTERN = "^[0-9]+\\.[0-9]+\\.[0-9]+$";

const DEFECT_CODES = {
  SCHEMA_MISMATCH: "schema_mismatch",
  MISSING_FIELD: "missing_field",
  INVALID_FIELD: "invalid_field",
  UNKNOWN_FIELD: "unknown_field",
  DUPLICATE_ISSUE_ID: "duplicate_issue_id",
  DUPLICATE_REQUIREMENT_ID: "duplicate_requirement_id",
  UNKNOWN_REQUIREMENT: "unknown_requirement",
  MISSING_COVERAGE: "missing_coverage",
  UNKNOWN_DEPENDENCY: "unknown_dependency",
  SELF_DEPENDENCY: "self_dependency",
  DEPENDENCY_CYCLE: "dependency_cycle",
  VAGUE_DOD_FIELD: "vague_dod_field",
  MALFORMED_DOD_BUDGET: "malformed_dod_budget",
  DUPLICATE_DOD_PROOF_ID: "duplicate_dod_proof_id",
  UNKNOWN_DOD_PROOF: "unknown_dod_proof",
};

const MANIFEST_FIELDS = {
  required: {
    schema: { type: "string", const: MANIFEST_SCHEMA },
    manifest_version: { type: "string", pattern: VERSION_PATTERN },
    specification: { type: "object" },
    requirements: { type: "array", minItems: 1, itemType: "object" },
    issues: { type: "array", minItems: 1, itemType: "object" },
  },
  optional: {
    notes: { type: "array", itemType: "string" },
  },
};

const SPECIFICATION_FIELDS = {
  required: {
    spec_id: { type: "string", pattern: ID_PATTERN },
    source_revision: { type: "string", pattern: "^\\S+$" },
    source_document: { type: "string", minLength: 1 },
  },
  optional: {
    title: { type: "string", minLength: 1 },
    ratified_on: { type: "string", minLength: 1 },
    status: { type: "string", minLength: 1 },
  },
};

const REQUIREMENT_FIELDS = {
  required: {
    id: { type: "string", pattern: ID_PATTERN },
    title: { type: "string", minLength: 1 },
  },
  optional: {
    normative: { type: "boolean" },
    summary: { type: "string", minLength: 1 },
  },
};

const ISSUE_FIELDS = {
  required: {
    issue_id: { type: "string", pattern: ID_PATTERN },
    title: { type: "string", minLength: 1 },
    owner_repository: { type: "string", pattern: REPOSITORY_PATTERN },
    requirements: { type: "array", minItems: 1, itemType: "string", itemPattern: ID_PATTERN },
    depends_on: { type: "array", itemType: "string", itemPattern: ID_PATTERN },
    acceptance_criteria: { type: "array", minItems: 1, itemType: "string" },
    validation_commands: { type: "array", minItems: 1, itemType: "string" },
    non_goals: { type: "array", itemType: "string" },
    write_class: { type: "string", enum: WRITE_CLASSES },
  },
  optional: {
    summary: { type: "string", minLength: 1 },
    manager_project: { type: "string", minLength: 1 },
    external_dependencies: { type: "array", itemType: "string" },
    validation_notes: { type: "string", minLength: 1 },
    labels: { type: "array", itemType: "string" },
  },
};

const DOD_PROOF_FIELDS = {
  required: {
    id: { type: "string", pattern: ID_PATTERN },
    requirement: { type: "string", minLength: 1, pattern: "\\S" },
    evidence: { type: "string", minLength: 1, pattern: "\\S" },
  },
  optional: {},
};

const DOD_PASS_FIELDS = {
  required: {
    proof_id: { type: "string", pattern: ID_PATTERN },
    criterion: { type: "string", minLength: 1, pattern: "\\S" },
    expected_result: { type: "string", minLength: 1, pattern: "\\S" },
  },
  optional: {},
};

const DOD_BUDGET_FIELDS = {
  required: {
    max_review_rounds: { type: "integer", minimum: 0 },
    max_continuation_attempts: { type: "integer", minimum: 0 },
  },
  optional: {},
};

const DOD_KILL_FIELDS = {
  required: {
    trigger: { type: "string", minLength: 1, pattern: "\\S" },
    action: { type: "string", minLength: 1, pattern: "\\S" },
    decision_time: { type: "string", minLength: 1, pattern: "\\S" },
  },
  optional: {},
};

const DOD_POLICY_FIELDS = {
  required: {
    within_dod: { type: "string", const: "fix" },
    beyond_dod: { type: "string", const: "defer" },
    contract_gap: { type: "string", const: "escalate" },
    at_budget: { type: "string", const: "accept_or_defer" },
  },
  optional: {},
};

const DOD_FIELDS = {
  required: {
    proof_requirements: { type: "array", minItems: 1, itemType: "object" },
    pass_criteria: { type: "array", minItems: 1, itemType: "object" },
    budget: { type: "object" },
    kill_criteria: { type: "array", minItems: 1, itemType: "object" },
    finding_policy: { type: "object" },
  },
  optional: {},
};

const ISSUE_FIELDS_V2 = {
  required: {
    ...ISSUE_FIELDS.required,
    definition_of_done: { type: "object" },
  },
  optional: ISSUE_FIELDS.optional,
};

function jsonSchemaProperty(spec) {
  if (spec.type === "array") {
    const items = { type: "string" };

    if (spec.itemType === "object") {
      items.type = "object";
    } else if (spec.itemPattern) {
      items.pattern = spec.itemPattern;
    } else {
      items.minLength = 1;
    }

    const property = { type: "array", items };

    if (spec.minItems) {
      property.minItems = spec.minItems;
    }

    return property;
  }

  const property = { type: spec.type };

  if (spec.const) {
    property.const = spec.const;
  }

  if (spec.enum) {
    property.enum = [...spec.enum];
  }

  if (spec.pattern) {
    property.pattern = spec.pattern;
  }

  if (spec.minLength) {
    property.minLength = spec.minLength;
  }

  if (spec.minimum !== undefined) {
    property.minimum = spec.minimum;
  }

  return property;
}

function jsonSchemaObject(fields, title) {
  const properties = {};

  for (const [name, spec] of Object.entries(fields.required)) {
    properties[name] = jsonSchemaProperty(spec);
  }

  for (const [name, spec] of Object.entries(fields.optional)) {
    properties[name] = jsonSchemaProperty(spec);
  }

  return {
    title,
    type: "object",
    additionalProperties: false,
    required: Object.keys(fields.required),
    properties,
  };
}

// Generated from the field tables above so the published JSON Schema cannot
// drift from the executable validator. Cross-entity defects (coverage, cycles,
// unknown references) are outside JSON Schema; the validator owns those.
function buildJsonSchema(schema = MANIFEST_SCHEMA) {
  if (![MANIFEST_SCHEMA, MANIFEST_SCHEMA_V2].includes(schema)) {
    throw new Error(`unsupported manifest schema: ${schema}`);
  }

  const root = jsonSchemaObject(MANIFEST_FIELDS, "GitHub lifecycle specification-to-issue manifest");
  root.properties.schema.const = schema;

  root.properties.specification = jsonSchemaObject(SPECIFICATION_FIELDS, "Source specification");
  root.properties.requirements.items = jsonSchemaObject(REQUIREMENT_FIELDS, "Requirement");
  root.properties.issues.items = jsonSchemaObject(ISSUE_FIELDS, "Proposed issue");

  if (schema === MANIFEST_SCHEMA_V2) {
    root.properties.issues.items.required.push("definition_of_done");
    root.properties.issues.items.properties.definition_of_done = jsonSchemaObject(DOD_FIELDS, "Definition of done");
    const dod = root.properties.issues.items.properties.definition_of_done.properties;
    dod.proof_requirements.items = jsonSchemaObject(DOD_PROOF_FIELDS, "Proof requirement");
    dod.pass_criteria.items = jsonSchemaObject(DOD_PASS_FIELDS, "Pass criterion");
    dod.budget = jsonSchemaObject(DOD_BUDGET_FIELDS, "Review and continuation budget");
    dod.kill_criteria.items = jsonSchemaObject(DOD_KILL_FIELDS, "Kill criterion");
    dod.finding_policy = jsonSchemaObject(DOD_POLICY_FIELDS, "Finding disposition policy");
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://joelkehle.com/schemas/${schema}.schema.json`,
    ...root,
  };
}

module.exports = {
  DEFECT_CODES,
  ID_PATTERN,
  ISSUE_FIELDS,
  ISSUE_FIELDS_V2,
  DOD_BUDGET_FIELDS,
  DOD_FIELDS,
  DOD_KILL_FIELDS,
  DOD_PASS_FIELDS,
  DOD_POLICY_FIELDS,
  DOD_PROOF_FIELDS,
  MANIFEST_FIELDS,
  MANIFEST_SCHEMA,
  MANIFEST_SCHEMA_V2,
  RECEIPT_SCHEMA,
  RENDER_SCHEMA,
  REPOSITORY_PATTERN,
  REQUIREMENT_FIELDS,
  SPECIFICATION_FIELDS,
  VALIDATION_SCHEMA,
  WRITE_CLASSES,
  buildJsonSchema,
};
