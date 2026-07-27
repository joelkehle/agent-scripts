const MANIFEST_SCHEMA = "github-lifecycle-manifest.v1";
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
function buildJsonSchema() {
  const root = jsonSchemaObject(MANIFEST_FIELDS, "GitHub lifecycle specification-to-issue manifest");

  root.properties.specification = jsonSchemaObject(SPECIFICATION_FIELDS, "Source specification");
  root.properties.requirements.items = jsonSchemaObject(REQUIREMENT_FIELDS, "Requirement");
  root.properties.issues.items = jsonSchemaObject(ISSUE_FIELDS, "Proposed issue");

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://joelkehle.com/schemas/${MANIFEST_SCHEMA}.schema.json`,
    ...root,
  };
}

module.exports = {
  DEFECT_CODES,
  ID_PATTERN,
  ISSUE_FIELDS,
  MANIFEST_FIELDS,
  MANIFEST_SCHEMA,
  RECEIPT_SCHEMA,
  RENDER_SCHEMA,
  REPOSITORY_PATTERN,
  REQUIREMENT_FIELDS,
  SPECIFICATION_FIELDS,
  VALIDATION_SCHEMA,
  WRITE_CLASSES,
  buildJsonSchema,
};
