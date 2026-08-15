"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const agentSshBin = path.join(repoRoot, "bin", "agent-ssh");
const gridPath = path.join(repoRoot, "lib", "ssh-grid.json");

function runAgentSsh(args, host) {
  return spawnSync(agentSshBin, args, {
    encoding: "utf8",
    env: { ...process.env, AGENT_SSH_HOST: host },
  });
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

test("agent-ssh with no arguments prints usage", () => {
  const result = spawnSync(agentSshBin, [], { encoding: "utf8", env: process.env });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: agent-ssh <target> \[command\.\.\.\]/);
});
