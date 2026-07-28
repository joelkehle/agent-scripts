const { checkObject } = require("./manifest-validator");
const {
  ACTIVATION_SPEC_FIELDS,
  BUILD_IDENTITY_FIELDS,
  CHECKPOINT_FIELDS,
  CHECKPOINT_RECEIPT_FIELDS,
  COMMAND_FIELDS,
  COMMAND_PROGRAMS,
  ENVIRONMENT_ISSUE_FIELDS,
  EVIDENCE_CLASSES,
  GAP_FIELDS,
  MAP_FIELDS,
  MAP_SPECIFICATION_FIELDS,
  PILOT_DEFECT_CODES,
  SCENARIO_FIELDS,
  SCENARIO_IDS,
  SCENARIO_MAP_SCHEMA,
  SERVICE_IDENTITY_FIELDS,
  WORKTREE_FIELDS,
} = require("./pilot-schema");

function defect(errors, code, path, message) {
  errors.push({ code, path, message });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectWorktrees(map, errors) {
  const worktrees = new Map();

  map.worktrees.forEach((worktree, index) => {
    const path = `worktrees[${index}]`;

    if (!isObject(worktree)) {
      return;
    }

    checkObject(worktree, WORKTREE_FIELDS, path, errors);

    const id = worktree.worktree_id;

    if (typeof id !== "string" || id.length === 0) {
      return;
    }

    if (worktrees.has(id)) {
      defect(errors, PILOT_DEFECT_CODES.DUPLICATE_WORKTREE_ID, path, `worktree ${id} is declared more than once`);
      return;
    }

    worktrees.set(id, worktree);
  });

  return worktrees;
}

function checkCommand(command, path, worktrees, errors) {
  if (!isObject(command)) {
    defect(errors, PILOT_DEFECT_CODES.INVALID_FIELD, path, "must be an object");
    return;
  }

  checkObject(command, COMMAND_FIELDS, path, errors);

  if (typeof command.worktree_id === "string" && !worktrees.has(command.worktree_id)) {
    defect(
      errors,
      PILOT_DEFECT_CODES.UNKNOWN_WORKTREE,
      `${path}.worktree_id`,
      `command references undeclared worktree ${command.worktree_id}`,
    );
  }

  if (!Number.isInteger(command.expects_tests) || command.expects_tests < 1) {
    defect(
      errors,
      PILOT_DEFECT_CODES.INVALID_FIELD,
      `${path}.expects_tests`,
      "must be a positive integer so a selector that matches nothing cannot pass silently",
    );
  }

  if (!Array.isArray(command.argv) || command.argv.length === 0) {
    return;
  }

  const allowed = COMMAND_PROGRAMS[command.kind];

  if (allowed && !allowed.includes(command.argv[0])) {
    defect(
      errors,
      PILOT_DEFECT_CODES.FORBIDDEN_PROGRAM,
      `${path}.argv[0]`,
      `kind ${command.kind} may only run ${allowed.join(", ")}, not ${command.argv[0]}`,
    );
  }

  // `go test -run` reports success when its regex matches no test, so a Go
  // command must ask for the verbose output the runner counts tests from.
  if (command.kind === "go_test" && !command.argv.includes("-v")) {
    defect(
      errors,
      PILOT_DEFECT_CODES.INVALID_FIELD,
      `${path}.argv`,
      "go_test argv must include -v so executed tests can be counted",
    );
  }
}

function checkGap(gap, path, errors) {
  if (!isObject(gap)) {
    defect(errors, PILOT_DEFECT_CODES.INVALID_FIELD, path, "must be an object");
    return;
  }

  checkObject(gap, GAP_FIELDS, path, errors);
}

// The evidence class is a claim about honesty, so the validator enforces it
// rather than trusting the author: `missing` may not carry commands, `partial`
// must name what is unproven, and `executable` may not hide an open gap.
function checkEvidenceConsistency(scenario, path, errors) {
  const commands = Array.isArray(scenario.commands) ? scenario.commands : [];
  const gaps = Array.isArray(scenario.gaps) ? scenario.gaps : [];
  const proves = Array.isArray(scenario.proves) ? scenario.proves : [];

  if (scenario.evidence === EVIDENCE_CLASSES.MISSING) {
    if (commands.length > 0) {
      defect(
        errors,
        PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION,
        `${path}.commands`,
        "a scenario marked missing must declare no commands",
      );
    }

    if (gaps.length === 0) {
      defect(
        errors,
        PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION,
        `${path}.gaps`,
        "a scenario marked missing must describe what would prove it",
      );
    }

    return;
  }

  if (commands.length === 0) {
    defect(
      errors,
      PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION,
      `${path}.commands`,
      `a scenario marked ${scenario.evidence} must declare at least one command`,
    );
  }

  if (proves.length === 0) {
    defect(
      errors,
      PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION,
      `${path}.proves`,
      `a scenario marked ${scenario.evidence} must state which clauses it proves`,
    );
  }

  if (scenario.evidence === EVIDENCE_CLASSES.PARTIAL && gaps.length === 0) {
    defect(
      errors,
      PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION,
      `${path}.gaps`,
      "a scenario marked partial must name the clauses it does not prove",
    );
  }

  if (scenario.evidence === EVIDENCE_CLASSES.EXECUTABLE && gaps.length > 0) {
    defect(
      errors,
      PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION,
      `${path}.gaps`,
      "a scenario carrying an open gap is partial, not executable",
    );
  }
}

function collectScenarios(map, worktrees, errors) {
  const scenarios = new Map();

  map.scenarios.forEach((scenario, index) => {
    const path = `scenarios[${index}]`;

    if (!isObject(scenario)) {
      return;
    }

    checkObject(scenario, SCENARIO_FIELDS, path, errors);

    const id = scenario.scenario_id;

    if (typeof id !== "string" || id.length === 0) {
      return;
    }

    if (scenarios.has(id)) {
      defect(errors, PILOT_DEFECT_CODES.DUPLICATE_SCENARIO_ID, path, `scenario ${id} is declared more than once`);
      return;
    }

    if (!SCENARIO_IDS.includes(id)) {
      defect(errors, PILOT_DEFECT_CODES.UNKNOWN_SCENARIO_ID, path, `${id} is not an acceptance scenario of this specification`);
      return;
    }

    scenarios.set(id, scenario);
    checkEvidenceConsistency(scenario, path, errors);

    if (Array.isArray(scenario.commands)) {
      scenario.commands.forEach((command, commandIndex) => {
        checkCommand(command, `${path}.commands[${commandIndex}]`, worktrees, errors);
      });
    }

    if (Array.isArray(scenario.gaps)) {
      scenario.gaps.forEach((gap, gapIndex) => {
        checkGap(gap, `${path}.gaps[${gapIndex}]`, errors);
      });
    }
  });

  for (const expected of SCENARIO_IDS) {
    if (!scenarios.has(expected)) {
      defect(errors, PILOT_DEFECT_CODES.MISSING_SCENARIO, "scenarios", `acceptance scenario ${expected} is not bound to any evidence`);
    }
  }

  return scenarios;
}

function summarizeCoverage(scenarios) {
  const coverage = [];

  for (const id of SCENARIO_IDS) {
    const scenario = scenarios.get(id);

    if (!scenario) {
      continue;
    }

    coverage.push({
      scenario_id: id,
      evidence: scenario.evidence,
      command_count: Array.isArray(scenario.commands) ? scenario.commands.length : 0,
      proves_count: Array.isArray(scenario.proves) ? scenario.proves.length : 0,
      gap_count: Array.isArray(scenario.gaps) ? scenario.gaps.length : 0,
    });
  }

  return coverage;
}

function validateScenarioMap(map) {
  const errors = [];

  if (!isObject(map)) {
    return {
      schema: SCENARIO_MAP_SCHEMA,
      ok: false,
      errors: [{ code: PILOT_DEFECT_CODES.INVALID_FIELD, path: "", message: "scenario map must be an object" }],
      coverage: [],
      scenarios_missing_evidence: [],
      scenarios_partial: [],
    };
  }

  checkObject(map, MAP_FIELDS, "", errors);

  if (isObject(map.specification)) {
    checkObject(map.specification, MAP_SPECIFICATION_FIELDS, "specification", errors);
  }

  if (Array.isArray(map.known_environment_issues)) {
    map.known_environment_issues.forEach((issue, index) => {
      if (!isObject(issue)) {
        return;
      }

      checkObject(issue, ENVIRONMENT_ISSUE_FIELDS, `known_environment_issues[${index}]`, errors);
    });
  }

  const structural = Array.isArray(map.worktrees) && Array.isArray(map.scenarios);
  const worktrees = structural ? collectWorktrees(map, errors) : new Map();
  const scenarios = structural ? collectScenarios(map, worktrees, errors) : new Map();
  const listed = [...scenarios.values()];

  return {
    schema: SCENARIO_MAP_SCHEMA,
    ok: errors.length === 0,
    errors,
    coverage: summarizeCoverage(scenarios),
    scenarios_missing_evidence: listed
      .filter((scenario) => scenario.evidence === EVIDENCE_CLASSES.MISSING)
      .map((scenario) => scenario.scenario_id)
      .sort(),
    scenarios_partial: listed
      .filter((scenario) => scenario.evidence === EVIDENCE_CLASSES.PARTIAL)
      .map((scenario) => scenario.scenario_id)
      .sort(),
  };
}

function validateActivationSpec(spec) {
  const errors = [];

  if (!isObject(spec)) {
    return { ok: false, errors: [{ code: PILOT_DEFECT_CODES.INVALID_FIELD, path: "", message: "activation spec must be an object" }] };
  }

  checkObject(spec, ACTIVATION_SPEC_FIELDS, "", errors);

  const seen = new Set();

  if (Array.isArray(spec.checkpoints)) {
    spec.checkpoints.forEach((checkpoint, index) => {
      const path = `checkpoints[${index}]`;

      if (!isObject(checkpoint)) {
        return;
      }

      checkObject(checkpoint, CHECKPOINT_FIELDS, path, errors);

      if (typeof checkpoint.checkpoint_id !== "string") {
        return;
      }

      if (seen.has(checkpoint.checkpoint_id)) {
        defect(errors, PILOT_DEFECT_CODES.DUPLICATE_SCENARIO_ID, path, `checkpoint ${checkpoint.checkpoint_id} is declared more than once`);
        return;
      }

      seen.add(checkpoint.checkpoint_id);
    });
  }

  return { ok: errors.length === 0, errors };
}

function validateBuildIdentities(observed) {
  const errors = [];

  if (!isObject(observed)) {
    return { ok: false, errors: [{ code: PILOT_DEFECT_CODES.INVALID_FIELD, path: "", message: "observed build identities must be an object" }] };
  }

  checkObject(observed, BUILD_IDENTITY_FIELDS, "", errors);

  if (Array.isArray(observed.services)) {
    observed.services.forEach((service, index) => {
      if (!isObject(service)) {
        defect(errors, PILOT_DEFECT_CODES.INVALID_FIELD, `services[${index}]`, "must be an object");
        return;
      }

      checkObject(service, SERVICE_IDENTITY_FIELDS, `services[${index}]`, errors);
    });
  }

  if (Array.isArray(observed.checkpoint_receipts)) {
    observed.checkpoint_receipts.forEach((receipt, index) => {
      if (!isObject(receipt)) {
        defect(errors, PILOT_DEFECT_CODES.INVALID_FIELD, `checkpoint_receipts[${index}]`, "must be an object");
        return;
      }

      checkObject(receipt, CHECKPOINT_RECEIPT_FIELDS, `checkpoint_receipts[${index}]`, errors);
    });
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateActivationSpec, validateBuildIdentities, validateScenarioMap };
