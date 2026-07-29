const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, describe, it } = require("node:test");
const { main: runCliMain } = require("../../bin/ghl-manifest");

const {
  DEFECT_CODES,
  buildJsonSchema,
  buildValidationReceipt,
  canonicalize,
  loadManifest,
  renderIssue,
  renderManifest,
  validateManifest,
  verifyReceipt,
} = require("../../lib/github-lifecycle");

const REPO_ROOT = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "docs", "github-lifecycle", "jk-spec-ghlife-001.v1.json");
const SCHEMA_PATH = path.join(REPO_ROOT, "docs", "schemas", "github-lifecycle-manifest.v1.schema.json");
const SCHEMA_V2_PATH = path.join(REPO_ROOT, "docs", "schemas", "github-lifecycle-manifest.v2.schema.json");
const GOLDEN_PATH = path.join(__dirname, "fixtures", "ghl-003.expected.md");
const CLI = path.join(REPO_ROOT, "bin", "ghl-manifest");
const FIXED_TIMESTAMP = "2026-07-27T00:00:00.000Z";

const tempDirs = [];

function batch() {
  return loadManifest(MANIFEST_PATH);
}

function defectCodes(manifest) {
  return validateManifest(manifest).errors.map((error) => error.code);
}

function issueById(manifest, issueId) {
  return manifest.issues.find((issue) => issue.issue_id === issueId);
}

function minimalManifest() {
  return {
    schema: "github-lifecycle-manifest.v1",
    manifest_version: "1.0.0",
    specification: {
      spec_id: "JK-SPEC-TEST-001",
      source_document: "docs/example.md",
      source_revision: "abc1234",
    },
    requirements: [
      { id: "REQ-01", title: "First requirement" },
      { id: "REQ-02", title: "Second requirement" },
    ],
    issues: [
      {
        issue_id: "TEST-001",
        title: "First slice",
        owner_repository: "joelkehle/agent-scripts",
        write_class: "propose",
        requirements: ["REQ-01"],
        depends_on: [],
        acceptance_criteria: ["Do the first thing."],
        validation_commands: ["npm run agent:check"],
        non_goals: ["No external writes."],
      },
      {
        issue_id: "TEST-002",
        title: "Second slice",
        owner_repository: "joelkehle/agent-scripts",
        write_class: "propose",
        requirements: ["REQ-02"],
        depends_on: ["TEST-001"],
        acceptance_criteria: ["Do the second thing."],
        validation_commands: ["npm run agent:check"],
        non_goals: [],
      },
    ],
  };
}

function structuredManifest() {
  const manifest = minimalManifest();
  manifest.schema = "github-lifecycle-manifest.v2";
  for (const issue of manifest.issues) {
    issue.definition_of_done = {
      class: "full",
      proof_requirements: [
        {
          id: "PROOF-01",
          requirement: `Validate ${issue.issue_id} with the repository gate.`,
          evidence: "An exact-command test result anchored to the candidate commit.",
        },
      ],
      pass_criteria: [
        {
          proof_id: "PROOF-01",
          criterion: "The repository gate exits successfully.",
          expected_result: "Exit status 0 with no reported test failures.",
        },
      ],
      non_goals: [...issue.non_goals],
      budget: { max_review_rounds: 2, max_continuation_attempts: 3 },
      kill_criteria: [
        {
          trigger: "A required change leaves the declared repository scope.",
          action: "Stop implementation and escalate the contract gap.",
          decide_by: "Before making the out-of-scope edit.",
        },
      ],
      defer_policy: {
        destination: "A linked follow-up issue.",
        promotion_rule: "Joel explicitly promotes the follow-up into a new ratified contract.",
      },
      ratification: { actor: "joelkehle", evidence: "github_comment" },
      finding_policy: {
        within_dod: "fix",
        beyond_dod: "defer",
        contract_gap: "escalate",
        at_budget: "accept_or_defer",
      },
    };
  }
  return manifest;
}

function writeTempManifest(manifest) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ghl-manifest-"));
  tempDirs.push(dir);
  const file = path.join(dir, "manifest.json");
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);

  return file;
}

function runCli(args) {
  const originalArgv = process.argv;
  const stdout = [];
  const stderr = [];
  const originalLog = console.log;
  const originalError = console.error;

  try {
    process.argv = [process.execPath, CLI, ...args];
    console.log = (...values) => stdout.push(values.join(" "));
    console.error = (...values) => stderr.push(values.join(" "));
    const status = runCliMain();
    return { status, stdout: `${stdout.join("\n")}\n`, stderr: `${stderr.join("\n")}\n` };
  } catch (error) {
    stderr.push(`ghl-manifest: ${error.message}`);
    return { status: 2, stdout: `${stdout.join("\n")}\n`, stderr: `${stderr.join("\n")}\n` };
  } finally {
    process.argv = originalArgv;
    console.log = originalLog;
    console.error = originalError;
  }
}

after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("ratified GHL-001..GHL-010 batch plus the GHL-013 doctrine amendment", () => {
  it("contains the complete issue batch with its requirement set", () => {
    const manifest = batch();

    assert.deepEqual(
      manifest.issues.map((issue) => issue.issue_id),
      ["GHL-001", "GHL-002", "GHL-003", "GHL-004", "GHL-005", "GHL-006", "GHL-007", "GHL-008", "GHL-009", "GHL-010", "GHL-013"],
    );
    assert.equal(manifest.specification.spec_id, "JK-SPEC-GHLIFE-001");
    assert.equal(manifest.requirements.length, 14);
  });

  it("preserves every field GHL-REQ-01 requires", () => {
    for (const issue of batch().issues) {
      assert.ok(issue.owner_repository, `${issue.issue_id} owner`);
      assert.ok(issue.requirements.length > 0, `${issue.issue_id} requirements`);
      assert.ok(Array.isArray(issue.depends_on), `${issue.issue_id} dependencies`);
      assert.ok(issue.acceptance_criteria.length > 0, `${issue.issue_id} acceptance criteria`);
      assert.ok(issue.validation_commands.length > 0, `${issue.issue_id} validation`);
      assert.ok(Array.isArray(issue.non_goals), `${issue.issue_id} non-goals`);
      assert.ok(["read", "propose", "write"].includes(issue.write_class), `${issue.issue_id} write class`);
    }
  });

  it("validates clean and orders the batch by dependency", () => {
    const validation = validateManifest(batch());

    assert.deepEqual(validation.errors, []);
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.uncovered_requirements, []);
    assert.equal(validation.issue_order.length, 11);
    assert.ok(validation.issue_order.indexOf("GHL-003") < validation.issue_order.indexOf("GHL-004"));
    assert.ok(validation.issue_order.indexOf("GHL-005") < validation.issue_order.indexOf("GHL-006"));
    assert.equal(validation.issue_order.at(-1), "GHL-010");
  });

  it("covers every declared requirement", () => {
    const validation = validateManifest(batch());

    for (const entry of validation.requirement_coverage) {
      assert.ok(entry.issue_ids.length > 0, `${entry.requirement_id} is uncovered`);
    }
  });
});

describe("defect detection", () => {
  it("passes a minimal valid manifest", () => {
    assert.deepEqual(validateManifest(minimalManifest()).errors, []);
  });

  it("detects an unknown requirement reference", () => {
    const manifest = minimalManifest();
    manifest.issues[0].requirements = ["REQ-01", "REQ-99"];

    const errors = validateManifest(manifest).errors;

    assert.ok(errors.some((error) => error.code === DEFECT_CODES.UNKNOWN_REQUIREMENT));
    assert.ok(errors.some((error) => error.message.includes("REQ-99")));
  });

  it("detects a requirement no issue covers", () => {
    const manifest = minimalManifest();
    manifest.issues[1].requirements = ["REQ-01"];

    const validation = validateManifest(manifest);

    assert.deepEqual(validation.uncovered_requirements, ["REQ-02"]);
    assert.ok(validation.errors.some((error) => error.code === DEFECT_CODES.MISSING_COVERAGE));
  });

  it("ignores coverage for an explicitly non-normative requirement", () => {
    const manifest = minimalManifest();
    manifest.requirements[1].normative = false;
    manifest.issues[1].requirements = ["REQ-01"];

    assert.deepEqual(validateManifest(manifest).errors, []);
  });

  it("detects a dependency cycle and refuses to order the batch", () => {
    const manifest = minimalManifest();
    manifest.issues[0].depends_on = ["TEST-002"];

    const validation = validateManifest(manifest);
    const cycle = validation.errors.find((error) => error.code === DEFECT_CODES.DEPENDENCY_CYCLE);

    assert.ok(cycle);
    assert.equal(cycle.message, "dependency cycle: TEST-001 -> TEST-002 -> TEST-001");
    assert.deepEqual(validation.issue_order, []);
  });

  it("detects a cycle in the ratified batch when one is introduced", () => {
    const manifest = batch();
    issueById(manifest, "GHL-003").depends_on = ["GHL-010"];

    assert.ok(defectCodes(manifest).includes(DEFECT_CODES.DEPENDENCY_CYCLE));
  });

  it("reports a cycle once regardless of declaration order", () => {
    const forward = minimalManifest();
    forward.issues[0].depends_on = ["TEST-002"];

    const reversed = minimalManifest();
    reversed.issues[0].depends_on = ["TEST-002"];
    reversed.issues.reverse();

    const cyclesOf = (manifest) =>
      validateManifest(manifest)
        .errors.filter((error) => error.code === DEFECT_CODES.DEPENDENCY_CYCLE)
        .map((error) => error.message);

    assert.equal(cyclesOf(forward).length, 1);
    assert.deepEqual(cyclesOf(forward), cyclesOf(reversed));
  });

  it("detects a self dependency", () => {
    const manifest = minimalManifest();
    manifest.issues[0].depends_on = ["TEST-001"];

    assert.ok(defectCodes(manifest).includes(DEFECT_CODES.SELF_DEPENDENCY));
  });

  it("detects a dependency on an undeclared issue", () => {
    const manifest = minimalManifest();
    manifest.issues[1].depends_on = ["TEST-404"];

    assert.ok(defectCodes(manifest).includes(DEFECT_CODES.UNKNOWN_DEPENDENCY));
  });

  it("detects a duplicate issue id", () => {
    const manifest = minimalManifest();
    manifest.issues.push({ ...minimalManifest().issues[0], requirements: ["REQ-02"] });

    assert.ok(defectCodes(manifest).includes(DEFECT_CODES.DUPLICATE_ISSUE_ID));
  });

  it("detects a duplicate requirement id", () => {
    const manifest = minimalManifest();
    manifest.requirements.push({ id: "REQ-01", title: "First requirement again" });

    assert.ok(defectCodes(manifest).includes(DEFECT_CODES.DUPLICATE_REQUIREMENT_ID));
  });

  it("detects each missing mandatory field", () => {
    const mandatory = [
      "issue_id",
      "title",
      "owner_repository",
      "requirements",
      "depends_on",
      "acceptance_criteria",
      "validation_commands",
      "non_goals",
      "write_class",
    ];

    for (const field of mandatory) {
      const manifest = minimalManifest();
      delete manifest.issues[0][field];

      const errors = validateManifest(manifest).errors;

      assert.ok(
        errors.some((error) => error.code === DEFECT_CODES.MISSING_FIELD && error.path === `issues[0].${field}`),
        `missing ${field} was not reported`,
      );
    }
  });

  it("detects missing mandatory specification fields", () => {
    const manifest = minimalManifest();
    delete manifest.specification.source_revision;

    const errors = validateManifest(manifest).errors;

    assert.ok(
      errors.some(
        (error) => error.code === DEFECT_CODES.MISSING_FIELD && error.path === "specification.source_revision",
      ),
    );
  });

  it("rejects empty acceptance criteria and validation commands", () => {
    const manifest = minimalManifest();
    manifest.issues[0].acceptance_criteria = [];
    manifest.issues[0].validation_commands = [];

    const errors = validateManifest(manifest).errors;
    const paths = errors.filter((error) => error.code === DEFECT_CODES.INVALID_FIELD).map((error) => error.path);

    assert.ok(paths.includes("issues[0].acceptance_criteria"));
    assert.ok(paths.includes("issues[0].validation_commands"));
  });

  it("rejects an unknown write class", () => {
    const manifest = minimalManifest();
    manifest.issues[0].write_class = "destructive";

    assert.ok(defectCodes(manifest).includes(DEFECT_CODES.INVALID_FIELD));
  });

  it("rejects an unknown field", () => {
    const manifest = minimalManifest();
    manifest.issues[0].assignee = "kehle-contributor-agent";

    const errors = validateManifest(manifest).errors;

    assert.ok(
      errors.some((error) => error.code === DEFECT_CODES.UNKNOWN_FIELD && error.path === "issues[0].assignee"),
    );
  });

  it("rejects a manifest written against another schema version", () => {
    const manifest = minimalManifest();
    manifest.schema = "github-lifecycle-manifest.v3";

    assert.ok(defectCodes(manifest).includes(DEFECT_CODES.SCHEMA_MISMATCH));
  });

  it("reports defects deterministically", () => {
    const manifest = minimalManifest();
    manifest.issues[0].requirements = ["REQ-99"];
    delete manifest.issues[1].validation_commands;

    assert.deepEqual(validateManifest(manifest).errors, validateManifest(manifest).errors);
  });
});

describe("structured definition of done v2", () => {
  it("validates a complete machine-gradeable contract", () => {
    const validation = validateManifest(structuredManifest());

    assert.equal(validation.ok, true);
    assert.equal(validation.manifest_schema, "github-lifecycle-manifest.v2");
  });

  it("keeps a valid v1 fixture compatible without a DoD contract", () => {
    const manifest = minimalManifest();

    assert.equal(validateManifest(manifest).ok, true);
    assert.equal(renderManifest(manifest).issues[0].definition_of_done, undefined);
  });

  it("names every missing mandatory DoD field deterministically", () => {
    const mandatory = [
      "class", "proof_requirements", "pass_criteria", "non_goals", "budget",
      "kill_criteria", "defer_policy", "ratification", "finding_policy",
    ];

    for (const field of mandatory) {
      const manifest = structuredManifest();
      delete manifest.issues[0].definition_of_done[field];
      const errors = validateManifest(manifest).errors;

      assert.ok(
        errors.some(
          (error) =>
            error.code === DEFECT_CODES.MISSING_FIELD &&
            error.path === `issues[0].definition_of_done.${field}`,
        ),
        `missing ${field} was not reported`,
      );
    }
  });

  it("rejects vague proof, pass, and kill criteria with a named defect", () => {
    const manifest = structuredManifest();
    manifest.issues[0].definition_of_done.proof_requirements[0].evidence = "TBD";
    manifest.issues[0].definition_of_done.pass_criteria[0].expected_result = "works well";
    manifest.issues[0].definition_of_done.kill_criteria[0].trigger = "as needed";

    const vague = validateManifest(manifest).errors.filter((error) => error.code === DEFECT_CODES.VAGUE_DOD_FIELD);

    assert.deepEqual(
      vague.map((error) => error.path),
      [
        "issues[0].definition_of_done.proof_requirements[0].evidence",
        "issues[0].definition_of_done.pass_criteria[0].expected_result",
        "issues[0].definition_of_done.kill_criteria[0].trigger",
      ],
    );
  });

  it("rejects empty or whitespace-only mandatory DoD statements deterministically", () => {
    const manifest = structuredManifest();
    const statements = [
      ["proof_requirements", 0, "requirement"],
      ["proof_requirements", 0, "evidence"],
      ["pass_criteria", 0, "criterion"],
      ["pass_criteria", 0, "expected_result"],
      ["kill_criteria", 0, "trigger"],
      ["kill_criteria", 0, "action"],
      ["kill_criteria", 0, "decide_by"],
    ];

    statements.forEach(([collection, index, field], statementIndex) => {
      manifest.issues[0].definition_of_done[collection][index][field] = statementIndex % 2 === 0 ? "" : " \t ";
    });

    const validation = validateManifest(manifest);
    const vague = validation.errors.filter((error) => error.code === DEFECT_CODES.VAGUE_DOD_FIELD);

    assert.equal(validation.ok, false);
    assert.deepEqual(
      vague.map((error) => error.path),
      statements.map(
        ([collection, index, field]) => `issues[0].definition_of_done.${collection}[${index}].${field}`,
      ),
    );
  });

  it("rejects malformed budgets with a named defect", () => {
    const cases = [0, -1, 1.5, "two"];

    for (const value of cases) {
      const manifest = structuredManifest();
      manifest.issues[0].definition_of_done.budget.max_review_rounds = value;
      const errors = validateManifest(manifest).errors;

      assert.ok(errors.some((error) => error.code === DEFECT_CODES.MALFORMED_DOD_BUDGET), String(value));
    }
  });

  it("requires DoD non-goals and ratification policy to match the issue contract", () => {
    const manifest = structuredManifest();
    manifest.issues[0].definition_of_done.non_goals = ["A different exclusion."];
    manifest.issues[1].definition_of_done.ratification.actor = "codex";
    const errors = validateManifest(manifest).errors;

    assert.ok(errors.some((error) =>
      error.code === DEFECT_CODES.DOD_NON_GOALS_MISMATCH &&
      error.path === "issues[0].definition_of_done.non_goals"));
    assert.ok(errors.some((error) =>
      error.code === DEFECT_CODES.INVALID_FIELD &&
      error.path === "issues[1].definition_of_done.ratification.actor"));
  });

  it("rejects duplicate proof IDs with a named deterministic defect", () => {
    const manifest = structuredManifest();
    manifest.issues[0].definition_of_done.proof_requirements.push({
      ...manifest.issues[0].definition_of_done.proof_requirements[0],
    });

    assert.deepEqual(
      validateManifest(manifest).errors.filter(
        (error) => error.code === DEFECT_CODES.DUPLICATE_DOD_PROOF_ID,
      ),
      [
        {
          code: DEFECT_CODES.DUPLICATE_DOD_PROOF_ID,
          path: "issues[0].definition_of_done.proof_requirements[1].id",
          message: "duplicates proof requirement PROOF-01",
        },
      ],
    );
  });

  it("projects the identical DoD contract into rendering and receipts", () => {
    const manifest = structuredManifest();
    const rendered = renderManifest(manifest);
    const receipt = buildValidationReceipt({
      manifest,
      validation: validateManifest(manifest),
      actor: "codex-contributor",
      timestamp: FIXED_TIMESTAMP,
    });

    assert.deepEqual(rendered.issues[0].definition_of_done, manifest.issues[0].definition_of_done);
    assert.deepEqual(receipt.subject.definition_of_done[0].contract, manifest.issues[0].definition_of_done);
    assert.deepEqual(renderManifest(manifest), rendered);
    assert.ok(verifyReceipt(receipt));
    assert.match(rendered.issues[0].body, /Claiming requires a GitHub comment by that actor/);
  });

  it("binds the v2 payload hash to the exact rendered title and body", () => {
    const rendered = renderManifest(structuredManifest()).issues[0];
    const [marker, ...bodyParts] = rendered.body.split("\n\n");
    const body = bodyParts.join("\n\n");
    const expected = crypto.createHash("sha256").update(`${rendered.title}\n${body}`).digest("hex");

    assert.match(marker, new RegExp(`payload_sha256=${expected}`));
    assert.equal(rendered.payload_sha256, expected);
  });
});

describe("renderer stability", () => {
  it("renders byte-identical output across runs", () => {
    assert.deepEqual(renderManifest(batch()), renderManifest(batch()));
  });

  it("matches the checked-in golden body for GHL-003", () => {
    const rendered = renderIssue(batch(), "GHL-003");

    assert.equal(`${rendered.title}\n\n${rendered.body}`, fs.readFileSync(GOLDEN_PATH, "utf8"));
  });

  it("is insensitive to manifest key order", () => {
    const manifest = batch();
    const reordered = JSON.parse(JSON.stringify(manifest));
    reordered.issues = reordered.issues.map((issue) => Object.fromEntries(Object.entries(issue).reverse()));

    assert.deepEqual(renderManifest(reordered).issues, renderManifest(manifest).issues);
  });

  it("treats an omitted optional list as an empty list", () => {
    const manifest = minimalManifest();
    const withEmpty = minimalManifest();
    withEmpty.issues[0].external_dependencies = [];
    withEmpty.issues[0].labels = [];

    assert.deepEqual(renderManifest(withEmpty).issues, renderManifest(manifest).issues);
  });

  it("carries no timestamp or nonce into rendered bodies", () => {
    for (const issue of renderManifest(batch()).issues) {
      assert.doesNotMatch(issue.body, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      assert.doesNotMatch(issue.title, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    }
  });

  it("projects spec lineage, owner, dependencies, validation, and write class into every body", () => {
    const manifest = batch();

    for (const rendered of renderManifest(manifest).issues) {
      const issue = issueById(manifest, rendered.issue_id);

      assert.equal(rendered.title, `${issue.issue_id} — ${issue.title}`);
      assert.ok(rendered.body.includes("`JK-SPEC-GHLIFE-001`"));
      assert.ok(rendered.body.includes(`\`${issue.owner_repository}\``));
      assert.ok(rendered.body.includes(`**External-write class:** \`${issue.write_class}\``));

      for (const requirementId of issue.requirements) {
        assert.ok(rendered.body.includes(`\`${requirementId}\``), `${issue.issue_id} lost ${requirementId}`);
      }

      for (const command of issue.validation_commands) {
        assert.ok(rendered.body.includes(command), `${issue.issue_id} lost ${command}`);
      }

      for (const nonGoal of issue.non_goals) {
        assert.ok(rendered.body.includes(nonGoal), `${issue.issue_id} lost a non-goal`);
      }
    }
  });

  it("changes an issue payload hash only when that issue changes", () => {
    const before = renderManifest(batch()).issues;
    const manifest = batch();
    issueById(manifest, "GHL-002").non_goals.push("No new non-goal.");
    const after = renderManifest(manifest).issues;

    const changed = before.filter((issue, index) => issue.payload_sha256 !== after[index].payload_sha256);

    assert.deepEqual(changed.map((issue) => issue.issue_id), ["GHL-002"]);
  });

  it("refuses to render an unknown issue", () => {
    assert.throws(() => renderIssue(batch(), "GHL-404"), /unknown issue: GHL-404/);
  });

  it("refuses to render an invalid manifest", () => {
    const manifest = batch();
    issueById(manifest, "GHL-004").depends_on = ["GHL-404"];

    assert.throws(() => renderManifest(manifest), /refusing to render an invalid manifest: 1 defect/);
  });
});

describe("validation receipt", () => {
  it("records who validated, the input hash, and the outcome", () => {
    const manifest = batch();
    const receipt = buildValidationReceipt({
      manifest,
      validation: validateManifest(manifest),
      actor: "codex-contributor",
      timestamp: FIXED_TIMESTAMP,
      source: "docs/github-lifecycle/jk-spec-ghlife-001.v1.json",
    });

    assert.equal(receipt.schema, "github-lifecycle-validation-receipt.v1");
    assert.equal(receipt.validated_at, FIXED_TIMESTAMP);
    assert.equal(receipt.validator.actor, "codex-contributor");
    assert.equal(receipt.validator.write_class, "read");
    assert.equal(receipt.subject.spec_id, "JK-SPEC-GHLIFE-001");
    assert.equal(receipt.subject.issue_count, 11);
    assert.match(receipt.input.content_sha256, /^[0-9a-f]{64}$/);
    assert.equal(receipt.outcome.ok, true);
    assert.deepEqual(receipt.outcome.defect_codes, []);
    assert.ok(verifyReceipt(receipt));
  });

  it("hashes the manifest content, not its key order or formatting", () => {
    const manifest = batch();
    const reordered = { issues: manifest.issues, requirements: manifest.requirements, ...manifest };

    const hashOf = (input) =>
      buildValidationReceipt({
        manifest: input,
        validation: validateManifest(input),
        actor: "codex-contributor",
        timestamp: FIXED_TIMESTAMP,
      }).input.content_sha256;

    assert.equal(hashOf(reordered), hashOf(manifest));
    assert.equal(canonicalize(reordered), canonicalize(manifest));
  });

  it("changes the content hash when the manifest changes", () => {
    const manifest = batch();
    const mutated = batch();
    issueById(mutated, "GHL-001").acceptance_criteria.push("One more criterion.");

    const hashOf = (input) =>
      buildValidationReceipt({
        manifest: input,
        validation: validateManifest(input),
        actor: "codex-contributor",
        timestamp: FIXED_TIMESTAMP,
      }).input.content_sha256;

    assert.notEqual(hashOf(mutated), hashOf(manifest));
  });

  it("is reproducible for the same inputs and detects tampering", () => {
    const manifest = batch();
    const build = () =>
      buildValidationReceipt({
        manifest,
        validation: validateManifest(manifest),
        actor: "codex-contributor",
        timestamp: FIXED_TIMESTAMP,
      });

    assert.deepEqual(build(), build());
    assert.equal(verifyReceipt({ ...build(), outcome: { ...build().outcome, ok: false } }), false);
  });

  it("records the failing defect classes", () => {
    const manifest = minimalManifest();
    manifest.issues[0].requirements = ["REQ-99"];

    const receipt = buildValidationReceipt({
      manifest,
      validation: validateManifest(manifest),
      actor: "codex-contributor",
      timestamp: FIXED_TIMESTAMP,
    });

    assert.equal(receipt.outcome.ok, false);
    assert.deepEqual(receipt.outcome.defect_codes, [DEFECT_CODES.MISSING_COVERAGE, DEFECT_CODES.UNKNOWN_REQUIREMENT]);
    assert.deepEqual(receipt.outcome.uncovered_requirements, ["REQ-01"]);
  });

  it("requires an injected actor and timestamp", () => {
    const manifest = minimalManifest();
    const validation = validateManifest(manifest);

    assert.throws(() => buildValidationReceipt({ manifest, validation, timestamp: FIXED_TIMESTAMP }), /actor is required/);
    assert.throws(() => buildValidationReceipt({ manifest, validation, actor: "codex" }), /timestamp is required/);
  });
});

describe("published schema", () => {
  it("matches the generated schema", () => {
    assert.deepEqual(JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8")), buildJsonSchema());
  });

  it("matches the generated v2 schema", () => {
    assert.deepEqual(
      JSON.parse(fs.readFileSync(SCHEMA_V2_PATH, "utf8")),
      buildJsonSchema("github-lifecycle-manifest.v2"),
    );
  });
});

describe("ghl-manifest CLI", () => {
  it("validates the ratified batch and exits zero", () => {
    const result = runCli(["validate"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /ghl-manifest: ok/);
  });

  it("exits one on a defective manifest", () => {
    const manifest = minimalManifest();
    manifest.issues[0].requirements = ["REQ-99"];

    const result = runCli(["validate", writeTempManifest(manifest)]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /unknown_requirement/);
  });

  it("renders without contacting GitHub and refuses an invalid manifest", () => {
    const rendered = runCli(["render", "--issue", "GHL-003"]);
    assert.equal(rendered.status, 0);
    assert.match(rendered.stdout, /GHL-003 — Add a versioned specification-to-issue manifest and validator/);

    const manifest = minimalManifest();
    delete manifest.issues[0].write_class;
    const refused = runCli(["render", writeTempManifest(manifest)]);

    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /refusing to render an invalid manifest/);
  });

  it("emits a receipt with an injected timestamp", () => {
    const result = runCli(["receipt", "--actor", "codex-contributor", "--at", FIXED_TIMESTAMP]);
    const receipt = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(receipt.validated_at, FIXED_TIMESTAMP);
    assert.equal(receipt.validator.actor, "codex-contributor");
    assert.ok(verifyReceipt(receipt));
  });

  it("exits two on an unreadable manifest", () => {
    const result = runCli(["validate", path.join(os.tmpdir(), "ghl-manifest-does-not-exist.json")]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /cannot read manifest/);
  });

  it("prints the versioned v2 schema", () => {
    const result = runCli(["schema", "--schema-version", "v2"]);

    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).properties.schema.const, "github-lifecycle-manifest.v2");
  });
});
