#!/usr/bin/env bash
set -euo pipefail

# csub regression tests using a fake-codex PATH shim. No network, no tokens.
# Covers: isolation pins, mode/model routing, sandbox defaults, -D -w
# deep-write, stdin handling, hyphen-leading briefs, supported-version
# contract incl. prerelease floor exclusion, positive -T validation, timeout,
# canonical Elephant guard invariants, prune scope, JSON-safe receipts with
# null-token interruption accounting, and symlink-safe agent installation.
# BSD/macOS-portable: no GNU-only touch/sort options.

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fail() { printf 'csub test FAIL: %s\n' "$1" >&2; exit 1; }

# --- fake codex shim ---------------------------------------------------------
mkdir -p "$tmp/bin"
cat > "$tmp/bin/codex" <<'SHIM'
#!/usr/bin/env bash
if [ "${1:-}" = "--version" ]; then
  printf 'codex-cli %s\n' "${CSUB_TEST_VERSION:-0.145.0}"
  exit 0
fi
printf '%s\n' "$@" > "$CSUB_TEST_ARGS"
prev="" out=""
for a in "$@"; do
  [ "$prev" = "--output-last-message" ] && out=$a
  prev=$a
done
printf 'STDIN<%s>\n' "$(cat)" >> "$CSUB_TEST_ARGS"
sleep "${CSUB_TEST_SLEEP:-0}"
[ -n "$out" ] && printf 'FAKE-MSG\n' > "$out"
printf 'tokens used\n4,321\n'
exit "${CSUB_TEST_EXIT:-0}"
SHIM
chmod +x "$tmp/bin/codex"
export PATH="$tmp/bin:$PATH"
export CSUB_TEST_ARGS="$tmp/args.txt"
export CSUB_LOG_DIR="$tmp/state"

csub="$repo/bin/csub"
workdir="$tmp/work"
mkdir -p "$workdir"

has_arg() { grep -qxF -e "$1" "$CSUB_TEST_ARGS"; }

# --- 1. default mode: fast, read-only, ephemeral, isolation pins -------------
"$csub" -C "$workdir" 'test brief' > "$tmp/out1" 2>/dev/null
for want in --ephemeral --ignore-user-config read-only \
  'model="gpt-5.6-terra"' 'model_reasoning_effort="medium"' \
  'web_search="disabled"' agents.enabled=false \
  features.multi_agent_v2=false \
  features.apps=false features.plugins=false features.tool_suggest=false; do
  has_arg "$want" || fail "default args missing: $want"
done
grep -qxF 'workspace-write' "$CSUB_TEST_ARGS" && fail "default must not be workspace-write"
grep -q 'STDIN<>' "$CSUB_TEST_ARGS" || fail "stdin not closed on non-stdin brief (v1 slurp bug)"
grep -qxF 'FAKE-MSG' "$tmp/out1" || fail "final message not printed"

# --- 2. -w: workspace-write with network off ---------------------------------
"$csub" -w -C "$workdir" 'test brief' >/dev/null 2>&1
has_arg 'workspace-write' || fail "-w did not select workspace-write"
has_arg 'sandbox_workspace_write.network_access=false' || fail "-w did not pin network off"

# --- 3. -D: deep model/effort, still read-only -------------------------------
"$csub" -D -C "$workdir" 'test brief' >/dev/null 2>&1
has_arg 'model="gpt-5.6-sol"' || fail "-D did not select sol"
has_arg 'model_reasoning_effort="high"' || fail "-D did not select high effort"
has_arg 'read-only' || fail "-D alone must stay read-only"

# --- 4. -D -w: bounded deep-write is allowed ---------------------------------
"$csub" -D -w -C "$workdir" 'test brief' >/dev/null 2>&1
has_arg 'model="gpt-5.6-sol"' || fail "-D -w lost deep model"
has_arg 'workspace-write' || fail "-D -w did not allow write"

# --- 5. stdin brief ("-") passes through -------------------------------------
printf 'piped brief body' | "$csub" -C "$workdir" - >/dev/null 2>&1
grep -q 'STDIN<piped brief body>' "$CSUB_TEST_ARGS" || fail "stdin brief not passed through"

# --- 6. hyphen-leading brief: option terminator reaches codex ----------------
"$csub" -C "$workdir" -- '--help' > "$tmp/out6" 2>/dev/null
has_arg -- '--' || fail "option terminator not passed to codex"
has_arg -- '--help' || fail "hyphen-leading brief not passed verbatim"
grep -qxF 'FAKE-MSG' "$tmp/out6" || fail "hyphen-leading brief did not execute"

# --- 7. supported-version contract fails closed, prereleases excluded --------
check_version_refused() {
  set +e
  CSUB_TEST_VERSION="$1" "$csub" -C "$workdir" 'test brief' >/dev/null 2>"$tmp/ver-err"
  rc=$?
  set -e
  [ "$rc" -eq 4 ] || fail "version $1 not refused (got $rc)"
  grep -q 'unsupported codex-cli version' "$tmp/ver-err" || fail "version refusal message missing for $1"
}
check_version_refused "0.144.0-alpha.4"
check_version_refused "0.145.0-alpha.4"
check_version_refused "garbage"
CSUB_TEST_VERSION="0.145.0" "$csub" -C "$workdir" 'test brief' >/dev/null 2>&1 || fail "exact floor must pass"
CSUB_TEST_VERSION="0.146.2" "$csub" -C "$workdir" 'test brief' >/dev/null 2>&1 || fail "newer version must pass"
CSUB_TEST_VERSION="0.146.0-alpha.1" "$csub" -C "$workdir" 'test brief' >/dev/null 2>&1 || fail "prerelease above the floor must pass"

# --- 8. -T must be a positive integer ----------------------------------------
for bad in 0 -5 abc 1.5 ''; do
  set +e
  "$csub" -T "$bad" -C "$workdir" 'test brief' >/dev/null 2>&1
  rc=$?
  set -e
  [ "$rc" -eq 2 ] || fail "-T '$bad' not rejected (got $rc)"
done

# --- 9. wall-clock timeout; interrupted usage recorded as null ---------------
set +e
CSUB_TEST_SLEEP=3 "$csub" -T 1 -C "$workdir" 'test brief' >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -eq 124 ] || fail "timeout did not produce exit 124 (got $rc)"
tail -1 "$CSUB_LOG_DIR/receipts.jsonl" | python3 -c '
import json, sys
rec = json.loads(sys.stdin.read())
assert rec["tokens"] is None, rec["tokens"]
assert rec["exit"] == 124, rec["exit"]
' || fail "interrupted run did not record tokens as null"

# --- 10. Elephant guard: canonical invariants, fail closed -------------------
eledir="$tmp/elephant-repo"
mkdir -p "$eledir/.codex"
git -C "$eledir" init -q
git -C "$eledir" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
marker="$eledir/.codex/elephant-active.json"
run_w() { set +e; "$csub" -w -C "$eledir" 'test brief' >/dev/null 2>"$tmp/ele-err"; rc=$?; set -e; }

# absent marker: allowed
"$csub" -w -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "absent marker must not block -w"

# deactivated and committed: allowed
printf '{"schema": 1, "active": false}\n' > "$marker"
git -C "$eledir" add .codex/elephant-active.json
git -C "$eledir" -c user.email=t@t -c user.name=t commit -qm deactivate
"$csub" -w -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "committed deactivation must not block -w"

# uncommitted deactivation: refused (canonical invariant)
printf '{"schema": 1, "active": true}\n' > "$marker"
git -C "$eledir" add .codex/elephant-active.json
git -C "$eledir" -c user.email=t@t -c user.name=t commit -qm activate
printf '{"schema": 1, "active": false}\n' > "$marker"
run_w; [ "$rc" -eq 3 ] || fail "uncommitted deactivation did not refuse -w (got $rc)"
grep -q 'deactivated before commit' "$tmp/ele-err" || fail "uncommitted-deactivation message missing"
git -C "$eledir" checkout -q -- .codex/elephant-active.json

# unsupported schema: refused
printf '{"schema": 2, "active": false}\n' > "$marker"
run_w; [ "$rc" -eq 3 ] || fail "unsupported schema did not refuse -w (got $rc)"
grep -q 'unsupported schema' "$tmp/ele-err" || fail "schema refusal message missing"

# malformed JSON: refused
printf '{"active": tru\n' > "$marker"
run_w; [ "$rc" -eq 3 ] || fail "malformed marker did not fail closed (got $rc)"

# incomplete active marker (missing contract fields): refused
printf '{"schema": 1, "active": true}\n' > "$marker"
run_w; [ "$rc" -eq 3 ] || fail "incomplete active marker did not refuse -w (got $rc)"

# fully valid active marker: refused as active governance
printf 'receipt-body\n' > "$eledir/.codex/receipt.json"
printf '{"schema": 1}\n' > "$eledir/.codex/trace.json"
git -C "$eledir" add .codex/receipt.json .codex/trace.json
git -C "$eledir" -c user.email=t@t -c user.name=t commit -qm contract
sha=$(python3 -c 'import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$eledir/.codex/receipt.json")
head_commit=$(git -C "$eledir" rev-parse HEAD)
python3 -c '
import json, sys
json.dump({"schema": 1, "active": True, "receipt": ".codex/receipt.json",
           "receipt_sha256": sys.argv[2], "traceability": ".codex/trace.json",
           "activated_at_commit": sys.argv[3]}, open(sys.argv[1], "w"))
' "$marker" "$sha" "$head_commit"
run_w; [ "$rc" -eq 3 ] || fail "valid active marker did not refuse -w (got $rc)"
grep -q 'active Elephant marker' "$tmp/ele-err" || fail "active-governance message missing"

# read-only under active marker: allowed
"$csub" -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "read-only must not be blocked by marker"

# non-repo workdir with -w: guard passes through (codex enforces its own repo check)
nogit="$tmp/nogit"
mkdir -p "$nogit"
"$csub" -w -C "$nogit" 'test brief' >/dev/null 2>&1 || fail "non-repo workdir must not be blocked by the guard"

# --- 11. prune scope: only aged csub-* files (portable timestamp) ------------
mkdir -p "$CSUB_LOG_DIR"
touch -t 202601010000 "$CSUB_LOG_DIR/csub-old.log" "$CSUB_LOG_DIR/keep-me.log"
"$csub" -C "$workdir" 'test brief' >/dev/null 2>&1
[ ! -e "$CSUB_LOG_DIR/csub-old.log" ] || fail "aged csub-* file not pruned"
[ -e "$CSUB_LOG_DIR/keep-me.log" ] || fail "prune touched a non-csub file"

# --- 12. receipts are valid JSON even with hostile paths ---------------------
qdir="$tmp/work\"quoted"
mkdir -p "$qdir"
"$csub" -C "$qdir" 'test brief' >/dev/null 2>&1
tail -1 "$CSUB_LOG_DIR/receipts.jsonl" | python3 -c '
import json, sys
rec = json.loads(sys.stdin.read())
assert rec["dir"].endswith("work\"quoted"), rec["dir"]
assert rec["model"] == "gpt-5.6-terra", rec["model"]
assert rec["tokens"] == 4321, rec["tokens"]
assert rec["mode"] == "fast", rec["mode"]
' || fail "receipt is not valid JSON with correct fields under a quoted path"

# --- 13. install-claude-agents works through an installer shim ---------------
ln -s "$repo/bin/install-claude-agents" "$tmp/bin/install-claude-agents"
agents_dst="$tmp/agents"
CLAUDE_AGENTS_DIR="$agents_dst" "$tmp/bin/install-claude-agents" >/dev/null 2>&1 \
  || fail "installer failed when invoked through a prefix symlink"
for name in grunt.md mech.md; do
  [ -L "$agents_dst/$name" ] || fail "installer did not link $name via shim"
  cmp -s "$agents_dst/$name" "$repo/claude/agents/$name" || fail "shim-installed $name diverges from tracked copy"
done

printf 'csub tests OK\n'
