const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { after, describe, it } = require("node:test");

const {
  COMMAND_STATUSES,
  EVIDENCE_CLASSES,
  PREFLIGHT_REFUSAL_CODES,
  PILOT_DEFECT_CODES,
  SCENARIO_IDS,
  SCENARIO_STATUSES,
  buildPilotLedgerReceipt,
  buildPreflightReceipt,
  evaluateActivation,
  loadActivationSpec,
  loadBuildIdentities,
  loadScenarioMap,
  parseGoTestOutput,
  parseNodeTestOutput,
  runScenarios,
  validateActivationSpec,
  validateBuildIdentities,
  validateScenarioMap,
  verifyReceipt,
} = require("../../lib/github-lifecycle");

const REPO_ROOT = path.join(__dirname, "..", "..");
const CLI = path.join(REPO_ROOT, "bin", "ghl-pilot");
const DOCS = path.join(REPO_ROOT, "docs", "github-lifecycle");
const MAP_PATH = path.join(DOCS, "ghl-e2e-scenarios.v1.json");
const SPEC_PATH = path.join(DOCS, "ghl-activation-spec.v1.json");
const FIXTURES = path.join(__dirname, "fixtures", "pilot");
const FIXED_TIMESTAMP = "2026-07-27T00:00:00.000Z";

const tempDirs = [];

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ghl-pilot-"));

  tempDirs.push(dir);

  return dir;
}

function identities(name) {
  return loadBuildIdentities(path.join(FIXTURES, `${name}.identities.json`));
}

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status, stdout: error.stdout || "", stderr: error.stderr || "" };
  }
}

after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A minimal, valid map used to exercise the runner without touching the real
// suites. The executor and git reader are injected, so nothing is spawned.
function sampleMap(overrides) {
  const map = {
    schema: "github-lifecycle-e2e-scenarios.v1",
    map_version: "1.0.0",
    specification: {
      spec_id: "JK-SPEC-GHLIFE-001",
      source_revision: "c853edb",
      source_document: "docs/github-native-lifecycle-read-propose-packet.md",
      scenarios_section: "End-to-end acceptance scenarios",
    },
    worktrees: [
      {
        worktree_id: "dep",
        repository: "joelkehle/dep",
        path: "/tmp/dep",
        head_sha: "1111111111111111111111111111111111111111",
        revision_policy: "pinned",
      },
      {
        worktree_id: "self",
        repository: "joelkehle/agent-scripts",
        path: "/tmp/self",
        head_sha: "2222222222222222222222222222222222222222",
        revision_policy: "self",
      },
    ],
    scenarios: SCENARIO_IDS.map((id) => ({
      scenario_id: id,
      title: `scenario ${id}`,
      evidence: EVIDENCE_CLASSES.EXECUTABLE,
      proves: ["a clause"],
      gaps: [],
      commands: [
        {
          worktree_id: "dep",
          kind: "go_test",
          argv: ["go", "test", "./internal/x", "-count=1", "-v", "-run", `^Test${id.replace(/-/g, "")}$`],
          expects_tests: 1,
        },
      ],
    })),
  };

  return { ...map, ...(overrides || {}) };
}

function goOutput(passed, failed) {
  const lines = [];

  for (let i = 0; i < passed; i += 1) {
    lines.push(`=== RUN   TestPass${i}`, `    --- PASS: TestPass${i}/subcase (0.00s)`, `--- PASS: TestPass${i} (0.00s)`);
  }

  for (let i = 0; i < failed; i += 1) {
    lines.push(`=== RUN   TestFail${i}`, `--- FAIL: TestFail${i} (0.00s)`);
  }

  lines.push(failed > 0 ? "FAIL" : "ok  \tgithub.com/joelkehle/dep/internal/x\t0.01s");

  return `${lines.join("\n")}\n`;
}

function fakeExecutor(options) {
  const settings = options || {};

  return () => ({
    status: settings.status === undefined ? 0 : settings.status,
    stdout: settings.stdout === undefined ? goOutput(settings.passed === undefined ? 1 : settings.passed, settings.failed || 0) : settings.stdout,
    stderr: "",
    duration_ms: settings.duration_ms === undefined ? 12 : settings.duration_ms,
    error: settings.error || null,
  });
}

function fakeGit(shas) {
  return (worktreePath) => {
    const sha = shas[worktreePath];

    return sha ? { ok: true, sha, error: null } : { ok: false, sha: null, error: "not a worktree" };
  };
}

const MATCHING_SHAS = {
  "/tmp/dep": "1111111111111111111111111111111111111111",
  "/tmp/self": "2222222222222222222222222222222222222222",
};

function runSample(options) {
  const settings = options || {};

  return runScenarios({
    map: settings.map || sampleMap(),
    executor: settings.executor || fakeExecutor(),
    git: settings.git || fakeGit(MATCHING_SHAS),
    allowDrift: settings.allowDrift === true,
    scenarioIds: settings.scenarioIds,
    startedAt: settings.startedAt || FIXED_TIMESTAMP,
    source: "sample-map.json",
  });
}

function defectCodes(validation) {
  return [...new Set(validation.errors.map((error) => error.code))].sort();
}

function mutateScenario(index, changes) {
  const map = sampleMap();

  map.scenarios[index] = { ...map.scenarios[index], ...changes };

  return map;
}

describe("scenario map validation", () => {
  it("accepts the checked-in scenario map", () => {
    const validation = validateScenarioMap(loadScenarioMap(MAP_PATH));

    assert.deepEqual(validation.errors, []);
    assert.equal(validation.ok, true);
  });

  it("binds every acceptance scenario exactly once", () => {
    const map = loadScenarioMap(MAP_PATH);
    const bound = map.scenarios.map((scenario) => scenario.scenario_id);

    assert.deepEqual([...bound].sort(), [...SCENARIO_IDS].sort());
    assert.equal(new Set(bound).size, SCENARIO_IDS.length);
  });

  it("keeps every checked-in command offline and countable", () => {
    const map = loadScenarioMap(MAP_PATH);
    const worktrees = new Set(map.worktrees.map((worktree) => worktree.worktree_id));

    for (const scenario of map.scenarios) {
      for (const command of scenario.commands) {
        assert.ok(worktrees.has(command.worktree_id), `${scenario.scenario_id} names a declared worktree`);
        assert.ok(["go", "node"].includes(command.argv[0]), `${scenario.scenario_id} runs only a test runner`);
        assert.ok(command.expects_tests >= 1, `${scenario.scenario_id} declares an expected test count`);

        if (command.kind === "go_test") {
          assert.ok(command.argv.includes("-v"), `${scenario.scenario_id} can count executed Go tests`);
        }
      }
    }
  });

  it("requires every scenario to be bound", () => {
    const map = sampleMap();

    map.scenarios = map.scenarios.slice(0, 11);

    const validation = validateScenarioMap(map);

    assert.equal(validation.ok, false);
    assert.ok(defectCodes(validation).includes(PILOT_DEFECT_CODES.MISSING_SCENARIO));
  });

  it("rejects a duplicated or invented scenario", () => {
    const duplicated = sampleMap();
    duplicated.scenarios.push({ ...duplicated.scenarios[0] });

    assert.ok(defectCodes(validateScenarioMap(duplicated)).includes(PILOT_DEFECT_CODES.DUPLICATE_SCENARIO_ID));

    const invented = sampleMap();
    invented.scenarios.push({ ...invented.scenarios[0], scenario_id: "GHL-E2E-99" });

    assert.ok(defectCodes(validateScenarioMap(invented)).includes(PILOT_DEFECT_CODES.INVALID_FIELD));
  });

  it("rejects a duplicated worktree", () => {
    const map = sampleMap();

    map.worktrees.push({ ...map.worktrees[0] });

    assert.ok(defectCodes(validateScenarioMap(map)).includes(PILOT_DEFECT_CODES.DUPLICATE_WORKTREE_ID));
  });

  it("rejects a command naming an undeclared worktree", () => {
    const map = mutateScenario(0, {
      commands: [{ worktree_id: "nowhere", kind: "go_test", argv: ["go", "test", "./x", "-v"], expects_tests: 1 }],
    });

    assert.ok(defectCodes(validateScenarioMap(map)).includes(PILOT_DEFECT_CODES.UNKNOWN_WORKTREE));
  });

  it("rejects a command that is not a test runner", () => {
    const map = mutateScenario(0, {
      commands: [{ worktree_id: "dep", kind: "go_test", argv: ["bash", "-c", "echo pass", "-v"], expects_tests: 1 }],
    });

    assert.ok(defectCodes(validateScenarioMap(map)).includes(PILOT_DEFECT_CODES.FORBIDDEN_PROGRAM));
  });

  it("rejects a Go command whose tests cannot be counted", () => {
    const map = mutateScenario(0, {
      commands: [{ worktree_id: "dep", kind: "go_test", argv: ["go", "test", "./x"], expects_tests: 1 }],
    });

    const validation = validateScenarioMap(map);

    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.message.includes("-v")));
  });

  it("rejects a command that expects no tests", () => {
    const map = mutateScenario(0, {
      commands: [{ worktree_id: "dep", kind: "go_test", argv: ["go", "test", "./x", "-v"], expects_tests: 0 }],
    });

    const validation = validateScenarioMap(map);

    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.path.endsWith("expects_tests")));
  });

  it("refuses an evidence class that contradicts the evidence", () => {
    const gap = { clause: "c", why: "w", would_be_proven_by: "p" };
    const command = { worktree_id: "dep", kind: "go_test", argv: ["go", "test", "./x", "-v"], expects_tests: 1 };

    const missingWithCommands = mutateScenario(0, { evidence: EVIDENCE_CLASSES.MISSING, gaps: [gap], commands: [command] });
    assert.ok(defectCodes(validateScenarioMap(missingWithCommands)).includes(PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION));

    const missingWithoutGaps = mutateScenario(0, { evidence: EVIDENCE_CLASSES.MISSING, gaps: [], commands: [] });
    assert.ok(defectCodes(validateScenarioMap(missingWithoutGaps)).includes(PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION));

    const partialWithoutGaps = mutateScenario(0, { evidence: EVIDENCE_CLASSES.PARTIAL, gaps: [], commands: [command] });
    assert.ok(defectCodes(validateScenarioMap(partialWithoutGaps)).includes(PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION));

    const executableWithGap = mutateScenario(0, { evidence: EVIDENCE_CLASSES.EXECUTABLE, gaps: [gap], commands: [command] });
    assert.ok(defectCodes(validateScenarioMap(executableWithGap)).includes(PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION));

    const executableWithoutCommands = mutateScenario(0, { evidence: EVIDENCE_CLASSES.EXECUTABLE, gaps: [], commands: [] });
    assert.ok(defectCodes(validateScenarioMap(executableWithoutCommands)).includes(PILOT_DEFECT_CODES.EVIDENCE_CONTRADICTION));
  });

  it("requires a gap to say what would prove it", () => {
    const map = mutateScenario(0, {
      evidence: EVIDENCE_CLASSES.PARTIAL,
      gaps: [{ clause: "unproven clause" }],
      commands: [{ worktree_id: "dep", kind: "go_test", argv: ["go", "test", "./x", "-v"], expects_tests: 1 }],
    });

    const validation = validateScenarioMap(map);

    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.path.endsWith("would_be_proven_by")));
  });
});

describe("test output counting", () => {
  it("counts top-level Go tests and ignores subtests", () => {
    assert.deepEqual(parseGoTestOutput(goOutput(2, 1)), {
      tests_run: 3,
      tests_passed: 2,
      tests_failed: 1,
      tests_skipped: 0,
    });
  });

  it("reads the Node test summary", () => {
    const output = "# tests 5\n# suites 2\n# pass 4\n# fail 1\n# skipped 0\n";

    assert.deepEqual(parseNodeTestOutput(output), { tests_run: 5, tests_passed: 4, tests_failed: 1, tests_skipped: 0 });
  });

  it("counts nothing when a selector matched no test", () => {
    assert.equal(parseGoTestOutput("testing: warning: no tests to run\nPASS\nok  \tpkg\t0.01s\n").tests_run, 0);
  });
});

describe("ledger determinism", () => {
  it("produces an identical ledger and receipt for identical observations", () => {
    const first = runSample();
    const second = runSample();

    assert.deepEqual(first, second);

    const receiptOptions = { actor: "joelkehle", timestamp: FIXED_TIMESTAMP, source: "sample-map.json" };
    const firstReceipt = buildPilotLedgerReceipt({ ledger: first, ...receiptOptions });
    const secondReceipt = buildPilotLedgerReceipt({ ledger: second, ...receiptOptions });

    assert.equal(firstReceipt.receipt_id, secondReceipt.receipt_id);
    assert.equal(verifyReceipt(firstReceipt), true);
  });

  it("seals the same receipt when only wall-clock durations differ", () => {
    const fast = runSample({ executor: fakeExecutor({ duration_ms: 5 }) });
    const slow = runSample({ executor: fakeExecutor({ duration_ms: 5000 }) });

    assert.notDeepEqual(fast.scenarios[0].commands[0].duration_ms, slow.scenarios[0].commands[0].duration_ms);

    const options = { actor: "joelkehle", timestamp: FIXED_TIMESTAMP };

    assert.equal(
      buildPilotLedgerReceipt({ ledger: fast, ...options }).receipt_id,
      buildPilotLedgerReceipt({ ledger: slow, ...options }).receipt_id,
    );
  });

  it("detects a tampered receipt", () => {
    const receipt = buildPilotLedgerReceipt({ ledger: runSample(), actor: "joelkehle", timestamp: FIXED_TIMESTAMP });

    assert.equal(verifyReceipt({ ...receipt, outcome: { ...receipt.outcome, ok: !receipt.outcome.ok } }), false);
  });

  it("requires an injected clock and actor", () => {
    assert.throws(() => runScenarios({ map: sampleMap(), executor: fakeExecutor(), git: fakeGit(MATCHING_SHAS) }), /startedAt is required/);
    assert.throws(() => buildPilotLedgerReceipt({ ledger: runSample(), actor: "joelkehle" }), /timestamp is required/);
  });

  it("records the map content hash and the revisions it ran against", () => {
    const ledger = runSample();

    assert.match(ledger.map.content_sha256, /^[0-9a-f]{64}$/);
    assert.equal(ledger.worktrees.length, 2);
    assert.equal(ledger.worktrees[0].matches, true);
    assert.equal(ledger.worktrees[0].pinned, true);
    assert.equal(ledger.worktrees[1].pinned, false);
    assert.equal(ledger.worktrees[1].matches, null);
  });
});

describe("revision checking", () => {
  it("marks a scenario stale and fails the run when a pinned HEAD moved", () => {
    const ledger = runSample({ git: fakeGit({ ...MATCHING_SHAS, "/tmp/dep": "9999999999999999999999999999999999999999" }) });

    assert.equal(ledger.ok, false);
    assert.equal(ledger.counts.stale_revision, SCENARIO_IDS.length);
    assert.equal(ledger.counts.revision_mismatches, 1);
    assert.equal(ledger.scenarios[0].status, SCENARIO_STATUSES.STALE_REVISION);
    assert.deepEqual(ledger.scenarios[0].stale_worktrees, ["dep"]);
    assert.deepEqual(ledger.scenarios[0].commands, [], "a stale scenario runs nothing");
  });

  it("fails the run when a worktree cannot be read at all", () => {
    const ledger = runSample({ git: fakeGit({}) });

    assert.equal(ledger.ok, false);
    assert.equal(ledger.worktrees[0].observed_head_sha, null);
    assert.equal(ledger.worktrees[0].matches, false);
    assert.ok(ledger.worktrees[0].error);
  });

  it("runs anyway under --allow-drift and records the drift", () => {
    const drifted = { ...MATCHING_SHAS, "/tmp/dep": "9999999999999999999999999999999999999999" };
    const ledger = runSample({ git: fakeGit(drifted), allowDrift: true });

    assert.equal(ledger.ok, true);
    assert.equal(ledger.options.allow_drift, true);
    assert.equal(ledger.counts.revision_mismatches, 1);
    assert.equal(ledger.scenarios[0].status, SCENARIO_STATUSES.PASSED);
    assert.equal(ledger.scenarios[0].drift_allowed, true);

    const receipt = buildPilotLedgerReceipt({ ledger, actor: "joelkehle", timestamp: FIXED_TIMESTAMP });

    assert.equal(receipt.outcome.allow_drift, true);
    assert.equal(receipt.revisions[0].matches, false);
  });

  it("never calls a self worktree stale", () => {
    const ledger = runSample({ git: fakeGit({ ...MATCHING_SHAS, "/tmp/self": "abcabcabcabcabcabcabcabcabcabcabcabcabca" }) });

    assert.equal(ledger.ok, true);
    assert.equal(ledger.counts.revision_mismatches, 0);
    assert.equal(ledger.worktrees[1].observed_head_sha, "abcabcabcabcabcabcabcabcabcabcabcabcabca");
  });
});

describe("command outcomes", () => {
  it("fails a selector that matched no test rather than passing silently", () => {
    const ledger = runSample({ executor: fakeExecutor({ stdout: "testing: warning: no tests to run\nPASS\nok  \tpkg\t0.01s\n" }) });

    assert.equal(ledger.ok, false);
    assert.equal(ledger.scenarios[0].commands[0].status, COMMAND_STATUSES.NO_TESTS_MATCHED);
    assert.match(ledger.scenarios[0].commands[0].detail, /matched no test/);
  });

  it("fails when the number of tests run is not the number declared", () => {
    const ledger = runSample({ executor: fakeExecutor({ passed: 3 }) });

    assert.equal(ledger.ok, false);
    assert.equal(ledger.scenarios[0].commands[0].status, COMMAND_STATUSES.TEST_COUNT_MISMATCH);
    assert.match(ledger.scenarios[0].commands[0].detail, /ran 3 test\(s\) where the map declares 1/);
  });

  it("fails and keeps an excerpt when a test fails", () => {
    const ledger = runSample({ executor: fakeExecutor({ passed: 0, failed: 1, status: 1 }) });
    const command = ledger.scenarios[0].commands[0];

    assert.equal(ledger.ok, false);
    assert.equal(command.status, COMMAND_STATUSES.FAILED);
    assert.equal(command.tests_failed, 1);
    assert.match(command.failure_excerpt, /--- FAIL: TestFail0/);
  });

  it("fails when the runner could not be spawned", () => {
    const ledger = runSample({ executor: fakeExecutor({ status: null, stdout: "", error: "spawn go ENOENT" }) });

    assert.equal(ledger.ok, false);
    assert.equal(ledger.scenarios[0].commands[0].status, COMMAND_STATUSES.FAILED);
    assert.equal(ledger.scenarios[0].commands[0].detail, "spawn go ENOENT");
  });

  it("records an output hash for a passing command", () => {
    const command = runSample().scenarios[0].commands[0];

    assert.equal(command.status, COMMAND_STATUSES.PASSED);
    assert.match(command.output_sha256, /^[0-9a-f]{64}$/);
    assert.ok(command.output_bytes > 0);
    assert.equal(command.failure_excerpt, null);
  });
});

describe("gap reporting", () => {
  it("reports a scenario without executable evidence as a gap, never a pass", () => {
    const map = mutateScenario(3, {
      evidence: EVIDENCE_CLASSES.MISSING,
      proves: [],
      commands: [],
      gaps: [{ clause: "nothing proves this", why: "no suite exists", would_be_proven_by: "a new end-to-end test" }],
    });

    const ledger = runSample({ map });
    const scenario = ledger.scenarios[3];

    assert.equal(scenario.status, SCENARIO_STATUSES.GAP_ONLY);
    assert.equal(ledger.counts.gap_only, 1);
    assert.equal(ledger.counts.passed, SCENARIO_IDS.length - 1);
    assert.equal(ledger.counts.open_gaps, 1);
    assert.ok(ledger.gaps.some((entry) => entry.scenario_id === scenario.scenario_id));
  });

  it("carries the gaps of a partially proven scenario into the ledger", () => {
    const map = mutateScenario(2, {
      evidence: EVIDENCE_CLASSES.PARTIAL,
      gaps: [{ clause: "half proven", why: "no fake exists", would_be_proven_by: "a failure hook" }],
    });

    const ledger = runSample({ map });

    assert.equal(ledger.scenarios[2].status, SCENARIO_STATUSES.PASSED);
    assert.equal(ledger.counts.open_gaps, 1);
    assert.equal(ledger.counts.scenarios_with_gaps, 1);

    const receipt = buildPilotLedgerReceipt({ ledger, actor: "joelkehle", timestamp: FIXED_TIMESTAMP });

    assert.equal(receipt.outcome.scenarios[2].gap_count, 1);
  });

  it("surfaces the checked-in map's own open gaps", () => {
    const validation = validateScenarioMap(loadScenarioMap(MAP_PATH));
    const partial = validation.coverage.filter((entry) => entry.evidence !== EVIDENCE_CLASSES.EXECUTABLE);

    assert.ok(partial.length > 0, "the map records honest partial coverage");

    for (const entry of partial) {
      assert.ok(entry.gap_count > 0, `${entry.scenario_id} names what it does not prove`);
    }
  });

  it("skips scenarios outside a filter without counting them as passed", () => {
    const ledger = runSample({ scenarioIds: ["GHL-E2E-02"] });

    assert.equal(ledger.counts.passed, 1);
    assert.equal(ledger.counts.skipped, SCENARIO_IDS.length - 1);
    assert.deepEqual(ledger.options.scenario_filter, ["GHL-E2E-02"]);
    assert.throws(() => runSample({ scenarioIds: ["GHL-E2E-99"] }), /unknown scenario/);
  });
});

describe("live-mode refusal preflight", () => {
  const spec = loadActivationSpec(SPEC_PATH);

  it("accepts the checked-in activation spec", () => {
    assert.deepEqual(validateActivationSpec(spec).errors, []);
    assert.deepEqual(spec.checkpoints.map((checkpoint) => checkpoint.checkpoint_id), ["ACT-REV-03", "ACT-REV-04"]);
  });

  it("requires every checkpoint to name a rollback", () => {
    const withoutRollback = { ...spec, checkpoints: spec.checkpoints.map(({ rollback, ...rest }) => rest) };
    const validation = validateActivationSpec(withoutRollback);

    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.path.endsWith("rollback")));
  });

  it("refuses live mode for the current live state", () => {
    const observed = identities("current-live-state");
    const preflight = evaluateActivation({ spec, observed });

    assert.equal(preflight.live_mode_permitted, false);
    assert.equal(preflight.checkpoints.every((checkpoint) => !checkpoint.satisfied), true);
    assert.deepEqual(preflight.refusal_codes, [
      PREFLIGHT_REFUSAL_CODES.COMMIT_MISMATCH,
      PREFLIGHT_REFUSAL_CODES.MISSING_CHECKPOINT_RECEIPT,
    ]);

    const coordinator = preflight.checkpoints.find((checkpoint) => checkpoint.checkpoint_id === "ACT-REV-04");

    assert.equal(coordinator.observed_commit, "4fc77c8");
    assert.ok(
      coordinator.refusals.some((refusal) => refusal.message.includes("GHL-004")),
      "the refusal names the issues the deployed build is missing",
    );
  });

  it("permits live mode only when every build matches exactly", () => {
    const preflight = evaluateActivation({ spec, observed: identities("activated") });

    assert.equal(preflight.live_mode_permitted, true);
    assert.deepEqual(preflight.refusals, []);
    assert.equal(preflight.still_requires_owner_authorization, true);
  });

  it("refuses a dirty build and a build that was never activated", () => {
    const preflight = evaluateActivation({ spec, observed: identities("unactivated") });

    assert.equal(preflight.live_mode_permitted, false);
    assert.deepEqual(preflight.refusal_codes, [PREFLIGHT_REFUSAL_CODES.DIRTY_BUILD, PREFLIGHT_REFUSAL_CODES.NOT_ACTIVATED]);
  });

  it("refuses an absent service rather than assuming it is fine", () => {
    const observed = identities("activated");
    const preflight = evaluateActivation({
      spec,
      observed: { ...observed, services: observed.services.filter((service) => service.service !== "manager") },
    });

    assert.equal(preflight.live_mode_permitted, false);
    assert.deepEqual(preflight.refusal_codes, [PREFLIGHT_REFUSAL_CODES.SERVICE_ABSENT]);
  });

  it("refuses an ambiguous or unknown build identity", () => {
    const observed = identities("activated");

    const duplicated = evaluateActivation({ spec, observed: { ...observed, services: [...observed.services, observed.services[0]] } });
    assert.ok(duplicated.refusal_codes.includes(PREFLIGHT_REFUSAL_CODES.DUPLICATE_SERVICE));

    const blank = evaluateActivation({
      spec,
      observed: { ...observed, services: observed.services.map((service) => ({ ...service, commit: "" })) },
    });
    assert.deepEqual(blank.refusal_codes, [PREFLIGHT_REFUSAL_CODES.COMMIT_UNKNOWN]);
  });

  it("treats a short health-endpoint SHA as the same build", () => {
    const observed = identities("activated");
    const preflight = evaluateActivation({
      spec,
      observed: { ...observed, services: observed.services.map((service) => ({ ...service, commit: service.commit.slice(0, 7) })) },
    });

    assert.equal(preflight.live_mode_permitted, true);
  });

  it("refuses a commit too short to identify a build", () => {
    const observed = identities("activated");
    const preflight = evaluateActivation({
      spec,
      observed: { ...observed, services: observed.services.map((service) => ({ ...service, commit: service.commit.slice(0, 5) })) },
    });

    assert.equal(preflight.live_mode_permitted, false);
    assert.deepEqual(preflight.refusal_codes, [PREFLIGHT_REFUSAL_CODES.COMMIT_MISMATCH]);
  });

  it("rejects malformed observed identities", () => {
    const validation = validateBuildIdentities({ schema: "github-lifecycle-build-identity.v1" });

    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.code === PILOT_DEFECT_CODES.MISSING_FIELD));
    assert.deepEqual(validateBuildIdentities(identities("activated")).errors, []);
  });

  it("seals an attributable preflight receipt", () => {
    const observed = identities("current-live-state");
    const preflight = evaluateActivation({ spec, observed });
    const receipt = buildPreflightReceipt({ preflight, spec, observed, actor: "joelkehle", timestamp: FIXED_TIMESTAMP });

    assert.equal(verifyReceipt(receipt), true);
    assert.equal(receipt.outcome.live_mode_permitted, false);
    assert.equal(receipt.evaluator.write_class, "read");
    assert.equal(receipt.boundary.authorizes_no_canary, true);
    assert.equal(receipt.outcome.refusal_count, 4);
  });
});

describe("ghl-pilot command line", () => {
  it("plans the checked-in map and names its partial scenarios", () => {
    const result = runCli(["plan"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /GHL-E2E-01/);
    assert.match(result.stdout, /partial evidence:/);
    assert.match(result.stdout, /would be proven by:/);
  });

  it("refuses live mode with a nonzero exit for the current live state", () => {
    const result = runCli(["preflight", path.join(FIXTURES, "current-live-state.identities.json")]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /live mode REFUSED/);
    assert.match(result.stdout, /commit_mismatch/);
  });

  it("permits live mode for an exactly matching state and says it is not an authorization", () => {
    const result = runCli(["preflight", path.join(FIXTURES, "activated.identities.json")]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /still requires Joel's separate authorization/);
  });

  it("prints a verifiable preflight receipt", () => {
    const result = runCli([
      "preflight",
      path.join(FIXTURES, "current-live-state.identities.json"),
      "--receipt",
      "--actor",
      "joelkehle",
      "--at",
      FIXED_TIMESTAMP,
    ]);

    assert.equal(result.status, 1);
    assert.equal(verifyReceipt(JSON.parse(result.stdout)), true);
  });

  it("runs a map end to end and seals its ledger", () => {
    const dir = tempDir();
    const passing = path.join(dir, "passing.test.js");
    const mapPath = path.join(dir, "map.json");
    const ledgerPath = path.join(dir, "ledger.json");

    fs.writeFileSync(
      passing,
      'const { test } = require("node:test");\ntest("proves something", () => {});\ntest("proves another thing", () => {});\n',
    );

    const head = execFileSync("git", ["-C", REPO_ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const map = sampleMap({
      worktrees: [
        {
          worktree_id: "agent-scripts",
          repository: "joelkehle/agent-scripts",
          path: REPO_ROOT,
          head_sha: head,
          revision_policy: "pinned",
        },
      ],
      scenarios: SCENARIO_IDS.map((id, index) => ({
        scenario_id: id,
        title: `scenario ${id}`,
        evidence: index === 0 ? EVIDENCE_CLASSES.MISSING : EVIDENCE_CLASSES.EXECUTABLE,
        proves: index === 0 ? [] : ["a clause"],
        gaps: index === 0 ? [{ clause: "unproven", why: "no suite", would_be_proven_by: "a new test" }] : [],
        commands:
          index === 0
            ? []
            : [{ worktree_id: "agent-scripts", kind: "node_test", argv: ["node", "--test", passing], expects_tests: 2 }],
      })),
    });

    fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));

    const run = runCli(["run", mapPath, "--out", ledgerPath, "--at", FIXED_TIMESTAMP]);

    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /11 passed, 0 failed, 0 stale, 1 without evidence/);
    assert.match(run.stdout, /1 open gap\(s\)/);
    assert.match(run.stdout, /no executable evidence exists for this scenario/);

    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));

    assert.equal(ledger.ok, true);
    assert.equal(ledger.counts.gap_only, 1);
    assert.equal(ledger.scenarios[1].commands[0].tests_run, 2);

    const sealed = runCli(["ledger", "--from", ledgerPath, "--actor", "joelkehle", "--at", FIXED_TIMESTAMP]);

    assert.equal(sealed.status, 0);
    assert.equal(verifyReceipt(JSON.parse(sealed.stdout)), true);
  });

  it("refuses an invalid map and an unknown command", () => {
    const dir = tempDir();
    const mapPath = path.join(dir, "broken.json");

    fs.writeFileSync(mapPath, JSON.stringify({ schema: "github-lifecycle-e2e-scenarios.v1" }));

    const run = runCli(["run", mapPath]);

    assert.equal(run.status, 1);
    assert.match(run.stderr, /refusing to run an invalid scenario map/);
    assert.equal(runCli(["nonsense"]).status, 2);
  });
});
