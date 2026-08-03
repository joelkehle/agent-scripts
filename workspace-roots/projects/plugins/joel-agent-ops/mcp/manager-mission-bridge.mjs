#!/usr/bin/env node

import readline from "node:readline";

const DEFAULT_UPSTREAM = "http://127.0.0.1:8228/mcp";
const REQUEST_TIMEOUT_MS = 10_000;
const ALLOWED_TOOLS = Object.freeze([
  "preflight_agent_mission",
  "start_agent_mission",
  "check_agent_mission",
]);
const ALLOWED_TOOL_SET = new Set(ALLOWED_TOOLS);
const EXPECTED_ANNOTATIONS = Object.freeze({
  preflight_agent_mission: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  start_agent_mission: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  check_agent_mission: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

function upstreamURL() {
  const raw = process.env.MANAGER_MISSION_BRIDGE_URL || DEFAULT_UPSTREAM;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Manager upstream URL is invalid");
  }
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1") {
    throw new Error("Manager upstream must use loopback HTTP at 127.0.0.1");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/mcp") {
    throw new Error("Manager upstream must be a plain loopback /mcp URL");
  }
  return parsed.toString();
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function errorMessage(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function isRequest(value) {
  return value !== null && !Array.isArray(value) && typeof value === "object" &&
    value.jsonrpc === "2.0" && typeof value.method === "string";
}

function validateAnnotations(tool) {
  const expected = EXPECTED_ANNOTATIONS[tool.name];
  if (!tool.annotations || typeof tool.annotations !== "object") {
    throw new Error(`Manager tool ${tool.name} lacks safety labels`);
  }
  for (const [key, value] of Object.entries(expected)) {
    if (tool.annotations[key] !== value) {
      throw new Error(`Manager tool ${tool.name} has an unsafe ${key} label`);
    }
  }
}

async function callUpstream(request) {
  const response = await fetch(upstreamURL(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Manager returned HTTP ${response.status}`);
  }
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Manager returned invalid JSON");
  }
  if (!payload || Array.isArray(payload) || typeof payload !== "object" ||
      payload.jsonrpc !== "2.0" || payload.id !== request.id ||
      (payload.result === undefined) === (payload.error === undefined)) {
    throw new Error("Manager returned an invalid JSON-RPC reply");
  }
  return payload;
}

async function listTools(request) {
  const upstream = await callUpstream(request);
  if (upstream.error) return upstream;
  if (!upstream.result || !Array.isArray(upstream.result.tools)) {
    throw new Error("Manager returned an invalid tool list");
  }

  const byName = new Map();
  for (const tool of upstream.result.tools) {
    if (!tool || typeof tool !== "object" || typeof tool.name !== "string") continue;
    if (!ALLOWED_TOOL_SET.has(tool.name)) continue;
    if (byName.has(tool.name)) throw new Error(`Manager returned duplicate tool ${tool.name}`);
    byName.set(tool.name, tool);
  }
  for (const name of ALLOWED_TOOLS) {
    if (!byName.has(name)) throw new Error(`Manager did not offer required tool ${name}`);
    validateAnnotations(byName.get(name));
  }

  return {
    jsonrpc: "2.0",
    id: request.id,
    result: { tools: ALLOWED_TOOLS.map((name) => byName.get(name)) },
  };
}

async function handle(request) {
  if (!isRequest(request)) {
    return errorMessage(request?.id, -32600, "Invalid Request");
  }
  if (request.id === undefined) {
    // The initialized notice is the only notification this bridge accepts.
    return null;
  }

  if (request.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "manager-mission-operator", version: "1.0.0" },
      },
    };
  }
  if (request.method === "ping") {
    return { jsonrpc: "2.0", id: request.id, result: {} };
  }
  if (request.method === "tools/list") {
    return listTools(request);
  }
  if (request.method === "tools/call") {
    const name = request.params?.name;
    if (typeof name !== "string" || !ALLOWED_TOOL_SET.has(name)) {
      return errorMessage(request.id, -32602, "Tool is not allowed");
    }
    return callUpstream(request);
  }
  return errorMessage(request.id, -32601, "Method not found");
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

lines.on("line", async (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    writeMessage(errorMessage(null, -32700, "Parse error"));
    return;
  }
  if (Array.isArray(request)) {
    writeMessage(errorMessage(null, -32600, "Batch requests are not allowed"));
    return;
  }
  try {
    const response = await handle(request);
    if (response) writeMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manager request failed";
    writeMessage(errorMessage(request?.id, -32000, message));
  }
});

lines.on("close", () => {
  process.exitCode = 0;
});
