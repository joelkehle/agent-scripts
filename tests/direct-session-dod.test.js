"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "direct-session-dod.json"), "utf8"));
const impactFields = [
  "schema", "auth", "credential", "deployment", "migration", "new_dependency",
  "reachable_service", "destructive_external_write",
];

function directSessionDecision(fixture) {
  const { task, contract } = fixture;
  const lightweight = task.reversible === true && task.repositories === 1 &&
    impactFields.every((field) => task[field] === false);
  const completeInline = contract &&
    ["outcome", "proof", "pass_condition", "non_goal", "stop_rule", "defer_policy", "ratification_evidence"]
      .every((field) => typeof contract[field] === "string" && contract[field].trim() !== "") &&
    contract.max_review_rounds === 1;
  return lightweight && completeInline ? "proceed" : "draft_and_stop";
}

test("direct-session fixtures enforce the ratified lightweight boundary", () => {
  for (const fixture of fixtures) {
    assert.equal(directSessionDecision(fixture), fixture.expected_action, fixture.name);
  }
});

test("ship, review, and repair skills carry the same direct-session ceiling", () => {
  for (const skill of ["ship-loop", "review-loop", "repair-loop"]) {
    const canonical = path.join(root, "workspace-roots", "projects", ".agents", "skills", skill, "SKILL.md");
    const packaged = path.join(root, "workspace-roots", "projects", "plugins", "joel-agent-ops", "skills", skill, "SKILL.md");
    const text = fs.readFileSync(canonical, "utf8");
    assert.match(text, /docs\/measurable-done\.md/);
    assert.match(text, /within_dod/);
    assert.match(text, /beyond_dod/);
    assert.match(text, /contract_gap/);
    assert.equal(fs.readFileSync(packaged, "utf8"), text, `${skill} packaged copy drifted`);
  }
});
