"use strict";

const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { Worker } = require("node:worker_threads");

const {
  calendarDate,
  FocusValidationError,
  focusStatus,
  loadFocus,
  parseFocusYaml,
  resolveException,
  resolveGoal,
  validateFocus,
} = require("../lib/weekly-focus");
const {
  evaluateWorkspace,
  preflightWorkspace,
  quarantineMatch,
  readClaims,
} = require("../lib/workspace-preflight");
const {
  beginRun,
  entranceClaimPath,
  readManifest,
  reconcileRuns,
  resolveRun,
  sealRun,
} = require("../lib/agent-workspace");
const { processIdentity } = require("../lib/process-owner");

const repoRoot = path.resolve(__dirname, "..");

function focusYaml(execution = "", weekEnding = "2099-08-02") {
  return `week_ending: ${weekEnding}
goals:
  - id: W31-CORE
    done: Core is validated.
    required_milestone: Targeted tests pass.
    fallback: Preserve the safe read path.
${execution}
not_this_week:
  - New orchestrator
`;
}

function parseValidFocus(text) {
  const parsed = parseFocusYaml(text);
  const result = validateFocus(parsed.focus, parsed.errors);
  assert.deepEqual(result.errors, []);
  return result.focus;
}

function baseObservation(overrides = {}) {
  return {
    git: true,
    repository_root: "/workspace/core",
    current_root: "/workspace/core",
    primary_root: "/workspace/core",
    canonical_remote: "https://github.com/kehle-tdg-dev/core.git",
    origin_fetch_url: "https://github.com/kehle-tdg-dev/core.git",
    origin_push_urls: ["https://github.com/kehle-tdg-dev/core.git"],
    github: { owner: "kehle-tdg-dev", repo: "core" },
    push_github: [{ owner: "kehle-tdg-dev", repo: "core" }],
    branch: "main",
    starting_head: "a".repeat(40),
    tracking_branch: "origin/main",
    divergence: { ahead: 0, behind: 0 },
    worktrees: [{
      root: "/workspace/core",
      status_ok: true,
      status: "",
      has_changes: false,
      living_owner: false,
    }],
    claims: { available: true, active: [], invalid: [] },
    quarantine: { available: true, matches: [] },
    runs: [],
    invalid_runs: [],
    ...overrides,
  };
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function makeRepository(t, name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `workspace-safety-${name}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "workspace-safety@example.com");
  git(root, "config", "user.name", "Workspace Safety Test");
  fs.writeFileSync(path.join(root, "README.md"), "initial\n");
  git(root, "add", "README.md");
  git(root, "commit", "-q", "-m", "initial");
  git(root, "remote", "add", "origin", `https://github.com/kehle-tdg-dev/${name}.git`);
  const head = git(root, "rev-parse", "HEAD");
  git(root, "update-ref", "refs/remotes/origin/main", head);
  git(root, "branch", "--set-upstream-to=origin/main", "main");
  return root;
}

function makeRunFixture(t, name) {
  const root = makeRepository(t, name);
  const support = fs.mkdtempSync(path.join(os.tmpdir(), `workspace-safety-support-${name}-`));
  t.after(() => fs.rmSync(support, { recursive: true, force: true }));
  const focusFile = path.join(support, "weekly-focus.yaml");
  const stateRoot = path.join(support, "state");
  const agentcoordRoot = path.join(support, "agentcoord");
  const quarantineRoot = path.join(support, "quarantine");
  fs.mkdirSync(agentcoordRoot, { recursive: true });
  fs.mkdirSync(quarantineRoot, { recursive: true });
  fs.writeFileSync(focusFile, focusYaml());
  return { root, focusFile, stateRoot, agentcoordRoot, quarantineRoot };
}

function makeAgentStartSupport(fixture) {
  const stubDir = path.join(path.dirname(fixture.stateRoot), "stubs");
  fs.mkdirSync(stubDir, { recursive: true });
  for (const command of [
    "agent-start",
    "agent-focus",
    "workspace-preflight",
    "agent-workspace",
    "agentcoord",
    "machine-compliance",
    "committer",
    "docs-list",
    "bus-discover",
    "wwi",
    "claude",
    "codex",
    "agent-check",
  ]) {
    const file = path.join(stubDir, command);
    fs.writeFileSync(file, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  }
  const workbench = path.join(path.dirname(fixture.stateRoot), "workbench.json");
  fs.writeFileSync(workbench, JSON.stringify({
    summary: { shouldSurface: false, surfaceReasons: [] },
    artifacts: { latestUrl: "http://example.test/proof/" },
  }));
  return {
    stubDir,
    workbench,
    env: {
      ...process.env,
      PATH: `${stubDir}:${process.env.PATH}`,
      AGENTCOORD_ROOT: fixture.agentcoordRoot,
      AGENT_QUARANTINE_ROOT: fixture.quarantineRoot,
      AGENT_WORKSPACE_STATE_ROOT: fixture.stateRoot,
    },
  };
}

test("valid weekly focus supports no execution_refs", () => {
  const focus = parseValidFocus(focusYaml());
  assert.equal(focus.goals[0].execution_refs, undefined);
});

test("valid weekly focus supports one mission execution_ref", () => {
  const focus = parseValidFocus(focusYaml(`    execution_refs:
      - kind: mission
        id: mission-123
`));
  assert.deepEqual(focus.goals[0].execution_refs, [{ kind: "mission", id: "mission-123" }]);
});

test("valid weekly focus supports several mixed execution_refs", () => {
  const focus = parseValidFocus(focusYaml(`    execution_refs:
      - kind: mission
        id: mission-123
      - kind: initiative
        id: initiative/456
      - kind: campaign
        id: campaign:789
`));
  assert.equal(focus.goals[0].execution_refs.length, 3);
  assert.deepEqual(focus.goals[0].execution_refs.map((ref) => ref.kind), [
    "mission",
    "initiative",
    "campaign",
  ]);
});

test("weekly focus rejects invalid files, execution kinds, and missing execution IDs", () => {
  const missing = parseFocusYaml("week_ending: 2026-08-02\ngoals: []\n");
  assert.equal(validateFocus(missing.focus, missing.errors).ok, false);

  const invalidKind = parseFocusYaml(focusYaml(`    execution_refs:
      - kind: program
        id: program-1
`));
  assert.match(validateFocus(invalidKind.focus, invalidKind.errors).errors.join("\n"), /kind must be mission/);

  const missingId = parseFocusYaml(focusYaml(`    execution_refs:
      - kind: mission
`));
  assert.match(validateFocus(missingId.focus, missingId.errors).errors.join("\n"), /id must be/);
});

test("goal and exception resolution validate declared IDs and reasons", () => {
  const focus = { ...parseValidFocus(focusYaml()), file: "fixture.yaml" };
  assert.equal(resolveGoal(focus, "W31-CORE").goal_id, "W31-CORE");
  assert.throws(() => resolveGoal(focus, "UNKNOWN"), FocusValidationError);
  assert.equal(
    resolveException(focus, "production_incident", "Production is unavailable.").exception.category,
    "production_incident",
  );
  assert.throws(() => resolveException(focus, "security_exposure", ""), /reason is required/);
});

test("weekly focus expires only after week_ending in America/Los_Angeles", (t) => {
  const support = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-focus-expiry-"));
  t.after(() => fs.rmSync(support, { recursive: true, force: true }));
  const file = path.join(support, "weekly-focus.yaml");
  fs.writeFileSync(file, focusYaml("", "2026-08-02"));
  const before = new Date("2026-08-02T06:59:59Z");
  const onDate = new Date("2026-08-03T06:59:59Z");
  const after = new Date("2026-08-03T07:00:00Z");

  assert.equal(calendarDate(before), "2026-08-01");
  assert.equal(calendarDate(onDate), "2026-08-02");
  assert.equal(calendarDate(after), "2026-08-03");
  assert.equal(focusStatus({ week_ending: "2026-08-02" }, before).expired, false);
  assert.equal(focusStatus({ week_ending: "2026-08-02" }, onDate).expired, false);
  assert.equal(focusStatus({ week_ending: "2026-08-02" }, after).expired, true);

  const current = loadFocus(file, { now: onDate });
  assert.equal(resolveGoal(current, "W31-CORE", { now: onDate }).goal_id, "W31-CORE");
  assert.throws(() => loadFocus(file, { now: after }), /expired.*America\/Los_Angeles/);
  const expired = loadFocus(file, { now: after, allowExpired: true });
  assert.throws(() => resolveGoal(expired, "W31-CORE", { now: after }), /expired/);
  assert.equal(
    resolveException(expired, "production_incident", "Production is unavailable.", { now: after })
      .focus_status,
    "expired",
  );
});

test("agent-focus validate and list report expired focus while exception remains available", (t) => {
  const support = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-focus-cli-expiry-"));
  t.after(() => fs.rmSync(support, { recursive: true, force: true }));
  const file = path.join(support, "weekly-focus.yaml");
  fs.writeFileSync(file, focusYaml("", "2000-01-01"));
  for (const command of ["validate", "list"]) {
    const result = spawnSync("node", [
      path.join(repoRoot, "bin/agent-focus"),
      command,
      "--file", file,
    ], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /EXPIRED/);
    assert.match(result.stdout, /America\/Los_Angeles/);
  }
  const goal = spawnSync("node", [
    path.join(repoRoot, "bin/agent-focus"),
    "resolve", "W31-CORE",
    "--file", file,
  ], { encoding: "utf8" });
  assert.equal(goal.status, 1);
  assert.match(goal.stderr, /expired/);

  const exception = spawnSync("node", [
    path.join(repoRoot, "bin/agent-focus"),
    "exception",
    "--category", "production_incident",
    "--reason", "Production is unavailable.",
    "--file", file,
  ], { encoding: "utf8" });
  assert.equal(exception.status, 0, exception.stderr);
  assert.match(exception.stdout, /resolved exception production_incident/);
});

test("write preflight accepts canonical development origin and a clean primary", () => {
  assert.equal(evaluateWorkspace(baseObservation(), "write").ok, true);
});

test("write preflight rejects the ucla-tdg mirror origin", () => {
  const result = evaluateWorkspace(baseObservation({
    canonical_remote: "https://github.com/ucla-tdg/core.git",
    origin_fetch_url: "https://github.com/ucla-tdg/core.git",
    origin_push_urls: ["https://github.com/ucla-tdg/core.git"],
    github: { owner: "ucla-tdg", repo: "core" },
    push_github: [{ owner: "ucla-tdg", repo: "core" }],
  }), "write");
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.code === "read_only_mirror_origin"));
  assert.ok(result.issues.some((item) => item.code === "read_only_mirror_push"));
});

test("write preflight rejects a mirror push URL behind a development fetch URL", (t) => {
  const fixture = makeRunFixture(t, "split-push");
  git(fixture.root, "config", "--add", "remote.origin.pushurl", "https://github.com/ucla-tdg/split-push.git");
  const result = preflightWorkspace(fixture.root, "write", fixture);
  assert.equal(result.origin_fetch_url, "https://github.com/kehle-tdg-dev/split-push.git");
  assert.deepEqual(result.origin_push_urls, ["https://github.com/ucla-tdg/split-push.git"]);
  assert.ok(result.issues.some((item) => item.code === "read_only_mirror_push"));
  assert.equal(result.ok, false);
});

test("write preflight rejects primary uncommitted changes", () => {
  const observation = baseObservation();
  observation.worktrees[0] = { ...observation.worktrees[0], has_changes: true, status: " M README.md" };
  assert.ok(evaluateWorkspace(observation, "write").issues.some((item) => item.code === "primary_has_changes"));
});

test("write preflight rejects unowned linked changes and accepts a living owner", () => {
  const linked = {
    root: "/workspace/linked",
    status_ok: true,
    status: " M README.md",
    has_changes: true,
    living_owner: false,
  };
  const refused = evaluateWorkspace(baseObservation({
    worktrees: [...baseObservation().worktrees, linked],
  }), "write");
  assert.ok(refused.issues.some((item) => item.code === "linked_worktree_unowned_changes"));

  const accepted = evaluateWorkspace(baseObservation({
    worktrees: [...baseObservation().worktrees, { ...linked, living_owner: true }],
    runs: [{
      manifest: {
        state: "active",
        repository_root: "/workspace/linked",
        run_id: "linked-owner",
      },
      living: true,
    }],
  }), "write");
  assert.equal(accepted.ok, true);
});

test("divergence blocks write mode but remains visible in read mode", () => {
  const observation = baseObservation({ divergence: { ahead: 1, behind: 0 } });
  const write = evaluateWorkspace(observation, "write");
  assert.equal(write.ok, false);
  assert.ok(write.issues.some((item) => item.code === "primary_divergent"));
  const read = evaluateWorkspace(observation, "read");
  assert.equal(read.ok, true);
  assert.ok(read.issues.some((item) => item.code === "primary_divergent"));
});

test("AgentCoord matches repository identity before interpreting relative scope", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-claims-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const claims = path.join(root, "claims");
  const expires = "2099-01-01T00:00:00Z";
  const base = {
    slug: "writer",
    agent: "codex",
    host: "beelink",
    safety: "write",
    started_at: "2026-07-30T00:00:00Z",
    expires_at: expires,
    next_action: "test",
  };
  const writeClaim = (repo, name, scope) => {
    const dir = path.join(claims, ...repo.split("/"));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ ...base, repo, scope }));
  };
  writeClaim("shared/core", "same", ["lib/core.js"]);
  writeClaim("shared/unrelated", "other", ["README.md"]);
  writeClaim("other/core", "same-basename", ["README.md"]);
  const result = readClaims(
    root,
    new Set(["shared/core", "kehle-tdg-dev/core", "/workspace/core"]),
    "/workspace/core",
    new Date("2026-07-30T12:00:00Z"),
  );
  assert.deepEqual(result.active.map(({ claim }) => claim.repo), ["shared/core"]);
});

test("AgentCoord canonical validation blocks relevant invalid claims only", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-invalid-claims-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const claims = path.join(root, "claims");
  const claim = {
    repo: "shared/core",
    slug: "writer",
    agent: "codex",
    host: "beelink",
    safety: "write",
    scope: ["README.md"],
    started_at: "2026-07-30T00:00:00Z",
    expires_at: "2099-01-01T00:00:00Z",
    next_action: "test",
  };
  const write = (repoDirectory, name, value) => {
    const directory = path.join(claims, ...repoDirectory.split("/"));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, `${name}.json`),
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  write("shared/core", "malformed", "{not-json");
  write("misc", "missing-expiry", { ...claim, expires_at: undefined });
  write("shared/core", "invalid-scope", { ...claim, scope: "README.md" });
  write("shared/unrelated", "malformed", "{not-json");
  write("shared/unrelated", "invalid", {
    ...claim,
    repo: "shared/unrelated",
    expires_at: undefined,
  });

  const result = readClaims(
    root,
    new Set(["shared/core", "/workspace/core"]),
    "/workspace/core",
    new Date("2026-07-30T12:00:00Z"),
  );
  assert.equal(result.active.length, 0);
  assert.deepEqual(
    result.invalid.map((entry) => path.basename(entry.file)).sort(),
    ["invalid-scope.json", "malformed.json", "missing-expiry.json"],
  );
  assert.ok(result.invalid.some((entry) => entry.errors.some((error) => /invalid JSON/.test(error))));
  assert.ok(result.invalid.some((entry) => entry.errors.includes("missing expires_at")));
  assert.ok(result.invalid.some((entry) => entry.errors.includes("scope must be an array")));

  const preflight = evaluateWorkspace(baseObservation({ claims: result }), "write");
  assert.equal(preflight.ok, false);
  assert.ok(preflight.issues.some((item) => item.code === "agentcoord_claim_ambiguous"));

  const canonical = spawnSync("node", [
    path.join(repoRoot, "bin/agentcoord"),
    "validate",
    "--root", root,
  ], { encoding: "utf8" });
  assert.equal(canonical.status, 1);
  assert.match(canonical.stdout, /invalid JSON/);
  assert.match(canonical.stdout, /missing expires_at/);
  assert.match(canonical.stdout, /scope must be an array/);
});

test("quarantine matching uses exact normalized repository and path identities", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-quarantine-match-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const registry = path.join(root, "registry.md");
  const aliases = new Set(["owner/app", "/path/app"]);
  fs.writeFileSync(registry, [
    "owner/app2 | QUARANTINED",
    "/path/app2 | QUARANTINED",
    "",
  ].join("\n"));
  assert.deepEqual(quarantineMatch(root, aliases).matches, []);

  fs.appendFileSync(registry, [
    "owner/app | QUARANTINED",
    "path=/path/app state=quarantined",
    "",
  ].join("\n"));
  const matches = quarantineMatch(root, aliases).matches;
  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((match) => match.line), [3, 4]);
});

test("write preflight rejects explicit quarantine and an active overlapping writer", () => {
  const quarantined = evaluateWorkspace(baseObservation({
    quarantine: { available: true, matches: [{ file: "registry.md", line: 4 }] },
  }), "write");
  assert.ok(quarantined.issues.some((item) => item.code === "repository_quarantined"));

  const collision = evaluateWorkspace(baseObservation({
    claims: { available: true, active: [{ claim: { repo: "shared/core", slug: "writer" } }], invalid: [] },
  }), "write");
  assert.ok(collision.issues.some((item) => item.code === "active_agentcoord_writer"));
});

test("run manifest without execution_ref begins and seals cleanly", (t) => {
  const fixture = makeRunFixture(t, "clean-seal");
  const begun = beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "clean-seal",
  });
  assert.equal(begun.manifest.state, "active");
  assert.equal(begun.manifest.execution_ref, null);
  const sealed = sealRun({ stateRoot: fixture.stateRoot, runId: "clean-seal", exitCode: 0 });
  assert.equal(sealed.manifest.state, "sealed");
  assert.equal(sealed.manifest.ending_head, sealed.manifest.starting_head);
});

test("begin rejects simultaneous goal and exception fields", (t) => {
  const fixture = makeRunFixture(t, "mixed-focus");
  assert.throws(() => beginRun({
    ...fixture,
    goalId: "W31-CORE",
    exceptionCategory: "production_incident",
    exceptionReason: "Production is unavailable.",
    tool: "codex",
    pid: process.pid,
  }), /mutually exclusive/);
  assert.throws(() => beginRun({
    ...fixture,
    goalId: "W31-CORE",
    exceptionSpecified: true,
    exceptionCategory: "",
    exceptionReason: "",
    tool: "codex",
    pid: process.pid,
  }), /mutually exclusive/);
});

test("expired focus blocks goal begin but permits a structured emergency exception", (t) => {
  const fixture = makeRunFixture(t, "expired-begin");
  fs.writeFileSync(fixture.focusFile, focusYaml("", "2026-08-02"));
  const now = new Date("2026-08-03T07:00:00Z");
  assert.throws(() => beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    now,
  }), /expired/);

  const begun = beginRun({
    ...fixture,
    exceptionCategory: "production_incident",
    exceptionReason: "Production is unavailable.",
    tool: "codex",
    pid: process.pid,
    runId: "expired-exception",
    now,
  });
  assert.equal(begun.manifest.state, "active");
  assert.equal(begun.manifest.goal_id, null);
  assert.deepEqual(begun.manifest.exception, {
    category: "production_incident",
    reason: "Production is unavailable.",
  });
  assert.equal(begun.focus.focus_status, "expired");
});

test("atomic repository entrance permits only one concurrent begin", async (t) => {
  const fixture = makeRunFixture(t, "concurrent-begin");
  const gate = new SharedArrayBuffer(4);
  const messages = [];
  const worker = new Worker(`
    const { parentPort, workerData } = require("node:worker_threads");
    const { beginRun } = require(workerData.module);
    try {
      const result = beginRun({
        ...workerData.options,
        pid: process.pid,
        runId: "concurrent-first",
        afterEntranceClaim() {
          parentPort.postMessage({ phase: "locked" });
          Atomics.wait(new Int32Array(workerData.gate), 0, 0);
        },
      });
      parentPort.postMessage({ phase: "result", ok: true, run_id: result.manifest.run_id });
    } catch (error) {
      parentPort.postMessage({ phase: "result", ok: false, error: error.message });
    }
  `, {
    eval: true,
    workerData: {
      module: path.join(repoRoot, "lib/agent-workspace.js"),
      options: { ...fixture, goalId: "W31-CORE", tool: "codex" },
      gate,
    },
  });
  worker.on("message", (message) => messages.push(message));
  await new Promise((resolve, reject) => {
    const onMessage = (message) => {
      if (message.phase === "locked") {
        worker.off("error", reject);
        worker.off("message", onMessage);
        resolve();
      }
    };
    worker.on("message", onMessage);
    worker.once("error", reject);
  });
  assert.throws(() => beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "claude",
    pid: process.pid,
    runId: "concurrent-second",
  }), /entrance is already in progress/);
  const workerExit = new Promise((resolve, reject) => {
    worker.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`worker exited ${code}`)));
    worker.once("error", reject);
  });
  Atomics.store(new Int32Array(gate), 0, 1);
  Atomics.notify(new Int32Array(gate), 0);
  await workerExit;
  const outcomes = messages.filter((message) => message.phase === "result");
  assert.deepEqual(outcomes, [{ phase: "result", ok: true, run_id: "concurrent-first" }]);
  assert.equal(fs.existsSync(path.join(fixture.stateRoot, "concurrent-second.json")), false);
});

test("atomic entrance safely reclaims a dead complete claim", (t) => {
  const fixture = makeRunFixture(t, "dead-entrance");
  const commonDir = fs.realpathSync(path.join(fixture.root, ".git"));
  const claim = entranceClaimPath(fixture.stateRoot, commonDir);
  fs.mkdirSync(path.dirname(claim), { recursive: true });
  fs.writeFileSync(claim, JSON.stringify({
    schema: "agent-workspace-entrance.v1",
    git_common_dir: commonDir,
    acquired_at: "2026-07-30T12:00:00Z",
    pid: process.pid,
    process_start_token: "linux:dead",
    host: os.hostname().split(".")[0],
  }));
  const begun = beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "dead-entrance",
  });
  assert.equal(begun.manifest.state, "active");
  assert.equal(fs.existsSync(claim), false);
});

test("run manifest with execution_ref validates syntax and quarantines uncommitted changes", (t) => {
  const fixture = makeRunFixture(t, "quarantine");
  const begun = beginRun({
    ...fixture,
    goalId: "W31-CORE",
    executionRef: { kind: "mission", id: "mission-abc" },
    tool: "claude",
    pid: process.pid,
    runId: "quarantine",
  });
  assert.deepEqual(begun.manifest.execution_ref, { kind: "mission", id: "mission-abc" });
  fs.appendFileSync(path.join(fixture.root, "README.md"), "changed\n");
  const sealed = sealRun({ stateRoot: fixture.stateRoot, runId: "quarantine", exitCode: 1 });
  assert.equal(sealed.manifest.state, "quarantined");
  assert.match(sealed.manifest.quarantine_reason, /uncommitted changes/);
});

test("seal accepts only the exact living controller identity", (t) => {
  const fixture = makeRunFixture(t, "seal-owner");
  const begun = beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "seal-owner",
  });
  assert.throws(() => sealRun({
    stateRoot: fixture.stateRoot,
    runId: "seal-owner",
    controllerIdentity: {
      pid: process.pid + 1000000,
      process_start_token: "linux:other",
      host: begun.manifest.host,
    },
  }), /owned by another controller/);
  assert.equal(readManifest(begun.file).state, "active");

  const sealed = sealRun({
    stateRoot: fixture.stateRoot,
    runId: "seal-owner",
    pid: process.pid,
    exitCode: 0,
  });
  assert.equal(sealed.manifest.state, "sealed");
});

test("seal refuses dead and ambiguous owners for reconcile", (t) => {
  const deadFixture = makeRunFixture(t, "seal-dead-owner");
  const dead = beginRun({
    ...deadFixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "seal-dead-owner",
  });
  fs.writeFileSync(dead.file, `${JSON.stringify({
    ...dead.manifest,
    process_start_token: "linux:dead",
  }, null, 2)}\n`);
  assert.throws(() => sealRun({
    stateRoot: deadFixture.stateRoot,
    runId: "seal-dead-owner",
    pid: process.pid,
  }), /use agent-workspace reconcile/);
  assert.equal(reconcileRuns({ stateRoot: deadFixture.stateRoot })[0].action, "marked_abandoned");

  const ambiguousFixture = makeRunFixture(t, "seal-ambiguous-owner");
  const ambiguous = beginRun({
    ...ambiguousFixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "seal-ambiguous-owner",
  });
  fs.writeFileSync(ambiguous.file, `${JSON.stringify({
    ...ambiguous.manifest,
    host: "another-host",
  }, null, 2)}\n`);
  assert.throws(() => sealRun({
    stateRoot: ambiguousFixture.stateRoot,
    runId: "seal-ambiguous-owner",
    pid: process.pid,
  }), /ownership is ambiguous/);
  assert.equal(readManifest(ambiguous.file).state, "active");
});

test("quarantined run resolution is guarded, terminal, and preserves evidence", (t) => {
  const fixture = makeRunFixture(t, "resolve-quarantine");
  const begun = beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "resolve-quarantine",
  });
  fs.appendFileSync(path.join(fixture.root, "README.md"), "changed\n");
  const quarantined = sealRun({
    stateRoot: fixture.stateRoot,
    runId: "resolve-quarantine",
    pid: process.pid,
    exitCode: 1,
  });
  const originalReason = quarantined.manifest.quarantine_reason;

  assert.throws(() => resolveRun({
    stateRoot: fixture.stateRoot,
    runId: "resolve-quarantine",
    reason: "",
  }), /resolution reason is required/);
  fs.writeFileSync(path.join(fixture.root, "README.md"), "initial\n");
  assert.throws(() => resolveRun({
    stateRoot: fixture.stateRoot,
    runId: "resolve-quarantine",
    reason: "Repository inspected and restored.",
  }), /owner is still living/);

  const deadManifest = {
    ...readManifest(begun.file),
    process_start_token: "linux:dead",
  };
  fs.writeFileSync(begun.file, `${JSON.stringify(deadManifest, null, 2)}\n`);
  fs.writeFileSync(begun.file, `${JSON.stringify({
    ...deadManifest,
    repository_root: path.join(path.dirname(fixture.stateRoot), "missing-repository"),
  }, null, 2)}\n`);
  assert.throws(() => resolveRun({
    stateRoot: fixture.stateRoot,
    runId: "resolve-quarantine",
    reason: "Repository inspected and restored.",
  }), /repository status is unreadable/);
  fs.writeFileSync(begun.file, `${JSON.stringify(deadManifest, null, 2)}\n`);
  fs.appendFileSync(path.join(fixture.root, "README.md"), "changed again\n");
  assert.throws(() => resolveRun({
    stateRoot: fixture.stateRoot,
    runId: "resolve-quarantine",
    reason: "Repository inspected and restored.",
  }), /uncommitted changes/);
  fs.writeFileSync(path.join(fixture.root, "README.md"), "initial\n");

  const livingIdentity = processIdentity(process.pid);
  const otherFile = path.join(fixture.stateRoot, "other-living.json");
  fs.writeFileSync(otherFile, `${JSON.stringify({
    ...deadManifest,
    run_id: "other-living",
    state: "active",
    ...livingIdentity,
    exit_code: null,
    ending_head: null,
    quarantine_reason: null,
  }, null, 2)}\n`);
  assert.throws(() => resolveRun({
    stateRoot: fixture.stateRoot,
    runId: "resolve-quarantine",
    reason: "Repository inspected and restored.",
  }), /living run other-living owns the same Git common directory/);
  fs.writeFileSync(otherFile, `${JSON.stringify({
    ...readManifest(otherFile),
    state: "sealed",
    exit_code: 0,
    ending_head: git(fixture.root, "rev-parse", "HEAD"),
    sealed_at: "2026-08-03T07:00:00Z",
  }, null, 2)}\n`);

  const result = resolveRun({
    stateRoot: fixture.stateRoot,
    runId: "resolve-quarantine",
    reason: "Repository inspected and restored.",
    pid: process.pid,
    now: new Date("2026-08-03T08:00:00Z"),
  });
  assert.equal(result.manifest.state, "resolved");
  assert.equal(result.manifest.quarantine_reason, originalReason);
  assert.equal(result.manifest.resolution_reason, "Repository inspected and restored.");
  assert.equal(result.manifest.resolved_at, "2026-08-03T08:00:00Z");
  assert.equal(result.manifest.resolved_head, git(fixture.root, "rev-parse", "HEAD"));
  assert.deepEqual(result.manifest.resolver, processIdentity(process.pid));
  assert.equal(fs.existsSync(begun.file), true);
  assert.equal(fs.readFileSync(path.join(fixture.root, "README.md"), "utf8"), "initial\n");

  const preflight = preflightWorkspace(fixture.root, "write", fixture);
  assert.equal(preflight.ok, true);
  assert.equal(preflight.issues.some((item) => item.code === "quarantined_run"), false);
  assert.throws(() => resolveRun({
    stateRoot: fixture.stateRoot,
    runId: "resolve-quarantine",
    reason: "Resolve twice.",
  }), /is resolved, not quarantined/);
});

test("agent-workspace resolve command records resolver identity", (t) => {
  const fixture = makeRunFixture(t, "resolve-cli");
  const begun = beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "resolve-cli",
  });
  fs.appendFileSync(path.join(fixture.root, "README.md"), "changed\n");
  sealRun({
    stateRoot: fixture.stateRoot,
    runId: "resolve-cli",
    pid: process.pid,
    exitCode: 1,
  });
  fs.writeFileSync(path.join(fixture.root, "README.md"), "initial\n");
  fs.writeFileSync(begun.file, `${JSON.stringify({
    ...readManifest(begun.file),
    process_start_token: "linux:dead",
  }, null, 2)}\n`);

  const result = spawnSync("node", [
    path.join(repoRoot, "bin/agent-workspace"),
    "resolve",
    "--run-id", "resolve-cli",
    "--reason", "Repository inspected and clean.",
    "--state-root", fixture.stateRoot,
    "--pid", String(process.pid),
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /agent-workspace: resolved run=resolve-cli/);
  const resolved = readManifest(begun.file);
  assert.equal(resolved.state, "resolved");
  assert.deepEqual(resolved.resolver, processIdentity(process.pid));
});

test("run manifest rejects an invalid execution_ref", (t) => {
  const fixture = makeRunFixture(t, "invalid-ref");
  assert.throws(() => beginRun({
    ...fixture,
    goalId: "W31-CORE",
    executionRef: { kind: "program", id: "" },
    tool: "codex",
    pid: process.pid,
  }), /kind must be mission/);
});

test("manifest reads, preflight, and reconciliation fail closed on invalid records", (t) => {
  const fixture = makeRunFixture(t, "invalid-record");
  const begun = beginRun({
    ...fixture,
    goalId: "W31-CORE",
    executionRef: { kind: "mission", id: "mission-valid" },
    tool: "codex",
    pid: process.pid,
    runId: "invalid-record",
  });
  fs.writeFileSync(begun.file, `${JSON.stringify({
    ...begun.manifest,
    execution_ref: { kind: "program", id: "" },
  }, null, 2)}\n`);
  assert.throws(() => readManifest(begun.file), /execution_ref.kind|kind must be mission/);
  let preflight = preflightWorkspace(fixture.root, "write", fixture);
  assert.ok(preflight.issues.some((item) => item.code === "run_manifest_ambiguous"));
  let reconciled = reconcileRuns({ stateRoot: fixture.stateRoot });
  assert.ok(reconciled.some((item) => item.action === "invalid_manifest"));

  fs.writeFileSync(path.join(fixture.stateRoot, "unreadable.json"), "{not-json\n");
  preflight = preflightWorkspace(fixture.root, "read", fixture);
  assert.equal(preflight.ok, true);
  assert.equal(preflight.shouldSurface, true);
  assert.ok(preflight.issues.some((item) => item.code === "run_manifest_ambiguous"));
  reconciled = reconcileRuns({ stateRoot: fixture.stateRoot });
  assert.equal(reconciled.filter((item) => item.action === "invalid_manifest").length, 2);
  const cli = spawnSync("node", [
    path.join(repoRoot, "bin/agent-workspace"),
    "reconcile",
    "--state-root", fixture.stateRoot,
  ], { encoding: "utf8" });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /invalid_manifest/);
  assert.match(cli.stdout, /cannot read manifest/);
  const jsonCli = spawnSync("node", [
    path.join(repoRoot, "bin/agent-workspace"),
    "reconcile",
    "--state-root", fixture.stateRoot,
    "--json",
  ], { encoding: "utf8" });
  assert.equal(jsonCli.status, 1);
  assert.match(jsonCli.stdout, /"action": "invalid_manifest"/);
});

test("reconcile keeps a living owner active", (t) => {
  const fixture = makeRunFixture(t, "living-owner");
  beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "living-owner",
  });
  const results = reconcileRuns({ stateRoot: fixture.stateRoot });
  assert.deepEqual(results.map((item) => item.action), ["kept_active"]);
  assert.equal(readManifest(path.join(fixture.stateRoot, "living-owner.json")).state, "active");
});

test("PID reuse start-token mismatch marks a clean dead run abandoned", (t) => {
  const fixture = makeRunFixture(t, "pid-reuse");
  const begun = beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "pid-reuse",
  });
  fs.writeFileSync(begun.file, `${JSON.stringify({
    ...begun.manifest,
    process_start_token: "linux:not-the-current-token",
  }, null, 2)}\n`);
  const results = reconcileRuns({ stateRoot: fixture.stateRoot });
  assert.equal(results[0].action, "marked_abandoned");
  assert.equal(readManifest(begun.file).state, "abandoned");
});

test("dead-run reconciliation quarantines uncommitted changes", (t) => {
  const fixture = makeRunFixture(t, "dead-run");
  const begun = beginRun({
    ...fixture,
    goalId: "W31-CORE",
    tool: "codex",
    pid: process.pid,
    runId: "dead-run",
  });
  fs.writeFileSync(begun.file, `${JSON.stringify({
    ...begun.manifest,
    process_start_token: "linux:dead",
  }, null, 2)}\n`);
  fs.appendFileSync(path.join(fixture.root, "README.md"), "uncommitted\n");
  const results = reconcileRuns({ stateRoot: fixture.stateRoot });
  assert.equal(results[0].action, "marked_quarantined");
  assert.match(readManifest(begun.file).quarantine_reason, /dead or PID-reused owner/);
});

test("agent-start displays weekly focus, execution binding, and clean workspace summary", (t) => {
  const fixture = makeRunFixture(t, "agent-start");
  fs.writeFileSync(fixture.focusFile, focusYaml(`    execution_refs:
      - kind: mission
        id: mission-start-1
`));
  const support = makeAgentStartSupport(fixture);
  const result = spawnSync("node", [
    path.join(repoRoot, "bin/agent-start"),
    "--root", fixture.root,
    "--goal", "W31-CORE",
    "--focus-file", fixture.focusFile,
    "--no-bus",
    "--workbench-summary", support.workbench,
  ], {
    encoding: "utf8",
    env: support.env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /goal: W31-CORE \[selected\]/);
  assert.match(result.stdout, /definition of done: Core is validated/);
  assert.match(result.stdout, /required milestone: Targeted tests pass/);
  assert.match(result.stdout, /execution binding: mission:mission-start-1/);
  assert.match(result.stdout, /preflight: PASS mode=write/);
  assert.match(result.stdout, /origin fetch: https:\/\/github\.com\/kehle-tdg-dev\/agent-start\.git/);
  assert.match(result.stdout, /origin push: https:\/\/github\.com\/kehle-tdg-dev\/agent-start\.git/);
});

test("agent-start read mode permits but surfaces repository hazards", (t) => {
  const fixture = makeRunFixture(t, "agent-start-read-hazard");
  const support = makeAgentStartSupport(fixture);
  git(fixture.root, "config", "--add", "remote.origin.pushurl", "https://github.com/ucla-tdg/agent-start-read-hazard.git");
  git(fixture.root, "commit", "--allow-empty", "-q", "-m", "ahead");
  fs.appendFileSync(path.join(fixture.root, "README.md"), "uncommitted\n");
  fs.writeFileSync(
    path.join(fixture.quarantineRoot, "registry.md"),
    `${fixture.root} | QUARANTINED\n`,
  );
  const claimDir = path.join(
    fixture.agentcoordRoot,
    "claims",
    "kehle-tdg-dev",
    "agent-start-read-hazard",
  );
  fs.mkdirSync(claimDir, { recursive: true });
  fs.writeFileSync(path.join(claimDir, "writer.json"), JSON.stringify({
    repo: "kehle-tdg-dev/agent-start-read-hazard",
    slug: "writer",
    agent: "codex",
    host: "beelink",
    safety: "write",
    scope: ["README.md"],
    started_at: "2026-07-30T00:00:00Z",
    expires_at: "2099-01-01T00:00:00Z",
    next_action: "test",
  }));
  fs.mkdirSync(fixture.stateRoot, { recursive: true });
  const identity = processIdentity(process.pid);
  fs.writeFileSync(path.join(fixture.stateRoot, "active-hazard.json"), JSON.stringify({
    schema: "agent-workspace-run.v1",
    run_id: "active-hazard",
    repository_root: fixture.root,
    git_common_dir: fs.realpathSync(path.join(fixture.root, ".git")),
    canonical_remote: "https://github.com/kehle-tdg-dev/agent-start-read-hazard.git",
    origin_push_urls: ["https://github.com/ucla-tdg/agent-start-read-hazard.git"],
    goal_id: "W31-CORE",
    exception: null,
    execution_ref: null,
    tool: "codex",
    ...identity,
    branch: "main",
    starting_head: git(fixture.root, "rev-parse", "HEAD"),
    created_at: "2026-07-30T12:00:00Z",
    state: "active",
    exit_code: null,
    ending_head: null,
    quarantine_reason: null,
  }));
  const result = spawnSync("node", [
    path.join(repoRoot, "bin/agent-start"),
    "--root", fixture.root,
    "--mode", "read",
    "--focus-file", fixture.focusFile,
    "--no-bus",
    "--workbench-summary", support.workbench,
  ], {
    encoding: "utf8",
    env: support.env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /shouldSurface=true/);
  assert.match(result.stdout, /preflight: PASS mode=read/);
  assert.match(result.stdout, /primary_has_changes/);
  assert.match(result.stdout, /primary_divergent/);
  assert.match(result.stdout, /read_only_mirror_push/);
  assert.match(result.stdout, /repository_quarantined/);
  assert.match(result.stdout, /active_agentcoord_writer/);
  assert.match(result.stdout, /active_run_collision/);
});
