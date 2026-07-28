#!/usr/bin/env bash
set -euo pipefail

# csub regression tests using a fake-codex PATH shim. No network, no tokens.
# Covers: isolation pins, mode/model routing, sandbox defaults, -D -w
# deep-write, stdin handling (the v1 stdin-slurp bug), timeout, Elephant -w
# guard, prune scope, and receipt emission.

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fail() { printf 'csub test FAIL: %s\n' "$1" >&2; exit 1; }

# --- fake codex shim ---------------------------------------------------------
mkdir -p "$tmp/bin"
cat > "$tmp/bin/codex" <<'SHIM'
#!/usr/bin/env bash
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

csub="$repo/scripts/csub"
workdir="$tmp/work"
mkdir -p "$workdir"

has_arg() { grep -qxF -e "$1" "$CSUB_TEST_ARGS"; }

# --- 1. default mode: fast, read-only, ephemeral, isolation pins -------------
"$csub" -C "$workdir" 'test brief' > "$tmp/out1" 2>/dev/null
for want in --ephemeral --ignore-user-config read-only \
  'model="gpt-5.6-terra"' 'model_reasoning_effort="medium"' \
  'web_search="disabled"' agents.enabled=false \
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

# --- 6. wall-clock timeout ---------------------------------------------------
set +e
CSUB_TEST_SLEEP=3 "$csub" -T 1 -C "$workdir" 'test brief' >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -eq 124 ] || fail "timeout did not produce exit 124 (got $rc)"

# --- 7. Elephant guard: -w refused under active marker -----------------------
eledir="$tmp/elephant-repo"
mkdir -p "$eledir"
git -C "$eledir" init -q
printf '{"active": true}\n' > "$eledir/elephant-active.json"
set +e
"$csub" -w -C "$eledir" 'test brief' >/dev/null 2>"$tmp/ele-err"
rc=$?
set -e
[ "$rc" -eq 3 ] || fail "Elephant guard did not refuse -w (got $rc)"
grep -q 'active Elephant marker' "$tmp/ele-err" || fail "Elephant refusal message missing"
# inactive marker: allowed
printf '{"active": false}\n' > "$eledir/elephant-active.json"
"$csub" -w -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "inactive marker must not block -w"
# read-only in active-marker repo: allowed
printf '{"active": true}\n' > "$eledir/elephant-active.json"
"$csub" -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "read-only must not be blocked by marker"

# --- 8. prune scope: only aged csub-* files ----------------------------------
mkdir -p "$CSUB_LOG_DIR"
touch -d '30 days ago' "$CSUB_LOG_DIR/csub-old.log" "$CSUB_LOG_DIR/keep-me.log"
"$csub" -C "$workdir" 'test brief' >/dev/null 2>&1
[ ! -e "$CSUB_LOG_DIR/csub-old.log" ] || fail "aged csub-* file not pruned"
[ -e "$CSUB_LOG_DIR/keep-me.log" ] || fail "prune touched a non-csub file"

# --- 9. receipt captures model/effort/tokens/duration ------------------------
receipt=$(tail -1 "$CSUB_LOG_DIR/receipts.jsonl")
printf '%s' "$receipt" | grep -q '"model":"gpt-5.6-terra"' || fail "receipt missing model"
printf '%s' "$receipt" | grep -q '"tokens":4321' || fail "receipt missing parsed tokens"
printf '%s' "$receipt" | grep -q '"mode":"fast"' || fail "receipt missing mode"

printf 'csub tests OK\n'
