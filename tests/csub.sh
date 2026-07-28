#!/usr/bin/env bash
set -euo pipefail

# csub regression tests using a fake-codex PATH shim. No network, no tokens.
# Covers: isolation pins, mode/model routing, sandbox defaults, -D -w
# deep-write, stdin handling (the v1 stdin-slurp bug), hyphen-leading briefs
# (option terminator), supported-version contract, timeout, fail-closed
# Elephant -w guard, prune scope, and JSON-safe receipts.

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

# --- 7. supported-version contract fails closed ------------------------------
set +e
CSUB_TEST_VERSION="0.144.0-alpha.4" "$csub" -C "$workdir" 'test brief' >/dev/null 2>"$tmp/ver-err"
rc=$?
set -e
[ "$rc" -eq 4 ] || fail "old codex version not refused (got $rc)"
grep -q 'unsupported codex-cli version' "$tmp/ver-err" || fail "version refusal message missing"
CSUB_TEST_VERSION="0.146.2" "$csub" -C "$workdir" 'test brief' >/dev/null 2>&1 || fail "newer version must pass the gate"

# --- 8. wall-clock timeout ---------------------------------------------------
set +e
CSUB_TEST_SLEEP=3 "$csub" -T 1 -C "$workdir" 'test brief' >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -eq 124 ] || fail "timeout did not produce exit 124 (got $rc)"

# --- 9. Elephant guard: fail closed on active/multiline/malformed ------------
eledir="$tmp/elephant-repo"
mkdir -p "$eledir"
git -C "$eledir" init -q
run_w() { set +e; "$csub" -w -C "$eledir" 'test brief' >/dev/null 2>"$tmp/ele-err"; rc=$?; set -e; }

printf '{"active": true}\n' > "$eledir/elephant-active.json"
run_w; [ "$rc" -eq 3 ] || fail "compact active marker did not refuse -w (got $rc)"
grep -q 'active Elephant marker' "$tmp/ele-err" || fail "active refusal message missing"

printf '{\n  "active"\n    : true\n}\n' > "$eledir/elephant-active.json"
run_w; [ "$rc" -eq 3 ] || fail "multiline active marker did not refuse -w (got $rc)"

printf '{"active": tru\n' > "$eledir/elephant-active.json"
run_w; [ "$rc" -eq 3 ] || fail "malformed marker did not fail closed (got $rc)"
grep -q 'malformed or unreadable' "$tmp/ele-err" || fail "fail-closed message missing"

printf '{\n  "active": false\n}\n' > "$eledir/elephant-active.json"
"$csub" -w -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "inactive marker must not block -w"
printf '{"active": true}\n' > "$eledir/elephant-active.json"
"$csub" -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "read-only must not be blocked by marker"

# --- 10. prune scope: only aged csub-* files ---------------------------------
mkdir -p "$CSUB_LOG_DIR"
touch -d '30 days ago' "$CSUB_LOG_DIR/csub-old.log" "$CSUB_LOG_DIR/keep-me.log"
"$csub" -C "$workdir" 'test brief' >/dev/null 2>&1
[ ! -e "$CSUB_LOG_DIR/csub-old.log" ] || fail "aged csub-* file not pruned"
[ -e "$CSUB_LOG_DIR/keep-me.log" ] || fail "prune touched a non-csub file"

# --- 11. receipts are valid JSON even with hostile paths ---------------------
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

printf 'csub tests OK\n'
