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
  readClaimsAsync,
} = require("../lib/agentcoord-claims");
const {
  normalizeRepositoryIdentity,
  readClaims: preflightReadClaims,
} = require("../lib/workspace-preflight");

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

test("parallel claim scan keeps 210 delayed reads inside the startup deadline", async (t) => {
  const root = makeRoot(t, "parallel-startup");
  for (let index = 0; index < 208; index += 1) {
    writeClaim(root, "shared/agent-scripts", `active-${String(index).padStart(3, "0")}`, baseClaim({
      slug: `active-${index}`,
    }));
  }
  writeClaim(root, "shared/agent-scripts", "stale", baseClaim({
    slug: "stale",
    expires_at: "2000-01-01T00:00:00Z",
  }));
  writeClaim(root, "shared/agent-scripts", "invalid", "{not-json");

  let reads = 0;
  const started = Date.now();
  const entries = await readClaimsAsync(root, {
    concurrency: 32,
    readFile: async (file, encoding) => {
      reads += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return fs.promises.readFile(file, encoding);
    },
  });
  const elapsedMs = Date.now() - started;
  const statuses = entries.reduce((counts, entry) => {
    counts[entry.status] = (counts[entry.status] || 0) + 1;
    return counts;
  }, {});

  assert.equal(reads, 210);
  assert.deepEqual(statuses, { active: 208, invalid: 1, stale: 1 });
  assert.ok(elapsedMs < 5000, `parallel scan took ${elapsedMs}ms; startup limit is 5000ms`);
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

test("repo normalization never returns inherited Object.prototype members", () => {
  // Before the null-prototype fix these returned the Object constructor /
  // Object.prototype instead of a string.
  assert.equal(normalizeRepo("constructor"), "constructor");
  assert.equal(normalizeRepo("hasOwnProperty"), "hasOwnProperty");
  assert.equal(normalizeRepo("toString"), "toString");
  // "__proto__" still gets the documented `__` -> `/` rule, but the result
  // is a plain string, not the prototype object.
  const proto = normalizeRepo("__proto__");
  assert.equal(typeof proto, "string");
  assert.equal(proto, "/proto/");
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

test("swept invalid tombstones read as released and clear workspace preflight", (t) => {
  const root = makeRoot(t, "tombstone");
  const old = daysAgo(10);
  const parseable = writeClaim(root, "shared/agent-scripts", "bad-scope.codex.beelink", baseClaim({
    slug: "bad-scope",
    scope: "not-an-array",
  }));
  fs.utimesSync(parseable, old, old);
  const corrupt = writeClaim(root, "shared/agent-scripts", "crashed.codex.beelink", "{not-json");
  fs.utimesSync(corrupt, old, old);

  // Before the sweep, preflight flags both for this repo.
  const aliases = new Set([normalizeRepositoryIdentity("shared/agent-scripts")]);
  const before = preflightReadClaims(root, aliases, root);
  assert.equal(before.invalid.length, 2);

  const applied = runCli(t, ["sweep", "--root", root, "--stale-after-days", "7", "--apply", "--json"]);
  if (!applied) return;
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).summary.released_invalid, 2);

  // Every tombstone is a fully valid claim that reads as released.
  const entries = readClaims(root);
  assert.equal(entries.length, 2);
  for (const entry of entries) {
    assert.deepEqual(entry.issues, [], entry.file);
    assert.equal(entry.status, "released", entry.file);
  }
  // ...so preflight no longer reports agentcoord_claim_ambiguous input.
  const after = preflightReadClaims(root, aliases, root);
  assert.equal(after.invalid.length, 0);
  assert.equal(after.active.length, 0);

  // Parseable original: fields carried over where sane.
  const carried = entries.find((entry) => entry.file === parseable).data;
  assert.equal(carried.slug, "bad-scope");
  assert.equal(carried.repo, "shared/agent-scripts");
  assert.deepEqual(carried.scope, ["unknown"]);
  assert.equal(carried.original.scope, "not-an-array");

  // Corrupt original: placeholders synthesized, sidecar referenced.
  const synthesized = entries.find((entry) => entry.file === corrupt).data;
  assert.equal(synthesized.repo, "shared/agent-scripts");
  assert.equal(synthesized.safety, "read");
  assert.deepEqual(synthesized.scope, ["unknown"]);
  assert.equal(synthesized.next_action, "released by janitor");
  assert.equal(synthesized.original_file, "crashed.codex.beelink.json.corrupt");
});

test("ambiguous normalized lookup errors and lists every matching file", (t) => {
  const root = makeRoot(t, "ambiguous");
  const canonical = writeClaim(root, "shared/manager", "dup.codex.beelink", baseClaim({
    repo: "shared/manager",
    slug: "dup",
  }));
  const legacy = writeClaim(root, "shared-manager", "dup.codex.beelink", baseClaim({
    repo: "shared-manager",
    slug: "dup",
  }));

  const released = runCli(t, [
    "release", "--root", root,
    "--repo", "manager", "--slug", "dup",
    "--agent", "codex", "--host", "beelink",
  ]);
  if (!released) return;
  assert.equal(released.status, 1);
  assert.match(released.stderr, /ambiguous claim/);
  assert.ok(released.stderr.includes(canonical), released.stderr);
  assert.ok(released.stderr.includes(legacy), released.stderr);
  // Neither claim was silently released.
  assert.equal(JSON.parse(fs.readFileSync(canonical, "utf8")).released_at, undefined);
  assert.equal(JSON.parse(fs.readFileSync(legacy, "utf8")).released_at, undefined);

  // A single match still resolves.
  fs.rmSync(legacy);
  const retried = runCli(t, [
    "release", "--root", root,
    "--repo", "manager", "--slug", "dup",
    "--agent", "codex", "--host", "beelink", "--json",
  ]);
  assert.equal(retried.status, 0, retried.stderr);
  assert.ok(JSON.parse(retried.stdout).claim.released_at);
});

test("archive collision gets a deterministic released_at suffix", (t) => {
  const root = makeRoot(t, "collision");
  const releasedAt = iso(daysAgo(45));
  const claim = writeClaim(root, "shared/agent-scripts", "dup-name", baseClaim({
    released_at: releasedAt,
    released_by: "agentcoord-janitor",
  }));
  // An earlier archive run already used the plain relative name.
  const archiveDir = path.join(root, "claims-archive", "shared", "agent-scripts");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(path.join(archiveDir, "dup-name.json"), "{}\n");

  const applied = runCli(t, ["archive", "--root", root, "--apply", "--json"]);
  if (!applied) return;
  assert.equal(applied.status, 0, applied.stderr);
  const report = JSON.parse(applied.stdout);
  assert.equal(report.summary.archived, 1);
  assert.equal(report.summary.errors, 0);
  const suffixed = path.join(archiveDir, `dup-name.released-${releasedAt.replace(/:/g, "-")}.json`);
  assert.equal(fs.existsSync(suffixed), true);
  assert.equal(fs.existsSync(claim), false);
  // The pre-existing archive entry is untouched.
  assert.equal(fs.readFileSync(path.join(archiveDir, "dup-name.json"), "utf8"), "{}\n");
});

test("invalid claim with unparseable released_at is swept, not leaked", (t) => {
  const root = makeRoot(t, "bad-released");
  const old = daysAgo(10);
  const file = writeClaim(root, "shared/agent-scripts", "bad-released.codex.beelink", baseClaim({
    slug: "bad-released",
    scope: "not-an-array",
    released_at: "not-a-date",
  }));
  fs.utimesSync(file, old, old);

  const applied = runCli(t, ["sweep", "--root", root, "--stale-after-days", "7", "--apply", "--json"]);
  if (!applied) return;
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).summary.released_invalid, 1);

  const entries = readClaims(root);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, "released");
  assert.equal(entries[0].data.release_reason, "invalid-expired");
  assert.equal(entries[0].data.original.released_at, "not-a-date");
});

test("preflight readClaims matches alias-spelled claims to the canonical directory", (t) => {
  const root = makeRoot(t, "preflight-alias");
  // A legacy claim filed under the alias spelling, in the alias directory.
  writeClaim(root, "shared-manager", "legacy.codex.beelink", baseClaim({
    repo: "shared-manager",
    slug: "legacy",
    scope: ["*"],
  }));

  // The write-guard runs for the canonical workspace identity.
  const canonicalAliases = new Set([normalizeRepositoryIdentity("shared/manager")]);
  const found = preflightReadClaims(root, canonicalAliases, "/srv/checkouts/manager");
  assert.equal(found.available, true);
  assert.equal(found.active.length, 1);
  assert.equal(found.active[0].claim.slug, "legacy");
  assert.equal(found.active[0].claim.repo, "shared-manager");

  // The reverse also holds: a workspace known only by an alias spelling
  // still sees a claim filed under the canonical name.
  writeClaim(root, "jk/llm-wiki", "canonical.codex.beelink", baseClaim({
    repo: "jk/llm-wiki",
    slug: "canonical",
    scope: ["*"],
  }));
  const aliasAliases = new Set([normalizeRepositoryIdentity("llm-wiki")]);
  const reverse = preflightReadClaims(root, aliasAliases, "/srv/checkouts/llm-wiki");
  assert.equal(reverse.active.length, 1);
  assert.equal(reverse.active[0].claim.slug, "canonical");

  // Unrelated repos still do not match.
  const unrelated = preflightReadClaims(root, new Set([normalizeRepositoryIdentity("shared/agent-scripts")]), "/srv/checkouts/agent-scripts");
  assert.equal(unrelated.active.length, 0);
});

test("archive moves the corrupt sidecar together with its tombstone", (t) => {
  const root = makeRoot(t, "sidecar");
  const old = daysAgo(10);
  const file = writeClaim(root, "shared/agent-scripts", "crashed.codex.beelink", "{not-json");
  fs.utimesSync(file, old, old);

  const swept = runCli(t, ["sweep", "--root", root, "--stale-after-days", "7", "--apply", "--json"]);
  if (!swept) return;
  assert.equal(swept.status, 0, swept.stderr);
  const sidecar = `${file}.corrupt`;
  assert.equal(fs.existsSync(sidecar), true);

  // Age the tombstone's released_at past the archive threshold.
  const tomb = JSON.parse(fs.readFileSync(file, "utf8"));
  tomb.released_at = iso(daysAgo(45));
  fs.writeFileSync(file, `${JSON.stringify(tomb, null, 2)}\n`);

  const archived = runCli(t, ["archive", "--root", root, "--apply", "--json"]);
  assert.equal(archived.status, 0, archived.stderr);
  const report = JSON.parse(archived.stdout);
  assert.equal(report.summary.archived, 1);
  assert.equal(report.summary.errors, 0);
  const archiveDir = path.join(root, "claims-archive", "shared", "agent-scripts");
  assert.equal(fs.existsSync(path.join(archiveDir, "crashed.codex.beelink.json")), true);
  assert.equal(fs.existsSync(path.join(archiveDir, "crashed.codex.beelink.json.corrupt")), true);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(sidecar), false);
  assert.equal(report.archived[0].sidecar_to, path.join(archiveDir, "crashed.codex.beelink.json.corrupt"));
  // The archived tombstone still references its sidecar by basename.
  const moved = JSON.parse(fs.readFileSync(path.join(archiveDir, "crashed.codex.beelink.json"), "utf8"));
  assert.equal(moved.original_file, "crashed.codex.beelink.json.corrupt");
});
