const { spawnSync } = require("node:child_process");

const { contentHash, sha256Hex } = require("./canonical-json");
const {
  COMMAND_KINDS,
  COMMAND_STATUSES,
  EVIDENCE_CLASSES,
  LEDGER_SCHEMA,
  PILOT_WRITE_BOUNDARY,
  SCENARIO_STATUSES,
} = require("./pilot-schema");

const FAILURE_EXCERPT_LIMIT = 2000;
const DEFAULT_COMMAND_TIMEOUT_MS = 900000;

function countMatches(text, pattern) {
  const matches = text.match(pattern);

  return matches ? matches.length : 0;
}

function readCount(text, pattern) {
  const match = text.match(pattern);

  return match ? Number.parseInt(match[1], 10) : null;
}

// Only top-level results start at column zero; `t.Run` subtests are indented,
// so a table-driven test counts once, matching what the map declares.
function parseGoTestOutput(output) {
  const passed = countMatches(output, /^--- PASS: /gm);
  const failed = countMatches(output, /^--- FAIL: /gm);
  const skipped = countMatches(output, /^--- SKIP: /gm);

  return { tests_run: passed + failed + skipped, tests_passed: passed, tests_failed: failed, tests_skipped: skipped };
}

function parseNodeTestOutput(output) {
  const passed = readCount(output, /^# pass (\d+)$/m);
  const failed = readCount(output, /^# fail (\d+)$/m);
  const skipped = readCount(output, /^# skipped (\d+)$/m);

  if (passed === null && failed === null) {
    const ok = countMatches(output, /^ok \d+ - /gm);
    const notOk = countMatches(output, /^not ok \d+ - /gm);

    return { tests_run: ok + notOk, tests_passed: ok, tests_failed: notOk, tests_skipped: 0 };
  }

  const pass = passed || 0;
  const fail = failed || 0;
  const skip = skipped || 0;

  return { tests_run: pass + fail + skip, tests_passed: pass, tests_failed: fail, tests_skipped: skip };
}

function parseTestOutput(kind, output) {
  return kind === COMMAND_KINDS.GO_TEST ? parseGoTestOutput(output) : parseNodeTestOutput(output);
}

// Node is invoked through the interpreter already running, so a map cannot
// select a different runtime than the one being validated.
function resolveProgram(command) {
  if (command.kind === COMMAND_KINDS.NODE_TEST && command.argv[0] === "node") {
    return process.execPath;
  }

  return command.argv[0];
}

// `node --test` chooses its reporter from the terminal and from the runner
// that spawned it, so the reporter this parser reads is requested explicitly.
// Without it, running the pilot from inside a test runner yields output with
// no countable summary and every command looks like it matched no test.
function effectiveArgv(command) {
  if (command.kind !== COMMAND_KINDS.NODE_TEST) {
    return [...command.argv];
  }

  if (command.argv.some((arg) => arg.startsWith("--test-reporter"))) {
    return [...command.argv];
  }

  return [command.argv[0], "--test-reporter=tap", ...command.argv.slice(1)];
}

// `NODE_TEST_CONTEXT` marks a process as a child of a Node test run and
// switches the reporter to a serialized stream. Dropping it keeps a spawned
// suite's output the same whether the pilot runs from a shell or from a test.
function childEnvironment() {
  const environment = { ...process.env };

  delete environment.NODE_TEST_CONTEXT;

  return environment;
}

function defaultExecutor({ argv, cwd, program, timeoutMs }) {
  const startedAt = process.hrtime.bigint();
  const result = spawnSync(program, argv.slice(1), {
    cwd,
    encoding: "utf8",
    env: childEnvironment(),
    timeout: timeoutMs || DEFAULT_COMMAND_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    // No shell, no inherited stdin, and no network is reachable from either
    // test runner; the suites use in-process and loopback fakes only.
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);

  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    duration_ms: durationMs,
    error: result.error ? result.error.message : null,
  };
}

function defaultGit(worktreePath) {
  const result = spawnSync("git", ["-C", worktreePath, "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    return { ok: false, sha: null, error: result.error.message };
  }

  if (result.status !== 0) {
    return { ok: false, sha: null, error: (result.stderr || "").trim() || `git exited ${result.status}` };
  }

  return { ok: true, sha: (result.stdout || "").trim(), error: null };
}

// Every worktree is checked before anything executes, so a ledger always
// states which revision produced its results.
function checkRevisions(map, git) {
  return map.worktrees.map((worktree) => {
    const observed = git(worktree.path);
    const pinned = worktree.revision_policy !== "self";

    return {
      worktree_id: worktree.worktree_id,
      repository: worktree.repository,
      path: worktree.path,
      pinned,
      expected_head_sha: worktree.head_sha,
      observed_head_sha: observed.sha,
      // An unpinned `self` worktree records its revision and never reports a
      // mismatch; only pinned dependency evidence can go stale.
      matches: pinned ? observed.ok && observed.sha === worktree.head_sha : null,
      error: observed.error,
    };
  });
}

function commandLine(argv, program) {
  return [program, ...argv.slice(1)].join(" ");
}

function classifyCommand(execution, parsed, expectsTests) {
  if (execution.error) {
    return COMMAND_STATUSES.FAILED;
  }

  if (parsed.tests_run === 0) {
    return execution.status === 0 ? COMMAND_STATUSES.NO_TESTS_MATCHED : COMMAND_STATUSES.FAILED;
  }

  if (parsed.tests_failed > 0 || execution.status !== 0) {
    return COMMAND_STATUSES.FAILED;
  }

  if (parsed.tests_run !== expectsTests) {
    return COMMAND_STATUSES.TEST_COUNT_MISMATCH;
  }

  return COMMAND_STATUSES.PASSED;
}

function describeCommandStatus(status, parsed, expectsTests, execution) {
  switch (status) {
    case COMMAND_STATUSES.NO_TESTS_MATCHED:
      return "the selector matched no test; a renamed or removed test cannot count as evidence";
    case COMMAND_STATUSES.TEST_COUNT_MISMATCH:
      return `ran ${parsed.tests_run} test(s) where the map declares ${expectsTests}`;
    case COMMAND_STATUSES.FAILED:
      return execution.error || `${parsed.tests_failed} test(s) failed, exit ${execution.status}`;
    default:
      return null;
  }
}

function runCommand(command, worktree, executor) {
  const program = resolveProgram(command);
  const argv = effectiveArgv(command);
  const execution = executor({
    argv,
    program,
    cwd: worktree.path,
    kind: command.kind,
  });

  const output = `${execution.stdout || ""}${execution.stderr || ""}`;
  const parsed = parseTestOutput(command.kind, output);
  const status = classifyCommand(execution, parsed, command.expects_tests);
  const detail = describeCommandStatus(status, parsed, command.expects_tests, execution);

  return {
    worktree_id: command.worktree_id,
    label: command.label || null,
    kind: command.kind,
    command: commandLine(argv, program),
    cwd: worktree.path,
    status,
    exit_code: execution.status === undefined ? null : execution.status,
    duration_ms: execution.duration_ms === undefined ? null : execution.duration_ms,
    expects_tests: command.expects_tests,
    tests_run: parsed.tests_run,
    tests_passed: parsed.tests_passed,
    tests_failed: parsed.tests_failed,
    tests_skipped: parsed.tests_skipped,
    output_sha256: sha256Hex(output),
    output_bytes: Buffer.byteLength(output, "utf8"),
    detail,
    failure_excerpt: status === COMMAND_STATUSES.PASSED ? null : output.slice(-FAILURE_EXCERPT_LIMIT) || null,
  };
}

function scenarioWorktreeIds(scenario) {
  return [...new Set((scenario.commands || []).map((command) => command.worktree_id))];
}

function runScenario(scenario, context) {
  const { worktrees, revisions, executor, allowDrift } = context;

  if (scenario.evidence === EVIDENCE_CLASSES.MISSING) {
    return {
      scenario_id: scenario.scenario_id,
      title: scenario.title,
      evidence: scenario.evidence,
      status: SCENARIO_STATUSES.GAP_ONLY,
      drift_allowed: false,
      stale_worktrees: [],
      commands: [],
      gaps: scenario.gaps || [],
    };
  }

  const used = scenarioWorktreeIds(scenario);
  const stale = used.filter((id) => {
    const revision = revisions.find((entry) => entry.worktree_id === id);

    return !revision || revision.matches === false;
  });

  if (stale.length > 0 && !allowDrift) {
    return {
      scenario_id: scenario.scenario_id,
      title: scenario.title,
      evidence: scenario.evidence,
      status: SCENARIO_STATUSES.STALE_REVISION,
      drift_allowed: false,
      stale_worktrees: stale,
      commands: [],
      gaps: scenario.gaps || [],
    };
  }

  const commands = scenario.commands.map((command) => runCommand(command, worktrees.get(command.worktree_id), executor));
  const failed = commands.some((command) => command.status !== COMMAND_STATUSES.PASSED);

  return {
    scenario_id: scenario.scenario_id,
    title: scenario.title,
    evidence: scenario.evidence,
    status: failed ? SCENARIO_STATUSES.FAILED : SCENARIO_STATUSES.PASSED,
    drift_allowed: stale.length > 0,
    stale_worktrees: stale,
    commands,
    gaps: scenario.gaps || [],
  };
}

function countBy(scenarios, status) {
  return scenarios.filter((scenario) => scenario.status === status).length;
}

// `startedAt` is injected exactly as GHL-003 injects receipt timestamps, so a
// ledger is reproducible and this library never reads the wall clock.
function runScenarios(options) {
  const { map } = options;
  const executor = options.executor || defaultExecutor;
  const git = options.git || defaultGit;
  const allowDrift = options.allowDrift === true;
  const startedAt = options.startedAt;

  if (typeof startedAt !== "string" || startedAt.trim().length === 0) {
    throw new Error("startedAt is required");
  }

  const revisions = checkRevisions(map, git);
  const worktrees = new Map(map.worktrees.map((worktree) => [worktree.worktree_id, worktree]));
  const selected = options.scenarioIds && options.scenarioIds.length > 0 ? new Set(options.scenarioIds) : null;

  if (selected) {
    const known = new Set(map.scenarios.map((scenario) => scenario.scenario_id));

    for (const id of selected) {
      if (!known.has(id)) {
        throw new Error(`unknown scenario: ${id}`);
      }
    }
  }

  const scenarios = map.scenarios.map((scenario) => {
    if (selected && !selected.has(scenario.scenario_id)) {
      return {
        scenario_id: scenario.scenario_id,
        title: scenario.title,
        evidence: scenario.evidence,
        status: SCENARIO_STATUSES.SKIPPED,
        drift_allowed: false,
        stale_worktrees: [],
        commands: [],
        gaps: scenario.gaps || [],
      };
    }

    return runScenario(scenario, { worktrees, revisions, executor, allowDrift });
  });

  const input = contentHash(map);
  const gapScenarios = scenarios.filter((scenario) => (scenario.gaps || []).length > 0);
  const gapCount = gapScenarios.reduce((total, scenario) => total + scenario.gaps.length, 0);
  const failedCount = countBy(scenarios, SCENARIO_STATUSES.FAILED);
  const staleCount = countBy(scenarios, SCENARIO_STATUSES.STALE_REVISION);

  return {
    schema: LEDGER_SCHEMA,
    ledger_version: "1.0.0",
    started_at: startedAt,
    write_boundary: PILOT_WRITE_BOUNDARY,
    map: {
      source: options.source || null,
      schema: map.schema,
      map_version: map.map_version,
      spec_id: map.specification ? map.specification.spec_id : null,
      source_revision: map.specification ? map.specification.source_revision : null,
      content_sha256: input.sha256,
      canonical_bytes: input.canonical_bytes,
    },
    options: {
      allow_drift: allowDrift,
      scenario_filter: selected ? [...selected].sort() : [],
    },
    worktrees: revisions,
    scenarios,
    gaps: gapScenarios.map((scenario) => ({
      scenario_id: scenario.scenario_id,
      evidence: scenario.evidence,
      gaps: scenario.gaps,
    })),
    counts: {
      scenarios: scenarios.length,
      passed: countBy(scenarios, SCENARIO_STATUSES.PASSED),
      failed: failedCount,
      stale_revision: staleCount,
      gap_only: countBy(scenarios, SCENARIO_STATUSES.GAP_ONLY),
      skipped: countBy(scenarios, SCENARIO_STATUSES.SKIPPED),
      scenarios_with_gaps: gapScenarios.length,
      open_gaps: gapCount,
      revision_mismatches: revisions.filter((revision) => revision.matches === false).length,
    },
    // Gaps never fail a run; they are reported so an unproven clause stays
    // visible instead of being read as a pass.
    ok: failedCount === 0 && staleCount === 0,
  };
}

module.exports = {
  checkRevisions,
  defaultExecutor,
  defaultGit,
  parseGoTestOutput,
  parseNodeTestOutput,
  parseTestOutput,
  runScenarios,
};
