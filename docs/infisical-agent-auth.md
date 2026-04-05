---
summary: "Infisical rollout guide for shared agent CLI auth across surface-wsl, beelink, and macmini."
read_when:
  - Setting up or rotating agent GitHub tokens.
  - Wiring Codex/Claude launch flows to Infisical runtime injection.
  - Configuring Universal Auth on a new machine.
---

# Infisical Agent Auth

## Scope

- Infisical project: `agent-secrets`
- Project ID: `d73a32d5-f679-47a4-86e6-aad34a1dbd86`
- Shared path: `/shared`
- Machine paths: `/machines/beelink`, `/machines/macmini`, `/machines/surface-wsl`
- Default environment: `prod`

## Wrapper

Use `bin/agent-env.sh` to inject secrets at runtime:

```bash
agent-env.sh -- gh repo list
agent-env.sh -- env | rg -n 'GH_TOKEN|GITHUB_TOKEN'
agent-env.sh -- codex
```

Codex shortcut wrapper:

```bash
codex-agent.sh
```

Default behavior:
- `--projectId d73a32d5-f679-47a4-86e6-aad34a1dbd86`
- `--env prod`
- `--path /shared`

Overrides:
- `INFISICAL_PROJECT_ID` or `AGENT_INFISICAL_PROJECT_ID`
- `INFISICAL_ENV` or `AGENT_INFISICAL_ENV`
- `INFISICAL_PATH` or `AGENT_INFISICAL_PATH`
- `INFISICAL_DOMAIN`
- `INFISICAL_UA_CONFIG` (default `~/.config/infisical/ua.env`)

`ua.env` is used for UA credentials (`INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET`).
The wrapper keeps its own default project/env/path unless you override explicitly.

## Universal Auth Setup

Joel-only step in web UI:
1. Create a Machine Identity for each host (`surface-wsl`, `beelink`, `macmini`).
2. Grant least-privilege access to required env/path(s).
3. Capture `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET`.

Per-machine shell steps:

```bash
mkdir -p ~/.config/infisical
chmod 700 ~/.config/infisical
cat > ~/.config/infisical/ua.env <<'EOF'
INFISICAL_CLIENT_ID=...
INFISICAL_CLIENT_SECRET=...
INFISICAL_PROJECT_ID=d73a32d5-f679-47a4-86e6-aad34a1dbd86
INFISICAL_ENV=prod
INFISICAL_PATH=/shared
INFISICAL_DOMAIN=https://app.infisical.com/api
EOF
chmod 600 ~/.config/infisical/ua.env
```

Verify:

```bash
agent-env.sh -- gh auth status
agent-env.sh -- gh repo list --limit 5
```

## Machine Checklist

### `surface-wsl`
- Install Infisical CLI.
- Configure `~/.config/infisical/ua.env`.
- Verify `agent-env.sh -- gh repo list`.

### `beelink`
- SSH in as bootstrap user.
- Install Infisical CLI if missing.
- If `~/.config/infisical/ua.env` already exists for another project, keep it and use a dedicated file (for example `~/.config/infisical/ua.agent.env`) with `INFISICAL_UA_CONFIG=...`.
- Configure UA for both `joelkehle` and `agent` users if both run agents.
- Verify wrapper for the agent runtime user.

### `macmini`
- Repeat same steps as beelink.
- Confirm shell profile/path includes `~/Projects/shared/agent-scripts/bin`.
- If Homebrew is unavailable, install CLIs to `~/.local/bin`:
  - Infisical: extract `Infisical/cli` darwin arm64 release and install `infisical` binary.
  - GitHub CLI: extract `cli/cli` macOS arm64 release and install `gh` binary.

## Codex / Claude Launch Pattern

Prefer runtime injection, not persistent exports in shell startup files:

```bash
agent-env.sh -- codex
codex-agent.sh
agent-env.sh -- claude --dangerously-skip-permissions
```

If you need convenience aliases, keep them command wrappers only (no long-lived `export GH_TOKEN=...` in `.bashrc`).

## Privileged Host Checklist (Joel sudo)

Run on each host:

```bash
sudo getent passwd agent
sudo ls -ld /home/agent /home/agent/.ssh /home/agent/.ssh/authorized_keys
sudo ssh-keygen -lf /home/agent/.ssh/authorized_keys
sudo grep -RInE '^(PubkeyAuthentication|PasswordAuthentication|PermitRootLogin|AuthorizedKeysFile)' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/* 2>/dev/null || true
sudo sshd -T | rg -n '^(pubkeyauthentication|passwordauthentication|permitrootlogin|authorizedkeysfile)'
```

Expected baseline:
- `PubkeyAuthentication yes`
- `PasswordAuthentication` disabled where feasible
- agent key present in `/home/agent/.ssh/authorized_keys`
- secure permissions (`~/.ssh` = `700`, `authorized_keys` = `600`)
