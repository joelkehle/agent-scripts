const { canonicalize, sha256Hex } = require("./canonical-json");
const { RENDER_SCHEMA } = require("./manifest-schema");
const {
  ADJUDICATION_WRITE_BOUNDARY,
  EVIDENCE_SCHEMA,
  GRADUATION_SCHEMA,
  OWNING_DOCUMENTS,
} = require("./adjudication-schema");

// Renders the follow-up issue that carries a durable ruling to its canonical
// document. The proposal is the request for that edit; this module edits no
// doctrine file and reaches no GitHub API. Bodies carry no timestamp and no
// randomness, so the same evidence renders the same bytes.

const PROPOSAL_ID_LENGTH = 32;
const GRADUATION_LABELS = ["doctrine", "graduation"];

function backtickList(values) {
  return values.map((value) => `\`${value}\``).join(", ");
}

function proposalIdentity(ruling) {
  return sha256Hex([GRADUATION_SCHEMA, ruling.ruling_key].join("\u0000"));
}

function renderTitle(ruling) {
  return `${ruling.ruling_id} — Graduate ruling ${ruling.ruling_slug} into ${ruling.owning_document}`;
}

function renderRelatedIds(ruling, lines) {
  lines.push("## Related IDs");
  lines.push("");
  lines.push(`- Ruling: \`${ruling.ruling_id}\` (identity \`${ruling.ruling_key.slice(0, 16)}\`)`);

  if (ruling.ruling_refs.length > 0) {
    lines.push(`- Standing rulings: ${backtickList(ruling.ruling_refs)}`);
  }

  if (ruling.requirement_ids.length > 0) {
    lines.push(`- Requirements: ${backtickList(ruling.requirement_ids)}`);
  }

  if (ruling.supersedes.length > 0) {
    lines.push(`- Supersedes: ${backtickList(ruling.supersedes)}`);
  }

  if (ruling.lineage) {
    const issue = `${ruling.lineage.repository || ruling.repository}#${ruling.lineage.issue_number}`;
    lines.push(`- Lifecycle issue: \`${ruling.lineage.issue_id}\` (${issue})`);

    if (ruling.lineage.spec_id) {
      lines.push(
        `- Specification: \`${ruling.lineage.spec_id}\`` +
          (ruling.lineage.source_revision ? ` at revision \`${ruling.lineage.source_revision}\`` : ""),
      );
    }
  }

  lines.push("");
}

function renderBody(ruling, payloadSha256) {
  const document = OWNING_DOCUMENTS[ruling.owning_document];
  const pullRequest = `${ruling.repository}#${ruling.pull_number}`;
  const lines = [];

  lines.push(
    `<!-- ${RENDER_SCHEMA} source=${EVIDENCE_SCHEMA} ruling=${ruling.ruling_id}` +
      ` repository=${ruling.repository} pull_request=${ruling.pull_number}` +
      ` head_sha=${ruling.head_sha} payload_sha256=${payloadSha256} -->`,
  );
  lines.push("");
  lines.push(
    `Proposed by the \`${EVIDENCE_SCHEMA}\` observer after \`${ruling.decided_by}\` adjudicated` +
      ` ${pullRequest}. Creating this issue is a separately authorized external write, and the` +
      " doctrine edit it asks for happens through the ordinary issue, mission, PR, review, and" +
      " adjudication path.",
  );
  lines.push("");
  lines.push(`**Ruling:** \`${ruling.ruling_id}\``);
  lines.push("");
  lines.push(`**Owning document:** \`${ruling.owning_document}\` — ${document.title}`);
  lines.push("");
  lines.push(
    `**Adjudication:** \`${ruling.github_disposition}\` by \`${ruling.decided_by}\`` +
      ` at head \`${ruling.head_sha}\` on \`${ruling.decided_at}\``,
  );
  lines.push("");
  lines.push(`**Detected from:** \`${ruling.source}\``);
  lines.push("");

  if (ruling.evidence_url) {
    lines.push(`**Evidence:** ${ruling.evidence_url}`);
    lines.push("");
  }

  lines.push("## Ruling");
  lines.push("");
  lines.push(ruling.statement);
  lines.push("");

  if (ruling.reason) {
    lines.push(`Reason: ${ruling.reason}`);
    lines.push("");
  }

  renderRelatedIds(ruling, lines);

  lines.push("## Acceptance criteria");
  lines.push("");
  lines.push(
    `- Record the ruling in \`${ruling.owning_document}\` under the stable ID \`${ruling.ruling_id}\`,` +
      " with its one-line reason.",
  );
  lines.push(`- Cite the adjudicated pull request ${pullRequest} and head \`${ruling.head_sha}\`.`);
  lines.push(`- ${document.change_control}`);
  lines.push("- Leave the PR verdict on the PR; the document carries the durable rule only.");
  lines.push("- Link the merged doctrine change back from the adjudicated pull request.");
  lines.push("");
  lines.push("## Validation");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run agent:check");
  lines.push("```");
  lines.push("");
  lines.push("## Non-goals");
  lines.push("");
  lines.push("- No doctrine edit by the observer; this issue is the request for that edit.");
  lines.push("- No competing home for the ruling in another document.");
  lines.push("- No adjudication, approval, merge, or request-changes by automation.");
  lines.push("");

  return lines.join("\n");
}

function renderGraduationProposal(ruling) {
  if (!OWNING_DOCUMENTS[ruling.owning_document]) {
    throw new Error(`unknown owning document: ${ruling.owning_document}`);
  }

  const payloadSha256 = sha256Hex(canonicalize(ruling));
  const idempotencyKey = proposalIdentity(ruling);

  return {
    proposal_id: idempotencyKey.slice(0, PROPOSAL_ID_LENGTH),
    idempotency_key: idempotencyKey,
    ruling_id: ruling.ruling_id,
    ruling_key: ruling.ruling_key,
    owning_document: ruling.owning_document,
    owner_repository: ruling.repository,
    source_record_id: ruling.record_id || null,
    write_class: "propose",
    labels: [...GRADUATION_LABELS],
    payload_sha256: payloadSha256,
    title: renderTitle(ruling),
    body: renderBody(ruling, payloadSha256),
  };
}

function renderGraduation(report) {
  return {
    schema: GRADUATION_SCHEMA,
    report_schema: report.schema,
    evidence_schema: report.evidence_schema,
    evidence_sha256: report.evidence_sha256,
    issue_marker: RENDER_SCHEMA,
    write_boundary: ADJUDICATION_WRITE_BOUNDARY,
    no_github_write: true,
    proposals: report.rulings.map((ruling) => renderGraduationProposal(ruling)),
  };
}

module.exports = { renderGraduation, renderGraduationProposal };
