#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$repo_root/bin:$PATH"
unset AGENT_CHECK_ACTIVE

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"

  if ! printf '%s\n' "$haystack" | grep -Fq "$needle"; then
    printf 'output:\n%s\n' "$haystack" >&2
    fail "missing expected text: $needle"
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"

  if printf '%s\n' "$haystack" | grep -Fq "$needle"; then
    printf 'output:\n%s\n' "$haystack" >&2
    fail "unexpected text: $needle"
  fi
}

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
recursive_output="$(timeout 10 agent-check --root "$recursive" 2>&1)"
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

audit_output="$(HOME="$home" loop-audit "$workspace")"
assert_contains "$audit_output" "OK $home/.agents/skills/ship-loop/SKILL.md"
assert_contains "$audit_output" "OK $workspace/.agents/skills/ship-loop/SKILL.md"
assert_contains "$audit_output" "OK $home/.agents/skills/hygiene-loop/SKILL.md"
assert_contains "$audit_output" "OK $workspace/.agents/skills/hygiene-loop/SKILL.md"
assert_contains "$audit_output" "OK make-only -> make agent-check"
assert_contains "$audit_output" "OK script-only -> scripts/agent-check.sh"

dirty_repo="$workspace/dirty-repo"
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
dirty_json="$(dirty-audit "$workspace" --json)"
assert_contains "$dirty_json" '"repo": "dirty-repo"'
assert_contains "$dirty_json" '"validation": "npm test"'

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
