"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("every test installer invocation isolates Claude agent symlinks", () => {
  const testsRoot = __dirname;
  const invocations = [];
  for (const name of fs.readdirSync(testsRoot).filter((entry) => entry.endsWith(".sh"))) {
    const lines = fs.readFileSync(path.join(testsRoot, name), "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!line.includes("--prefix")) return;
      const invocation = lines.slice(Math.max(0, index - 3), index + 1).join("\n");
      if (!invocation.includes("agent-env-install")) return;
      invocations.push(`${name}:${index + 1}`);
      assert.match(
        invocation,
        /CLAUDE_AGENTS_DIR=/,
        `${name}:${index + 1} can write the real ~/.claude/agents; set CLAUDE_AGENTS_DIR to a test directory`,
      );
    });
  }
  assert.ok(invocations.length >= 3, "expected all known agent-env-install test invocations");
});
