#!/usr/bin/env bash
set -euo pipefail

# csub regression tests using a fake-codex PATH shim. No network, no tokens.
# Covers: isolation pins, mode/model routing, sandbox defaults, -D -w
# deep-write, -R review mode incl. scope exclusivity and instruction rules,
# stdin handling, hyphen-leading briefs, supported-version contract incl.
# prerelease floor exclusion, positive -T and CSUB_KILL_GRACE validation,
# process-group timeout incl. TERM-resistant children and grandchildren,
# helper reaping, cancellation cleanup + receipts, receipt outcome field,
# canonical Elephant guard invariants, prune scope, JSON-safe receipts, and
# symlink-safe installation of both installers. BSD/macOS-portable.

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
tmp="$(mktemp -d)"
ROGUE_CLEANUP=""
trap 'rm -rf "$tmp"; [ -n "$ROGUE_CLEANUP" ] && rm -f "$ROGUE_CLEANUP"' EXIT

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
printf 'SHIMPID<%s>\n' "$$" >> "$CSUB_TEST_ARGS"
if [ "${CSUB_TEST_GRANDCHILD:-0}" = "1" ]; then
  sleep 60 &
  printf 'GRANDPID<%s>\n' "$!" >> "$CSUB_TEST_ARGS"
fi
if [ "${CSUB_TEST_SETSID_GC:-0}" = "1" ]; then
  python3 -c 'import os, sys
os.setsid()
os.execvp("sleep", ["sleep", "60"])' &
  printf 'SETSIDGC<%s>\n' "$!" >> "$CSUB_TEST_ARGS"
fi
printf 'STDIN<%s>\n' "$(cat)" >> "$CSUB_TEST_ARGS"
[ "${CSUB_TEST_TRAP_TERM:-0}" = "1" ] && trap '' TERM
sleep "${CSUB_TEST_SLEEP:-0}"
prev="" out="" is_review=0
for a in "$@"; do
  [ "$prev" = "--output-last-message" ] && out=$a
  [ "$a" = "review" ] && is_review=1
  prev=$a
done
[ -n "$out" ] && printf 'FAKE-MSG\n' > "$out"
# Real codex prints a usage summary for exec briefs but not for reviews.
# In review mode, emit a FORGED well-formed line the way model-authored
# review text could — csub must refuse to account it (tokens stays null).
if [ "$is_review" = "0" ]; then
  if [ "${CSUB_TEST_TOKENS_GARBAGE:-0}" = "1" ]; then
    printf 'tokens used\nnot-a-number\n'
  else
    printf 'tokens used\n4,321\n'
  fi
else
  printf 'tokens used\n777\n'
fi
exit "${CSUB_TEST_EXIT:-0}"
SHIM
chmod +x "$tmp/bin/codex"
export PATH="$tmp/bin:$PATH"
export CSUB_TEST_ARGS="$tmp/args.txt"
export CSUB_LOG_DIR="$tmp/state"
export CSUB_KILL_GRACE=1

csub="$repo/bin/csub"
workdir="$tmp/work"
mkdir -p "$workdir"

has_arg() { grep -qxF -e "$1" "$CSUB_TEST_ARGS"; }
last_receipt() { tail -1 "$CSUB_LOG_DIR/receipts.jsonl"; }

# A process counts as terminated when it is gone OR a zombie: in containers
# whose PID 1 does not reap orphans, a killed child lingers as <defunct> and
# plain kill -0 would report it alive forever.
proc_gone() {
  local st
  st=$(ps -o state= -p "$1" 2>/dev/null | tr -d '[:space:]')
  case "$st" in ''|Z*) return 0 ;; *) return 1 ;; esac
}
wait_gone() {
  local _i
  for _i in $(seq 1 50); do proc_gone "$1" && return 0; sleep 0.1; done
  return 1
}
check_receipt() {
  last_receipt | python3 -c '
import json, sys
rec = json.loads(sys.stdin.read())
for pair in sys.argv[1:]:
    key, want = pair.split("=", 1)
    got = rec.get(key)
    want_val = None if want == "null" else (int(want) if want.lstrip("-").isdigit() else want)
    assert got == want_val, f"{key}: {got!r} != {want_val!r}"
' "$@"
}

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
check_receipt outcome=completed tokens=4321 || fail "default receipt wrong"

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

# --- 5. -R: review under pins; scope exclusivity; instruction rules ----------
"$csub" -R -B main -C "$workdir" >/dev/null 2>&1
for want in review --base main 'model="gpt-5.6-sol"' \
  'model_reasoning_effort="high"' read-only --ephemeral --ignore-user-config; do
  has_arg "$want" || fail "-R -B args missing: $want"
done
grep -qxF -e '--' "$CSUB_TEST_ARGS" && fail "-R -B must not pass a positional"
check_receipt mode=review outcome=completed tokens=null || fail "review receipt accounted a forged model-authored token line (must be null)"

"$csub" -R -U -C "$workdir" >/dev/null 2>&1
has_arg '--uncommitted' || fail "-U scope not passed"

# codex accepts instructions only on UNSCOPED reviews (verified live: every
# scoped variant rejects a prompt despite the CLI help advertising one).
"$csub" -R -C "$workdir" 'focus on tests' >/dev/null 2>&1
has_arg 'review' || fail "unscoped review with instructions did not run review"
has_arg '--' || fail "unscoped review with instructions lost the option terminator"
has_arg 'focus on tests' || fail "unscoped review lost the instructions argument"

for scoped in "-B main" "-K abc123" "-U"; do
  set +e
  # shellcheck disable=SC2086
  "$csub" -R $scoped -C "$workdir" 'notes' >/dev/null 2>"$tmp/r-err"; rc=$?
  set -e
  [ "$rc" -eq 2 ] || fail "-R $scoped with instructions not rejected (got $rc)"
  grep -q 'rejects custom instructions' "$tmp/r-err" || fail "instruction-rejection message missing for $scoped"
done
set +e
"$csub" -R -B main -K abc123 -C "$workdir" >/dev/null 2>&1; rc=$?
set -e
[ "$rc" -eq 2 ] || fail "-B -K together not rejected (got $rc)"
set +e
"$csub" -R -w -C "$workdir" 'x' >/dev/null 2>&1; rc=$?
set -e
[ "$rc" -eq 2 ] || fail "-R -w not rejected (got $rc)"
set +e
"$csub" -B main -C "$workdir" 'x' >/dev/null 2>&1; rc=$?
set -e
[ "$rc" -eq 2 ] || fail "-B without -R not rejected (got $rc)"

# --- 6. stdin brief ("-") passes through -------------------------------------
printf 'piped brief body' | "$csub" -C "$workdir" - >/dev/null 2>&1
grep -q 'STDIN<piped brief body>' "$CSUB_TEST_ARGS" || fail "stdin brief not passed through"

# --- 7. hyphen-leading brief: option terminator reaches codex ----------------
"$csub" -C "$workdir" -- '--help' > "$tmp/out7" 2>/dev/null
has_arg '--' || fail "option terminator not passed to codex"
has_arg '--help' || fail "hyphen-leading brief not passed verbatim"
grep -qxF 'FAKE-MSG' "$tmp/out7" || fail "hyphen-leading brief did not execute"

# --- 8. supported-version contract fails closed, prereleases excluded --------
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

# --- 9. -T and CSUB_KILL_GRACE validation ------------------------------------
for bad in 0 -5 abc 1.5 ''; do
  set +e
  "$csub" -T "$bad" -C "$workdir" 'test brief' >/dev/null 2>&1
  rc=$?
  set -e
  [ "$rc" -eq 2 ] || fail "-T '$bad' not rejected (got $rc)"
done
CSUB_KILL_GRACE=abc "$csub" -C "$workdir" 'test brief' >/dev/null 2>"$tmp/grace-err" \
  || fail "invalid CSUB_KILL_GRACE must not break a normal run"
grep -q 'ignoring invalid CSUB_KILL_GRACE' "$tmp/grace-err" || fail "grace fallback warning missing"
set +e
CSUB_KILL_GRACE=0 CSUB_TEST_SLEEP=5 "$csub" -T 1 -C "$workdir" 'test brief' >/dev/null 2>"$tmp/grace0-err"
rc=$?
set -e
[ "$rc" -eq 124 ] || fail "timeout with non-positive grace fallback failed (got $rc)"
grep -q 'non-positive CSUB_KILL_GRACE' "$tmp/grace0-err" || fail "non-positive grace warning missing"

# --- 10. watchdog timeout: tree-killed, unknown usage, escapees dead ---------
rm -f "$CSUB_TEST_ARGS"
set +e
CSUB_TEST_GRANDCHILD=1 CSUB_TEST_SETSID_GC=1 CSUB_TEST_SLEEP=5 "$csub" -T 1 -C "$workdir" 'test brief' >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -eq 124 ] || fail "timeout did not produce exit 124 (got $rc)"
check_receipt outcome=timeout tokens=null exit=124 || fail "timeout receipt wrong"
grand_pid=$(sed -n 's/^GRANDPID<\([0-9]*\)>$/\1/p' "$CSUB_TEST_ARGS")
setsid_pid=$(sed -n 's/^SETSIDGC<\([0-9]*\)>$/\1/p' "$CSUB_TEST_ARGS")
[ -n "$grand_pid" ] || fail "grandchild pid not captured"
[ -n "$setsid_pid" ] || fail "setsid grandchild pid not captured"
wait_gone "$grand_pid" || fail "grandchild survived group timeout kill"
wait_gone "$setsid_pid" || fail "setsid-detached grandchild survived tree kill"

# --- 11. TERM-resistant child is still KILLed at the bound -------------------
start_ts=$(date +%s)
set +e
CSUB_TEST_TRAP_TERM=1 CSUB_TEST_SLEEP=30 "$csub" -T 1 -C "$workdir" 'test brief' >/dev/null 2>&1
rc=$?
set -e
elapsed=$(( $(date +%s) - start_ts ))
[ "$rc" -eq 124 ] || fail "TERM-resistant child did not report timeout (got $rc)"
[ "$elapsed" -le 10 ] || fail "TERM-resistant child exceeded the bound (took ${elapsed}s)"

# --- 12. cancellation: whole group terminated, receipt written ---------------
rm -f "$CSUB_TEST_ARGS"
set +e
CSUB_TEST_GRANDCHILD=1 CSUB_TEST_SLEEP=30 "$csub" -C "$workdir" 'test brief' >/dev/null 2>&1 &
csub_pid=$!
for _ in $(seq 1 50); do [ -s "$CSUB_TEST_ARGS" ] && grep -q 'STDIN<' "$CSUB_TEST_ARGS" && break; sleep 0.1; done
shim_pid=$(sed -n 's/^SHIMPID<\([0-9]*\)>$/\1/p' "$CSUB_TEST_ARGS")
grand_pid=$(sed -n 's/^GRANDPID<\([0-9]*\)>$/\1/p' "$CSUB_TEST_ARGS")
kill -TERM "$csub_pid"
wait "$csub_pid"
rc=$?
set -e
[ "$rc" -eq 143 ] || fail "cancelled csub did not exit 143 (got $rc)"
[ -n "$shim_pid" ] || fail "shim pid not captured"
[ -n "$grand_pid" ] || fail "grandchild pid not captured (cancel)"
wait_gone "$shim_pid" || fail "codex child survived csub cancellation"
wait_gone "$grand_pid" || fail "grandchild survived csub cancellation"
check_receipt outcome=signaled exit=143 tokens=null || fail "cancellation receipt wrong"

# --- 13. no watchdog/escalation helpers survive csub -------------------------
sleep 1
if pgrep -f -- "csub-wd:$CSUB_LOG_DIR" >/dev/null 2>&1 || pgrep -f -- "csub-esc:$CSUB_LOG_DIR" >/dev/null 2>&1; then
  fail "watchdog/escalation helpers survived csub exit"
fi

# --- 14. failed child records outcome=failed ---------------------------------
CSUB_TEST_EXIT=7 "$csub" -C "$workdir" 'test brief' >/dev/null 2>&1 && fail "nonzero child exit not propagated"
check_receipt outcome=failed exit=7 || fail "failed-run receipt wrong"

# --- 14a. SIGINT works even for background invocations (inherited-ignore) ----
rm -f "$CSUB_TEST_ARGS"
set +e
CSUB_TEST_SLEEP=30 "$csub" -C "$workdir" 'test brief' >/dev/null 2>&1 &
csub_pid=$!
for _ in $(seq 1 50); do [ -s "$CSUB_TEST_ARGS" ] && grep -q 'STDIN<' "$CSUB_TEST_ARGS" && break; sleep 0.1; done
kill -INT "$csub_pid"
wait "$csub_pid"
rc=$?
set -e
[ "$rc" -eq 130 ] || fail "background SIGINT did not produce exit 130 (got $rc)"
check_receipt outcome=signaled exit=130 || fail "SIGINT receipt wrong"

# --- 14b. malformed token summary never drops the receipt --------------------
CSUB_TEST_TOKENS_GARBAGE=1 "$csub" -C "$workdir" 'test brief' >/dev/null 2>&1
check_receipt outcome=completed tokens=null exit=0 || fail "garbage token summary dropped or corrupted the receipt"

# --- 14c. successful runs emit no job-control noise on stderr ----------------
"$csub" -C "$workdir" 'test brief' >/dev/null 2>"$tmp/noise"
grep -Eq 'Killed|csub-wd|csub-esc' "$tmp/noise" && fail "stderr contains job-control noise: $(cat "$tmp/noise")"

# --- 15. Elephant guard: canonical invariants, fail closed -------------------
eledir="$tmp/elephant-repo"
mkdir -p "$eledir/.codex"
git -C "$eledir" init -q
git -C "$eledir" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
marker="$eledir/.codex/elephant-active.json"
run_w() { set +e; "$csub" -w -C "$eledir" 'test brief' >/dev/null 2>"$tmp/ele-err"; rc=$?; set -e; }

"$csub" -w -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "absent marker must not block -w"

printf '{"schema": 1, "active": false}\n' > "$marker"
run_w; [ "$rc" -eq 3 ] || fail "untracked marker did not refuse -w (got $rc)"
grep -q 'never committed' "$tmp/ele-err" || fail "untracked-marker message missing"

printf '{"schema": 1, "active": true}\n' > "$marker"
git -C "$eledir" add .codex/elephant-active.json
git -C "$eledir" -c user.email=t@t -c user.name=t commit -qm activate
printf '{"schema": 1, "active": false}\n' > "$marker"
git -C "$eledir" add .codex/elephant-active.json
run_w; [ "$rc" -eq 3 ] || fail "staged-only deactivation did not refuse -w (got $rc)"
grep -q 'not committed to HEAD' "$tmp/ele-err" || fail "staged-deactivation message missing"

git -C "$eledir" reset -q HEAD .codex/elephant-active.json
git -C "$eledir" checkout -q -- .codex/elephant-active.json
printf '{"schema": 1, "active": false}\n' > "$marker"
run_w; [ "$rc" -eq 3 ] || fail "worktree-only deactivation did not refuse -w (got $rc)"

git -C "$eledir" add .codex/elephant-active.json
git -C "$eledir" -c user.email=t@t -c user.name=t commit -qm deactivate
"$csub" -w -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "committed deactivation must not block -w"

printf '{"schema": 2, "active": false}\n' > "$marker"
run_w; [ "$rc" -eq 3 ] || fail "unsupported schema did not refuse -w (got $rc)"
git -C "$eledir" checkout -q -- .codex/elephant-active.json

printf '{"active": tru\n' > "$marker"
run_w; [ "$rc" -eq 3 ] || fail "malformed marker did not fail closed (got $rc)"
git -C "$eledir" checkout -q -- .codex/elephant-active.json

printf '{"schema": 1, "active": true}\n' > "$marker"
run_w; [ "$rc" -eq 3 ] || fail "incomplete active marker did not refuse -w (got $rc)"
git -C "$eledir" checkout -q -- .codex/elephant-active.json

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

"$csub" -C "$eledir" 'test brief' >/dev/null 2>&1 || fail "read-only must not be blocked by marker"

nogit="$tmp/nogit"
mkdir -p "$nogit"
"$csub" -w -C "$nogit" 'test brief' >/dev/null 2>&1 || fail "non-repo workdir must not be blocked by the guard"

# --- 16. prune scope: only aged csub-* files (portable timestamp) ------------
mkdir -p "$CSUB_LOG_DIR"
touch -t 202601010000 "$CSUB_LOG_DIR/csub-old.log" "$CSUB_LOG_DIR/keep-me.log"
"$csub" -C "$workdir" 'test brief' >/dev/null 2>&1
[ ! -e "$CSUB_LOG_DIR/csub-old.log" ] || fail "aged csub-* file not pruned"
[ -e "$CSUB_LOG_DIR/keep-me.log" ] || fail "prune touched a non-csub file"

# --- 17. receipts are valid JSON even with hostile paths ---------------------
qdir="$tmp/work\"quoted"
mkdir -p "$qdir"
"$csub" -C "$qdir" 'test brief' >/dev/null 2>&1
last_receipt | python3 -c '
import json, sys
rec = json.loads(sys.stdin.read())
assert rec["dir"].endswith("work\"quoted"), rec["dir"]
assert rec["model"] == "gpt-5.6-terra", rec["model"]
assert rec["tokens"] == 4321, rec["tokens"]
assert rec["mode"] == "fast", rec["mode"]
assert rec["outcome"] == "completed", rec["outcome"]
' || fail "receipt is not valid JSON with correct fields under a quoted path"

# --- 18. install-claude-agents works through an installer shim ---------------
ln -s "$repo/bin/install-claude-agents" "$tmp/bin/install-claude-agents"
agents_dst="$tmp/agents"
CLAUDE_AGENTS_DIR="$agents_dst" "$tmp/bin/install-claude-agents" >/dev/null 2>&1 \
  || fail "installer failed when invoked through a prefix symlink"
for name in grunt.md mech.md; do
  [ -L "$agents_dst/$name" ] || fail "installer did not link $name via shim"
  cmp -s "$agents_dst/$name" "$repo/claude/agents/$name" || fail "shim-installed $name diverges from tracked copy"
done

# --- 18b. divergent user-owned symlinks are refused, identical repointed -----
sym_dst="$tmp/sym-agents"
mkdir -p "$sym_dst"
printf 'my own grunt\n' > "$tmp/user-grunt.md"
ln -s "$tmp/user-grunt.md" "$sym_dst/grunt.md"
cp "$repo/claude/agents/mech.md" "$tmp/mech-copy.md"
ln -s "$tmp/mech-copy.md" "$sym_dst/mech.md"
set +e
CLAUDE_AGENTS_DIR="$sym_dst" "$repo/bin/install-claude-agents" >/dev/null 2>"$tmp/sym-err"
sym_rc=$?
set -e
[ "$sym_rc" -ne 0 ] || fail "divergent user symlink did not cause a refusal exit"
grep -q 'REFUSING grunt.md' "$tmp/sym-err" || fail "divergent-symlink refusal message missing"
[ "$(readlink "$sym_dst/grunt.md")" = "$tmp/user-grunt.md" ] || fail "divergent user symlink was replaced"
[ "$(readlink "$sym_dst/mech.md")" = "$repo/claude/agents/mech.md" ] || fail "identical-content symlink was not repointed"

# --- 18a. untracked agent definitions are never installed --------------------
rogue="$repo/claude/agents/zz-rogue-test.md"
if [ -e "$rogue" ] || [ -L "$rogue" ]; then
  printf 'csub tests: SKIP untracked-agent subtest (pre-existing %s)\n' "$rogue" >&2
else
ROGUE_CLEANUP="$rogue"
printf -- '---\nname: rogue\n---\nrogue\n' > "$rogue"
rogue_dst="$tmp/rogue-agents"
CLAUDE_AGENTS_DIR="$rogue_dst" "$repo/bin/install-claude-agents" >/dev/null 2>"$tmp/rogue-err" && rogue_rc=0 || rogue_rc=$?
rm -f "$rogue"
[ "$rogue_rc" -eq 0 ] || fail "installer failed with an untracked file present"
[ ! -e "$rogue_dst/zz-rogue-test.md" ] || fail "untracked agent definition was installed"
grep -q 'skipping untracked zz-rogue-test.md' "$tmp/rogue-err" || fail "untracked-skip message missing"
[ -L "$rogue_dst/grunt.md" ] || fail "tracked agents not installed alongside rogue skip"
ROGUE_CLEANUP=""
fi

# --- 19. bootstrap installs agents, and works through its own shim -----------
boot_agents="$tmp/boot-agents"
CLAUDE_AGENTS_DIR="$boot_agents" bash "$repo/bin/agent-env-install" --prefix "$tmp/boot-prefix" >/dev/null 2>&1 \
  || fail "agent-env-install failed in test prefix"
[ -L "$tmp/boot-prefix/csub" ] || fail "bootstrap did not link csub"
for name in grunt.md mech.md; do
  [ -L "$boot_agents/$name" ] || fail "bootstrap did not install $name"
done
# invoked through its own installed symlink, sources must still resolve to the repo
ln -s "$repo/bin/agent-env-install" "$tmp/bin/agent-env-install"
boot2_agents="$tmp/boot2-agents"
CLAUDE_AGENTS_DIR="$boot2_agents" "$tmp/bin/agent-env-install" --prefix "$tmp/boot2-prefix" >/dev/null 2>&1 \
  || fail "agent-env-install failed when invoked through a prefix symlink"
[ -L "$tmp/boot2-prefix/csub" ] || fail "symlinked bootstrap did not link csub"
target=$(readlink "$tmp/boot2-prefix/csub")
[ "$target" = "$repo/bin/csub" ] || fail "symlinked bootstrap linked csub from wrong source ($target)"
[ -L "$boot2_agents/grunt.md" ] || fail "symlinked bootstrap did not install agents"

printf 'csub tests OK\n'
