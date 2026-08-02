const { canonicalize, sha256Hex } = require("./canonical-json");
const { RENDER_SCHEMA } = require("./manifest-schema");
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

function renderBodyContent(manifest, issue) {
  const spec = manifest.specification;
  const titles = requirementTitles(manifest);
  const lines = [];

  lines.push(
    `Proposed by the \`${manifest.schema}\` renderer from \`${spec.source_document}\`.` +
      " Creating or updating this issue is a separately authorized external write.",
  );
  lines.push("");
  lines.push(`**Specification:** \`${spec.spec_id}\` at revision \`${spec.source_revision}\``);
  lines.push("");
  if (manifest.weekly_goal) {
    lines.push(`**Weekly goal:** \`${manifest.weekly_goal.goal_id}\``);
    lines.push(`**Week ending:** \`${manifest.weekly_goal.week_ending}\``);
    lines.push(`**Goal link schema:** \`${manifest.weekly_goal.schema}\``);
    lines.push("");
  }
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

  if (issue.definition_of_done) {
    const dod = issue.definition_of_done;
    lines.push("");
    lines.push("## Definition of done");
    lines.push("");
    lines.push(`- Class: \`${dod.class}\``);
    lines.push("");
    lines.push("### Proof requirements");
    lines.push("");
    for (const proof of dod.proof_requirements) {
      lines.push(`- \`${proof.id}\` — ${proof.requirement}`);
      lines.push(`  Evidence: ${proof.evidence}`);
    }
    lines.push("");
    lines.push("### Pass criteria");
    lines.push("");
    for (const criterion of dod.pass_criteria) {
      lines.push(`- \`${criterion.proof_id}\` — ${criterion.criterion}`);
      lines.push(`  Pass: ${criterion.expected_result}`);
    }
    lines.push("");
    lines.push("### Non-goals");
    lines.push("");
    if (dod.non_goals.length === 0) lines.push("- None declared");
    for (const nonGoal of dod.non_goals) lines.push(`- ${nonGoal}`);
    lines.push("");
    lines.push("### Budget and stop policy");
    lines.push("");
    lines.push(`- Maximum review rounds: ${dod.budget.max_review_rounds}`);
    lines.push(`- Maximum continuation attempts: ${dod.budget.max_continuation_attempts}`);
    for (const criterion of dod.kill_criteria) {
      lines.push(`- Kill trigger: ${criterion.trigger}; action: ${criterion.action}; decide by: ${criterion.decide_by}`);
    }
    lines.push(
      `- Findings: within DoD \`${dod.finding_policy.within_dod}\`; beyond DoD \`${dod.finding_policy.beyond_dod}\`; ` +
        `contract gaps \`${dod.finding_policy.contract_gap}\`; at budget \`${dod.finding_policy.at_budget}\`.`,
    );
    lines.push("");
    lines.push("### Defer policy");
    lines.push("");
    lines.push(`- Destination: ${dod.defer_policy.destination}`);
    lines.push(`- Promotion rule: ${dod.defer_policy.promotion_rule}`);
    lines.push("");
    lines.push("### Ratification");
    lines.push("");
    lines.push(`- Actor: \`${dod.ratification.actor}\``);
    lines.push(`- Evidence: \`${dod.ratification.evidence}\``);
    lines.push("- Claiming requires a GitHub comment by that actor carrying a `ratified-definition-of-done.v1` marker for the opening marker's exact `payload_sha256`.");
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
  const title = renderTitle(issue);
  const bodyContent = renderBodyContent(manifest, issue);
  const payloadSha256 = ["github-lifecycle-manifest.v2", "github-lifecycle-manifest.v3"].includes(manifest.schema)
    ? sha256Hex(`${title}\n${bodyContent}`)
    : sha256Hex(canonicalize(issue));
  const spec = manifest.specification;
  const marker = `<!-- ${manifest.schema} spec=${spec.spec_id} revision=${spec.source_revision}` +
    ` issue=${issue.issue_id} payload_sha256=${payloadSha256} -->`;

  return {
    issue_id: issue.issue_id,
    owner_repository: issue.owner_repository,
    write_class: issue.write_class,
    labels: issue.labels,
    payload_sha256: payloadSha256,
    ...(issue.definition_of_done ? { definition_of_done: issue.definition_of_done } : {}),
    ...(manifest.weekly_goal ? { weekly_goal: manifest.weekly_goal } : {}),
    title,
    body: `${marker}\n\n${bodyContent}`,
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
    ...(manifest.weekly_goal ? { weekly_goal: manifest.weekly_goal } : {}),
    issues: manifest.issues.map((issue) => renderIssue(manifest, issue.issue_id)),
  };
}

module.exports = { WRITE_BOUNDARY, renderIssue, renderManifest };
