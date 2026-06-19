const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

async function sendEmail(record) {
  const secret = ensureSecret(record.secret_file);
  await registerNotifier(record, secret);
  const conversationID = `codex-bg-${record.run_id}`;
  const requestID = `${record.run_id}-notify`;
  const body = JSON.stringify({
    action: "send",
    message: {
      to: [record.email_to],
      subject: `[Codex job done] ${record.name}: ${record.status}`,
      body_text: emailBody(record),
    },
  });
  const payload = JSON.stringify({
    to: record.gmail_agent,
    from: record.notifier_agent,
    conversation_id: conversationID,
    request_id: requestID,
    type: "request",
    body,
    ttl: 600,
    meta: { purpose: "codex-bg-notify", run_id: record.run_id, safety_class: "write" },
  });
  const sent = await postJSON(`${record.bus_url}/v1/messages`, payload, {
    "X-Bus-Signature": sign(secret, payload),
  });
  const messageID = sent.message_id;
  if (!messageID) throw new Error("bus returned empty message_id");
  const final = await observeFinal(record, secret, conversationID, messageID);
  return { message_id: messageID, final };
}

async function registerNotifier(record, secret) {
  const payload = JSON.stringify({
    agent_id: record.notifier_agent,
    secret,
    capabilities: ["codex-bg-notify"],
    version: "0.1.0",
    description: "Codex background job completion notifier.",
    agent_class: "worker",
    mutation_class: "mutate",
    mode: "pull",
    ttl: 900,
    meta: { owner: "shared/agent-scripts", purpose: "codex-bg email notification" },
  });
  await postJSON(`${record.bus_url}/v1/agents/register`, payload, {});
}

async function observeFinal(record, secret, conversationID, messageID) {
  const query = `agent_id=${encodeURIComponent(record.notifier_agent)}&conversation_id=${encodeURIComponent(conversationID)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${record.bus_url}/v1/observe?${query}`, {
      signal: controller.signal,
      headers: {
        "X-Agent-ID": record.notifier_agent,
        "X-Bus-Signature": sign(secret, query),
      },
    });
    if (!response.ok) throw new Error(`observe failed HTTP ${response.status}: ${await response.text()}`);
    return await readObserveStream(response, messageID);
  } finally {
    clearTimeout(timer);
  }
}

async function readObserveStream(response, messageID) {
  if (!response.body || !response.body.getReader) {
    return parseObserve(response.text ? await response.text() : "", messageID);
  }
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\n\n+/);
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const result = parseObserveFrame(frame, messageID);
      if (result.done) return result.body;
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    const result = parseObserveFrame(buffer, messageID);
    if (result.done) return result.body;
  }
  throw new Error(`observe ended before final event for ${messageID}`);
}

function parseObserve(text, messageID) {
  for (const frame of text.split(/\n\n+/)) {
    const result = parseObserveFrame(frame, messageID);
    if (result.done) return result.body;
  }
  throw new Error(`observe ended before final event for ${messageID}`);
}

function parseObserveFrame(frame, messageID) {
  const event = {};
  for (const line of frame.split("\n")) {
    if (line.startsWith("id:")) event.id = line.slice(3).trim();
    if (line.startsWith("event:")) event.event = line.slice(6).trim();
    if (line.startsWith("data:")) event.data = (event.data || "") + line.slice(5).trim();
  }
  if (event.event !== "state_change" || !event.data) return { done: false };
  const data = JSON.parse(event.data);
  if (data.message_id !== messageID) return { done: false };
  if (data.to_state === "error") throw new Error(data.error || "email message errored");
  if (data.to_state === "completed") return { done: true, body: data.body || "" };
  return { done: false };
}

async function postJSON(url, body, headers) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function emailBody(record) {
  return [
    `Status: ${record.status}`,
    `Run id: ${record.run_id}`,
    `Duration: ${formatDuration(record.duration_ms || 0)}`,
    `Exit code: ${record.exit_code}`,
    "",
    `Summary: ${record.summary_file}`,
    record.proof_url ? `Proof: ${record.proof_url}` : "",
    `Logs: ${record.run_dir}`,
    "",
    "Resume:",
    `cd ${record.cwd}`,
    record.resume_command,
    "",
    jobSummary(record),
  ].filter((line) => line !== "").join("\n");
}

function jobSummary(record) {
  if (!record.job_summary_file || !fs.existsSync(record.job_summary_file)) return "";
  return redact(fs.readFileSync(record.job_summary_file, "utf8")).slice(0, 8000);
}

function ensureSecret(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString("hex") + "\n", { mode: 0o600 });
  }
  return fs.readFileSync(file, "utf8").trim();
}

function sign(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function redact(value) {
  return String(value)
    .replace(/hf_[A-Za-z0-9_=-]{8,}/g, "hf_[REDACTED]")
    .replace(/sk-[A-Za-z0-9_=-]{8,}/g, "sk-[REDACTED]")
    .replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, "$1[REDACTED]");
}

module.exports = {
  sendEmail,
};
