const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { after, describe, it } = require("node:test");

const {
  ADJUDICATION_DEFECT_CODES,
  ADJUDICATION_WARNING_CODES,
  buildAdjudicationReceipt,
  correlateAdjudications,
  deriveRulingId,
  loadEvidenceBundle,
  parseMarkedComment,
  readEvidence,
  renderGraduation,
  verifyReceipt,
} = require("../../lib/github-lifecycle");

const REPO_ROOT = path.join(__dirname, "..", "..");
const FIXTURES = path.join(__dirname, "fixtures", "adjudication");
const GOLDEN_PATH = path.join(FIXTURES, "jk-ruling-20260727-44.expected.md");
const CLI = path.join(REPO_ROOT, "bin", "ghl-adjudication");
const FIXED_TIMESTAMP = "2026-07-27T00:00:00.000Z";

const tempDirs = [];

function fixturePath(name) {
  return path.join(FIXTURES, `${name}.evidence.json`);
}

function bundleFor(name) {
  return loadEvidenceBundle(fixturePath(name));
}

function reportFor(name) {
  const source = fixturePath(name);

  return correlateAdjudications(readEvidence(loadEvidenceBundle(source), source));
}

function onlyRecord(name) {
  const report = reportFor(name);

  assert.equal(report.records.length, 1, `${name} should hold one decision record`);

  return report.records[0];
}

function warningCodes(record) {
  return record.warnings.map((warning) => warning.code);
}

function writeTempBundle(bundle) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ghl-adjudication-"));
  const file = path.join(dir, "evidence.json");

  tempDirs.push(dir);
  fs.writeFileSync(file, `${JSON.stringify(bundle, null, 2)}\n`);

  return file;
}

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, stdout };
  } catch (error) {
    return { status: error.status, stdout: error.stdout || "", stderr: error.stderr || "" };
  }
}

after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("evidence bundle reading", () => {
  it("accepts every recorded fixture without defects", () => {
    for (const name of ["merge-adjudication", "request-changes", "superseded-head", "doctrine-graduation", "no-decision"]) {
      const report = reportFor(name);

      assert.deepEqual(report.errors, [], `${name} defects`);
      assert.equal(report.ok, true, `${name} ok`);
      assert.equal(report.no_github_write, true);
    }
  });

  it("classifies each marked comment by the schema its marker declares", () => {
    const source = fixturePath("doctrine-graduation");
    const evidence = readEvidence(loadEvidenceBundle(source), source);
    const pullRequest = evidence.pull_requests[0];

    assert.equal(pullRequest.packets.length, 1);
    assert.equal(pullRequest.attention_items.length, 1);
    assert.equal(pullRequest.observations.length, 1);
    assert.equal(pullRequest.rulings.length, 1);
    assert.equal(pullRequest.claims.length, 1);
  });

  it("rejects a marker whose key disagrees with its payload", () => {
    const bundle = bundleFor("merge-adjudication");
    const comments = bundle.pull_requests[0].comments;

    comments[1].body = comments[1].body.replace(/head_sha=[0-9a-f]+/, "head_sha=deadbeefdeadbeef");

    const source = writeTempBundle(bundle);
    const report = correlateAdjudications(readEvidence(loadEvidenceBundle(source), source));

    assert.equal(report.ok, false);
    assert.ok(report.errors.some((error) => error.code === ADJUDICATION_DEFECT_CODES.MALFORMED_MARKER));
  });

  it("treats owner prose as prose, not as lifecycle state", () => {
    const source = fixturePath("no-decision");
    const evidence = readEvidence(loadEvidenceBundle(source), source);

    assert.equal(evidence.pull_requests[0].unmarked_comments, 1);
    assert.equal(parseMarkedComment("Leaning merge, will read tonight.", "owner-attention.v1"), null);
  });

  it("reports a schema mismatch, an unknown field, and a duplicated decision", () => {
    const bundle = bundleFor("merge-adjudication");

    bundle.schema = "github-lifecycle-adjudication-evidence.v2";
    bundle.surprise = true;
    bundle.pull_requests[0].decisions.push({ ...bundle.pull_requests[0].decisions[0] });

    const source = writeTempBundle(bundle);
    const report = correlateAdjudications(readEvidence(loadEvidenceBundle(source), source));
    const codes = report.errors.map((error) => error.code);

    assert.ok(codes.includes(ADJUDICATION_DEFECT_CODES.SCHEMA_MISMATCH));
    assert.ok(codes.includes(ADJUDICATION_DEFECT_CODES.UNKNOWN_FIELD));
    assert.ok(codes.includes(ADJUDICATION_DEFECT_CODES.DUPLICATE_DECISION));
  });
});

describe("merge adjudication", () => {
  it("correlates decision, packet, attention item, and issue lineage", () => {
    const record = onlyRecord("merge-adjudication");

    assert.equal(record.status, "adjudicated");
    assert.equal(record.decision.action, "merge");
    assert.equal(record.decision.decided_by, "joelkehle");
    assert.equal(record.head.matches_current, true);
    assert.equal(record.packet.recommended_disposition, "merge");
    assert.equal(record.packet.reviewer_independent, true);
    assert.equal(record.attention.state, "open");
    assert.equal(record.lineage.issue_id, "GHL-004");
    assert.equal(record.claim_events, 1);
  });

  it("states the attention resolution without performing it", () => {
    const record = onlyRecord("merge-adjudication");
    const resolution = record.attention_resolution;

    assert.equal(resolution.proposed_state, "disposed");
    assert.equal(resolution.observed_action, "approve");
    assert.equal(resolution.decision, "acknowledged");
    assert.equal(resolution.write_needed, true);
    assert.equal(resolution.performed, false);
    assert.equal(resolution.performed_by, null);
    assert.match(resolution.adapter, /guarded owner-attention adapter/);
    assert.equal(record.no_github_write, true);
  });

  it("scores the reviewer recommendation against the decision", () => {
    const record = onlyRecord("merge-adjudication");

    assert.equal(record.calibration.recommendation_followed, true);
    assert.equal(record.calibration.stated_confidence, 0.78);
    assert.equal(record.calibration.reviewer_identity, "kehle-reviewer-agent");
  });

  it("proposes no graduation when the decision changes no doctrine", () => {
    const report = reportFor("merge-adjudication");

    assert.deepEqual(report.rulings, []);
    assert.deepEqual(renderGraduation(report).proposals, []);
  });
});

describe("request-changes adjudication", () => {
  it("separates a reviewer guardrail from Joel's adjudication", () => {
    const report = reportFor("request-changes");
    const [guardrail, adjudication] = report.records;

    assert.equal(guardrail.status, "not_adjudication");
    assert.equal(guardrail.classification, "non_owner_action");
    assert.equal(guardrail.attention_resolution, null);
    assert.ok(warningCodes(guardrail).includes(ADJUDICATION_WARNING_CODES.NON_OWNER_DECISION));

    assert.equal(adjudication.status, "adjudicated");
    assert.equal(adjudication.decision.action, "request_changes");
    assert.equal(adjudication.attention_resolution.observed_action, "dismiss");
    assert.equal(adjudication.attention_resolution.decision, "dismissed");
    assert.equal(adjudication.attention_resolution.github_disposition, "changes_requested");
  });

  it("leaves nothing awaiting adjudication once Joel has decided the head", () => {
    assert.deepEqual(reportFor("request-changes").awaiting_adjudication, []);
  });
});

describe("superseded head", () => {
  it("records the stale decision without resolving attention", () => {
    const record = onlyRecord("superseded-head");

    assert.equal(record.status, "superseded_by_head");
    assert.equal(record.head.matches_current, false);
    assert.equal(record.attention_resolution, null);
    assert.match(record.attention_resolution_blocked, /is not the current head/);
  });

  it("suppresses graduation from a decision the head moved past", () => {
    const report = reportFor("superseded-head");

    assert.deepEqual(report.rulings, []);
    assert.deepEqual(renderGraduation(report).proposals, []);
    assert.ok(warningCodes(report.records[0]).includes(ADJUDICATION_WARNING_CODES.GRADUATION_SUPPRESSED));
  });

  it("returns the current head to the awaiting queue", () => {
    const [awaiting] = reportFor("superseded-head").awaiting_adjudication;

    assert.equal(awaiting.pull_number, 43);
    assert.match(awaiting.reason, /earlier head/);
  });
});

describe("no decision", () => {
  it("never reads silence as a decision", () => {
    const report = reportFor("no-decision");

    assert.deepEqual(report.records, []);
    assert.equal(report.counts.adjudicated, 0);
    assert.match(report.awaiting_adjudication[0].reason, /silence is not a decision/);
  });
});

describe("doctrine graduation", () => {
  it("derives both rulings and their owning documents", () => {
    const report = reportFor("doctrine-graduation");

    assert.deepEqual(
      report.rulings.map((ruling) => [ruling.source, ruling.owning_document]),
      [
        ["packet_unresolved_judgment", "docs/contribution-review-architecture.md"],
        ["owner_ruling_comment", "docs/maintainer-charter.md"],
      ],
    );

    for (const ruling of report.rulings) {
      assert.match(ruling.ruling_id, /^JK-RULING-20260727-\d{2}$/);
      assert.equal(ruling.head_sha, report.records[0].decision.head_sha);
    }
  });

  it("renders a marked issue body the manifest tooling convention can upsert", () => {
    const graduation = renderGraduation(reportFor("doctrine-graduation"));
    const proposal = graduation.proposals.find((entry) => entry.ruling_id === "JK-RULING-20260727-44");

    assert.equal(graduation.issue_marker, "github-lifecycle-issue-proposal.v1");
    assert.match(
      proposal.body,
      /^<!-- github-lifecycle-issue-proposal\.v1 source=github-lifecycle-adjudication-evidence\.v1 ruling=JK-RULING-20260727-44 /,
    );
    assert.match(proposal.body, new RegExp(`payload_sha256=${proposal.payload_sha256} -->`));
    assert.equal(proposal.write_class, "propose");
    assert.equal(`${proposal.title}\n\n${proposal.body}`, fs.readFileSync(GOLDEN_PATH, "utf8"));
  });

  it("names the change control the owning document imposes", () => {
    const proposals = renderGraduation(reportFor("doctrine-graduation")).proposals;
    const charter = proposals.find((entry) => entry.owning_document === "docs/maintainer-charter.md");
    const architecture = proposals.find(
      (entry) => entry.owning_document === "docs/contribution-review-architecture.md",
    );

    assert.match(charter.body, /changelog entry and merge to `main`/);
    assert.match(architecture.body, /Elephant Check/);
    assert.match(architecture.body, /No doctrine edit by the observer/);
  });

  it("marks an attention resolution that the coordinator already observed", () => {
    const record = onlyRecord("doctrine-graduation");

    assert.equal(record.attention_resolution.already_observed, true);
    assert.equal(record.attention_resolution.write_needed, false);
  });

  it("rejects a ruling that claims a document outside the canonical four", () => {
    const bundle = bundleFor("doctrine-graduation");
    const comments = bundle.pull_requests[0].comments;

    comments[2].body = comments[2].body.replace('"maintainer-charter.md"', '"docs/README.md"');

    const source = writeTempBundle(bundle);
    const report = correlateAdjudications(readEvidence(loadEvidenceBundle(source), source));

    assert.equal(report.ok, false);
    assert.ok(report.errors.some((error) => error.code === ADJUDICATION_DEFECT_CODES.UNKNOWN_OWNING_DOCUMENT));
  });

  it("ignores a ruling marker somebody other than the owner posted", () => {
    const bundle = bundleFor("doctrine-graduation");

    bundle.pull_requests[0].comments[2].author = "kehle-contributor-agent";

    const source = writeTempBundle(bundle);
    const report = correlateAdjudications(readEvidence(loadEvidenceBundle(source), source));

    assert.equal(report.rulings.length, 1);
    assert.ok(warningCodes(report.records[0]).includes(ADJUDICATION_WARNING_CODES.NON_OWNER_RULING));
  });
});

describe("ruling identity", () => {
  it("derives the date from the decision and the sequence from decision identity", () => {
    const identity = {
      repository: "joelkehle/agent-scripts",
      pull_number: 44,
      head_sha: "F0D638A477BCEA0FB9BAB51C96C8C3725E0798F4",
      owning_document: "docs/maintainer-charter.md",
      ruling_slug: "observer-states-attention-resolution",
      decided_at: "2026-07-27T09:18:44.000Z",
    };

    assert.deepEqual(deriveRulingId(identity), deriveRulingId({ ...identity, head_sha: identity.head_sha.toLowerCase() }));
    assert.equal(deriveRulingId(identity).ruling_id, "JK-RULING-20260727-44");
    assert.notEqual(
      deriveRulingId(identity).ruling_key,
      deriveRulingId({ ...identity, ruling_slug: "another-ruling" }).ruling_key,
    );
  });

  it("does not renumber a ruling when the bundle grows", () => {
    const doctrine = bundleFor("doctrine-graduation");
    const merged = bundleFor("merge-adjudication");
    const combined = {
      ...doctrine,
      pull_requests: [...merged.pull_requests, ...doctrine.pull_requests],
    };
    const source = writeTempBundle(combined);
    const report = correlateAdjudications(readEvidence(loadEvidenceBundle(source), source));

    assert.deepEqual(
      report.rulings.map((ruling) => ruling.ruling_id),
      reportFor("doctrine-graduation").rulings.map((ruling) => ruling.ruling_id),
    );
  });
});

describe("replay determinism", () => {
  it("produces byte-identical library output for the same evidence", () => {
    for (const name of ["merge-adjudication", "superseded-head", "doctrine-graduation"]) {
      const first = reportFor(name);
      const second = reportFor(name);

      assert.equal(JSON.stringify(second), JSON.stringify(first), `${name} report`);
      assert.equal(JSON.stringify(renderGraduation(second)), JSON.stringify(renderGraduation(first)), `${name} proposals`);
    }
  });

  it("produces byte-identical CLI output and stable identities across runs", () => {
    const bundle = fixturePath("doctrine-graduation");
    const first = runCli(["render", bundle]);
    const second = runCli(["render", bundle]);

    assert.equal(first.status, 0);
    assert.equal(second.stdout, first.stdout);

    const firstJson = JSON.parse(runCli(["observe", bundle, "--format", "json"]).stdout);
    const secondJson = JSON.parse(runCli(["observe", bundle, "--format", "json"]).stdout);

    assert.deepEqual(secondJson, firstJson);
    assert.deepEqual(
      secondJson.records.map((record) => record.idempotency_key),
      firstJson.records.map((record) => record.idempotency_key),
    );
  });

  it("keeps identity stable when the evidence is reformatted", () => {
    const bundle = bundleFor("doctrine-graduation");
    const reordered = { pull_requests: bundle.pull_requests, ...bundle };
    const source = writeTempBundle(reordered);
    const report = correlateAdjudications(readEvidence(loadEvidenceBundle(source), source));

    assert.deepEqual(
      report.records.map((record) => record.record_id),
      reportFor("doctrine-graduation").records.map((record) => record.record_id),
    );
    assert.equal(report.evidence_sha256, reportFor("doctrine-graduation").evidence_sha256);
  });
});

describe("observation receipt", () => {
  it("records the observer, the evidence hash, and the boundary", () => {
    const source = fixturePath("doctrine-graduation");
    const bundle = loadEvidenceBundle(source);
    const report = correlateAdjudications(readEvidence(bundle, source));
    const receipt = buildAdjudicationReceipt({
      bundle,
      report,
      graduation: renderGraduation(report),
      actor: "codex-contributor",
      timestamp: FIXED_TIMESTAMP,
      source,
    });

    assert.equal(receipt.observed_at, FIXED_TIMESTAMP);
    assert.equal(receipt.observer.write_class, "read");
    assert.equal(receipt.boundary.no_github_write, true);
    assert.equal(receipt.boundary.performs_adjudication, false);
    assert.equal(receipt.boundary.edits_doctrine, false);
    assert.equal(receipt.outcome.adjudicated, 1);
    assert.deepEqual(receipt.outcome.ruling_ids, ["JK-RULING-20260727-19", "JK-RULING-20260727-44"]);
    assert.equal(receipt.outcome.proposal_ids.length, 2);
    assert.ok(verifyReceipt(receipt));
  });

  it("detects a tampered receipt and refuses a missing timestamp", () => {
    const source = fixturePath("merge-adjudication");
    const bundle = loadEvidenceBundle(source);
    const report = correlateAdjudications(readEvidence(bundle, source));
    const receipt = buildAdjudicationReceipt({ bundle, report, actor: "codex", timestamp: FIXED_TIMESTAMP, source });

    assert.ok(verifyReceipt(receipt));
    assert.equal(verifyReceipt({ ...receipt, outcome: { ...receipt.outcome, adjudicated: 99 } }), false);
    assert.throws(() => buildAdjudicationReceipt({ bundle, report, actor: "codex" }), /timestamp is required/);
  });
});

describe("ghl-adjudication CLI", () => {
  it("observes a fixture and exits zero", () => {
    const result = runCli(["observe", fixturePath("merge-adjudication")]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /ghl-adjudication: ok/);
    assert.match(result.stdout, /stated only/);
  });

  it("exits one on defective evidence and refuses to render it", () => {
    const bundle = bundleFor("merge-adjudication");
    delete bundle.pull_requests[0].current_head_sha;

    const source = writeTempBundle(bundle);
    const observed = runCli(["observe", source]);

    assert.equal(observed.status, 1);
    assert.match(observed.stderr, /missing_field/);

    const rendered = runCli(["render", source]);

    assert.equal(rendered.status, 1);
    assert.match(rendered.stderr, /refusing to render from defective evidence/);
  });

  it("reports that nothing graduates when no ruling is present", () => {
    const result = runCli(["render", fixturePath("merge-adjudication")]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /nothing to propose/);
  });

  it("limits output to one pull request", () => {
    const bundle = bundleFor("doctrine-graduation");

    bundle.pull_requests = [...bundleFor("merge-adjudication").pull_requests, ...bundle.pull_requests];

    const source = writeTempBundle(bundle);
    const report = JSON.parse(runCli(["observe", source, "--format", "json", "--pull", "44"]).stdout);

    assert.deepEqual(report.records.map((record) => record.pull_number), [44]);
    assert.equal(report.rulings.length, 2);
  });

  it("emits a receipt with an injected timestamp", () => {
    const result = runCli([
      "receipt",
      fixturePath("doctrine-graduation"),
      "--actor",
      "codex-contributor",
      "--at",
      FIXED_TIMESTAMP,
    ]);
    const receipt = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(receipt.observed_at, FIXED_TIMESTAMP);
    assert.equal(receipt.observer.actor, "codex-contributor");
    assert.equal(receipt.observer.tool, "ghl-adjudication");
    assert.ok(verifyReceipt(receipt));
  });

  it("exits two on an unreadable bundle and on a missing path", () => {
    const missing = runCli(["observe", path.join(os.tmpdir(), "ghl-adjudication-does-not-exist.json")]);

    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /cannot read evidence bundle/);

    const noPath = runCli(["observe"]);

    assert.equal(noPath.status, 2);
    assert.match(noPath.stderr, /evidence bundle path is required/);
  });
});
