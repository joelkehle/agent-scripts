#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_root="$repo_root/workspace-roots/projects/plugins/joel-agent-ops"
source_rel="workspace-roots/projects/.agents/skills"
canonical_skills="$repo_root/$source_rel"
codex_manifest="$plugin_root/.codex-plugin/plugin.json"
claude_manifest="$plugin_root/.claude-plugin/plugin.json"
codex_marketplace="$repo_root/workspace-roots/projects/.agents/plugins/marketplace.json"
claude_marketplace="$repo_root/.claude-plugin/marketplace.json"

fail() {
  printf 'plugin-marketplace: %s\n' "$*" >&2
  exit 1
}

bash -n "$repo_root/scripts/sync-plugin-skills"

for file in "$codex_manifest" "$claude_manifest" "$codex_marketplace" "$claude_marketplace"; do
  jq -e . "$file" >/dev/null || fail "invalid JSON: ${file#$repo_root/}"
done

jq -e '
  .id == "joel-agent-ops" and
  .skills == "./skills/" and
  .version == "0.1.0"
' "$codex_manifest" >/dev/null || fail "Codex manifest contract mismatch"

jq -e '
  .name == "joel-agent-ops" and
  .plugins[0].name == "joel-agent-ops" and
  .plugins[0].source.path == "./plugins/joel-agent-ops"
' "$codex_marketplace" >/dev/null || fail "Codex marketplace contract mismatch"

jq -e '
  .name == "joel-agent-ops" and
  .version == "0.1.0"
' "$claude_manifest" >/dev/null || fail "Claude manifest contract mismatch"

jq -e '
  .name == "joel-agent-ops" and
  .plugins[0].name == "joel-agent-ops" and
  .plugins[0].source == "./workspace-roots/projects/plugins/joel-agent-ops"
' "$claude_marketplace" >/dev/null || fail "Claude marketplace contract mismatch"

skills=(
  design-walkthrough
  feature-elicitation
  hygiene-loop
  learn-loop
  oracle
  repair-loop
  review-loop
  ship-loop
)

tracked_file_count=0
for skill in "${skills[@]}"; do
  [ -f "$canonical_skills/$skill/SKILL.md" ] ||
    fail "canonical skill missing SKILL.md: $skill"
  skill_file_count=0
  while IFS= read -r tracked_file; do
    relative="${tracked_file#"$source_rel/"}"
    packaged_file="$plugin_root/skills/$relative"
    [ -f "$packaged_file" ] || fail "missing packaged tracked file: $relative"
    cmp -s "$repo_root/$tracked_file" "$packaged_file" ||
      fail "packaged file differs from canonical source: $relative"
    skill_file_count=$((skill_file_count + 1))
    tracked_file_count=$((tracked_file_count + 1))
  done < <(git -C "$repo_root" ls-files -- "$source_rel/$skill")
  [ "$skill_file_count" -gt 0 ] || fail "no tracked files for canonical skill: $skill"
  packaged_file_count="$(find "$plugin_root/skills/$skill" -type f | wc -l | tr -d ' ')"
  [ "$packaged_file_count" -eq "$skill_file_count" ] ||
    fail "unexpected packaged file count for $skill: $packaged_file_count"
done

skill_count="$(find "$plugin_root/skills" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
[ "$skill_count" -eq "${#skills[@]}" ] || fail "unexpected packaged skill count: $skill_count"

printf 'plugin-marketplace: ok skills=%s tracked_files=%s runtimes=codex,claude\n' \
  "$skill_count" "$tracked_file_count"
