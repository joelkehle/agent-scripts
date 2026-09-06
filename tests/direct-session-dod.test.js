"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
test("shared instructions use direct scope and native controls, without local ratification gates", () => {
  const globalAgents = fs.readFileSync(path.join(root, "AGENTS.MD"), "utf8");
  const loopModel = fs.readFileSync(path.join(root, "docs", "loop-operating-model.md"), "utf8");
  const instructionArchitecture = fs.readFileSync(
    path.join(root, "docs", "instruction-architecture.md"),
    "utf8",
  );
  const decision = fs.readFileSync(
    path.join(root, "docs", "interactive-permissions-2026-09-06.md"),
    "utf8",
  );

  assert.match(globalAgents, /Joel's stated scope and the native vendor permission prompts/);
  assert.match(loopModel, /Do not add a local ratification or fixed\s+definition-of-done gate/);
  assert.match(decision, /Native vendor permission prompts and real OS,\s+API, service, and product controls remain in force/);
  assert.match(instructionArchitecture, /agent-env-install` materializes\s+regular workspace copies/);
  assert.doesNotMatch(instructionArchitecture, /installed links live under/);

  for (const skill of ["ship-loop", "review-loop", "repair-loop"]) {
    const canonical = path.join(
      root,
      "workspace-roots",
      "projects",
      ".agents",
      "skills",
      skill,
      "SKILL.md",
    );
    const packaged = path.join(
      root,
      "workspace-roots",
      "projects",
      "plugins",
      "joel-agent-ops",
      "skills",
      skill,
      "SKILL.md",
    );
    const text = fs.readFileSync(canonical, "utf8");
    assert.match(text, /Do not require a local ratification/);
    assert.doesNotMatch(text, /ratified definition of done/);
    assert.doesNotMatch(text, /one-round review cap/);
    assert.doesNotMatch(text, /production config, schema migration, deployment/);
    assert.equal(fs.readFileSync(packaged, "utf8"), text, `${skill} packaged copy drifted`);
  }

  const hygieneCanonical = path.join(
    root,
    "workspace-roots",
    "projects",
    ".agents",
    "skills",
    "hygiene-loop",
    "SKILL.md",
  );
  const hygienePackaged = path.join(
    root,
    "workspace-roots",
    "projects",
    "plugins",
    "joel-agent-ops",
    "skills",
    "hygiene-loop",
    "SKILL.md",
  );
  const hygiene = fs.readFileSync(hygieneCanonical, "utf8");
  assert.match(hygiene, /outside the user's authorized scope/);
  assert.doesNotMatch(hygiene, /deleting tracked files, changing branches, force-pushing, deploying/);
  assert.equal(fs.readFileSync(hygienePackaged, "utf8"), hygiene, "hygiene-loop packaged copy drifted");
});
