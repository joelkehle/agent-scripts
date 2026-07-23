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

## GitHub identity separation

Joel's normal shell, the contributor account, and the reviewer account are
separate GitHub actors. Do not replace Joel's persistent `gh` login and do not
reuse the reviewer service credential for contribution work.

Use `bin/contributor-agent` when a coding agent should author commits, push
branches, or open pull requests as `kehle-contributor-agent`:

```bash
contributor-agent -- gh api user --jq .login
contributor-agent -- codex
contributor-agent -- claude --dangerously-skip-permissions
```

The wrapper:

1. Retrieves only `KEHLE_CONTRIBUTOR_AGENT_GITHUB_TOKEN` from Infisical.
2. Verifies that GitHub resolves the token to `kehle-contributor-agent`.
3. Fails closed instead of falling back to Joel's or the reviewer's identity.
4. Sets `GH_TOKEN` and `GITHUB_TOKEN` only for the child command.
5. Sets Git author and committer attribution to the contributor account's
   GitHub `noreply` address.
6. Leaves persistent `gh` and Git configuration unchanged.

The reviewer identity remains owned by the review agent's deployment and
owning-repo policy. It is never selected by `contributor-agent`.

### Historical note

Older versions of this guide named `agent-env.sh` and `codex-agent.sh`. Local
copies existed in the pre-restructure archive, but `bin/*` ignored them and
they were never Git-tracked or installed by the active repository. Do not
restore the generic wrapper: it injected the entire `/shared` secret set and
did not enforce a GitHub role identity.

## Universal Auth Setup

Joel-only step in web UI:
1. Create a Machine Identity for each host (`surface-wsl`, `beelink`, `macmini`).
2. Grant least-privilege access to required env/path(s).
3. Capture `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET`.

Per-machine shell steps:

```bash
mkdir -p ~/.config/infisical
chmod 700 ~/.config/infisical
cat > ~/.config/infisical/ua.agent.env <<'EOF'
INFISICAL_CLIENT_ID=...
INFISICAL_CLIENT_SECRET=...
INFISICAL_PROJECT_ID=d73a32d5-f679-47a4-86e6-aad34a1dbd86
INFISICAL_ENV=prod
INFISICAL_PATH=/shared
INFISICAL_DOMAIN=https://app.infisical.com/api
EOF
chmod 600 ~/.config/infisical/ua.agent.env
```

Verify:

```bash
contributor-agent -- gh api user --jq .login
```

Expected output includes `kehle-contributor-agent`.

## Machine Checklist

### `surface-wsl`
- Install Infisical CLI.
- Configure `~/.config/infisical/ua.agent.env`.
- Verify `contributor-agent -- gh api user --jq .login`.

### `beelink`
- SSH in as bootstrap user.
- Install Infisical CLI if missing.
- Keep other project credentials separate; use
  `~/.config/infisical/ua.agent.env` for the `agent-secrets` machine identity.
- Configure UA for both `joelkehle` and `agent` users if both run agents.
- Verify `contributor-agent` for the agent runtime user.

### `macmini`
- Repeat same steps as beelink.
- Confirm shell profile/path includes `~/Projects/shared/agent-scripts/bin`.
- If Homebrew is unavailable, install CLIs to `~/.local/bin`:
  - Infisical: extract `Infisical/cli` darwin arm64 release and install `infisical` binary.
  - GitHub CLI: extract `cli/cli` macOS arm64 release and install `gh` binary.

## Codex / Claude Launch Pattern

Select the contributor identity explicitly:

```bash
contributor-agent -- codex
contributor-agent -- claude --dangerously-skip-permissions
```

Do not add long-lived `GH_TOKEN` or `GITHUB_TOKEN` exports to shell startup
files. Outside this wrapper, `gh` continues to use the user's normal login.

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
