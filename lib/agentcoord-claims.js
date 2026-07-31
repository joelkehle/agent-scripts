"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SAFETY = new Set(["read", "propose", "write"]);

function walkClaimFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkClaimFiles(file));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(file);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function parseTimestamp(value) {
  if (!value || typeof value !== "string") return null;
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return new Date(direct);
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(Z|[+-]\d{2}:?\d{2})$/);
  if (!match) return null;
  const parsed = Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}${match[5]}`);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function normalizeTimestamp(value) {
  const date = parseTimestamp(value);
  return date ? date.toISOString().replace(/\.\d{3}Z$/, "Z") : value || "";
}

function claimDirectoryIdentity(claimsRoot, file) {
  const relative = path.relative(claimsRoot, path.dirname(file));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return "";
  return relative.split(path.sep).filter(Boolean).join("/");
}

function validateClaim(data) {
  const issues = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["claim must be a JSON object"];
  }
  for (const field of [
    "repo",
    "slug",
    "agent",
    "host",
    "safety",
    "scope",
    "started_at",
    "expires_at",
    "next_action",
  ]) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      issues.push(`missing ${field}`);
    }
  }
  if (data.safety && !SAFETY.has(data.safety)) issues.push(`invalid safety ${data.safety}`);
  if (data.scope && !Array.isArray(data.scope)) issues.push("scope must be an array");
  if (Array.isArray(data.scope) && data.scope.length === 0) {
    issues.push("scope must contain at least one entry");
  }

  const started = parseTimestamp(data.started_at);
  const expires = parseTimestamp(data.expires_at);
  if (!started) issues.push("invalid started_at");
  if (!expires) issues.push("invalid expires_at");
  return issues;
}

function readClaim(file, options = {}) {
  const now = options.now || new Date();
  const claimsRoot = options.claimsRoot || path.dirname(file);
  const directory_repo = claimDirectoryIdentity(claimsRoot, file);
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return {
      file,
      data: null,
      directory_repo,
      status: "invalid",
      issues: [`invalid JSON: ${error.message}`],
      started: null,
      expires: null,
    };
  }

  const issues = validateClaim(data);
  const started = parseTimestamp(data.started_at);
  const expires = parseTimestamp(data.expires_at);
  let status = "invalid";
  if (!issues.length) {
    status = data.released_at
      ? "released"
      : expires.getTime() < now.getTime()
        ? "stale"
        : "active";
  }
  return { file, data, directory_repo, status, issues, started, expires };
}

function readClaims(root, now = new Date()) {
  const claimsRoot = path.join(root, "claims");
  return walkClaimFiles(claimsRoot).map((file) => readClaim(file, { claimsRoot, now }));
}

module.exports = {
  SAFETY,
  claimDirectoryIdentity,
  normalizeTimestamp,
  parseTimestamp,
  readClaim,
  readClaims,
  validateClaim,
  walkClaimFiles,
};
