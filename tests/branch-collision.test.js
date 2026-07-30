"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const probeBin = path.join(repoRoot, "bin", "branch-collision");

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function commit(repo, files, message) {
  for (const [name, body] of Object.entries(files)) {
    const target = path.join(repo, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (body === null) fs.rmSync(target, { force: true });
    else fs.writeFileSync(target, body);
  }
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", message]);
}

function initRepo(tmpRoot) {
  const repo = path.join(tmpRoot, "repo");
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.name", "Collision Test"]);
  git(repo, ["config", "user.email", "collision-test@example.com"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  return repo;
}

function probe(repo, branch, base) {
  const out = execFileSync(
    process.execPath,
    [probeBin, branch, "--base", base, "--repo", repo, "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(out);
}

function withTmp(fn) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "branch-collision-"));
  try {
    return fn(tmpRoot);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

test("clean branch reports no collisions", () => {
  withTmp((tmpRoot) => {
    const repo = initRepo(tmpRoot);
    commit(repo, { "a.go": "package a\n\nfunc A() {}\n" }, "init");
    git(repo, ["checkout", "-q", "-b", "feature"]);
    commit(repo, { "b.go": "package a\n\nfunc B() {}\n" }, "add b");
    git(repo, ["checkout", "-q", "main"]);
    commit(repo, { "c.go": "package a\n\nfunc C() {}\n" }, "add c");

    const r = probe(repo, "feature", "main");
    assert.equal(r.deleted.length, 0);
    assert.equal(r.renamed.length, 0);
    assert.equal(r.symbolDivergence.length, 0);
    assert.equal(r.mergeClean, true);
    assert.match(r.verdict, /^CLEAN/);
  });
});

test("detects commits already landed on base under a different hash", () => {
  withTmp((tmpRoot) => {
    const repo = initRepo(tmpRoot);
    commit(repo, { "a.txt": "one\n" }, "init");
    git(repo, ["checkout", "-q", "-b", "feature"]);
    commit(repo, { "shared.txt": "shared change\n" }, "shared change");
    const sha = git(repo, ["rev-parse", "HEAD"]).trim();
    git(repo, ["checkout", "-q", "main"]);
    // Base must advance first, otherwise cherry-picking onto the commit's own
    // parent reproduces a byte-identical commit and the branches converge.
    commit(repo, { "unrelated.txt": "base moved on\n" }, "advance base");
    // Same content now lands on base as a genuinely different commit.
    git(repo, ["cherry-pick", sha]);

    const r = probe(repo, "feature", "main");
    assert.equal(r.alreadyLanded.length, 1);
    assert.equal(r.uniqueCommits.length, 0);
    assert.match(r.verdict, /^REDUNDANT/);
  });
});

test("detects delete/modify when base removes a file the branch edits", () => {
  withTmp((tmpRoot) => {
    const repo = initRepo(tmpRoot);
    commit(repo, { "legacy.go": "package a\n\nfunc Legacy() {}\n" }, "init");
    git(repo, ["checkout", "-q", "-b", "feature"]);
    commit(repo, { "legacy.go": "package a\n\nfunc Legacy() { /* extended */ }\n" }, "extend legacy");
    git(repo, ["checkout", "-q", "main"]);
    commit(repo, { "legacy.go": null }, "remove legacy paths");

    const r = probe(repo, "feature", "main");
    assert.deepEqual(r.deleted, ["legacy.go"]);
    assert.match(r.verdict, /^STRUCTURAL COLLISION/);
  });
});

test("detects a base-side rename of a file the branch edits", () => {
  withTmp((tmpRoot) => {
    const repo = initRepo(tmpRoot);
    const body = `package a\n\n${"// filler\n".repeat(40)}func Thing() {}\n`;
    commit(repo, { "old/thing.go": body }, "init");
    git(repo, ["checkout", "-q", "-b", "feature"]);
    commit(repo, { "old/thing.go": `${body}\n// branch edit\n` }, "edit thing");
    git(repo, ["checkout", "-q", "main"]);
    commit(repo, { "old/thing.go": null, "new/thing.go": body }, "rename package");

    const r = probe(repo, "feature", "main");
    assert.equal(r.renamed.length, 1);
    assert.equal(r.renamed[0].from, "old/thing.go");
    assert.equal(r.renamed[0].to, "new/thing.go");
    assert.match(r.verdict, /^STRUCTURAL COLLISION/);
  });
});

test("detects parallel introduction of different names for the same ground", () => {
  // The case a merge-base comparison cannot see: at the merge-base neither name
  // existed, so nothing was dropped -- both sides simply invented their own.
  withTmp((tmpRoot) => {
    const repo = initRepo(tmpRoot);
    commit(repo, { "svc.go": "package a\n\ntype Service struct{}\n" }, "init");
    git(repo, ["checkout", "-q", "-b", "feature"]);
    commit(
      repo,
      { "svc.go": "package a\n\ntype Service struct{}\n\ntype storeAPI interface{}\n" },
      "add storeAPI",
    );
    git(repo, ["checkout", "-q", "main"]);
    commit(
      repo,
      { "svc.go": "package a\n\ntype Service struct{}\n\ntype bridgeStore interface{}\n" },
      "add bridgeStore",
    );

    const r = probe(repo, "feature", "main");
    assert.equal(r.mergeClean, false, "the file should conflict textually");
    const hit = r.symbolDivergence.find((s) => s.file === "svc.go");
    assert.ok(hit, "svc.go should be flagged");
    assert.equal(hit.kind, "parallel");
    assert.deepEqual(hit.addedByBranch, ["storeAPI"]);
    assert.deepEqual(hit.addedByBase, ["bridgeStore"]);
    assert.match(r.verdict, /^DIVERGENT REFACTOR/);
  });
});

test("reports nothing to land when the branch is fully contained in base", () => {
  withTmp((tmpRoot) => {
    const repo = initRepo(tmpRoot);
    commit(repo, { "a.txt": "one\n" }, "init");
    git(repo, ["checkout", "-q", "-b", "feature"]);
    git(repo, ["checkout", "-q", "main"]);
    commit(repo, { "a.txt": "two\n" }, "advance base");

    const r = probe(repo, "feature", "main");
    assert.equal(r.ahead, 0);
    assert.match(r.verdict, /^NOTHING TO LAND/);
  });
});

test("exits non-zero with a clear message for an unknown ref", () => {
  withTmp((tmpRoot) => {
    const repo = initRepo(tmpRoot);
    commit(repo, { "a.txt": "one\n" }, "init");
    let failed = false;
    try {
      execFileSync(process.execPath, [probeBin, "no-such-branch", "--base", "main", "--repo", repo], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      failed = true;
      assert.match(String(error.stderr), /branch not found/);
    }
    assert.ok(failed, "should exit non-zero for an unknown branch");
  });
});
