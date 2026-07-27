const { canonicalize, sha256Hex } = require("./canonical-json");
const { MANIFEST_SCHEMA, RENDER_SCHEMA } = require("./manifest-schema");
const { validateManifest } = require("./manifest-validator");

// Rendering is proposal-only. Nothing in this module may reach GitHub; issue
// creation and updates are separately authorized external writes.
const WRITE_BOUNDARY = "proposal-only; creating or updating GitHub issues is a separately authorized external write";

const OPTIONAL_LISTS = ["depends_on", "external_dependencies", "non_goals", "labels"];

function normalizeIssue(issue) {
  const normalized = { ...issue };

  for (const field of OPTIONAL_LISTS) {
    normalized[field] = Array.isArray(issue[field]) ? [...issue[field]] : [];
  }

  return normalized;
}

function backtickList(values) {
  return values.map((value) => `\`${value}\``).join(", ");
}

function requirementTitles(manifest) {
  const titles = new Map();

  for (const requirement of manifest.requirements) {
    titles.set(requirement.id, requirement.title);
  }

  return titles;
}

function findIssue(manifest, issueId) {
  const issue = manifest.issues.find((candidate) => candidate.issue_id === issueId);

  if (!issue) {
    throw new Error(`unknown issue: ${issueId}`);
  }

  return issue;
}

function renderTitle(issue) {
  return `${issue.issue_id} — ${issue.title}`;
}

function renderBody(manifest, issue, payloadSha256) {
  const spec = manifest.specification;
  const titles = requirementTitles(manifest);
  const lines = [];

  lines.push(
    `<!-- ${MANIFEST_SCHEMA} spec=${spec.spec_id} revision=${spec.source_revision}` +
      ` issue=${issue.issue_id} payload_sha256=${payloadSha256} -->`,
  );
  lines.push("");
  lines.push(
    `Proposed by the \`${MANIFEST_SCHEMA}\` renderer from \`${spec.source_document}\`.` +
      " Creating or updating this issue is a separately authorized external write.",
  );
  lines.push("");
  lines.push(`**Specification:** \`${spec.spec_id}\` at revision \`${spec.source_revision}\``);
  lines.push("");
  lines.push(`**Owner:** \`${issue.owner_repository}\``);
  lines.push("");

  if (issue.manager_project) {
    lines.push(`**Manager project:** \`${issue.manager_project}\``);
    lines.push("");
  }

  lines.push(`**External-write class:** \`${issue.write_class}\``);
  lines.push("");

  if (issue.summary) {
    lines.push(issue.summary);
    lines.push("");
  }

  lines.push("## Requirements");
  lines.push("");

  for (const requirementId of issue.requirements) {
    const title = titles.get(requirementId);
    lines.push(title ? `- \`${requirementId}\` — ${title}` : `- \`${requirementId}\``);
  }

  lines.push("");
  lines.push("## Dependencies");
  lines.push("");

  if (issue.depends_on.length === 0 && issue.external_dependencies.length === 0) {
    lines.push("- None");
  }

  if (issue.depends_on.length > 0) {
    lines.push(`- Issues: ${backtickList(issue.depends_on)}`);
  }

  for (const dependency of issue.external_dependencies) {
    lines.push(`- ${dependency}`);
  }

  lines.push("");
  lines.push("## Acceptance criteria");
  lines.push("");

  for (const criterion of issue.acceptance_criteria) {
    lines.push(`- ${criterion}`);
  }

  lines.push("");
  lines.push("## Validation");
  lines.push("");
  lines.push("```bash");

  for (const command of issue.validation_commands) {
    lines.push(command);
  }

  lines.push("```");

  if (issue.validation_notes) {
    lines.push("");
    lines.push(issue.validation_notes);
  }

  lines.push("");
  lines.push("## Non-goals");
  lines.push("");

  if (issue.non_goals.length === 0) {
    lines.push("- None declared");
  }

  for (const nonGoal of issue.non_goals) {
    lines.push(`- ${nonGoal}`);
  }

  lines.push("");

  return lines.join("\n");
}

function renderIssue(manifest, issueId) {
  const issue = normalizeIssue(findIssue(manifest, issueId));
  const payloadSha256 = sha256Hex(canonicalize(issue));

  return {
    issue_id: issue.issue_id,
    owner_repository: issue.owner_repository,
    write_class: issue.write_class,
    labels: issue.labels,
    payload_sha256: payloadSha256,
    title: renderTitle(issue),
    body: renderBody(manifest, issue, payloadSha256),
  };
}

function renderManifest(manifest) {
  const validation = validateManifest(manifest);

  if (!validation.ok) {
    throw new Error(`refusing to render an invalid manifest: ${validation.errors.length} defect(s)`);
  }

  return {
    schema: RENDER_SCHEMA,
    manifest_schema: manifest.schema,
    manifest_version: manifest.manifest_version,
    spec_id: manifest.specification.spec_id,
    source_revision: manifest.specification.source_revision,
    manifest_sha256: sha256Hex(canonicalize(manifest)),
    write_boundary: WRITE_BOUNDARY,
    issues: manifest.issues.map((issue) => renderIssue(manifest, issue.issue_id)),
  };
}

module.exports = { WRITE_BOUNDARY, renderIssue, renderManifest };
