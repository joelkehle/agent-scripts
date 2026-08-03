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
mcp_config="$plugin_root/.mcp.json"
mcp_bridge="$plugin_root/mcp/manager-mission-bridge.mjs"

fail() {
  printf 'plugin-marketplace: %s\n' "$*" >&2
  exit 1
}

bash -n "$repo_root/scripts/sync-plugin-skills"

for file in "$codex_manifest" "$claude_manifest" "$codex_marketplace" "$claude_marketplace" "$mcp_config"; do
  jq -e . "$file" >/dev/null || fail "invalid JSON: ${file#$repo_root/}"
done

jq -e '
  def valid_codex_version:
    type == "string" and
    test("^0[.]1[.]0[+]codex[.][a-z0-9](?:[a-z0-9-]*[a-z0-9])?$");
  .id == "joel-agent-ops" and
  .skills == "./skills/" and
  .mcpServers == "./.mcp.json" and
  (.version | valid_codex_version)
' "$codex_manifest" >/dev/null || fail "Codex manifest contract mismatch"

jq -n -e '
  def valid_codex_version:
    type == "string" and
    test("^0[.]1[.]0[+]codex[.][a-z0-9](?:[a-z0-9-]*[a-z0-9])?$");
  ([
    "0.1.0",
    "0.1.0+codex.one+codex.two",
    "0.1.0+codex.one.codex.two"
  ] | all(valid_codex_version | not))
' >/dev/null || fail "Codex cachebuster version guard mismatch"

jq -e '
  .mcpServers["manager-mission-operator"] as $server |
  $server.command == "node" and
  $server.args == ["./mcp/manager-mission-bridge.mjs"] and
  $server.cwd == "." and
  $server.enabled_tools == [
    "preflight_agent_mission",
    "start_agent_mission",
    "check_agent_mission"
  ] and
  $server.default_tools_approval_mode == "writes"
' "$mcp_config" >/dev/null || fail "Codex mission MCP contract mismatch"

node --check "$mcp_bridge"
node --test "$repo_root/tests/plugin-manager-mission-mcp.test.js"

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
  manager-mission-operator
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

mission_skill="$canonical_skills/manager-mission-operator/SKILL.md"
for required_text in \
  preflight_agent_mission \
  start_agent_mission \
  check_agent_mission \
  tool_surface_missing \
  manager-mission-bridge.mjs \
  "raw MCP JSON"; do
  grep -Fq "$required_text" "$mission_skill" ||
    fail "Manager mission skill lacks required rule: $required_text"
done
grep -Fq "Do not run" "$mission_skill" ||
  fail "Manager mission skill does not forbid shell bridge use"
grep -Fq "exact tool search" "$mission_skill" ||
  fail "Manager mission skill does not require native tool discovery"

skill_count="$(find "$plugin_root/skills" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
[ "$skill_count" -eq "${#skills[@]}" ] || fail "unexpected packaged skill count: $skill_count"

printf 'plugin-marketplace: ok skills=%s tracked_files=%s runtimes=codex,claude mission_tools=3\n' \
  "$skill_count" "$tracked_file_count"
