"use strict";

const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  FocusValidationError,
  parseFocusYaml,
  resolveException,
  resolveGoal,
  validateFocus,
} = require("../lib/weekly-focus");
const { evaluateWorkspace } = require("../lib/workspace-preflight");
const {
  beginRun,
  readManifest,
  reconcileRuns,
  sealRun,
} = require("../lib/agent-workspace");

const repoRoot = path.resolve(__dirname, "..");

function focusYaml(execution = "") {
  return `week_ending: 2026-08-02
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
    github: { owner: "kehle-tdg-dev", repo: "core" },
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

test("write preflight accepts canonical development origin and a clean primary", () => {
  assert.equal(evaluateWorkspace(baseObservation(), "write").ok, true);
});

test("write preflight rejects the ucla-tdg mirror origin", () => {
  const result = evaluateWorkspace(baseObservation({
    canonical_remote: "https://github.com/ucla-tdg/core.git",
    github: { owner: "ucla-tdg", repo: "core" },
  }), "write");
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, "read_only_mirror_origin");
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
  const result = spawnSync("node", [
    path.join(repoRoot, "bin/agent-start"),
    "--root", fixture.root,
    "--goal", "W31-CORE",
    "--focus-file", fixture.focusFile,
    "--no-bus",
    "--workbench-summary", workbench,
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${stubDir}:${process.env.PATH}`,
      AGENTCOORD_ROOT: fixture.agentcoordRoot,
      AGENT_QUARANTINE_ROOT: fixture.quarantineRoot,
      AGENT_WORKSPACE_STATE_ROOT: fixture.stateRoot,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /goal: W31-CORE \[selected\]/);
  assert.match(result.stdout, /definition of done: Core is validated/);
  assert.match(result.stdout, /required milestone: Targeted tests pass/);
  assert.match(result.stdout, /execution binding: mission:mission-start-1/);
  assert.match(result.stdout, /preflight: PASS mode=write/);
  assert.match(result.stdout, /canonical remote: https:\/\/github\.com\/kehle-tdg-dev\/agent-start\.git/);
});
