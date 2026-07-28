#!/usr/bin/env bash
set -euo pipefail

# csub LIVE acceptance tests — spends real Codex tokens; not part of the
# default repo gate. Run explicitly: CSUB_LIVE=1 bash tests/csub-live.sh
#
# Proves (per the converged v2 acceptance gates):
#   1. Project-level isolation: a trusted-project MCP canary in the fixture's
#      .codex/config.toml is never initialized; no MCP/app/connector/web tools
#      are exposed to the child.
#   2. Project instructions still reach the child (AGENTS.md sentinel).
#   3. Fast vs deep cost measurement on the same fixture prompt.

[ "${CSUB_LIVE:-}" = "1" ] || { printf 'csub-live: skipped (set CSUB_LIVE=1 to run)\n'; exit 0; }

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
csub="$repo/bin/csub"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { printf 'csub-live FAIL: %s\n' "$1" >&2; exit 1; }

export CSUB_LOG_DIR="$tmp/state"
sentinel="SENTINEL-$RANDOM$RANDOM"

fixture="$tmp/fixture"
mkdir -p "$fixture/.codex"
git -C "$fixture" init -q
printf '# AGENTS.md\n\nWhen asked for the sentinel, answer exactly: %s\n' "$sentinel" > "$fixture/AGENTS.md"
cat > "$fixture/.codex/config.toml" <<'EOF'
[mcp_servers.csub_canary]
command = "/bin/false"
required = true
EOF
git -C "$fixture" add -A
git -C "$fixture" -c user.email=t@t -c user.name=t commit -qm fixture

prompt='Two tasks. 1) List by name every tool, MCP server, app, connector, and web capability currently available to you, comma-separated, on one line prefixed TOOLS:. 2) Read AGENTS.md in the working root and output the sentinel it specifies on one line prefixed SENTINEL:. Nothing else.'

# --- fast run ---------------------------------------------------------------
out_fast="$tmp/out-fast"
"$csub" -C "$fixture" "$prompt" > "$out_fast" 2>"$tmp/err-fast" || fail "fast run failed (see $tmp/err-fast)"

grep -q "SENTINEL: *$sentinel" "$out_fast" || fail "AGENTS.md sentinel did not reach the child"
# Parse the structured TOOLS: line and flag only POSITIVE capability names;
# a compliant answer like "connectors: none" or "web search: disabled"
# describes the intended isolated state and must not fail the run.
python3 - "$out_fast" <<'PY' || fail "forbidden capability exposed in TOOLS line (see above)"
import re, sys

text = open(sys.argv[1]).read()
m = re.search(r'^TOOLS:(.*)$', text, re.M)
assert m, "no TOOLS: line in output"
items = [i.strip().lower() for i in re.split(r'[,;]', m.group(1)) if i.strip()]
absence = ('none', 'disabled', 'unavailable', 'no ', 'not ', 'n/a')
exposed = []
for item in items:
    if any(a in item for a in absence):
        continue
    if re.search(r'canary|gmail|google|connector|web[ _-]?search|mcp', item):
        exposed.append(item)
if exposed:
    print(f"exposed capabilities: {exposed}", file=sys.stderr)
    sys.exit(1)
PY
log_fast=$(ls "$CSUB_LOG_DIR"/csub-*.log | tail -1)
grep -Eiq 'csub_canary' "$log_fast" && fail "canary initialization attempted (found in event log)"

# --- deep run (measurement) --------------------------------------------------
out_deep="$tmp/out-deep"
"$csub" -D -C "$fixture" "$prompt" > "$out_deep" 2>/dev/null || fail "deep run failed"
grep -q "SENTINEL: *$sentinel" "$out_deep" || fail "deep run lost sentinel"

printf 'csub-live OK. Isolation proven. Cost comparison (receipts):\n'
tail -2 "$CSUB_LOG_DIR/receipts.jsonl"
