#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
wrapper="$repo_root/bin/contributor-agent"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  printf '%s\n' "$haystack" | grep -Fq -- "$needle" ||
    fail "missing expected text: $needle"
}

mock_bin="$tmp/bin"
mkdir -p "$mock_bin"

cat > "$mock_bin/infisical" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$MOCK_INFISICAL_LOG"
case "${1:-}" in
  login)
    printf 'mock-infisical-token\n'
    ;;
  secrets)
    [ "${2:-}" = "get" ] || exit 20
    [ "${3:-}" = "KEHLE_CONTRIBUTOR_AGENT_GITHUB_TOKEN" ] || exit 21
    printf '%s\n' "${MOCK_GITHUB_TOKEN:-mock-github-token}"
    ;;
  *)
    exit 22
    ;;
esac
MOCK

cat > "$mock_bin/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[ "${GH_TOKEN:-}" = "${MOCK_GITHUB_TOKEN:-mock-github-token}" ] || exit 30
[ "${GITHUB_TOKEN:-}" = "${MOCK_GITHUB_TOKEN:-mock-github-token}" ] || exit 31
[ "${1:-}" = "api" ] || exit 32
[ "${2:-}" = "user" ] || exit 33
printf '%s\n' "${MOCK_GITHUB_LOGIN:-kehle-contributor-agent}"
MOCK

cat > "$mock_bin/target" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
{
  printf 'GH_TOKEN=%s\n' "${GH_TOKEN:-}"
  printf 'GITHUB_TOKEN=%s\n' "${GITHUB_TOKEN:-}"
  printf 'GIT_AUTHOR_NAME=%s\n' "${GIT_AUTHOR_NAME:-}"
  printf 'GIT_AUTHOR_EMAIL=%s\n' "${GIT_AUTHOR_EMAIL:-}"
  printf 'GIT_COMMITTER_NAME=%s\n' "${GIT_COMMITTER_NAME:-}"
  printf 'GIT_COMMITTER_EMAIL=%s\n' "${GIT_COMMITTER_EMAIL:-}"
  printf 'GIT_TERMINAL_PROMPT=%s\n' "${GIT_TERMINAL_PROMPT:-}"
  if [ "${GITHUB_REVIEW_AGENT_GITHUB_TOKEN+x}" = "x" ]; then
    printf 'REVIEW_TOKEN_PRESENT=true\n'
  else
    printf 'REVIEW_TOKEN_PRESENT=false\n'
  fi
} > "$MOCK_TARGET_LOG"
MOCK

chmod +x "$mock_bin/infisical" "$mock_bin/gh" "$mock_bin/target"

ua_config="$tmp/ua.agent.env"
printf '%s\n' \
  'INFISICAL_CLIENT_ID=mock-client-id' \
  'INFISICAL_CLIENT_SECRET=mock-client-secret' \
  > "$ua_config"

infisical_log="$tmp/infisical.log"
target_log="$tmp/target.log"
: > "$infisical_log"

PATH="$mock_bin:$PATH" \
MOCK_INFISICAL_LOG="$infisical_log" \
MOCK_TARGET_LOG="$target_log" \
CONTRIBUTOR_AGENT_INFISICAL_UA_CONFIG="$ua_config" \
GITHUB_REVIEW_AGENT_GITHUB_TOKEN="must-not-leak" \
  "$wrapper" -- target

target_output="$(cat "$target_log")"
assert_contains "$target_output" "GH_TOKEN=mock-github-token"
assert_contains "$target_output" "GITHUB_TOKEN=mock-github-token"
assert_contains "$target_output" "GIT_AUTHOR_NAME=Kehle Contributor Agent"
assert_contains "$target_output" "GIT_AUTHOR_EMAIL=308211094+kehle-contributor-agent@users.noreply.github.com"
assert_contains "$target_output" "GIT_COMMITTER_NAME=Kehle Contributor Agent"
assert_contains "$target_output" "GIT_COMMITTER_EMAIL=308211094+kehle-contributor-agent@users.noreply.github.com"
assert_contains "$target_output" "GIT_TERMINAL_PROMPT=0"
assert_contains "$target_output" "REVIEW_TOKEN_PRESENT=false"

infisical_output="$(cat "$infisical_log")"
assert_contains "$infisical_output" "login --method universal-auth"
assert_contains "$infisical_output" "secrets get KEHLE_CONTRIBUTOR_AGENT_GITHUB_TOKEN"
if printf '%s\n' "$infisical_output" | grep -Fq " run "; then
  fail "wrapper used broad infisical run injection"
fi

set +e
wrong_login_output="$(
  PATH="$mock_bin:$PATH" \
  MOCK_INFISICAL_LOG="$infisical_log" \
  MOCK_TARGET_LOG="$tmp/should-not-exist" \
  MOCK_GITHUB_LOGIN="joelkehle" \
  CONTRIBUTOR_AGENT_INFISICAL_UA_CONFIG="$ua_config" \
    "$wrapper" -- target 2>&1
)"
wrong_login_status=$?
set -e
[ "$wrong_login_status" -ne 0 ] || fail "wrong GitHub login was accepted"
assert_contains "$wrong_login_output" "expected GitHub login kehle-contributor-agent, got joelkehle"
[ ! -e "$tmp/should-not-exist" ] || fail "target ran after identity mismatch"

install_dir="$tmp/install"
"$repo_root/bin/agent-env-install" --prefix "$install_dir" >/dev/null
[ -L "$install_dir/contributor-agent" ] || fail "installer omitted contributor-agent"
[ "$(readlink "$install_dir/contributor-agent")" = "$wrapper" ] ||
  fail "installer linked contributor-agent to the wrong source"

if grep -Eq '^agent-env\.sh|^codex-agent\.sh|Use `bin/agent-env\.sh`|Verify `agent-env\.sh' \
  "$repo_root/docs/infisical-agent-auth.md"; then
  fail "auth guide still instructs use of the untracked legacy wrappers"
fi

printf 'PASS: contributor-agent identity and isolation checks\n'
