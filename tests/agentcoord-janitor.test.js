"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  normalizeRepo,
  prepareClaimForWrite,
  readClaims,
} = require("../lib/agentcoord-claims");

const repoRoot = path.resolve(__dirname, "..");
const cli = path.join(repoRoot, "bin/agentcoord");

function makeRoot(t, name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `agentcoord-janitor-${name}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function baseClaim(overrides = {}) {
  return {
    repo: "shared/agent-scripts",
    slug: "janitor-test",
    agent: "codex",
    host: "beelink",
    safety: "write",
    scope: ["bin/agentcoord"],
    started_at: "2026-01-01T00:00:00Z",
    expires_at: "2099-01-01T00:00:00Z",
    next_action: "test",
    contact: "Joel Kehle <joel@kehle.com>",
    ...overrides,
  };
}

function writeClaim(root, repo, name, value) {
  const dir = path.join(root, "claims", ...repo.split("/"));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.json`);
  fs.writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function runCli(t, args) {
  const result = spawnSync("node", [cli, ...args], { encoding: "utf8" });
  if (result.error?.code === "EPERM") {
    t.skip("sandbox blocks nested process execution");
    return null;
  }
  return result;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 86400000);
}

function iso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

test("archive moves only old released claims and preserves the relative path", (t) => {
  const root = makeRoot(t, "archive");
  const oldReleased = writeClaim(root, "shared/agent-scripts", "old-released", baseClaim({
    released_at: iso(daysAgo(45)),
    released_by: "agentcoord-janitor",
  }));
  const freshReleased = writeClaim(root, "shared/agent-scripts", "fresh-released", baseClaim({
    slug: "fresh",
    released_at: iso(daysAgo(2)),
  }));
  const active = writeClaim(root, "shared/agent-scripts", "active", baseClaim({ slug: "active" }));

  const dry = runCli(t, ["archive", "--root", root, "--json"]);
  if (!dry) return;
  assert.equal(dry.status, 0, dry.stderr);
  const dryReport = JSON.parse(dry.stdout);
  assert.equal(dryReport.dry_run, true);
  assert.equal(dryReport.summary.eligible, 1);
  assert.equal(dryReport.summary.archived, 0);
  assert.equal(fs.existsSync(oldReleased), true);

  const applied = runCli(t, ["archive", "--root", root, "--apply", "--json"]);
  assert.equal(applied.status, 0, applied.stderr);
  const report = JSON.parse(applied.stdout);
  assert.equal(report.summary.archived, 1);
  assert.equal(report.summary.errors, 0);
  const target = path.join(root, "claims-archive", "shared", "agent-scripts", "old-released.json");
  assert.equal(fs.existsSync(target), true);
  assert.equal(fs.existsSync(oldReleased), false);
  assert.equal(fs.existsSync(freshReleased), true);
  assert.equal(fs.existsSync(active), true);
  // Nothing deleted: archived content is byte-identical claim data.
  assert.equal(JSON.parse(fs.readFileSync(target, "utf8")).slug, "janitor-test");
});

test("list, validate, and sweep skip claims-archive entirely", (t) => {
  const root = makeRoot(t, "skip-archive");
  writeClaim(root, "shared/agent-scripts", "live", baseClaim({ slug: "live" }));
  const archiveDir = path.join(root, "claims-archive", "shared", "agent-scripts");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(path.join(archiveDir, "buried.json"), JSON.stringify(baseClaim({
    slug: "buried",
    expires_at: "2000-01-01T00:00:00Z",
  })));
  fs.writeFileSync(path.join(archiveDir, "corrupt.json"), "{not-json");

  const entries = readClaims(root);
  assert.deepEqual(entries.map((entry) => entry.data.slug), ["live"]);

  const listed = runCli(t, ["list", "--root", root, "--all", "--json"]);
  if (!listed) return;
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).summary.total, 1);

  const validated = runCli(t, ["validate", "--root", root, "--json"]);
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).summary.invalid, 0);

  const swept = runCli(t, ["sweep", "--root", root, "--json"]);
  assert.equal(swept.status, 0, swept.stderr);
  const sweepReport = JSON.parse(swept.stdout);
  assert.equal(sweepReport.summary.stale, 0);
  assert.equal(sweepReport.summary.invalid, 0);
});

test("repo normalization maps observed variants and passes unknown names through", () => {
  assert.equal(normalizeRepo("manager"), "shared/manager");
  assert.equal(normalizeRepo("shared-manager"), "shared/manager");
  assert.equal(normalizeRepo("shared__manager"), "shared/manager");
  assert.equal(normalizeRepo("llm-wiki"), "jk/llm-wiki");
  assert.equal(normalizeRepo("shared-agent-scripts"), "shared/agent-scripts");
  assert.equal(normalizeRepo("shared-hall-monitor"), "shared/hall-monitor");
  // Already canonical: unchanged.
  assert.equal(normalizeRepo("shared/manager"), "shared/manager");
  assert.equal(normalizeRepo("shared/agent-scripts"), "shared/agent-scripts");
  // Unrecognized: passthrough apart from the __ rule. No fuzzy matching.
  assert.equal(normalizeRepo("ucla-tdg/oris"), "ucla-tdg/oris");
  assert.equal(normalizeRepo("some-other-repo"), "some-other-repo");
  assert.equal(normalizeRepo("jk__llm-wiki"), "jk/llm-wiki");
  assert.equal(normalizeRepo("a__b__c"), "a/b/c");
});

test("claim writes land in the canonical directory and old spellings converge on read", (t) => {
  const root = makeRoot(t, "normalize-cli");
  const claimed = runCli(t, [
    "claim", "--root", root,
    "--repo", "shared-manager",
    "--slug", "converge",
    "--agent", "codex", "--host", "beelink",
    "--json",
  ]);
  if (!claimed) return;
  assert.equal(claimed.status, 0, claimed.stderr);
  const written = JSON.parse(claimed.stdout);
  assert.equal(written.claim.repo, "shared/manager");
  assert.match(written.file, /claims\/shared\/manager\//);

  // An old spelling in a filter still finds the canonical claim.
  const listed = runCli(t, ["list", "--root", root, "--all", "--repo", "shared__manager", "--json"]);
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).summary.total, 1);

  // Release lookup converges too.
  const released = runCli(t, [
    "release", "--root", root,
    "--repo", "manager",
    "--slug", "converge",
    "--agent", "codex", "--host", "beelink",
    "--json",
  ]);
  assert.equal(released.status, 0, released.stderr);
  assert.ok(JSON.parse(released.stdout).claim.released_at);
});

test("claim refuses invalid input before writing", (t) => {
  assert.throws(() => prepareClaimForWrite(baseClaim({ scope: "bin/agentcoord" })), /scope must be an array/);
  assert.throws(() => prepareClaimForWrite(baseClaim({ slug: "" })), /slug is required/);
  assert.throws(() => prepareClaimForWrite(baseClaim({ expires_at: "not-a-time" })), /invalid expires_at/);
  assert.equal(typeof JSON.parse(prepareClaimForWrite(baseClaim())), "object");

  const root = makeRoot(t, "claim-refuse");
  const missingSlug = runCli(t, ["claim", "--root", root, "--repo", "shared/agent-scripts"]);
  if (!missingSlug) return;
  assert.equal(missingSlug.status, 1);
  assert.match(missingSlug.stderr, /--slug is required/);
  assert.equal(fs.existsSync(path.join(root, "claims")), false);
});

test("sweep releases expired-invalid claims and skips fresh-invalid ones", (t) => {
  const root = makeRoot(t, "sweep-invalid");
  const old = new Date(Date.now() - 10 * 86400000);
  const oldInvalid = writeClaim(root, "shared/agent-scripts", "old-invalid", baseClaim({
    slug: "old-invalid",
    scope: "not-an-array",
  }));
  fs.utimesSync(oldInvalid, old, old);
  const oldCorrupt = writeClaim(root, "shared/agent-scripts", "old-corrupt", "{not-json");
  fs.utimesSync(oldCorrupt, old, old);
  const freshInvalid = writeClaim(root, "shared/agent-scripts", "fresh-invalid", baseClaim({
    slug: "fresh-invalid",
    scope: "also-not-an-array",
  }));

  const dry = runCli(t, ["sweep", "--root", root, "--stale-after-days", "7", "--json"]);
  if (!dry) return;
  assert.equal(dry.status, 0, dry.stderr);
  const dryReport = JSON.parse(dry.stdout);
  assert.equal(dryReport.summary.invalid, 3);
  assert.equal(dryReport.summary.invalid_eligible, 2);
  assert.equal(JSON.parse(fs.readFileSync(oldInvalid, "utf8")).released_at, undefined);

  const applied = runCli(t, ["sweep", "--root", root, "--stale-after-days", "7", "--apply", "--json"]);
  assert.equal(applied.status, 0, applied.stderr);
  const report = JSON.parse(applied.stdout);
  assert.equal(report.summary.released_invalid, 2);
  assert.equal(report.summary.errors, 0);

  // Parseable invalid: rewritten as valid JSON with the original preserved.
  const rewritten = JSON.parse(fs.readFileSync(oldInvalid, "utf8"));
  assert.equal(rewritten.release_reason, "invalid-expired");
  assert.equal(rewritten.released_by, "agentcoord-janitor");
  assert.ok(rewritten.released_at);
  assert.equal(rewritten.original.slug, "old-invalid");
  assert.equal(rewritten.original.scope, "not-an-array");

  // Unparseable invalid: raw bytes preserved alongside as <name>.corrupt.
  const corruptRewritten = JSON.parse(fs.readFileSync(oldCorrupt, "utf8"));
  assert.equal(corruptRewritten.release_reason, "invalid-expired");
  assert.equal(corruptRewritten.original_file, "old-corrupt.json.corrupt");
  assert.equal(fs.readFileSync(`${oldCorrupt}.corrupt`, "utf8"), "{not-json");

  // Fresh invalid untouched.
  assert.equal(JSON.parse(fs.readFileSync(freshInvalid, "utf8")).released_at, undefined);

  // A second sweep does not reprocess already-released invalid claims.
  const again = runCli(t, ["sweep", "--root", root, "--stale-after-days", "7", "--apply", "--json"]);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(JSON.parse(again.stdout).summary.released_invalid, 0);
});
