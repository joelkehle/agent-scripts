#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
global_agents="$repo_root/AGENTS.MD"
workspace_agents="$repo_root/workspace-roots/projects/AGENTS.md"
oracle_doc="$repo_root/docs/oracle.md"
oracle_skill="$repo_root/workspace-roots/projects/.agents/skills/oracle/SKILL.md"
tools_doc="$repo_root/tools.md"

fail() {
  printf 'instruction-architecture: %s\n' "$*" >&2
  exit 1
}

check_max_bytes() {
  local file="$1"
  local limit="$2"
  local bytes
  bytes="$(wc -c < "$file" | tr -d ' ')"
  [ "$bytes" -le "$limit" ] ||
    fail "${file#$repo_root/} is ${bytes} bytes; limit is ${limit}"
}

require_text() {
  local file="$1"
  local text="$2"
  grep -Fq -- "$text" "$file" ||
    fail "${file#$repo_root/} missing router: $text"
}

reject_text() {
  local file="$1"
  local text="$2"
  if grep -Fq -- "$text" "$file"; then
    fail "${file#$repo_root/} contains stale or conflicting text: $text"
  fi
}

check_max_bytes "$global_agents" 12288
check_max_bytes "$workspace_agents" 4096

for router in \
  "docs/instruction-architecture.md" \
  "docs/loop-operating-model.md" \
  "docs/elephant/README.md" \
  "docs/STATE_ARCHITECTURE.md" \
  "docs/bus-discovery.md" \
  "docs/shared-agent-coordination.md" \
  "docs/service-runtime-policy.md" \
  "docs/oracle.md" \
  "design-walkthrough" \
  "tools.md"; do
  require_text "$global_agents" "$router"
done

for stale in \
  "Push only when user asks" \
  "prefer 2024–2025 sources" \
  "OpenAI GPT-5.2" \
  "## Session start: surface open loops"; do
  reject_text "$global_agents" "$stale"
done

for file in "$oracle_doc" "$oracle_skill" "$tools_doc"; do
  require_text "$file" "@steipete/oracle@latest"
  require_text "$file" "--model gpt-5-pro"
  reject_text "$file" "gpt-5.2-pro"
  reject_text "$file" "npx -y @steipete/oracle --help"
done

require_text "$oracle_doc" "--remote-chrome 127.0.0.1:9223"
require_text "$oracle_doc" "requested=Pro"
require_text "$oracle_doc" "resolved=Pro"
require_text "$oracle_doc" "verified=yes"

[ "$(grep -c '^## Session Start$' "$global_agents")" -eq 1 ] ||
  fail "global AGENTS must contain exactly one Session Start section"

for stale in \
  "## Project Inventory" \
  "## Model Preferences" \
  "### Services on Beelink" \
  "Credentials in ~/Projects/shared/manager/ops/.env"; do
  reject_text "$workspace_agents" "$stale"
done

printf 'instruction-architecture: ok global=%s workspace=%s\n' \
  "$(wc -c < "$global_agents" | tr -d ' ')" \
  "$(wc -c < "$workspace_agents" | tr -d ' ')"
