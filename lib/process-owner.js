"use strict";

const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

function processStartToken(pid) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) return null;
  try {
    const stat = fs.readFileSync(`/proc/${numericPid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    const fields = stat.slice(close + 2).trim().split(/\s+/);
    if (close < 0 || !fields[19]) return null;
    return `linux:${fields[19]}`;
  } catch {
    const result = spawnSync("ps", ["-o", "lstart=", "-p", String(numericPid)], {
      encoding: "utf8",
      timeout: 1000,
    });
    const started = result.status === 0 ? result.stdout.trim().replace(/\s+/g, " ") : "";
    return started ? `ps:${started}` : null;
  }
}

function processIdentity(pid = process.pid) {
  return {
    pid: Number(pid),
    process_start_token: processStartToken(pid),
    host: os.hostname().split(".")[0],
  };
}

function isLivingOwner(owner) {
  if (!owner || owner.host !== os.hostname().split(".")[0]) return false;
  const token = processStartToken(owner.pid);
  return Boolean(token && owner.process_start_token && token === owner.process_start_token);
}

module.exports = { isLivingOwner, processIdentity, processStartToken };
