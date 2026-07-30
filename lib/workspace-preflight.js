"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { isLivingOwner } = require("./process-owner");

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
  }
  return worktrees;
}

function githubRemote(remote) {
  const value = String(remote || "").trim();
  let match = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (!match) match = value.match(/^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

function repositoryAliases(root, remote) {
  const aliases = new Set([path.resolve(root).toLowerCase(), path.basename(root).toLowerCase()]);
  const projects = path.join(os.homedir(), "Projects");
  const relative = path.relative(projects, root);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    aliases.add(relative.replaceAll(path.sep, "/").toLowerCase());
  }
  const github = githubRemote(remote);
  if (github) {
    aliases.add(`${github.owner}/${github.repo}`.toLowerCase());
    aliases.add(github.repo.toLowerCase());
  }
  return aliases;
}

function repositoryMatches(value, aliases) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\.\/|\/$/g, "").toLowerCase();
  if (!normalized) return false;
  return [...aliases].some((alias) => normalized === alias || normalized.endsWith(`/${alias}`));
}

function readClaims(root, aliases, repositoryRoot, now = new Date()) {
  if (!fs.existsSync(root)) return { available: false, active: [], invalid: [] };
  const active = [];
  const invalid = [];
  for (const file of walkFiles(path.join(root, "claims"), ".json")) {
    try {
      const claim = JSON.parse(fs.readFileSync(file, "utf8"));
      const expires = Date.parse(claim.expires_at);
      if (!claim.released_at && claim.safety === "write" && Number.isFinite(expires) && expires >= now.getTime()) {
        const scopeOverlap = Array.isArray(claim.scope) && claim.scope.some((scope) => {
          const value = String(scope);
          return value === "*" || value === "." || path.resolve(value) === repositoryRoot ||
            path.resolve(repositoryRoot, value).startsWith(`${repositoryRoot}${path.sep}`);
        });
        if (repositoryMatches(claim.repo, aliases) || scopeOverlap) active.push({ file, claim });
      }
    } catch (error) {
      invalid.push({ file, error: error.message });
    }
  }
  return { available: true, active, invalid };
}

function readManifests(root) {
  if (!fs.existsSync(root)) return [];
  const manifests = [];
  for (const file of walkFiles(root, ".json")) {
    try {
      const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      manifests.push({ file, manifest, living: isLivingOwner(manifest) });
    } catch {
      // Reconcile reports malformed manifests. Preflight treats them as ambiguous below.
      manifests.push({ file, manifest: null, living: false });
    }
  }
  return manifests;
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
      if ([...aliases].some((alias) => line.toLowerCase().includes(alias))) {
        matches.push({ file, line: index + 1, text: line.trim() });
      }
    }
  }
  return { available: true, matches };
}

function collectWorkspace(root, options = {}) {
  const requestedRoot = path.resolve(root);
  const top = gitValue(requestedRoot, ["rev-parse", "--show-toplevel"]);
  if (!top) return { repository_root: requestedRoot, git: false };
  const currentRoot = path.resolve(top);
  const worktreeResult = runGit(currentRoot, ["worktree", "list", "--porcelain"]);
  const worktrees = worktreeResult.ok ? parseWorktrees(worktreeResult.stdout) : [];
  const primaryRoot = path.resolve(worktrees[0]?.root || currentRoot);
  const remote = gitValue(primaryRoot, ["remote", "get-url", "origin"]);
  const aliases = repositoryAliases(primaryRoot, remote);
  const commonRaw = gitValue(primaryRoot, ["rev-parse", "--git-common-dir"]);
  const commonDir = commonRaw
    ? path.resolve(primaryRoot, commonRaw)
    : null;
  const stateRoot = options.stateRoot || DEFAULT_STATE_ROOT;
  const manifests = readManifests(stateRoot);

  for (const worktree of worktrees) {
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
  return {
    git: true,
    repository_root: currentRoot,
    current_root: currentRoot,
    primary_root: primaryRoot,
    git_common_dir: commonDir,
    canonical_remote: remote,
    github: githubRemote(remote),
    branch,
    starting_head: head,
    primary_branch: primaryBranch,
    primary_head: primaryHead,
    tracking_branch: trackingBranch,
    divergence,
    worktrees,
    claims: readClaims(agentcoordRoot, aliases, primaryRoot, options.now),
    quarantine: quarantineMatch(quarantineRoot, aliases),
    runs,
  };
}

function issue(code, message, details = {}) {
  return { code, message, ...details };
}

function evaluateWorkspace(observation, mode = "write") {
  if (!["read", "write"].includes(mode)) throw new Error("mode must be read or write");
  const issues = [];
  if (!observation.git) {
    issues.push(issue("not_git_repository", "supplied root is not a Git repository"));
    return { ok: false, mode, issues };
  }
  if (mode === "write") {
    if (!observation.canonical_remote) {
      issues.push(issue("origin_unavailable", "origin remote is unavailable"));
    }
    if (observation.github?.owner.toLowerCase() === "ucla-tdg") {
      issues.push(issue(
        "read_only_mirror_origin",
        `write refused: origin targets read-only mirror github.com/${observation.github.owner}/${observation.github.repo}`,
      ));
    }
    const primary = observation.worktrees?.[0];
    if (!primary?.status_ok) {
      issues.push(issue("primary_status_ambiguous", "primary checkout status could not be read"));
    } else if (primary.has_changes) {
      issues.push(issue("primary_has_changes", "primary checkout has uncommitted changes"));
    }
    for (const worktree of (observation.worktrees || []).slice(1)) {
      if (worktree.has_changes && !worktree.living_owner) {
        issues.push(issue(
          "linked_worktree_unowned_changes",
          `linked worktree has uncommitted or ambiguous changes without a living owner: ${worktree.root}`,
          { worktree: worktree.root },
        ));
      }
    }
    if (!observation.tracking_branch || !observation.divergence) {
      issues.push(issue("tracking_branch_ambiguous", "primary branch canonical tracking state is unavailable"));
    } else if (!observation.tracking_branch.startsWith("origin/")) {
      issues.push(issue(
        "tracking_remote_not_origin",
        `primary branch tracks ${observation.tracking_branch}, not canonical origin`,
      ));
    } else if (observation.divergence.ahead !== 0 || observation.divergence.behind !== 0) {
      issues.push(issue(
        "primary_divergent",
        `primary branch diverges from ${observation.tracking_branch}: ahead=${observation.divergence.ahead} behind=${observation.divergence.behind}`,
      ));
    }
    if (!observation.quarantine.available) {
      issues.push(issue("quarantine_registry_unavailable", "worktree quarantine registry is unavailable"));
    } else if (observation.quarantine.matches.length) {
      issues.push(issue("repository_quarantined", "repository appears in the worktree quarantine registry", {
        matches: observation.quarantine.matches,
      }));
    }
    if (!observation.claims.available) {
      issues.push(issue("agentcoord_unavailable", "AgentCoord claims registry is unavailable"));
    } else if (observation.claims.active.length) {
      issues.push(issue("active_agentcoord_writer", "an active overlapping AgentCoord writer exists", {
        claims: observation.claims.active.map(({ file, claim }) => ({
          file,
          repo: claim.repo,
          slug: claim.slug,
          agent: claim.agent,
          host: claim.host,
        })),
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
      issues.push(issue("active_run_collision", "a living workspace run already owns this Git common directory", {
        run_ids: activeRuns.map(({ manifest }) => manifest.run_id),
      }));
    }
    if (staleRuns.length) {
      issues.push(issue("stale_run_requires_reconcile", "a dead or PID-reused workspace run requires reconciliation", {
        run_ids: staleRuns.map(({ manifest }) => manifest.run_id),
      }));
    }
    if (quarantinedRuns.length) {
      issues.push(issue("quarantined_run", "a quarantined workspace run exists", {
        run_ids: quarantinedRuns.map(({ manifest }) => manifest.run_id),
      }));
    }
  }
  return { ok: issues.length === 0, mode, issues };
}

function preflightWorkspace(root, mode = "write", options = {}) {
  const observation = collectWorkspace(root, options);
  const verdict = evaluateWorkspace(observation, mode);
  return {
    schema: "workspace-preflight.v1",
    checked_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    mode,
    ok: verdict.ok,
    shouldSurface: !verdict.ok,
    repository_root: observation.repository_root,
    current_root: observation.current_root || observation.repository_root,
    canonical_remote: observation.canonical_remote || null,
    branch: observation.branch || null,
    starting_head: observation.starting_head || null,
    tracking_branch: observation.tracking_branch || null,
    divergence: observation.divergence || null,
    issues: verdict.issues,
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
  parseWorktrees,
  preflightWorkspace,
  publicPreflight,
  readManifests,
  runGit,
};
