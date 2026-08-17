"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { normalizeRepo, readClaims: readValidatedClaims } = require("./agentcoord-claims");
const { isLivingOwner } = require("./process-owner");
const {
  EXCEPTION_CATEGORIES,
  validateExecutionRef,
} = require("./weekly-focus");

const DEFAULT_AGENTCOORD_ROOT =
  process.env.AGENTCOORD_ROOT || "/mnt/synology-share1/AgentCoord";
const DEFAULT_QUARANTINE_ROOT =
  process.env.AGENT_QUARANTINE_ROOT ||
  "/mnt/synology-share1/AgentCoord/registry/worktree-quarantine";
const DEFAULT_STATE_ROOT =
  process.env.AGENT_WORKSPACE_STATE_ROOT ||
  path.join(os.homedir(), ".local/state/agent-workspaces");

function runGit(root, args, timeoutMs = 3000) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
}

function gitValue(root, args) {
  const result = runGit(root, args);
  return result.ok ? result.stdout : null;
}

function walkFiles(root, suffix = "") {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(file, suffix));
    else if (entry.isFile() && (!suffix || entry.name.endsWith(suffix))) files.push(file);
  }
  return files.sort();
}

function parseWorktrees(text) {
  const worktrees = [];
  let current = null;
  for (const line of String(text).split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { root: line.slice(9), head: null, branch: null };
      worktrees.push(current);
    } else if (current && line.startsWith("HEAD ")) current.head = line.slice(5);
    else if (current && line.startsWith("branch ")) current.branch = line.slice(7).replace(/^refs\/heads\//, "");
    else if (current && line === "detached") current.branch = null;
    else if (current && line === "bare") current.bare = true;
  }
  return worktrees;
}

function githubRemote(remote) {
  const value = String(remote || "").trim();
  let match = null;
  try {
    const parsed = new URL(value);
    if (["http:", "https:", "ssh:"].includes(parsed.protocol) &&
        parsed.hostname.toLowerCase() === "github.com") {
      match = parsed.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
    }
  } catch {
    // SCP-style Git remotes are not URLs.
  }
  if (!match) match = value.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

function repositoryAliases(root, remote) {
  const aliases = new Set([normalizeRepositoryIdentity(path.resolve(root))]);
  const projects = path.join(os.homedir(), "Projects");
  const relative = path.relative(projects, root);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    aliases.add(normalizeRepositoryIdentity(relative));
  }
  const github = githubRemote(remote);
  if (github) {
    aliases.add(normalizeRepositoryIdentity(`${github.owner}/${github.repo}`));
  }
  return aliases;
}

function normalizeRepositoryIdentity(value) {
  let normalized = String(value || "").trim();
  normalized = normalized.replace(/^["'`]|["'`,;]+$/g, "");
  const remote = githubRemote(normalized);
  if (remote) normalized = `${remote.owner}/${remote.repo}`;
  normalized = normalized
    .replace(/^file:\/\//i, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\/|\/$/g, "")
    .replace(/\.git$/i, "")
    .toLowerCase();
  return normalized;
}

function repositoryMatches(value, aliases) {
  const normalized = normalizeRepositoryIdentity(value);
  if (!normalized) return false;
  if (aliases.has(normalized)) return true;
  // Claims filed under a legacy alias spelling ("shared-manager") must still
  // match the canonical workspace identity ("shared/manager"). Route through
  // the same canonical map the agentcoord CLI uses.
  const canonical = normalizeRepositoryIdentity(normalizeRepo(normalized));
  return Boolean(canonical) && aliases.has(canonical);
}

// Expand workspace aliases with their canonical repo spellings so both sides
// of every claim comparison go through the same normalization.
function canonicalizeAliases(aliases) {
  const expanded = new Set();
  for (const alias of aliases) {
    const normalized = normalizeRepositoryIdentity(alias);
    if (!normalized) continue;
    expanded.add(normalized);
    const canonical = normalizeRepositoryIdentity(normalizeRepo(normalized));
    if (canonical) expanded.add(canonical);
  }
  return expanded;
}

function selectClaims(entries, rawAliases, repositoryRoot) {
  const aliases = canonicalizeAliases(rawAliases);
  const active = [];
  const invalid = [];
  for (const entry of entries) {
    const claim = entry.data;
    const parsedRepositoryMatches = repositoryMatches(claim?.repo, aliases);
    const directoryRepositoryMatches = repositoryMatches(entry.directory_repo, aliases);
    const sameRepository = parsedRepositoryMatches || directoryRepositoryMatches;
    if (entry.status === "invalid") {
      if (sameRepository) {
        invalid.push({
          file: entry.file,
          claim,
          directory_repo: entry.directory_repo,
          errors: entry.issues,
        });
      }
      continue;
    }
    if (entry.status === "active" && claim.safety === "write" && sameRepository) {
      const scopeOverlap = claim.scope.some((scope) => {
        const value = String(scope);
        if (value === "*" || value === ".") return true;
        const resolved = path.isAbsolute(value)
          ? path.resolve(value)
          : path.resolve(repositoryRoot, value);
        return resolved === repositoryRoot || resolved.startsWith(`${repositoryRoot}${path.sep}`);
      });
      if (scopeOverlap) {
        active.push({
          file: entry.file,
          claim,
          directory_repo: entry.directory_repo,
        });
      }
    }
  }
  return { available: true, active, invalid };
}

function readClaims(root, rawAliases, repositoryRoot, now = new Date()) {
  if (!fs.existsSync(root)) return { available: false, active: [], invalid: [] };
  return selectClaims(readValidatedClaims(root, now), rawAliases, repositoryRoot);
}

const RUN_STATES = new Set(["starting", "active", "sealed", "quarantined", "abandoned", "resolved"]);
const ACTIVE_RUN_STATES = new Set(["starting", "active"]);
const SHA_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;

function validTimestamp(value) {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function validateRunManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["manifest must be a JSON object"];
  }
  const legacyRepository = manifest.schema === "agent-workspace-run.v1";
  const versionedUnion = manifest.schema === "agent-workspace-run.v2";
  if (!legacyRepository && !versionedUnion) errors.push("unsupported or missing schema");
  const sessionKind = legacyRepository ? "repository" : manifest.session_kind;
  if (versionedUnion && !["repository", "workspace"].includes(sessionKind)) {
    errors.push("session_kind must be repository or workspace");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(String(manifest.run_id || ""))) {
    errors.push("run_id is missing or invalid");
  }
  const rootFields = sessionKind === "workspace" ? ["workspace_root"] : ["repository_root", "git_common_dir"];
  for (const field of rootFields) {
    if (typeof manifest[field] !== "string" || !path.isAbsolute(manifest[field])) {
      errors.push(`${field} must be an absolute path`);
    }
  }
  if (sessionKind === "workspace") {
    for (const field of ["repository_root", "git_common_dir", "canonical_remote", "origin_push_urls", "branch", "starting_head", "ending_head"]) {
      if (Object.hasOwn(manifest, field)) errors.push(`${field} must be omitted for workspace sessions`);
    }
    if (manifest.authority !== "operator" || manifest.safety_class !== "read") {
      errors.push("workspace sessions must declare operator authority and read safety_class");
    }
  } else if (typeof manifest.canonical_remote !== "string" || !manifest.canonical_remote.trim()) {
    errors.push("canonical_remote must be a non-empty string");
  }
  if (sessionKind !== "workspace" && manifest.origin_push_urls !== undefined &&
      (!Array.isArray(manifest.origin_push_urls) ||
       manifest.origin_push_urls.length === 0 ||
       manifest.origin_push_urls.some((url) => typeof url !== "string" || !url.trim()))) {
    errors.push("origin_push_urls must be a non-empty string list when present");
  }
  const hasGoal = typeof manifest.goal_id === "string" && Boolean(manifest.goal_id.trim());
  const hasException = manifest.exception !== null && manifest.exception !== undefined;
  if (hasGoal === hasException) errors.push("manifest must contain exactly one of goal_id or exception");
  if (hasException) {
    if (!manifest.exception || typeof manifest.exception !== "object" || Array.isArray(manifest.exception)) {
      errors.push("exception must be an object");
    } else {
      if (!EXCEPTION_CATEGORIES.has(manifest.exception.category)) {
        errors.push("exception.category is invalid");
      }
      if (typeof manifest.exception.reason !== "string" || !manifest.exception.reason.trim()) {
        errors.push("exception.reason must be a non-empty string");
      }
    }
  }
  if (manifest.execution_ref !== null && manifest.execution_ref !== undefined) {
    errors.push(...validateExecutionRef(manifest.execution_ref));
  }
  if (typeof manifest.tool !== "string" || !manifest.tool.trim()) errors.push("tool must be a non-empty string");
  if (!Number.isInteger(manifest.pid) || manifest.pid <= 0) errors.push("pid must be a positive integer");
  if (typeof manifest.process_start_token !== "string" || !manifest.process_start_token.trim()) {
    errors.push("process_start_token must be a non-empty string");
  }
  if (typeof manifest.host !== "string" || !manifest.host.trim()) errors.push("host must be a non-empty string");
  if (sessionKind !== "workspace" && (typeof manifest.branch !== "string" || !manifest.branch.trim())) errors.push("branch must be a non-empty string");
  if (sessionKind !== "workspace" && !SHA_PATTERN.test(String(manifest.starting_head || ""))) errors.push("starting_head must be a Git object ID");
  if (!validTimestamp(manifest.created_at)) errors.push("created_at must be a timestamp");
  if (!RUN_STATES.has(manifest.state)) errors.push("state is invalid");
  if (manifest.exit_code !== null && !Number.isInteger(manifest.exit_code)) {
    errors.push("exit_code must be null or an integer");
  }
  if (sessionKind !== "workspace" && manifest.ending_head !== null && !SHA_PATTERN.test(String(manifest.ending_head || ""))) {
    errors.push("ending_head must be null or a Git object ID");
  }
  if (ACTIVE_RUN_STATES.has(manifest.state)) {
    if (manifest.exit_code !== null) errors.push("active run exit_code must be null");
    if (sessionKind !== "workspace" && manifest.ending_head !== null) errors.push("active run ending_head must be null");
  }
  if (manifest.state === "sealed") {
    if (!Number.isInteger(manifest.exit_code)) errors.push("sealed exit_code must be an integer");
    if (!validTimestamp(manifest.sealed_at)) errors.push("sealed_at must be a timestamp");
  }
  if (manifest.state === "abandoned" && !validTimestamp(manifest.reconciled_at)) {
    errors.push("abandoned reconciled_at must be a timestamp");
  }
  if (manifest.state === "quarantined") {
    if (typeof manifest.quarantine_reason !== "string" || !manifest.quarantine_reason.trim()) {
      errors.push("quarantined run requires quarantine_reason");
    }
    if (!validTimestamp(manifest.sealed_at) && !validTimestamp(manifest.reconciled_at)) {
      errors.push("quarantined run requires sealed_at or reconciled_at");
    }
  }
  if (manifest.state === "resolved") {
    if (typeof manifest.quarantine_reason !== "string" || !manifest.quarantine_reason.trim()) {
      errors.push("resolved run must preserve quarantine_reason");
    }
    if (!validTimestamp(manifest.resolved_at)) errors.push("resolved_at must be a timestamp");
    if (!validTimestamp(manifest.sealed_at) && !validTimestamp(manifest.reconciled_at)) {
      errors.push("resolved run requires the original quarantine timestamp");
    }
    if (typeof manifest.resolution_reason !== "string" || !manifest.resolution_reason.trim()) {
      errors.push("resolution_reason must be a non-empty string");
    }
    if (!SHA_PATTERN.test(String(manifest.resolved_head || ""))) {
      errors.push("resolved_head must be a Git object ID");
    }
    const resolver = manifest.resolver;
    if (!resolver || typeof resolver !== "object" || Array.isArray(resolver)) {
      errors.push("resolver must be an identity object");
    } else {
      if (!Number.isInteger(resolver.pid) || resolver.pid <= 0) {
        errors.push("resolver.pid must be a positive integer");
      }
      if (typeof resolver.process_start_token !== "string" || !resolver.process_start_token.trim()) {
        errors.push("resolver.process_start_token must be a non-empty string");
      }
      if (typeof resolver.host !== "string" || !resolver.host.trim()) {
        errors.push("resolver.host must be a non-empty string");
      }
    }
  } else if (manifest.state !== "quarantined" && manifest.quarantine_reason !== null) {
    errors.push("quarantine_reason must be null unless state is quarantined or resolved");
  }
  return errors;
}

function readManifests(root) {
  if (!fs.existsSync(root)) return [];
  const manifests = [];
  for (const file of walkFiles(root, ".json")) {
    let raw = null;
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const errors = validateRunManifest(raw);
      manifests.push({
        file,
        manifest: errors.length ? null : raw,
        raw_manifest: raw,
        errors,
        living: errors.length ? false : isLivingOwner(raw),
      });
    } catch (error) {
      manifests.push({
        file,
        manifest: null,
        raw_manifest: raw,
        errors: [`cannot read manifest: ${error.message}`],
        living: false,
      });
    }
  }
  return manifests;
}

function readManifestFile(file) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { manifest: null, errors: [`cannot read manifest: ${error.message}`] };
  }
  const errors = validateRunManifest(manifest);
  return { manifest: errors.length ? null : manifest, raw_manifest: manifest, errors };
}

function livingOwnerFor(worktreeRoot, manifests) {
  const resolved = path.resolve(worktreeRoot);
  return manifests.some(({ manifest, living }) =>
    living &&
    ["starting", "active"].includes(manifest?.state) &&
    typeof manifest.repository_root === "string" &&
    path.resolve(manifest.repository_root) === resolved);
}

function runStatesForRepository(primaryRoot, commonDir, manifests) {
  return manifests.filter(({ manifest }) => {
    if (!manifest) return false;
    const sameRoot = typeof manifest.repository_root === "string" &&
      path.resolve(manifest.repository_root) === path.resolve(primaryRoot);
    const sameCommon = commonDir && typeof manifest.git_common_dir === "string" &&
      path.resolve(manifest.git_common_dir) === path.resolve(commonDir);
    return sameRoot || sameCommon;
  });
}

function invalidManifestsForRepository(primaryRoot, commonDir, manifests) {
  return manifests.filter(({ errors }) => errors?.length).filter(({ raw_manifest: manifest }) => {
    if (!manifest || typeof manifest !== "object") return true;
    const rootMatches = typeof manifest.repository_root === "string" &&
      path.resolve(manifest.repository_root) === path.resolve(primaryRoot);
    const commonMatches = commonDir && typeof manifest.git_common_dir === "string" &&
      path.resolve(manifest.git_common_dir) === path.resolve(commonDir);
    const hasIdentity = typeof manifest.repository_root === "string" ||
      typeof manifest.git_common_dir === "string";
    return rootMatches || commonMatches || !hasIdentity;
  });
}

function quarantineLineIdentities(line) {
  const identities = [];
  try {
    const value = JSON.parse(line);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const field of ["repo", "repository", "path", "root", "repository_root", "worktree"]) {
        if (typeof value[field] === "string") identities.push(value[field]);
      }
    }
  } catch {
    // Registry files may be Markdown or line-oriented text.
  }
  const keyed = /(?:^|[\s,{|])(?:repo|repository|path|root|repository_root|worktree)\s*[:=]\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`|([^\s,|}]+))/gi;
  for (const match of line.matchAll(keyed)) {
    identities.push(match[1] || match[2] || match[3] || match[4]);
  }
  for (const segment of line.split("|")) {
    const value = segment.trim().replace(/^[-*]\s+/, "");
    if (value && !/^(?:QUARANTINED|state\s*[:=]\s*["']?quarantined["']?)$/i.test(value)) {
      identities.push(value);
    }
  }
  const withoutState = line
    .replace(/state["']?\s*[:=]\s*["']?quarantined["']?/gi, " ")
    .replace(/\bQUARANTINED\b/gi, " ");
  identities.push(...withoutState.split(/\s+/).filter((value) => value.includes("/")));
  return new Set(identities.map(normalizeRepositoryIdentity).filter(Boolean));
}

function quarantineMatch(root, aliases) {
  if (!fs.existsSync(root)) return { available: false, matches: [] };
  const matches = [];
  for (const file of walkFiles(root)) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const [index, line] of text.split("\n").entries()) {
      if (!/(?:QUARANTINED|state["']?\s*[:=]\s*["']?quarantined)/i.test(line)) continue;
      const identities = quarantineLineIdentities(line);
      if ([...aliases].some((alias) => identities.has(normalizeRepositoryIdentity(alias)))) {
        matches.push({ file, line: index + 1, text: line.trim() });
      }
    }
  }
  return { available: true, matches };
}

function collectWorkspace(root, options = {}) {
  const requestedRoot = path.resolve(root);
  let stat;
  try {
    stat = fs.statSync(requestedRoot);
  } catch (error) {
    if (error.code === "ENOENT") return { repository_root: requestedRoot, path_exists: false, is_directory: false, git: false };
    return { repository_root: requestedRoot, path_exists: null, is_directory: null, path_error: error.message, git: false };
  }
  if (!stat.isDirectory()) {
    return { repository_root: requestedRoot, path_exists: true, is_directory: false, git: false };
  }
  const resolvedRoot = fs.realpathSync.native(requestedRoot);
  const top = gitValue(resolvedRoot, ["rev-parse", "--show-toplevel"]);
  if (!top) {
    const manifests = readManifests(options.stateRoot || DEFAULT_STATE_ROOT);
    const runs = manifests.filter(({ manifest }) => manifest?.session_kind === "workspace" &&
      path.resolve(manifest.workspace_root) === resolvedRoot);
    const invalidRuns = manifests.filter(({ errors }) => errors?.length).filter(({ raw_manifest: manifest }) => {
      if (!manifest || typeof manifest !== "object") return true;
      if (typeof manifest.workspace_root === "string") return path.resolve(manifest.workspace_root) === resolvedRoot;
      return typeof manifest.repository_root !== "string" && typeof manifest.git_common_dir !== "string";
    });
    return {
      repository_root: resolvedRoot,
      workspace_root: resolvedRoot,
      current_root: resolvedRoot,
      path_exists: true,
      is_directory: true,
      git: false,
      runs,
      invalid_runs: invalidRuns,
    };
  }
  const currentRoot = path.resolve(top);
  const worktreeResult = runGit(currentRoot, ["worktree", "list", "--porcelain"]);
  const worktrees = worktreeResult.ok ? parseWorktrees(worktreeResult.stdout) : [];
  const primaryRoot = path.resolve(worktrees[0]?.root || currentRoot);
  const remote = gitValue(primaryRoot, ["remote", "get-url", "origin"]);
  const pushRemoteText = gitValue(primaryRoot, ["remote", "get-url", "--push", "--all", "origin"]);
  const pushRemotes = pushRemoteText ? pushRemoteText.split("\n").filter(Boolean) : [];
  const aliases = repositoryAliases(primaryRoot, remote);
  for (const worktree of worktrees) {
    aliases.add(normalizeRepositoryIdentity(path.resolve(worktree.root)));
  }
  aliases.add(normalizeRepositoryIdentity(currentRoot));
  const commonRaw = gitValue(primaryRoot, ["rev-parse", "--git-common-dir"]);
  const commonDir = commonRaw
    ? fs.realpathSync.native(path.resolve(primaryRoot, commonRaw))
    : null;
  const stateRoot = options.stateRoot || DEFAULT_STATE_ROOT;
  const manifests = readManifests(stateRoot);

  for (const worktree of worktrees) {
    if (worktree.bare) {
      // A bare base has no working tree: nothing can be uncommitted there.
      worktree.status_ok = true;
      worktree.status = "";
      worktree.has_changes = false;
      worktree.living_owner = livingOwnerFor(worktree.root, manifests);
      continue;
    }
    const status = runGit(worktree.root, ["status", "--porcelain=v1", "--untracked-files=all"]);
    worktree.status_ok = status.ok;
    worktree.status = status.ok ? status.stdout : "";
    worktree.has_changes = !status.ok || Boolean(status.stdout);
    worktree.living_owner = livingOwnerFor(worktree.root, manifests);
  }

  const branch = gitValue(currentRoot, ["branch", "--show-current"]);
  const head = gitValue(currentRoot, ["rev-parse", "HEAD"]);
  const primaryBranch = gitValue(primaryRoot, ["branch", "--show-current"]);
  const primaryHead = gitValue(primaryRoot, ["rev-parse", "HEAD"]);
  const trackingBranch = gitValue(primaryRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  let divergence = null;
  if (trackingBranch) {
    const counts = gitValue(primaryRoot, ["rev-list", "--left-right", "--count", `HEAD...${trackingBranch}`]);
    const match = counts?.match(/^(\d+)\s+(\d+)$/);
    if (match) divergence = { ahead: Number(match[1]), behind: Number(match[2]) };
  }
  const agentcoordRoot = options.agentcoordRoot || DEFAULT_AGENTCOORD_ROOT;
  const quarantineRoot = options.quarantineRoot || DEFAULT_QUARANTINE_ROOT;
  const runs = runStatesForRepository(primaryRoot, commonDir, manifests);
  const invalidRuns = invalidManifestsForRepository(primaryRoot, commonDir, manifests);
  const claims = Array.isArray(options.claimEntries)
    ? selectClaims(options.claimEntries, aliases, primaryRoot)
    : options.claimStateError
      ? { available: false, active: [], invalid: [], error: options.claimStateError }
      : readClaims(agentcoordRoot, aliases, primaryRoot, options.now);
  return {
    git: true,
    repository_root: currentRoot,
    current_root: currentRoot,
    primary_root: primaryRoot,
    git_common_dir: commonDir,
    canonical_remote: remote,
    origin_fetch_url: remote,
    origin_push_urls: pushRemotes,
    github: githubRemote(remote),
    push_github: pushRemotes.map(githubRemote),
    branch,
    starting_head: head,
    primary_branch: primaryBranch,
    primary_head: primaryHead,
    tracking_branch: trackingBranch,
    divergence,
    worktrees,
    claims,
    quarantine: quarantineMatch(quarantineRoot, aliases),
    runs,
    invalid_runs: invalidRuns,
  };
}

function issue(code, message, details = {}) {
  return { code, message, ...details };
}

function evaluateWorkspace(observation, mode = "write", sessionKind = "repository") {
  if (!["read", "write"].includes(mode)) throw new Error("mode must be read or write");
  if (!["repository", "workspace"].includes(sessionKind)) {
    throw new Error("session kind must be repository or workspace");
  }
  const issues = [];
  const blockingIssues = [];
  const addIssue = (value, blocksWrite = true, blocksRead = false) => {
    issues.push(value);
    if ((mode === "write" && blocksWrite) || (mode === "read" && blocksRead)) {
      blockingIssues.push(value);
    }
  };
  if (!observation.git) {
    if (observation.path_exists === false) {
      addIssue(issue("path_missing", "supplied root does not exist"), true, true);
      return { ok: false, mode, issues, blocking_issues: blockingIssues };
    }
    if (observation.is_directory === false) {
      addIssue(issue("not_directory", "supplied root is not a directory"), true, true);
      return { ok: false, mode, issues, blocking_issues: blockingIssues };
    }
    if (observation.path_exists !== true || observation.is_directory !== true) {
      addIssue(issue("path_ambiguous", `supplied root cannot be checked: ${observation.path_error || "unknown error"}`), true, true);
      return { ok: false, mode, issues, blocking_issues: blockingIssues };
    }
    if (sessionKind !== "workspace") {
      addIssue(issue("git_repository_required", "supplied root is not a Git repository"), true, true);
      return { ok: false, mode, issues, blocking_issues: blockingIssues };
    }
    if (mode !== "read") {
      addIssue(issue("workspace_write_forbidden", "workspace operator sessions require read mode"), true, true);
      return { ok: false, mode, issues, blocking_issues: blockingIssues };
    }
    if ((observation.invalid_runs || []).length) {
      addIssue(issue("run_manifest_ambiguous", "a relevant workspace run manifest is unreadable or invalid", {
        manifests: observation.invalid_runs.map(({ file, errors }) => ({ file, errors })),
      }));
    }
    const active = (observation.runs || []).filter(({ manifest, living }) =>
      ["starting", "active"].includes(manifest?.state) && living);
    const stale = (observation.runs || []).filter(({ manifest, living }) =>
      ["starting", "active"].includes(manifest?.state) && !living);
    const quarantined = (observation.runs || []).filter(({ manifest }) => manifest?.state === "quarantined");
    if (active.length) addIssue(issue("active_run_collision", "a living workspace run already owns this exact directory", { run_ids: active.map(({ manifest }) => manifest.run_id) }));
    if (stale.length) addIssue(issue("stale_run_requires_reconcile", "a dead or PID-reused workspace run requires reconciliation", { run_ids: stale.map(({ manifest }) => manifest.run_id) }));
    if (quarantined.length) addIssue(issue("quarantined_run", "a quarantined workspace run exists", { run_ids: quarantined.map(({ manifest }) => manifest.run_id) }));
    return { ok: blockingIssues.length === 0, mode, issues, blocking_issues: blockingIssues };
  }
  if (sessionKind === "workspace") {
    addIssue(issue("workspace_requires_non_git_root", "workspace operator sessions require a non-Git directory"), true, true);
    return { ok: false, mode, issues, blocking_issues: blockingIssues };
  }
  if (!observation.canonical_remote) {
    addIssue(issue("origin_unavailable", "origin fetch URL is unavailable"));
  }
  if (!Array.isArray(observation.origin_push_urls) || observation.origin_push_urls.length === 0) {
    addIssue(issue("origin_push_unavailable", "effective origin push URL is unavailable"));
  }
  if (!observation.branch) {
    addIssue(issue("detached_current_worktree", "current worktree is detached; write launches require a branch"));
  }
  if (observation.github?.owner.toLowerCase() === "ucla-tdg") {
    addIssue(issue(
        "read_only_mirror_origin",
        `origin fetch URL targets read-only mirror github.com/${observation.github.owner}/${observation.github.repo}`,
    ));
  }
  for (const [index, remote] of (observation.push_github || []).entries()) {
    if (remote?.owner.toLowerCase() === "ucla-tdg") {
      addIssue(issue(
        "read_only_mirror_push",
        `effective origin push URL targets read-only mirror github.com/${remote.owner}/${remote.repo}`,
        { push_url: observation.origin_push_urls[index] },
      ));
    }
  }
  const primary = observation.worktrees?.[0];
  if (primary?.bare) {
    addIssue(issue(
        "primary_bare_base",
        "primary checkout is a bare base; linked worktrees carry the working state",
    ), false, false);
  }
  if (!primary?.status_ok) {
    addIssue(issue("primary_status_ambiguous", "primary checkout status could not be read"));
  } else if (primary.has_changes) {
    addIssue(issue("primary_has_changes", "primary checkout has uncommitted changes"));
  }
  for (const worktree of (observation.worktrees || []).slice(1)) {
    if (worktree.has_changes && !worktree.living_owner) {
      addIssue(issue(
          "linked_worktree_unowned_changes",
          `linked worktree has uncommitted or ambiguous changes without a living owner: ${worktree.root}`,
          { worktree: worktree.root },
      ));
    }
  }
  if (!observation.tracking_branch || !observation.divergence) {
    addIssue(issue("tracking_branch_ambiguous", "primary branch canonical tracking state is unavailable"));
  } else if (!observation.tracking_branch.startsWith("origin/")) {
    addIssue(issue(
        "tracking_remote_not_origin",
        `primary branch tracks ${observation.tracking_branch}, not canonical origin`,
    ));
  } else if (observation.divergence.ahead !== 0 || observation.divergence.behind !== 0) {
    addIssue(issue(
        "primary_divergent",
        `primary branch diverges from ${observation.tracking_branch}: ahead=${observation.divergence.ahead} behind=${observation.divergence.behind}`,
    ));
  }
  if (!observation.quarantine.available) {
    addIssue(issue("quarantine_registry_unavailable", "worktree quarantine registry is unavailable"));
  } else if (observation.quarantine.matches.length) {
    addIssue(issue("repository_quarantined", "repository appears in the worktree quarantine registry", {
        matches: observation.quarantine.matches,
    }));
  }
  if (!observation.claims.available) {
    addIssue(issue("agentcoord_unavailable", "AgentCoord claims registry is unavailable"));
  } else if (observation.claims.active.length) {
    addIssue(issue("active_agentcoord_writer", "an active overlapping AgentCoord writer exists", {
        claims: observation.claims.active.map(({ file, claim }) => ({
          file,
          repo: claim.repo,
          slug: claim.slug,
          agent: claim.agent,
          host: claim.host,
        })),
    }));
  }
  if ((observation.claims.invalid || []).length) {
    addIssue(issue("agentcoord_claim_ambiguous", "a relevant AgentCoord claim is unreadable or invalid", {
      claims: observation.claims.invalid.map(({ file, claim, directory_repo, errors }) => ({
        file,
        repo: claim?.repo || null,
        directory_repo,
        errors,
      })),
    }));
  }
  if ((observation.invalid_runs || []).length) {
    addIssue(issue("run_manifest_ambiguous", "a relevant workspace run manifest is unreadable or invalid", {
      manifests: observation.invalid_runs.map(({ file, errors }) => ({ file, errors })),
    }));
  }
  const relevantRuns = observation.runs || [];
  const sameCurrentRoot = ({ manifest }) =>
    typeof manifest?.repository_root === "string" &&
    path.resolve(manifest.repository_root) === path.resolve(observation.current_root);
  const activeRuns = relevantRuns.filter(({ manifest, living }) =>
    ["starting", "active"].includes(manifest?.state) && living).filter(sameCurrentRoot);
  const staleRuns = relevantRuns.filter(({ manifest, living }) =>
    ["starting", "active"].includes(manifest?.state) && !living).filter(sameCurrentRoot);
  const quarantinedRuns = relevantRuns.filter(({ manifest }) => manifest?.state === "quarantined");
  if (activeRuns.length) {
    addIssue(issue("active_run_collision", "a living workspace run already owns this checkout", {
        run_ids: activeRuns.map(({ manifest }) => manifest.run_id),
    }));
  }
  if (staleRuns.length) {
    addIssue(issue("stale_run_requires_reconcile", "a dead or PID-reused workspace run requires reconciliation", {
        run_ids: staleRuns.map(({ manifest }) => manifest.run_id),
    }));
  }
  if (quarantinedRuns.length) {
    addIssue(issue("quarantined_run", "a quarantined workspace run exists", {
        run_ids: quarantinedRuns.map(({ manifest }) => manifest.run_id),
    }));
  }
  return { ok: blockingIssues.length === 0, mode, issues, blocking_issues: blockingIssues };
}

function preflightWorkspace(root, mode = "write", options = {}) {
  const sessionKind = options.sessionKind || "repository";
  const observation = collectWorkspace(root, options);
  const verdict = evaluateWorkspace(observation, mode, sessionKind);
  return {
    schema: "workspace-preflight.v1",
    checked_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    mode,
    ok: verdict.ok,
    shouldSurface: verdict.issues.length > 0,
    repository_root: observation.repository_root,
    session_kind: sessionKind,
    workspace_root: observation.workspace_root || null,
    current_root: observation.current_root || observation.repository_root,
    canonical_remote: observation.canonical_remote || null,
    origin_fetch_url: observation.origin_fetch_url || null,
    origin_push_urls: observation.origin_push_urls || [],
    branch: observation.branch || null,
    starting_head: observation.starting_head || null,
    tracking_branch: observation.tracking_branch || null,
    divergence: observation.divergence || null,
    issues: verdict.issues,
    blocking_issues: verdict.blocking_issues,
    observation,
  };
}

function publicPreflight(result) {
  const output = { ...result };
  delete output.observation;
  return output;
}

module.exports = {
  DEFAULT_AGENTCOORD_ROOT,
  DEFAULT_QUARANTINE_ROOT,
  DEFAULT_STATE_ROOT,
  collectWorkspace,
  evaluateWorkspace,
  githubRemote,
  normalizeRepositoryIdentity,
  parseWorktrees,
  preflightWorkspace,
  publicPreflight,
  readClaims,
  selectClaims,
  readManifestFile,
  readManifests,
  runGit,
  quarantineMatch,
  validateRunManifest,
};
