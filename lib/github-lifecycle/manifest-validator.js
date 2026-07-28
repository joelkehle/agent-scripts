const {
  DEFECT_CODES,
  ISSUE_FIELDS,
  MANIFEST_FIELDS,
  MANIFEST_SCHEMA,
  REQUIREMENT_FIELDS,
  SPECIFICATION_FIELDS,
  VALIDATION_SCHEMA,
} = require("./manifest-schema");

function defect(errors, code, path, message) {
  errors.push({ code, path, message });
}

function checkScalar(value, spec, path, errors) {
  if (typeof value !== spec.type) {
    defect(errors, DEFECT_CODES.INVALID_FIELD, path, `must be a ${spec.type}`);
    return false;
  }

  if (spec.const !== undefined && value !== spec.const) {
    const code = path === "schema" ? DEFECT_CODES.SCHEMA_MISMATCH : DEFECT_CODES.INVALID_FIELD;
    defect(errors, code, path, `must equal ${JSON.stringify(spec.const)}`);
    return false;
  }

  if (spec.enum && !spec.enum.includes(value)) {
    defect(errors, DEFECT_CODES.INVALID_FIELD, path, `must be one of ${spec.enum.join(", ")}`);
    return false;
  }

  if (spec.minLength !== undefined && value.length < spec.minLength) {
    defect(errors, DEFECT_CODES.INVALID_FIELD, path, `must not be empty`);
    return false;
  }

  if (spec.pattern && !new RegExp(spec.pattern).test(value)) {
    defect(errors, DEFECT_CODES.INVALID_FIELD, path, `must match ${spec.pattern}`);
    return false;
  }

  return true;
}

function checkArray(value, spec, path, errors) {
  if (!Array.isArray(value)) {
    defect(errors, DEFECT_CODES.INVALID_FIELD, path, "must be an array");
    return false;
  }

  if (spec.minItems !== undefined && value.length < spec.minItems) {
    defect(errors, DEFECT_CODES.INVALID_FIELD, path, `must list at least ${spec.minItems} entry`);
    return false;
  }

  let ok = true;

  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;

    if (spec.itemType === "object") {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        defect(errors, DEFECT_CODES.INVALID_FIELD, itemPath, "must be an object");
        ok = false;
      }

      return;
    }

    const itemSpec = { type: spec.itemType || "string", minLength: 1, pattern: spec.itemPattern };

    if (!checkScalar(item, itemSpec, itemPath, errors)) {
      ok = false;
    }
  });

  return ok;
}

function checkField(value, spec, path, errors) {
  if (spec.type === "array") {
    return checkArray(value, spec, path, errors);
  }

  if (spec.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      defect(errors, DEFECT_CODES.INVALID_FIELD, path, "must be an object");
      return false;
    }

    return true;
  }

  return checkScalar(value, spec, path, errors);
}

function checkObject(value, fields, path, errors) {
  const prefix = path ? `${path}.` : "";

  for (const [name, spec] of Object.entries(fields.required)) {
    const fieldPath = `${prefix}${name}`;

    if (value[name] === undefined || value[name] === null) {
      defect(errors, DEFECT_CODES.MISSING_FIELD, fieldPath, "is required");
      continue;
    }

    checkField(value[name], spec, fieldPath, errors);
  }

  for (const [name, spec] of Object.entries(fields.optional)) {
    if (value[name] === undefined || value[name] === null) {
      continue;
    }

    checkField(value[name], spec, `${prefix}${name}`, errors);
  }

  for (const name of Object.keys(value)) {
    if (fields.required[name] === undefined && fields.optional[name] === undefined) {
      defect(errors, DEFECT_CODES.UNKNOWN_FIELD, `${prefix}${name}`, "is not part of the schema");
    }
  }
}

function normalizeCycle(path) {
  let pivot = 0;

  for (let index = 1; index < path.length; index += 1) {
    if (path[index] < path[pivot]) {
      pivot = index;
    }
  }

  const rotated = [...path.slice(pivot), ...path.slice(0, pivot)];

  return [...rotated, rotated[0]].join(" -> ");
}

function findCycles(nodeIds, edges) {
  const nodes = new Set(nodeIds);
  const state = new Map();
  const stack = [];
  const cycles = new Set();

  function visit(id) {
    state.set(id, "open");
    stack.push(id);

    for (const next of [...(edges.get(id) || [])].sort()) {
      if (!nodes.has(next)) {
        continue;
      }

      if (state.get(next) === "open") {
        cycles.add(normalizeCycle(stack.slice(stack.indexOf(next))));
        continue;
      }

      if (!state.has(next)) {
        visit(next);
      }
    }

    stack.pop();
    state.set(id, "closed");
  }

  for (const id of [...nodes].sort()) {
    if (!state.has(id)) {
      visit(id);
    }
  }

  return [...cycles].sort();
}

function topologicalOrder(issueIds, edges) {
  const remaining = new Map(issueIds.map((id) => [id, [...(edges.get(id) || [])].filter((dep) => issueIds.includes(dep))]));
  const order = [];

  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => deps.every((dep) => order.includes(dep)))
      .map(([id]) => id)
      .sort();

    if (ready.length === 0) {
      return [];
    }

    for (const id of ready) {
      order.push(id);
      remaining.delete(id);
    }
  }

  return order;
}

function collectRequirements(manifest, errors) {
  const declared = new Map();

  manifest.requirements.forEach((requirement, index) => {
    const path = `requirements[${index}]`;

    if (requirement === null || typeof requirement !== "object" || Array.isArray(requirement)) {
      return;
    }

    checkObject(requirement, REQUIREMENT_FIELDS, path, errors);

    const id = requirement.id;

    if (typeof id !== "string" || id.length === 0) {
      return;
    }

    if (declared.has(id)) {
      defect(errors, DEFECT_CODES.DUPLICATE_REQUIREMENT_ID, path, `requirement ${id} is declared more than once`);
      return;
    }

    declared.set(id, requirement);
  });

  return declared;
}

function collectIssues(manifest, declaredRequirements, errors) {
  const issues = new Map();
  const indexById = new Map();
  const coverage = new Map([...declaredRequirements.keys()].map((id) => [id, []]));

  manifest.issues.forEach((issue, index) => {
    const path = `issues[${index}]`;

    if (issue === null || typeof issue !== "object" || Array.isArray(issue)) {
      return;
    }

    checkObject(issue, ISSUE_FIELDS, path, errors);

    const issueId = issue.issue_id;

    if (typeof issueId !== "string" || issueId.length === 0) {
      return;
    }

    if (issues.has(issueId)) {
      defect(errors, DEFECT_CODES.DUPLICATE_ISSUE_ID, path, `issue ${issueId} is declared more than once`);
      return;
    }

    issues.set(issueId, issue);
    indexById.set(issueId, index);

    if (!Array.isArray(issue.requirements)) {
      return;
    }

    issue.requirements.forEach((requirementId, requirementIndex) => {
      if (!coverage.has(requirementId)) {
        defect(
          errors,
          DEFECT_CODES.UNKNOWN_REQUIREMENT,
          `${path}.requirements[${requirementIndex}]`,
          `issue ${issueId} references undeclared requirement ${requirementId}`,
        );
        return;
      }

      coverage.get(requirementId).push(issueId);
    });
  });

  return { issues, coverage, indexById };
}

function checkDependencies(issues, indexById, errors) {
  const edges = new Map();

  for (const [issueId, issue] of issues) {
    const dependencies = Array.isArray(issue.depends_on) ? issue.depends_on : [];
    const issuePath = `issues[${indexById.get(issueId)}]`;

    dependencies.forEach((dependencyId, index) => {
      const path = `${issuePath}.depends_on[${index}]`;

      if (dependencyId === issueId) {
        defect(errors, DEFECT_CODES.SELF_DEPENDENCY, path, `issue ${issueId} depends on itself`);
        return;
      }

      if (!issues.has(dependencyId)) {
        defect(
          errors,
          DEFECT_CODES.UNKNOWN_DEPENDENCY,
          path,
          `issue ${issueId} depends on undeclared issue ${dependencyId}`,
        );
      }
    });

    edges.set(issueId, dependencies);
  }

  for (const cycle of findCycles([...issues.keys()], edges)) {
    defect(errors, DEFECT_CODES.DEPENDENCY_CYCLE, "issues", `dependency cycle: ${cycle}`);
  }

  return edges;
}

function validateManifest(manifest) {
  const errors = [];

  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    return {
      schema: VALIDATION_SCHEMA,
      ok: false,
      errors: [{ code: DEFECT_CODES.INVALID_FIELD, path: "", message: "manifest must be an object" }],
      requirement_coverage: [],
      uncovered_requirements: [],
      issue_order: [],
    };
  }

  checkObject(manifest, MANIFEST_FIELDS, "", errors);

  if (manifest.specification && typeof manifest.specification === "object" && !Array.isArray(manifest.specification)) {
    checkObject(manifest.specification, SPECIFICATION_FIELDS, "specification", errors);
  }

  const structural = Array.isArray(manifest.requirements) && Array.isArray(manifest.issues);
  const declaredRequirements = structural ? collectRequirements(manifest, errors) : new Map();
  const { issues, coverage, indexById } = structural
    ? collectIssues(manifest, declaredRequirements, errors)
    : { issues: new Map(), coverage: new Map(), indexById: new Map() };

  if (structural) {
    checkDependencies(issues, indexById, errors);
  }

  const uncovered = [];

  for (const [requirementId, coveringIssues] of coverage) {
    const requirement = declaredRequirements.get(requirementId);
    const isNormative = requirement.normative !== false;

    if (isNormative && coveringIssues.length === 0) {
      uncovered.push(requirementId);
      defect(
        errors,
        DEFECT_CODES.MISSING_COVERAGE,
        `requirements[${requirementId}]`,
        `normative requirement ${requirementId} is covered by no issue`,
      );
    }
  }

  const blocking = errors.some((error) =>
    error.code === DEFECT_CODES.DEPENDENCY_CYCLE ||
    error.code === DEFECT_CODES.UNKNOWN_DEPENDENCY ||
    error.code === DEFECT_CODES.SELF_DEPENDENCY);
  const edges = new Map([...issues].map(([id, issue]) => [id, Array.isArray(issue.depends_on) ? issue.depends_on : []]));

  return {
    schema: VALIDATION_SCHEMA,
    manifest_schema: MANIFEST_SCHEMA,
    ok: errors.length === 0,
    errors,
    requirement_coverage: [...coverage].map(([requirement_id, issue_ids]) => ({ requirement_id, issue_ids })),
    uncovered_requirements: uncovered,
    issue_order: blocking ? [] : topologicalOrder([...issues.keys()], edges),
  };
}

module.exports = { checkObject, findCycles, topologicalOrder, validateManifest };
