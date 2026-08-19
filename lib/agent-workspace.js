"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { processIdentity, isLivingOwner } = require("./process-owner");
const { loadFocus, resolveException, resolveGoal, validateExecutionRef } = require("./weekly-focus");
const {
  DEFAULT_STATE_ROOT,
  preflightWorkspace,
  publicPreflight,
  readManifestFile,
  readManifests,
  runGit,
} = require("./workspace-preflight");

const ACTIVE_STATES = new Set(["starting", "active"]);

class WorkspaceRunError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "WorkspaceRunError";
    this.details = details;
  }
}

function iso(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function makeRunId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:.]/g, "").replace(/\d{3}Z$/, "Z");
  return `${stamp}-${crypto.randomBytes(5).toString("hex")}`;
}

function manifestPath(stateRoot, runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(String(runId || ""))) {
    throw new WorkspaceRunError("invalid run_id");
  }
  return path.join(stateRoot, `${runId}.json`);
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`,
  );
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  fs.renameSync(temporary, file);
}

function readManifest(file) {
  const result = readManifestFile(file);
  if (result.errors.length) {
    throw new WorkspaceRunError(`invalid manifest ${file}: ${result.errors.join("; ")}`);
  }
  return result.manifest;
}

function validateOptionalExecutionRef(executionRef) {
  if (executionRef === null || executionRef === undefined) return null;
  const errors = validateExecutionRef(executionRef);
  if (errors.length) throw new WorkspaceRunError(errors.join("; "));
  return { kind: executionRef.kind, id: executionRef.id };
}

function resolveFocus(options) {
  const hasGoal = Boolean(String(options.goalId || "").trim());
  const hasException = options.exceptionSpecified === true ||
    Boolean(options.exceptionCategory || options.exceptionReason);
  if (hasGoal && hasException) {
    throw new WorkspaceRunError("goal_id and exception fields are mutually exclusive");
  }
  if (!hasGoal && !hasException) {
    // Joel-ratified 2026-08: interactive Claude and Codex sessions are
    // ordinary delegated helpers. A routine run carries no weekly goal;
    // weekly focus is optional metadata, not inferred authority, and never
    // a gate for routine work. The launcher still validates focus health
    // and prints the expiry warning before begin.
    return { resolution: null, goal_id: null, exception: null };
  }
  const focus = loadFocus(options.focusFile, {
    allowExpired: hasException || hasGoal,
    now: options.now,
  });
  if (options.goalId) {
    let resolution;
    if (focus.expired) {
      const goal = focus.goals.find((item) => item.id === options.goalId);
      if (!goal) throw new WorkspaceRunError(`unknown weekly goal id ${options.goalId}`);
      const hasSupervisedContext = goal.supervised_execution?.required === true ||
        Boolean(goal.active_execution_ref) ||
        Boolean(goal.proof_execution_refs?.length) ||
        Boolean(goal.execution_refs?.length) ||
        Boolean(options.executionRef);
      if (hasSupervisedContext) {
        throw new WorkspaceRunError(
          "expired weekly focus refuses supervised mission, initiative, and campaign launches",
        );
      }
      resolution = {
        kind: "goal",
        ...(focus.schema ? { schema: focus.schema } : {}),
        week_ending: focus.week_ending,
        focus_status: "expired",
        goal_id: goal.id,
        ...goal,
      };
    } else {
      resolution = resolveGoal(focus, options.goalId, { now: options.now });
    }
    return { resolution, goal_id: resolution.goal_id, exception: null };
  }
  if (options.exceptionCategory || options.exceptionReason) {
    const resolution = resolveException(
      focus,
      options.exceptionCategory,
      options.exceptionReason,
      { now: options.now },
    );
    return { resolution, goal_id: null, exception: resolution.exception };
  }
  throw new WorkspaceRunError("ordinary work requires --goal; exceptions require --exception-category and --exception-reason");
}

function entranceClaimPath(stateRoot, identity, sessionKind = "repository") {
  const key = crypto.createHash("sha256").update(path.resolve(identity)).digest("hex");
  return sessionKind === "workspace"
    ? path.join(stateRoot, ".entrance", "workspace", `${key}.lock`)
    : path.join(stateRoot, ".entrance", `${key}.lock`);
}

function acquireEntranceClaim(stateRoot, identityPath, now = new Date(), sessionKind = "repository") {
  const claim = entranceClaimPath(stateRoot, identityPath, sessionKind);
  const directory = path.dirname(claim);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const identity = processIdentity(process.pid);
  if (!identity.process_start_token) {
    throw new WorkspaceRunError(`cannot read entrance process start token for PID ${identity.pid}`);
  }
  const identityField = sessionKind === "workspace" ? "workspace_root" : "git_common_dir";
  const payload = {
    schema: sessionKind === "workspace" ? "agent-workspace-entrance.v2" : "agent-workspace-entrance.v1",
    session_kind: sessionKind === "workspace" ? "workspace" : undefined,
    [identityField]: path.resolve(identityPath),
    acquired_at: iso(now),
    ...identity,
  };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const temporary = path.join(
      directory,
      `.${path.basename(claim)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`,
    );
    fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    try {
      fs.linkSync(temporary, claim);
      fs.unlinkSync(temporary);
      return claim;
    } catch (error) {
      fs.unlinkSync(temporary);
      if (error.code !== "EEXIST") throw error;
    }
    let existing;
    try {
      existing = JSON.parse(fs.readFileSync(claim, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw new WorkspaceRunError(`repository entrance claim is ambiguous: ${error.message}`);
    }
    const expectedSchema = sessionKind === "workspace" ? "agent-workspace-entrance.v2" : "agent-workspace-entrance.v1";
    if (existing.schema !== expectedSchema ||
        path.resolve(existing[identityField] || "") !== path.resolve(identityPath) ||
        !Number.isInteger(existing.pid) ||
        typeof existing.process_start_token !== "string" ||
        typeof existing.host !== "string") {
      throw new WorkspaceRunError(`${sessionKind} entrance claim is invalid: ${claim}`);
    }
    if (isLivingOwner(existing)) {
      throw new WorkspaceRunError(`${sessionKind} entrance is already in progress: ${identityPath}`);
    }
    const stale = `${claim}.stale.${process.pid}.${crypto.randomBytes(4).toString("hex")}`;
    try {
      fs.renameSync(claim, stale);
      fs.unlinkSync(stale);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw new WorkspaceRunError(`cannot reclaim dead ${sessionKind} entrance claim: ${error.message}`);
    }
  }
  throw new WorkspaceRunError(`${sessionKind} entrance claim changed repeatedly: ${identityPath}`);
}

function releaseEntranceClaim(claim) {
  try {
    fs.unlinkSync(claim);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function beginRun(options) {
  if (!options.root) throw new WorkspaceRunError("root is required");
  if (!String(options.tool || "").trim()) throw new WorkspaceRunError("tool is required");
  const stateRoot = options.stateRoot || DEFAULT_STATE_ROOT;
  const sessionKind = options.sessionKind || "repository";
  if (!["repository", "workspace"].includes(sessionKind)) {
    throw new WorkspaceRunError("session kind must be repository or workspace");
  }
  const focus = resolveFocus(options);
  const executionRef = validateOptionalExecutionRef(options.executionRef);
  const preflightMode = sessionKind === "workspace" ? "read" : "write";
  const preflight = preflightWorkspace(options.root, preflightMode, {
    agentcoordRoot: options.agentcoordRoot,
    quarantineRoot: options.quarantineRoot,
    stateRoot,
    now: options.now,
    sessionKind,
  });
  if (!preflight.ok) throw new WorkspaceRunError("workspace preflight refused begin", publicPreflight(preflight));

  if (sessionKind === "workspace" && !focus.goal_id && focus.exception) {
    throw new WorkspaceRunError("workspace operator exception sessions require --goal");
  }
  const entranceIdentity = sessionKind === "repository"
    ? preflight.observation.git_common_dir
    : preflight.observation.workspace_root;
  if (!entranceIdentity) throw new WorkspaceRunError(`${sessionKind} entrance identity is unavailable`);
  const entranceClaim = acquireEntranceClaim(stateRoot, entranceIdentity, options.now, sessionKind);
  try {
    if (typeof options.afterEntranceClaim === "function") {
      options.afterEntranceClaim(entranceClaim);
    }
    const confirmedPreflight = preflightWorkspace(options.root, preflightMode, {
      agentcoordRoot: options.agentcoordRoot,
      quarantineRoot: options.quarantineRoot,
      stateRoot,
      now: options.now,
      sessionKind,
    });
    if (!confirmedPreflight.ok) {
      throw new WorkspaceRunError(
        "workspace preflight refused begin after atomic entrance",
        publicPreflight(confirmedPreflight),
      );
    }
    const identity = processIdentity(options.pid || process.ppid);
    if (!identity.process_start_token) throw new WorkspaceRunError(`cannot read process start token for PID ${identity.pid}`);
    const runId = options.runId || makeRunId(options.now);
    const file = manifestPath(stateRoot, runId);
    if (fs.existsSync(file)) throw new WorkspaceRunError(`run manifest already exists: ${runId}`);
    const common = {
      schema: "agent-workspace-run.v2",
      session_kind: sessionKind,
      run_id: runId,
      goal_id: focus.goal_id,
      exception: focus.exception,
      execution_ref: executionRef,
      tool: String(options.tool).trim(),
      pid: identity.pid,
      process_start_token: identity.process_start_token,
      host: identity.host,
      created_at: iso(options.now),
      state: "starting",
      exit_code: null,
      quarantine_reason: null,
    };
    const base = sessionKind === "repository" ? {
      ...common,
      repository_root: confirmedPreflight.repository_root,
      git_common_dir: confirmedPreflight.observation.git_common_dir,
      canonical_remote: confirmedPreflight.canonical_remote,
      origin_push_urls: confirmedPreflight.origin_push_urls,
      branch: confirmedPreflight.branch,
      starting_head: confirmedPreflight.starting_head,
      ending_head: null,
    } : {
      ...common,
      workspace_root: confirmedPreflight.observation.workspace_root,
      authority: "operator",
      safety_class: "read",
    };
    atomicWrite(file, base);
    const active = { ...base, state: "active" };
    atomicWrite(file, active);
    return {
      file,
      manifest: active,
      focus: focus.resolution,
      preflight: publicPreflight(confirmedPreflight),
    };
  } finally {
    releaseEntranceClaim(entranceClaim);
  }
}

function inspectRepository(root) {
  const status = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const head = runGit(root, ["rev-parse", "HEAD"]);
  return {
    status_ok: status.ok,
    head_ok: head.ok,
    has_changes: status.ok ? Boolean(status.stdout) : null,
    status: status.stdout,
    status_error: status.stderr,
    head_error: head.stderr,
    ending_head: head.ok ? head.stdout : null,
  };
}

function controllerIdentity(options = {}, defaultPid = process.pid) {
  if (options.controllerIdentity !== undefined) {
    const identity = options.controllerIdentity;
    if (!identity || typeof identity !== "object" || Array.isArray(identity) ||
        !Number.isInteger(identity.pid) || identity.pid <= 0 ||
        typeof identity.process_start_token !== "string" || !identity.process_start_token ||
        typeof identity.host !== "string" || !identity.host) {
      throw new WorkspaceRunError("controller identity is ambiguous");
    }
    return {
      pid: identity.pid,
      process_start_token: identity.process_start_token,
      host: identity.host,
    };
  }
  const identity = processIdentity(options.pid || defaultPid);
  if (!identity.process_start_token) {
    throw new WorkspaceRunError(`controller identity is ambiguous for PID ${identity.pid}`);
  }
  return identity;
}

function sealRun(options) {
  const stateRoot = options.stateRoot || DEFAULT_STATE_ROOT;
  const file = manifestPath(stateRoot, options.runId);
  const manifest = readManifest(file);
  if (!ACTIVE_STATES.has(manifest.state)) {
    throw new WorkspaceRunError(`run ${manifest.run_id} is already ${manifest.state}`);
  }
  const localIdentity = processIdentity(process.pid);
  if (manifest.host !== localIdentity.host) {
    throw new WorkspaceRunError(
      `run ${manifest.run_id} owner host ${manifest.host} is not locally verifiable; ownership is ambiguous`,
    );
  }
  if (!isLivingOwner(manifest)) {
    throw new WorkspaceRunError(
      `run ${manifest.run_id} owner is no longer living; use agent-workspace reconcile`,
    );
  }
  const controller = controllerIdentity(options);
  if (controller.pid !== manifest.pid ||
      controller.process_start_token !== manifest.process_start_token ||
      controller.host !== manifest.host) {
    throw new WorkspaceRunError(`run ${manifest.run_id} is owned by another controller`);
  }
  const exitCode = Number(options.exitCode ?? 0);
  if (!Number.isInteger(exitCode)) throw new WorkspaceRunError("exit code must be an integer");
  if (manifest.session_kind === "workspace") {
    const next = {
      ...manifest,
      state: "sealed",
      exit_code: exitCode,
      sealed_at: iso(options.now),
    };
    atomicWrite(file, next);
    return { file, manifest: next };
  }
  const repository = inspectRepository(manifest.repository_root);
  const clean = repository.status_ok && repository.has_changes === false;
  const next = {
    ...manifest,
    state: clean ? "sealed" : "quarantined",
    exit_code: exitCode,
    ending_head: repository.ending_head,
    sealed_at: iso(options.now),
    quarantine_reason: clean
      ? null
      : repository.status_ok
        ? "working tree has uncommitted changes at seal"
        : `repository status ambiguous at seal: ${repository.status_error || "unknown error"}`,
  };
  atomicWrite(file, next);
  return { file, manifest: next };
}

function sameRepositoryIdentity(manifest, target) {
  const sameRoot = typeof manifest?.repository_root === "string" &&
    path.resolve(manifest.repository_root) === path.resolve(target.repository_root);
  const sameCommon = typeof manifest?.git_common_dir === "string" &&
    path.resolve(manifest.git_common_dir) === path.resolve(target.git_common_dir);
  return sameRoot || sameCommon;
}

function resolveRun(options) {
  const reason = String(options.reason || "").trim();
  if (!reason) throw new WorkspaceRunError("resolution reason is required");
  const stateRoot = options.stateRoot || DEFAULT_STATE_ROOT;
  const file = manifestPath(stateRoot, options.runId);
  const manifest = readManifest(file);
  if (manifest.state !== "quarantined") {
    throw new WorkspaceRunError(`run ${manifest.run_id} is ${manifest.state}, not quarantined`);
  }
  const localIdentity = processIdentity(process.pid);
  if (manifest.host !== localIdentity.host) {
    throw new WorkspaceRunError(
      `run ${manifest.run_id} owner host ${manifest.host} is not locally verifiable; ownership is ambiguous`,
    );
  }
  if (isLivingOwner(manifest)) {
    throw new WorkspaceRunError(`run ${manifest.run_id} owner is still living`);
  }

  const manifests = readManifests(stateRoot);
  for (const entry of manifests) {
    if (entry.file === file) continue;
    if (entry.errors?.length) {
      const raw = entry.raw_manifest;
      const hasIdentity = raw && typeof raw === "object" &&
        (typeof raw.repository_root === "string" || typeof raw.git_common_dir === "string");
      if (!hasIdentity || sameRepositoryIdentity(raw, manifest)) {
        throw new WorkspaceRunError(
          `cannot prove exclusive repository ownership because manifest ${entry.file} is invalid`,
        );
      }
      continue;
    }
    if (sameRepositoryIdentity(entry.manifest, manifest) &&
        ["starting", "active", "quarantined"].includes(entry.manifest.state) &&
        entry.living) {
      throw new WorkspaceRunError(
        `living run ${entry.manifest.run_id} owns the same Git common directory`,
      );
    }
  }

  const repository = inspectRepository(manifest.repository_root);
  if (!repository.status_ok) {
    throw new WorkspaceRunError(
      `repository status is unreadable: ${repository.status_error || "unknown error"}`,
    );
  }
  if (repository.has_changes) {
    throw new WorkspaceRunError("repository has uncommitted changes");
  }
  if (!repository.head_ok || !repository.ending_head) {
    throw new WorkspaceRunError(
      `repository HEAD is unreadable: ${repository.head_error || "unknown error"}`,
    );
  }

  const resolver = controllerIdentity(options);
  const next = {
    ...manifest,
    state: "resolved",
    resolved_at: iso(options.now),
    resolution_reason: reason,
    resolved_head: repository.ending_head,
    resolver,
  };
  atomicWrite(file, next);
  return { file, manifest: next };
}

function reconcileRuns(options = {}) {
  const stateRoot = options.stateRoot || DEFAULT_STATE_ROOT;
  const results = [];
  for (const entry of readManifests(stateRoot)) {
    if (entry.errors?.length) {
      results.push({
        file: entry.file,
        run_id: entry.raw_manifest?.run_id || null,
        action: "invalid_manifest",
        errors: entry.errors,
      });
      continue;
    }
    if (!ACTIVE_STATES.has(entry.manifest.state)) continue;
    if (isLivingOwner(entry.manifest)) {
      results.push({ file: entry.file, run_id: entry.manifest.run_id, action: "kept_active" });
      continue;
    }
    if (entry.manifest.session_kind === "workspace") {
      const next = { ...entry.manifest, state: "abandoned", reconciled_at: iso(options.now) };
      atomicWrite(entry.file, next);
      results.push({ file: entry.file, run_id: next.run_id, action: "marked_abandoned", manifest: next });
      continue;
    }
    const repository = inspectRepository(entry.manifest.repository_root);
    const clean = repository.status_ok && repository.has_changes === false;
    const next = {
      ...entry.manifest,
      state: clean ? "abandoned" : "quarantined",
      ending_head: repository.ending_head,
      reconciled_at: iso(options.now),
      quarantine_reason: clean
        ? null
        : repository.status_ok
          ? "dead or PID-reused owner left uncommitted changes"
          : `dead or PID-reused owner left ambiguous repository state: ${repository.status_error || "unknown error"}`,
    };
    atomicWrite(entry.file, next);
    results.push({
      file: entry.file,
      run_id: next.run_id,
      action: clean ? "marked_abandoned" : "marked_quarantined",
      manifest: next,
    });
  }
  return results;
}

function relevantRunStates(root, options = {}) {
  const resolved = path.resolve(root);
  const top = runGit(resolved, ["rev-parse", "--show-toplevel"]);
  const repositoryRoot = top.ok ? path.resolve(top.stdout) : resolved;
  const common = runGit(repositoryRoot, ["rev-parse", "--git-common-dir"]);
  const commonDir = common.ok ? path.resolve(repositoryRoot, common.stdout) : null;
  const workspaceRoot = top.ok ? null : (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? fs.realpathSync.native(resolved) : resolved);
  return readManifests(options.stateRoot || DEFAULT_STATE_ROOT)
    .filter(({ manifest }) => {
      if (!manifest) return false;
      const sameRoot = typeof manifest.repository_root === "string" &&
        path.resolve(manifest.repository_root) === repositoryRoot;
      const sameCommon = commonDir && typeof manifest.git_common_dir === "string" &&
        path.resolve(manifest.git_common_dir) === commonDir;
      const sameWorkspace = workspaceRoot && manifest.session_kind === "workspace" &&
        path.resolve(manifest.workspace_root) === workspaceRoot;
      return sameRoot || sameCommon || sameWorkspace;
    })
    .filter(({ manifest }) => ["starting", "active", "quarantined"].includes(manifest.state))
    .map(({ file, manifest, living }) => ({
      file,
      run_id: manifest.run_id,
      state: manifest.state,
      living,
      tool: manifest.tool,
      goal_id: manifest.goal_id,
      exception: manifest.exception,
      execution_ref: manifest.execution_ref || null,
      quarantine_reason: manifest.quarantine_reason,
    }));
}

module.exports = {
  WorkspaceRunError,
  acquireEntranceClaim,
  beginRun,
  entranceClaimPath,
  inspectRepository,
  makeRunId,
  manifestPath,
  readManifest,
  reconcileRuns,
  relevantRunStates,
  resolveRun,
  sealRun,
  validateOptionalExecutionRef,
};
