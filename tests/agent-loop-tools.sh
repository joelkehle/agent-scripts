#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$repo_root/bin:$PATH"
unset AGENT_CHECK_ACTIVE

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
timeout_cmd=""
if command -v timeout >/dev/null 2>&1; then
  timeout_cmd="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  timeout_cmd="gtimeout"
fi

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"

  if ! printf '%s\n' "$haystack" | grep -Fq -- "$needle"; then
    printf 'output:\n%s\n' "$haystack" >&2
    fail "missing expected text: $needle"
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"

  if printf '%s\n' "$haystack" | grep -Fq -- "$needle"; then
    printf 'output:\n%s\n' "$haystack" >&2
    fail "unexpected text: $needle"
  fi
}

node <<'NODE'
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _test } = require("./lib/codex-bg-email");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-bg-email-"));
const emailSummary = path.join(dir, "email-summary.md");
const jobSummary = path.join(dir, "job-summary.md");
fs.writeFileSync(emailSummary, "All tests passed. GLM was faster than Gemma on this exam.\n");
fs.writeFileSync(jobSummary, '{"technical":true}\n');
const email = _test.emailBody({
  name: "model-bakeoff",
  status: "pass",
  run_id: "run-1",
  duration_ms: 1234,
  exit_code: 0,
  summary_file: "/tmp/summary.md",
  run_dir: "/tmp/run",
  cwd: "/tmp/project",
  resume_command: "codex resume session-1",
  email_summary_file: emailSummary,
  job_summary_file: jobSummary,
});
if (!email.includes("Plain English") || !email.includes("All tests passed. GLM was faster")) {
  throw new Error(`missing plain English section: ${email}`);
}
if (!email.includes("Details") || !email.includes("Technical Summary")) {
  throw new Error(`missing details sections: ${email}`);
}
const record = { gmail_agent: "jk-gmail-ingest", notifier_agent: "codex-bg-notifier" };
const response = _test.parseObserve([
  "id: 1",
  "event: state_change",
  'data: {"message_id":"m-request","from_state":"waiting","to_state":"error","error":"ack timeout"}',
  "",
  "id: 2",
  "event: message",
  'data: {"message_id":"m-response","type":"response","from":"jk-gmail-ingest","to":"codex-bg-notifier","body":"{\\"message_id\\":\\"gmail-123\\"}"}',
  "",
].join("\n"), "m-request", record);
if (!response.includes("gmail-123")) {
  throw new Error(`response parse failed: ${response}`);
}
let failed = false;
try {
  _test.parseObserve([
    "id: 2",
    "event: message",
    'data: {"message_id":"m-response","type":"response","from":"jk-gmail-ingest","to":"codex-bg-notifier","body":"{\\"error\\":\\"send failed\\"}"}',
    "",
  ].join("\n"), "m-request", record);
} catch (error) {
  failed = error.message === "send failed";
}
if (!failed) {
  throw new Error("response error parse failed");
}
NODE

session_uuid="11111111-2222-3333-4444-555555555555"
codex_home="$tmp/codex-home"
mkdir -p "$codex_home/sessions/2026/06/19"
printf '{}\n' > "$codex_home/sessions/2026/06/19/session-$session_uuid.jsonl"
detected_session="$(CODEX_HOME="$codex_home" codex-bg current-session-id)"
[ "$detected_session" = "$session_uuid" ] || fail "current-session-id = $detected_session, want $session_uuid"

bg_state="$tmp/codex-bg-runs"
bg_output="$(
  CODEX_BG_STATE_DIR="$bg_state" CODEX_HOME="$codex_home" \
    codex-bg start --name smoke --launcher foreground --session-id "$session_uuid" --cwd "$tmp" -- \
      bash -lc 'printf "hello stdout\n"; printf "hello stderr\n" >&2; printf "plain $CODEX_SESSION_ID\n" > "$CODEX_BG_EMAIL_FILE"; printf "summary $CODEX_SESSION_ID hf_abcdefghijk sk-abcdefghijk Authorization: Bearer secret-token\n" > "$CODEX_BG_SUMMARY_FILE"'
)"
assert_contains "$bg_output" "codex-bg: run_id="
bg_run_id="$(printf '%s\n' "$bg_output" | sed -n 's/^codex-bg: run_id=//p')"
[ -n "$bg_run_id" ] || fail "codex-bg run id not found"
bg_status="$(CODEX_BG_STATE_DIR="$bg_state" codex-bg status "$bg_run_id")"
assert_contains "$bg_status" "$bg_run_id pass"
assert_contains "$bg_status" "codex resume $session_uuid"
bg_stdout="$(CODEX_BG_STATE_DIR="$bg_state" codex-bg tail "$bg_run_id")"
bg_stderr="$(CODEX_BG_STATE_DIR="$bg_state" codex-bg tail "$bg_run_id" --stderr)"
assert_contains "$bg_stdout" "hello stdout"
assert_contains "$bg_stderr" "hello stderr"
bg_summary="$(cat "$bg_state/$bg_run_id/summary.md")"
assert_contains "$bg_summary" "codex resume $session_uuid"
assert_contains "$bg_summary" "summary $session_uuid"
assert_contains "$bg_summary" "hf_[REDACTED]"
assert_contains "$bg_summary" "sk-[REDACTED]"
assert_contains "$bg_summary" "Authorization: Bearer [REDACTED]"
assert_not_contains "$bg_summary" "hf_abcdefghijk"
assert_not_contains "$bg_summary" "secret-token"

coord_root="$tmp/AgentCoord"
mkdir -p "$coord_root/claims"
claim_output="$(AGENTCOORD_ROOT="$coord_root" agentcoord claim --repo shared/agent-scripts --slug launch-ritual --agent codex-test --host beelink --safety write --scope bin/agent-start --next-action "test claim" --ttl-hours 1)"
assert_contains "$claim_output" "agentcoord: claimed"
coord_list="$(AGENTCOORD_ROOT="$coord_root" agentcoord list)"
assert_contains "$coord_list" "active shared/agent-scripts launch-ritual codex-test beelink write"
coord_json="$(AGENTCOORD_ROOT="$coord_root" agentcoord list --json)"
assert_contains "$coord_json" '"active": 1'
coord_check="$(AGENTCOORD_ROOT="$coord_root" agentcoord check)"
assert_contains "$coord_check" "active=1"
AGENTCOORD_ROOT="$coord_root" agentcoord renew --repo shared/agent-scripts --slug launch-ritual --agent codex-test --host beelink --ttl-hours 2 --next-action "renewed" >/dev/null
coord_renewed="$(AGENTCOORD_ROOT="$coord_root" agentcoord list)"
assert_contains "$coord_renewed" "next=renewed"
AGENTCOORD_ROOT="$coord_root" agentcoord release --repo shared/agent-scripts --slug launch-ritual --agent codex-test --host beelink >/dev/null
coord_released="$(AGENTCOORD_ROOT="$coord_root" agentcoord list --all)"
assert_contains "$coord_released" "released shared/agent-scripts launch-ritual"

mkdir -p "$coord_root/claims/bad"
printf '%s\n' '{' \
  '  "repo": "bad",' \
  '  "slug": "bad",' \
  '  "agent": "codex",' \
  '  "host": "beelink",' \
  '  "safety": "write",' \
  '  "scope": ["bad"],' \
  '  "started_at": "2026-06-28T00-06-41Z",' \
  '  "expires_at": "not a date",' \
  '  "next_action": "bad"' \
  '}' > "$coord_root/claims/bad/bad.codex.beelink.json"
set +e
coord_invalid="$(AGENTCOORD_ROOT="$coord_root" agentcoord check 2>&1)"
coord_invalid_status=$?
set -e
[ "$coord_invalid_status" -eq 1 ] || fail "agentcoord invalid status = $coord_invalid_status, want 1"
assert_contains "$coord_invalid" "invalid=1"
assert_contains "$coord_invalid" "invalid expires_at"

sweep_root="$tmp/AgentCoordSweep"
mkdir -p "$sweep_root/claims/sweep"
node - "$sweep_root" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[2];
const now = Date.now();
function iso(ms) { return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z"); }
function write(name, expiresAt) {
  const claim = {
    repo: "sweep",
    slug: name,
    agent: "codex-test",
    host: "beelink",
    safety: "write",
    scope: [name],
    started_at: iso(now - 15 * 86400000),
    expires_at: expiresAt,
    next_action: `${name} next action`,
    contact: "Joel Kehle <joel@kehle.com>"
  };
  fs.writeFileSync(path.join(root, "claims", "sweep", `${name}.codex-test.beelink.json`), `${JSON.stringify(claim, null, 2)}\n`);
}
write("old-stale", iso(now - 10 * 86400000));
write("recent-stale", iso(now - 2 * 86400000));
write("active", iso(now + 2 * 86400000));
NODE
old_stale_file="$sweep_root/claims/sweep/old-stale.codex-test.beelink.json"
recent_stale_file="$sweep_root/claims/sweep/recent-stale.codex-test.beelink.json"
sweep_dry="$(AGENTCOORD_ROOT="$sweep_root" agentcoord sweep --stale-after-days 7)"
assert_contains "$sweep_dry" "janitor dry-run stale=2 eligible=1 skipped_recent=1 released=0 invalid=0 errors=0 stale_after_days=7"
assert_contains "$sweep_dry" "old-stale"
assert_contains "$sweep_dry" "skipped 1 recent stale"
[ -f "$old_stale_file" ] || fail "old stale claim deleted during dry-run"
assert_not_contains "$(cat "$old_stale_file")" "released_at"
sweep_apply="$(AGENTCOORD_ROOT="$sweep_root" agentcoord sweep --apply --stale-after-days 7 --json)"
assert_contains "$sweep_apply" '"released": 1'
assert_contains "$sweep_apply" '"skipped_recent": 1'
[ -f "$old_stale_file" ] || fail "old stale claim deleted during apply"
[ -f "$recent_stale_file" ] || fail "recent stale claim deleted during apply"
old_stale_json="$(cat "$old_stale_file")"
recent_stale_json="$(cat "$recent_stale_file")"
assert_contains "$old_stale_json" '"released_by": "agentcoord-janitor"'
assert_contains "$old_stale_json" '"release_reason": "expired without renewal after'
assert_contains "$old_stale_json" '"previous_status": "stale"'
assert_contains "$old_stale_json" '"stale_since":'
assert_not_contains "$recent_stale_json" '"released_at"'
sweep_after="$(AGENTCOORD_ROOT="$sweep_root" agentcoord list --all)"
assert_contains "$sweep_after" "released sweep old-stale"
assert_contains "$sweep_after" "stale sweep recent-stale"
assert_contains "$sweep_after" "active sweep active"

set +e
bg_fail_output="$(
  CODEX_BG_STATE_DIR="$bg_state" CODEX_HOME="$codex_home" \
    codex-bg start --name fail --launcher foreground --session-id "$session_uuid" --cwd "$tmp" -- \
      bash -lc 'exit 7' 2>&1
)"
bg_fail_status=$?
set -e
[ "$bg_fail_status" -eq 7 ] || fail "codex-bg failure status = $bg_fail_status, want 7"
bg_fail_run_id="$(printf '%s\n' "$bg_fail_output" | sed -n 's/^codex-bg: run_id=//p')"
[ -n "$bg_fail_run_id" ] || fail "codex-bg failed run id not found"
set +e
bg_failed_status="$(CODEX_BG_STATE_DIR="$bg_state" codex-bg status "$bg_fail_run_id" 2>&1)"
bg_failed_status_code=$?
set -e
[ "$bg_failed_status_code" -eq 1 ] || fail "codex-bg status failed exit = $bg_failed_status_code, want 1"
assert_contains "$bg_failed_status" "$bg_fail_run_id fail"

empty="$tmp/empty"
mkdir -p "$empty"
set +e
empty_output="$(cd "$repo_root" && agent-check --root "$empty" --dry-run 2>&1)"
empty_status=$?
set -e
[ "$empty_status" -eq 1 ] || fail "empty root status = $empty_status, want 1"
assert_contains "$empty_output" "agent-check: no validation command found in $empty"

recursive="$tmp/recursive"
mkdir -p "$recursive"
cat > "$recursive/package.json" <<'JSON'
{
  "scripts": {
    "agent:check": "agent-check --dry-run",
    "test": "printf recursive-fallback"
  }
}
JSON
if [ -n "$timeout_cmd" ]; then
  recursive_output="$("$timeout_cmd" 10 agent-check --root "$recursive" 2>&1)"
else
  recursive_output="$(agent-check --root "$recursive" 2>&1)"
fi
assert_contains "$recursive_output" "agent-check: command=npm run agent:check"
assert_contains "$recursive_output" "agent-check: command=npm test"

home="$tmp/home"
workspace="$tmp/Projects"
mkdir -p "$home/.codex" "$workspace"
printf 'project_doc_max_bytes = 70000\n' > "$home/.codex/config.toml"

for install in "$home/.agents/skills" "$workspace/.agents/skills"; do
  for skill in ship-loop review-loop repair-loop learn-loop hygiene-loop; do
    mkdir -p "$install/$skill"
    printf -- '---\nname: %s\n---\n' "$skill" > "$install/$skill/SKILL.md"
  done
done

make_repo="$workspace/make-only"
mkdir -p "$make_repo"
cat > "$make_repo/Makefile" <<'MAKE'
agent-check:
	@printf make-ok
MAKE

script_repo="$workspace/script-only"
mkdir -p "$script_repo/scripts"
cat > "$script_repo/scripts/agent-check.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf script-ok
SH
chmod +x "$script_repo/scripts/agent-check.sh"

blocked_repo="$workspace/blocked-fixture"
mkdir -p "$blocked_repo/scripts"
cat > "$blocked_repo/package.json" <<'JSON'
{
  "scripts": {
    "test": "printf blocked"
  }
}
JSON
cat > "$blocked_repo/AGENTS.md" <<'MD'
blocked fixture should not be read
MD
git -C "$blocked_repo" init -q
git -C "$blocked_repo" config user.email "agent-loop-test@example.com"
git -C "$blocked_repo" config user.name "Agent Loop Test"
git -C "$blocked_repo" add package.json AGENTS.md
git -C "$blocked_repo" commit -q -m "init"
printf 'dirty\n' >> "$blocked_repo/AGENTS.md"

large_repo="$workspace/large-instructions"
mkdir -p "$large_repo"
printf '{"scripts":{"test":"printf large"}}\n' > "$large_repo/package.json"
awk 'BEGIN { for (i = 0; i < 17000; i++) printf "x" }' > "$large_repo/AGENTS.md"

audit_output="$(HOME="$home" AGENT_OFF_LIMIT_NAMES="blocked-fixture" loop-audit "$workspace")"
assert_contains "$audit_output" "OK $home/.codex/config.toml project_doc_max_bytes=70000"
assert_contains "$audit_output" "OK $home/.agents/skills/ship-loop/SKILL.md"
assert_contains "$audit_output" "OK $workspace/.agents/skills/ship-loop/SKILL.md"
assert_contains "$audit_output" "OK $home/.agents/skills/hygiene-loop/SKILL.md"
assert_contains "$audit_output" "OK $workspace/.agents/skills/hygiene-loop/SKILL.md"
assert_contains "$audit_output" "OK make-only -> make agent-check"
assert_contains "$audit_output" "OK script-only -> scripts/agent-check.sh"
assert_contains "$audit_output" "WARN   17000 large-instructions/AGENTS.md"
assert_not_contains "$audit_output" "blocked-fixture"

dirty_repo="$workspace/dirty-repo"
agent_start_card="$tmp/agent-start/card.json"
agent_start_output="$(AGENTCOORD_ROOT="$coord_root" agent-start --root "$make_repo" --no-bus --card "$agent_start_card")"
assert_contains "$agent_start_output" "Agent Start"
assert_contains "$agent_start_output" "== Tool Visibility =="
assert_contains "$agent_start_output" "== AgentCoord Active Claims =="
[ -f "$agent_start_card" ] || fail "agent-start card missing"
agent_start_json="$(cat "$agent_start_card")"
assert_contains "$agent_start_json" '"label": "Coding-agent startup brief"'
assert_contains "$agent_start_json" '"safetyClass": "read"'
assert_contains "$agent_start_json" '"workbench"'
assert_contains "$agent_start_json" '"results"'

workbench_summary="$tmp/workbench-summary.json"
cat > "$workbench_summary" <<'JSON'
{
  "summary": {
    "label": "Coding-agent workbench",
    "shouldSurface": false,
    "surfaceReasons": [],
    "counts": {
      "missingTools": 0,
      "complianceAlerts": 0
    }
  },
  "artifacts": {
    "latestUrl": "http://example.test/workbench/latest/"
  }
}
JSON
notice_clean="$(agent-start --notice --mode read --workbench-summary "$workbench_summary" --workbench-url http://fallback.test/latest/)"
[ "$notice_clean" = "" ] || fail "clean notice should be quiet, got: $notice_clean"

cat > "$workbench_summary" <<'JSON'
{
  "summary": {
    "label": "Coding-agent workbench",
    "shouldSurface": true,
    "surfaceReasons": [
      "missing tool: codex",
      "Machine Compliance failed"
    ],
    "counts": {
      "missingTools": 1,
      "complianceAlerts": 1
    }
  },
  "artifacts": {
    "latestUrl": "http://example.test/workbench/latest/"
  }
}
JSON
notice_warn="$(agent-start --notice --mode read --workbench-summary "$workbench_summary" --workbench-url http://fallback.test/latest/)"
assert_contains "$notice_warn" "Agent workbench warning: 2 issues"
assert_contains "$notice_warn" "- missing tool: codex"
assert_contains "$notice_warn" "Proof: http://example.test/workbench/latest/"
notice_missing="$(agent-start --notice --mode read --workbench-summary "$tmp/missing-workbench.json" --workbench-url http://fallback.test/latest/)"
assert_contains "$notice_missing" "Agent workbench warning: workbench summary unavailable"
assert_contains "$notice_missing" "Proof: http://fallback.test/latest/"

mkdir -p "$dirty_repo/proofs/run"
git -C "$dirty_repo" init -q
git -C "$dirty_repo" config user.email "agent-loop-test@example.com"
git -C "$dirty_repo" config user.name "Agent Loop Test"
printf '{"scripts":{"test":"printf test-ok"}}\n' > "$dirty_repo/package.json"
printf 'initial\n' > "$dirty_repo/README.md"
git -C "$dirty_repo" add package.json README.md
git -C "$dirty_repo" commit -q -m "init"
printf 'changed\n' >> "$dirty_repo/README.md"
printf '<html>proof</html>\n' > "$dirty_repo/proofs/run/index.html"
dirty_output="$(dirty-audit "$workspace")"
assert_contains "$dirty_output" "dirty-repo"
assert_contains "$dirty_output" "generated/proof: 1"
assert_contains "$dirty_output" "split generated/proof artifacts"
dirty_json="$(AGENT_OFF_LIMIT_NAMES="blocked-fixture" dirty-audit "$workspace" --json)"
assert_contains "$dirty_json" '"repo": "dirty-repo"'
assert_contains "$dirty_json" '"validation": "npm test"'
assert_not_contains "$dirty_json" "blocked-fixture"

receipt_repo="$workspace/receipt-repo"
mkdir -p "$receipt_repo/src"
cat > "$receipt_repo/package.json" <<'JSON'
{
  "scripts": {
    "test": "printf test-ok"
  }
}
JSON
printf 'hello\n' > "$receipt_repo/src/app.txt"
state_dir="$tmp/loop-state"
receipt_path="$(AGENT_LOOP_STATE_DIR="$state_dir" loop-receipt --root "$receipt_repo" --goal "Ship loop receipts" --status pass --next-loop review-loop --check "agent-check=pass" --file src/app.txt --note "ready for review" --print-path)"
[ -f "$receipt_path" ] || fail "receipt path not written: $receipt_path"
second_receipt_path="$(AGENT_LOOP_STATE_DIR="$state_dir" loop-receipt --root "$receipt_repo" --goal "Second receipt" --status pass --next-loop review-loop --check "agent-check=pass" --file src/app.txt --print-path)"
[ -f "$second_receipt_path" ] || fail "second receipt path not written: $second_receipt_path"
[ "$receipt_path" != "$second_receipt_path" ] || fail "back-to-back receipts reused the same path"
resume_output="$(AGENT_LOOP_STATE_DIR="$state_dir" loop-resume --root "$receipt_repo")"
assert_contains "$resume_output" "Goal: Second receipt"
assert_contains "$resume_output" "Next loop: review-loop"
assert_contains "$resume_output" "agent-check: pass"
assert_contains "$resume_output" '$review-loop continue from loop receipt'

non_git_repo="$workspace/non-git-receipt-repo"
mkdir -p "$non_git_repo"
printf '{"scripts":{"test":"printf test-ok"}}\n' > "$non_git_repo/package.json"
non_git_receipt_path="$(AGENT_LOOP_STATE_DIR="$state_dir" loop-receipt --root "$non_git_repo" --goal "Non-git receipt" --status pass --next-loop none --print-path)"
[ -f "$non_git_receipt_path" ] || fail "non-git receipt path not written: $non_git_receipt_path"

committed_repo="$workspace/committed-receipt-repo"
mkdir -p "$committed_repo"
git -C "$committed_repo" init -q
git -C "$committed_repo" config user.email "agent-loop-test@example.com"
git -C "$committed_repo" config user.name "Agent Loop Test"
printf '{"scripts":{"test":"printf test-ok"}}\n' > "$committed_repo/package.json"
git -C "$committed_repo" add package.json
git -C "$committed_repo" commit -q -m "init"
printf 'committed\n' > "$committed_repo/committed.txt"
git -C "$committed_repo" add committed.txt
git -C "$committed_repo" commit -q -m "add committed file"
committed_receipt_path="$(AGENT_LOOP_STATE_DIR="$state_dir" loop-receipt --root "$committed_repo" --goal "Post-commit receipt" --status pass --next-loop review-loop --print-path)"
committed_files="$(node -e 'const fs = require("node:fs"); const receipt = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); console.log(receipt.files.join("\n"));' "$committed_receipt_path")"
assert_contains "$committed_files" "committed.txt"

mixed_repo="$workspace/mixed-receipt-repo"
mkdir -p "$mixed_repo"
git -C "$mixed_repo" init -q
git -C "$mixed_repo" config user.email "agent-loop-test@example.com"
git -C "$mixed_repo" config user.name "Agent Loop Test"
printf '{"scripts":{"test":"printf test-ok"}}\n' > "$mixed_repo/package.json"
git -C "$mixed_repo" add package.json
git -C "$mixed_repo" commit -q -m "init"
printf 'unrelated\n' > "$mixed_repo/unrelated.txt"
printf 'current\n' > "$mixed_repo/current.txt"
git -C "$mixed_repo" add current.txt
git -C "$mixed_repo" commit -q -m "add current file"
mixed_receipt_path="$(AGENT_LOOP_STATE_DIR="$state_dir" loop-receipt --root "$mixed_repo" --goal "Mixed post-commit receipt" --status pass --next-loop review-loop --from-head --print-path)"
mixed_files="$(node -e 'const fs = require("node:fs"); const receipt = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); console.log(receipt.files.join("\n")); console.log(receipt.files_source);' "$mixed_receipt_path")"
assert_contains "$mixed_files" "current.txt"
assert_contains "$mixed_files" "commit:HEAD"
assert_not_contains "$mixed_files" "unrelated.txt"

merge_repo="$workspace/merge-receipt-repo"
mkdir -p "$merge_repo"
git -C "$merge_repo" init -q
git -C "$merge_repo" config user.email "agent-loop-test@example.com"
git -C "$merge_repo" config user.name "Agent Loop Test"
printf '{"scripts":{"test":"printf test-ok"}}\n' > "$merge_repo/package.json"
git -C "$merge_repo" add package.json
git -C "$merge_repo" commit -q -m "init"
default_branch="$(git -C "$merge_repo" branch --show-current)"
git -C "$merge_repo" checkout -q -b side
printf 'side\n' > "$merge_repo/side.txt"
git -C "$merge_repo" add side.txt
git -C "$merge_repo" commit -q -m "add side file"
git -C "$merge_repo" checkout -q "$default_branch"
printf 'main\n' > "$merge_repo/main.txt"
git -C "$merge_repo" add main.txt
git -C "$merge_repo" commit -q -m "add main file"
git -C "$merge_repo" merge -q --no-ff side -m "merge side"
merge_receipt_path="$(AGENT_LOOP_STATE_DIR="$state_dir" loop-receipt --root "$merge_repo" --goal "Merge receipt" --status pass --next-loop review-loop --from-head --print-path)"
merge_files="$(node -e 'const fs = require("node:fs"); const receipt = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); console.log(receipt.files.join("\n")); console.log(receipt.files_source);' "$merge_receipt_path")"
assert_contains "$merge_files" "main.txt"
assert_contains "$merge_files" "side.txt"
assert_contains "$merge_files" "commit:HEAD"
