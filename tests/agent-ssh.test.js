"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const agentSshBin = path.join(repoRoot, "bin", "agent-ssh");
const gridPath = path.join(repoRoot, "lib", "ssh-grid.json");

// agent-ssh derives its source host only from hostname(1), so the tests put a
// fake `hostname` executable first on PATH instead of using an env override.
function makeHostnameShim(host) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-ssh-hostname-"));
  fs.writeFileSync(
    path.join(dir, "hostname"),
    `#!/usr/bin/env bash\necho "${host}"\n`,
    { mode: 0o755 }
  );
  return dir;
}

function runAgentSsh(args, host, extraEnv = {}) {
  const shimDir = makeHostnameShim(host);
  try {
    return spawnSync(agentSshBin, args, {
      encoding: "utf8",
      env: { ...process.env, ...extraEnv, PATH: `${shimDir}:${process.env.PATH}` },
    });
  } finally {
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
}

test("ssh-grid.json parses and matches the approved grid shape", () => {
  const grid = JSON.parse(fs.readFileSync(gridPath, "utf8"));
  assert.deepEqual(grid.hosts, ["laptop", "dev", "beelink", "lab", "keystone", "macmini"]);
  for (const host of grid.hosts) {
    assert.ok(Object.prototype.hasOwnProperty.call(grid.grid, host), `grid row missing for ${host}`);
  }

  assert.deepEqual(Object.keys(grid.grid.laptop), ["dev", "beelink", "lab", "macmini"]);
  for (const [target, cell] of Object.entries(grid.grid.laptop)) {
    assert.equal(cell.method, "alias");
    assert.equal(cell.command, `agent-${target}`);
  }

  assert.deepEqual(Object.keys(grid.grid.dev), ["beelink", "lab", "macmini"]);
  for (const [target, cell] of Object.entries(grid.grid.dev)) {
    assert.equal(cell.method, "sudo-agent");
    assert.equal(cell.command, `agent-ssh ${target}`);
  }

  assert.deepEqual(Object.keys(grid.grid.beelink), ["keystone"]);
  assert.equal(grid.grid.beelink.keystone.method, "tunnel-only");
  assert.equal(grid.grid.beelink.keystone.command, null);

  assert.deepEqual(grid.grid.lab, {});
  assert.deepEqual(grid.grid.keystone, {});
  assert.deepEqual(grid.grid.macmini, {});

  assert.equal(grid.rule, "Never use joelkehle keys or accounts for automation.");
  assert.deepEqual(grid.hostAliases, { joelsurface5: "laptop" });
});

test("agent-ssh maps the real laptop hostname JoelSurface5 to the laptop row", () => {
  // Every laptop target is allowed via a shell alias, so agent-ssh should
  // point at the alias (proof the row matched) rather than report a block.
  for (const target of ["dev", "beelink", "lab", "macmini"]) {
    const result = runAgentSsh([target], "JoelSurface5");
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`agent-${target}`));
    assert.doesNotMatch(result.stderr, /blocked by the SSH grid/);
    assert.doesNotMatch(result.stderr, /not in the SSH grid/);
  }
  // Keystone stays blocked from the laptop, under the grid name.
  const keystone = runAgentSsh(["keystone"], "JoelSurface5");
  assert.equal(keystone.status, 1);
  assert.match(keystone.stderr, /blocked by the SSH grid: laptop -> keystone/);
});

test("agent-ssh lowercases and strips the domain before the alias lookup", () => {
  const result = runAgentSsh(["dev"], "JOELSURFACE5.local");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /agent-dev/);
  assert.doesNotMatch(result.stderr, /not in the SSH grid/);
});

test("agent-ssh fails closed on an unknown hostname and points at hostAliases", () => {
  const result = runAgentSsh(["dev"], "mystery-box");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /'mystery-box' is not in the SSH grid/);
  assert.match(result.stderr, /hostAliases/);
});

test("agent-ssh blocks a forbidden cell with exit 1", () => {
  const result = runAgentSsh(["dev"], "lab");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /blocked by the SSH grid: lab -> dev\. See agent-start output\./);
});

test("agent-ssh rejects an unknown target and lists valid ones", () => {
  const result = runAgentSsh(["nonesuch"], "dev");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown target 'nonesuch'/);
  assert.match(result.stderr, /laptop, dev, beelink, lab, keystone, macmini/);
});

test("agent-ssh refuses tunnel-only cells with a plain explanation", () => {
  const result = runAgentSsh(["keystone"], "beelink");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /tunnel-only/);
});

test("agent-ssh points laptop sessions at the shell alias", () => {
  const result = runAgentSsh(["beelink"], "laptop");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /agent-beelink/);
});

test("agent-ssh ignores AGENT_SSH_HOST and trusts only hostname(1)", () => {
  // The real host is lab (blocked from dev); the env tries to claim dev.
  const result = runAgentSsh(["dev"], "lab", { AGENT_SSH_HOST: "dev" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /blocked by the SSH grid: lab -> dev/);
});

test("agent-ssh with no arguments prints usage", () => {
  const result = spawnSync(agentSshBin, [], { encoding: "utf8", env: process.env });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: agent-ssh <target> \[command\.\.\.\]/);
});
