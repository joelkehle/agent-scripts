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
[ "${1:-}" = "secrets" ] || exit 20
[ "${2:-}" = "get" ] || exit 21
[ "${3:-}" = "KEHLE_CONTRIBUTOR_AGENT_GITHUB_TOKEN" ] || exit 22
[ "${INFISICAL_TOKEN:-}" = "mock-infisical-token" ] || exit 23
printf '%s\n' "${MOCK_GITHUB_TOKEN:-mock-github-token}"
MOCK

cat > "$mock_bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$MOCK_CURL_ARGV_LOG"
request_body="$(cat)"
printf '%s\n' "$request_body" >> "$MOCK_CURL_BODY_LOG"
printf '{"accessToken":"mock-infisical-token"}\n'
MOCK

cat > "$mock_bin/hostile-credential" <<'MOCK'
#!/usr/bin/env bash
printf 'username=attacker\npassword=attacker-token\n'
MOCK

cat > "$mock_bin/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[ "${GH_TOKEN:-}" = "${MOCK_GITHUB_TOKEN:-mock-github-token}" ] || exit 30
[ "${GITHUB_TOKEN:-}" = "${MOCK_GITHUB_TOKEN:-mock-github-token}" ] || exit 31
case "${1:-} ${2:-}" in
  "api user")
    printf '%s\n' "${MOCK_GITHUB_LOGIN:-kehle-contributor-agent}"
    ;;
  "auth git-credential")
    [ "${3:-}" = "get" ] || exit 32
    cat >/dev/null
    printf 'username=x-access-token\npassword=%s\n' "${MOCK_GIT_CREDENTIAL_TOKEN:-$GH_TOKEN}"
    ;;
  *)
    exit 33
    ;;
esac
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
  printf 'GIT_SSH_COMMAND=%s\n' "${GIT_SSH_COMMAND:-}"
  printf 'GCM_INTERACTIVE=%s\n' "${GCM_INTERACTIVE:-}"
  git_repo="$MOCK_GIT_REPO"
  git -C "$git_repo" init -q
  git -C "$git_repo" remote add origin git@github.com:owner/repo.git
  printf 'GIT_REMOTE_URL=%s\n' "$(git -C "$git_repo" ls-remote --get-url origin)"
  if git ls-remote ssh://example.invalid/repo.git >/dev/null 2>&1; then
    printf 'RESIDUAL_SSH_REJECTED=false\n'
  else
    printf 'RESIDUAL_SSH_REJECTED=true\n'
  fi
  credential="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill)"
  credential_password="$(printf '%s\n' "$credential" | sed -n 's/^password=//p')"
  if [ "$credential_password" = "$GH_TOKEN" ]; then
    printf 'GIT_CREDENTIAL_MATCH=true\n'
  else
    printf 'GIT_CREDENTIAL_MATCH=false\n'
  fi
  if [ "${GITHUB_REVIEW_AGENT_GITHUB_TOKEN+x}" = "x" ]; then
    printf 'REVIEW_TOKEN_PRESENT=true\n'
  else
    printf 'REVIEW_TOKEN_PRESENT=false\n'
  fi
} > "$MOCK_TARGET_LOG"
MOCK

chmod +x "$mock_bin/curl" "$mock_bin/hostile-credential" "$mock_bin/infisical" "$mock_bin/gh" "$mock_bin/target"

ua_config="$tmp/ua.agent.env"
printf '%s\n' \
  'INFISICAL_CLIENT_ID=mock-client-id' \
  'INFISICAL_CLIENT_SECRET=mock-client-secret' \
  > "$ua_config"

curl_argv_log="$tmp/curl-argv.log"
curl_body_log="$tmp/curl-body.log"
git_repo="$tmp/git-repo"
mkdir -p "$git_repo"
infisical_log="$tmp/infisical.log"
target_log="$tmp/target.log"
: > "$infisical_log"
: > "$curl_argv_log"
: > "$curl_body_log"

PATH="$mock_bin:$PATH" \
MOCK_CURL_ARGV_LOG="$curl_argv_log" \
MOCK_CURL_BODY_LOG="$curl_body_log" \
MOCK_INFISICAL_LOG="$infisical_log" \
MOCK_TARGET_LOG="$target_log" \
MOCK_GIT_REPO="$git_repo" \
GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0="credential.https://github.com.helper" \
GIT_CONFIG_VALUE_0="!$mock_bin/hostile-credential" \
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
assert_contains "$target_output" "GIT_SSH_COMMAND=false"
assert_contains "$target_output" "GCM_INTERACTIVE=never"
assert_contains "$target_output" "GIT_REMOTE_URL=https://github.com/owner/repo.git"
assert_contains "$target_output" "RESIDUAL_SSH_REJECTED=true"
assert_contains "$target_output" "GIT_CREDENTIAL_MATCH=true"
assert_contains "$target_output" "REVIEW_TOKEN_PRESENT=false"

infisical_output="$(cat "$infisical_log")"
assert_contains "$infisical_output" "secrets get KEHLE_CONTRIBUTOR_AGENT_GITHUB_TOKEN"
if printf '%s\n' "$infisical_output" | grep -Eq -- '--token|mock-infisical-token|mock-client-secret'; then
  fail "Infisical credential appeared in process arguments"
fi

curl_argv_output="$(cat "$curl_argv_log")"
if printf '%s\n' "$curl_argv_output" | grep -Eq 'mock-client-secret|mock-infisical-token'; then
  fail "Universal Auth credential appeared in curl arguments"
fi
curl_body_output="$(cat "$curl_body_log")"
assert_contains "$curl_body_output" '"clientId":"mock-client-id"'
assert_contains "$curl_body_output" '"clientSecret":"mock-client-secret"'

set +e
wrong_login_output="$(
  PATH="$mock_bin:$PATH" \
  MOCK_CURL_ARGV_LOG="$curl_argv_log" \
  MOCK_CURL_BODY_LOG="$curl_body_log" \
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

set +e
wrong_credential_output="$(
  PATH="$mock_bin:$PATH" \
  MOCK_CURL_ARGV_LOG="$curl_argv_log" \
  MOCK_CURL_BODY_LOG="$curl_body_log" \
  MOCK_INFISICAL_LOG="$infisical_log" \
  MOCK_TARGET_LOG="$tmp/wrong-credential-target" \
  MOCK_GIT_CREDENTIAL_TOKEN="attacker-token" \
  CONTRIBUTOR_AGENT_INFISICAL_UA_CONFIG="$ua_config" \
    "$wrapper" -- target 2>&1
)"
wrong_credential_status=$?
set -e
[ "$wrong_credential_status" -ne 0 ] || fail "wrong Git credential was accepted"
assert_contains "$wrong_credential_output" "Git selected a credential other than the verified contributor token"
[ ! -e "$tmp/wrong-credential-target" ] || fail "target ran after Git credential mismatch"

install_dir="$tmp/install"
CLAUDE_AGENTS_DIR="$tmp/claude-agents" \
  "$repo_root/bin/agent-env-install" --prefix "$install_dir" >/dev/null
[ -f "$install_dir/contributor-agent" ] && [ ! -L "$install_dir/contributor-agent" ] ||
  fail "installer omitted regular contributor-agent launcher"
[ -f "$install_dir/bin/contributor-agent" ] && [ ! -L "$install_dir/bin/contributor-agent" ] ||
  fail "installer omitted regular contributor-agent command"

if grep -Eq '^agent-env\.sh|^codex-agent\.sh|Use `bin/agent-env\.sh`|Verify `agent-env\.sh' \
  "$repo_root/docs/infisical-agent-auth.md"; then
  fail "auth guide still instructs use of the untracked legacy wrappers"
fi

printf 'PASS: contributor-agent identity and isolation checks\n'
