const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("node:http");
const { cpSync, mkdirSync, mkdtempSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

const REPO = path.resolve(__dirname, "..");
const PLUGIN = path.join(REPO, "workspace-roots/projects/plugins/joel-agent-ops");
const BRIDGE = path.join(PLUGIN, "mcp/manager-mission-bridge.mjs");
const NAMES = ["preflight_agent_mission", "start_agent_mission", "check_agent_mission"];

function tool(name) {
  const readOnly = name !== "start_agent_mission";
  return {
    name,
    description: `${name} description`,
    inputSchema: { type: "object", properties: { project_id: { type: "string" } } },
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: !readOnly,
      idempotentHint: readOnly,
      openWorldHint: false,
    },
  };
}

async function fakeManager(replyFor) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const parsed = JSON.parse(body);
    requests.push(parsed);
    const reply = await replyFor(parsed);
    response.statusCode = reply.status ?? 200;
    response.setHeader("content-type", "application/json");
    response.end(reply.body ?? JSON.stringify(reply.payload));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return { server, requests, url: `http://127.0.0.1:${port}/mcp` };
}

function startBridge(url, bridgePath = BRIDGE, cwd = PLUGIN) {
  const child = spawn(process.execPath, [bridgePath], {
    cwd,
    env: { ...process.env, MANAGER_MISSION_BRIDGE_URL: url },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  const waiters = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    while (stdout.includes("\n")) {
      const end = stdout.indexOf("\n");
      const line = stdout.slice(0, end);
      stdout = stdout.slice(end + 1);
      const waiter = waiters.shift();
      if (waiter) waiter(JSON.parse(line));
    }
  });
  function send(value, raw = false) {
    return new Promise((resolve) => {
      waiters.push(resolve);
      child.stdin.write(`${raw ? value : JSON.stringify(value)}\n`);
    });
  }
  async function stop() {
    child.stdin.end();
    await once(child, "exit");
    assert.equal(stderr, "");
  }
  return { send, stop };
}

function normalReply(request) {
  if (request.method === "tools/list") {
    return {
      payload: {
        jsonrpc: "2.0",
        id: request.id,
        result: { tools: [...NAMES.map(tool), tool("delete_everything")] },
      },
    };
  }
  return { payload: { jsonrpc: "2.0", id: request.id, result: { echoed: request.params } } };
}

test("handshake and ping stay inside the bridge", async () => {
  const manager = await fakeManager(normalReply);
  const bridge = startBridge(manager.url);
  const initialized = await bridge.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(initialized.result.serverInfo.name, "manager-mission-operator");
  const ping = await bridge.send({ jsonrpc: "2.0", id: 2, method: "ping" });
  assert.deepEqual(ping.result, {});
  assert.equal(manager.requests.length, 0);
  await bridge.stop();
  manager.server.close();
});

test("tool list keeps exactly three live definitions and safety labels", async () => {
  const manager = await fakeManager(normalReply);
  const bridge = startBridge(manager.url);
  const response = await bridge.send({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
  assert.deepEqual(response.result.tools.map(({ name }) => name), NAMES);
  for (const liveTool of response.result.tools) assert.deepEqual(liveTool, tool(liveTool.name));
  assert.equal(manager.requests.length, 1);
  await bridge.stop();
  manager.server.close();
});

test("only the three allowed tool calls reach Manager unchanged", async () => {
  const manager = await fakeManager(normalReply);
  const bridge = startBridge(manager.url);
  for (const [index, name] of NAMES.entries()) {
    const request = {
      jsonrpc: "2.0",
      id: 10 + index,
      method: "tools/call",
      params: { name, arguments: { project_id: "shared-agent-scripts" } },
    };
    const response = await bridge.send(request);
    assert.deepEqual(response.result.echoed, request.params);
    assert.deepEqual(manager.requests.at(-1), request);
  }
  const before = manager.requests.length;
  const refused = await bridge.send({
    jsonrpc: "2.0",
    id: 20,
    method: "tools/call",
    params: { name: "delete_everything", arguments: {} },
  });
  assert.equal(refused.error.code, -32602);
  assert.equal(manager.requests.length, before);
  await bridge.stop();
  manager.server.close();
});

test("other methods, batches, bad JSON, and unsafe labels fail before Manager", async () => {
  const manager = await fakeManager((request) => {
    const reply = normalReply(request);
    if (request.method === "tools/list") reply.payload.result.tools[1].annotations.readOnlyHint = true;
    return reply;
  });
  const bridge = startBridge(manager.url);
  const method = await bridge.send({ jsonrpc: "2.0", id: 30, method: "resources/list" });
  assert.equal(method.error.code, -32601);
  const batch = await bridge.send([{ jsonrpc: "2.0", id: 31, method: "ping" }]);
  assert.match(batch.error.message, /Batch/);
  const parse = await bridge.send("{broken", true);
  assert.equal(parse.error.code, -32700);
  const unsafe = await bridge.send({ jsonrpc: "2.0", id: 32, method: "tools/list" });
  assert.match(unsafe.error.message, /unsafe readOnlyHint/);
  assert.equal(manager.requests.length, 1);
  await bridge.stop();
  manager.server.close();
});

test("upstream outages and malformed replies fail clearly", async () => {
  const manager = await fakeManager(() => ({ body: "not json" }));
  const malformedBridge = startBridge(manager.url);
  const malformed = await malformedBridge.send({ jsonrpc: "2.0", id: 40, method: "tools/list" });
  assert.match(malformed.error.message, /invalid JSON/);
  await malformedBridge.stop();
  await new Promise((resolve) => manager.server.close(resolve));

  const downBridge = startBridge(manager.url);
  const down = await downBridge.send({ jsonrpc: "2.0", id: 41, method: "tools/list" });
  assert.equal(down.error.code, -32000);
  assert.match(down.error.message, /fetch failed|ECONNREFUSED/i);
  await downBridge.stop();
});

test("a copied plugin bundle starts the same narrow bridge", async () => {
  const copy = mkdtempSync(path.join(tmpdir(), "joel-agent-ops-copy-"));
  mkdirSync(path.join(copy, "mcp"));
  cpSync(BRIDGE, path.join(copy, "mcp/manager-mission-bridge.mjs"));
  cpSync(path.join(PLUGIN, ".mcp.json"), path.join(copy, ".mcp.json"));
  const config = JSON.parse(readFileSync(path.join(copy, ".mcp.json"), "utf8"));
  assert.deepEqual(config.mcpServers["manager-mission-operator"].enabled_tools, NAMES);
  assert.equal(config.mcpServers["manager-mission-operator"].default_tools_approval_mode, "writes");

  const manager = await fakeManager(normalReply);
  const bridge = startBridge(manager.url, path.join(copy, "mcp/manager-mission-bridge.mjs"), copy);
  const response = await bridge.send({ jsonrpc: "2.0", id: 50, method: "tools/list", params: {} });
  assert.deepEqual(response.result.tools.map(({ name }) => name), NAMES);
  await bridge.stop();
  manager.server.close();
});
