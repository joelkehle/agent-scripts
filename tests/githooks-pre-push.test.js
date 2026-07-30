"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { execFileSync, spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const hooksDir = path.join(repoRoot, "githooks");

function git(cwd, args, opts = {}) {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...opts,
  });
}

function gitPush(cwd, args, env = {}) {
  return spawnSync("git", ["push", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function makeRepoPair(tmpRoot) {
  const remote = path.join(tmpRoot, "remote.git");
  const work = path.join(tmpRoot, "work");
  git(tmpRoot, ["init", "-q", "-b", "main", "--bare", remote]);
  git(tmpRoot, ["clone", "-q", remote, work]);
  git(work, ["config", "user.name", "Pre-Push Test"]);
  git(work, ["config", "user.email", "pre-push-test@example.com"]);
  git(work, ["config", "commit.gpgsign", "false"]);
  git(work, ["config", "core.hooksPath", hooksDir]);
  fs.writeFileSync(path.join(work, "f.txt"), "init\n");
  git(work, ["add", "f.txt"]);
  git(work, ["commit", "-q", "-m", "init"]);
  git(work, ["push", "-q", "origin", "main"]);
  return { remote, work };
}

function commit(work, message) {
  fs.appendFileSync(path.join(work, "f.txt"), `${message}\n`);
  git(work, ["commit", "-q", "-am", message]);
}

function withTmpRepo(fn) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pre-push-guard-"));
  try {
    fn(makeRepoPair(tmpRoot), tmpRoot);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

test("a: push of the checked-out branch is allowed", () => {
  withTmpRepo(({ work }) => {
    commit(work, "second");
    const res = gitPush(work, ["origin", "main"]);
    assert.equal(res.status, 0, res.stderr);
  });
});

test("b: pushing main while HEAD is on a diverged branch is blocked", () => {
  withTmpRepo(({ work }) => {
    git(work, ["checkout", "-q", "-b", "feature"]);
    commit(work, "feature-commit");
    git(work, ["checkout", "-q", "main"]);
    commit(work, "main-diverge");
    git(work, ["checkout", "-q", "feature"]);

    const res = gitPush(work, ["origin", "main"]);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /REFUSED refs\/heads\/main/);
  });
});

test("c: GIT_PUSH_ALLOW_NONHEAD=1 overrides the block", () => {
  withTmpRepo(({ work }) => {
    git(work, ["checkout", "-q", "-b", "feature"]);
    commit(work, "feature-commit");
    git(work, ["checkout", "-q", "main"]);
    commit(work, "main-diverge");
    git(work, ["checkout", "-q", "feature"]);

    const res = gitPush(work, ["origin", "main"], { GIT_PUSH_ALLOW_NONHEAD: "1" });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stderr, /GIT_PUSH_ALLOW_NONHEAD=1 set/);
  });
});

test("d: pushing HEAD:main from a branch at the same oid as HEAD is allowed", () => {
  withTmpRepo(({ work }) => {
    git(work, ["checkout", "-q", "-b", "topic"]);
    commit(work, "topic-commit");
    const res = gitPush(work, ["origin", "HEAD:main"]);
    assert.equal(res.status, 0, res.stderr);
  });
});

test("e: branch deletion push is allowed", () => {
  withTmpRepo(({ work }) => {
    git(work, ["checkout", "-q", "-b", "dead-branch"]);
    commit(work, "dead-commit");
    git(work, ["push", "-q", "origin", "dead-branch"]);
    git(work, ["checkout", "-q", "main"]);

    const res = gitPush(work, ["origin", ":dead-branch"]);
    assert.equal(res.status, 0, res.stderr);
  });
});

test("f: tag push is allowed", () => {
  withTmpRepo(({ work }) => {
    git(work, ["tag", "v1"]);
    const res = gitPush(work, ["origin", "v1"]);
    assert.equal(res.status, 0, res.stderr);
  });
});

test("g: chained repo-local pre-push hook runs and its exit code propagates", () => {
  withTmpRepo(({ work }) => {
    const localHooksDir = path.join(work, ".git", "hooks");
    const localHook = path.join(localHooksDir, "pre-push");
    const marker = path.join(work, "marker.txt");

    fs.writeFileSync(
      localHook,
      `#!/usr/bin/env bash\ncat >/dev/null\ntouch "${marker}"\nexit 0\n`,
    );
    fs.chmodSync(localHook, 0o755);

    commit(work, "chain-allow");
    let res = gitPush(work, ["origin", "main"]);
    assert.equal(res.status, 0, res.stderr);
    assert.ok(fs.existsSync(marker), "chained hook marker was not created on allowed push");

    fs.rmSync(marker);
    fs.writeFileSync(localHook, `#!/usr/bin/env bash\ncat >/dev/null\nexit 1\n`);
    fs.chmodSync(localHook, 0o755);

    commit(work, "chain-block");
    res = gitPush(work, ["origin", "main"]);
    assert.notEqual(res.status, 0);
    assert.ok(!fs.existsSync(marker), "marker should not exist when chained hook blocks");
  });
});
