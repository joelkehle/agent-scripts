---
summary: "Canonical Oracle GPT-5.6 Pro browser-mode runbook for second-model reviews from Beelink through the signed-in Surface Chrome profile."
read_when:
  - "Invoking Oracle for an independent architecture, code, risk, or work-product review."
  - "Selecting GPT-5.6 Pro in Oracle browser mode."
  - "Starting, validating, or repairing the Beelink-to-Surface Oracle browser bridge."
---

# Oracle GPT-5.6 Pro

This is Joel's canonical Oracle path. Use GPT-5.6 Pro through ChatGPT browser
mode unless Joel explicitly requests another model or engine.

Oracle itself runs on Beelink. It assembles the prompt and selected files
locally, controls a dedicated signed-in Chrome profile on the Surface through a
loopback-only reverse SSH tunnel, and sends the request to ChatGPT over the
internet.

```text
Oracle on Beelink
  -> Beelink 127.0.0.1:9223
  -> reverse SSH tunnel
  -> Surface Chrome 127.0.0.1:9222
  -> chatgpt.com
```

## Required choices

- Use Node 24 or newer. Confirm the current npm release and its `engines`
  requirement before the first invocation in a session.
- Always invoke `npx -y @steipete/oracle@latest`. A bare
  `@steipete/oracle` invocation has resolved an obsolete cached release on
  Beelink.
- Use `--engine browser`.
- Use `--model gpt-5-pro` for ChatGPT's GPT-5.6 Pro picker.
- Do not add `--browser-thinking-time`; that setting belongs to base GPT-5.6
  Sol, not Pro.
- Do not use `--model "GPT-5.6 Sol Pro"`.
- Do not silently fall back to API mode, base Sol, or another model.

`gpt-5-pro` is Oracle's browser alias for the ChatGPT `Pro` picker. It is not
an OpenAI API model slug. OpenAI's API Pro mode and Oracle's browser picker are
separate interfaces.

## Golden path on Beelink

First confirm the bridge and current CLI:

```bash
curl -fsS http://127.0.0.1:9223/json/version | jq -r .Browser

source ~/.nvm/nvm.sh
nvm use 24 --silent
node --version
npm view @steipete/oracle version engines --json
npx -y @steipete/oracle@latest --help --verbose
```

Preview the exact context before sending it:

```bash
npx -y @steipete/oracle@latest \
  --engine browser \
  --model gpt-5-pro \
  --dry-run summary \
  --files-report \
  --prompt "<self-contained review request>" \
  --file "<smallest necessary file or glob>"
```

Run the review:

```bash
npx -y @steipete/oracle@latest \
  --engine browser \
  --model gpt-5-pro \
  --remote-chrome 127.0.0.1:9223 \
  --browser-archive auto \
  --timeout 20m \
  --verbose \
  --slug "<unique-3-5-word-slug>" \
  --prompt "<self-contained review request>" \
  --file "<smallest necessary file or glob>"
```

Omit `--browser-tab` for a fresh ChatGPT conversation. Use
`--browser-tab current` or another explicit tab reference only when continuing
an intentional existing conversation.

Oracle starts with no project knowledge. The prompt must state the goal,
relevant architecture, exact question, constraints, prior attempts, validation
commands, and desired answer shape. Attach only the files needed to resolve that
question.

## Proof requirements

A successful run must show:

```text
Model picker: Pro
Model selection evidence: requested=Pro; resolved=Pro; ...; verified=yes.
```

Also require a completed answer and a local transcript under
`~/.oracle/sessions/<slug>/artifacts/transcript.md`. Report the slug and
transcript path when handing off the review.

Picker evidence plus a completed response is the best operational proof
available through browser automation. A visible `Pro` label alone is not
cryptographic proof of the server-side generation mode; do not claim otherwise.

Treat Oracle's answer as advisory. Reconcile it against the source, tests, and
live runtime before changing or approving work.

## Bridge recovery

If `127.0.0.1:9223` is unavailable, do not expose Chrome DevTools on a LAN or
Tailscale address. Both ends must remain loopback-only.

On the Surface, launch a dedicated Chrome profile from PowerShell:

```powershell
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
& $chrome `
  --remote-debugging-address=127.0.0.1 `
  --remote-debugging-port=9222 `
  "--user-data-dir=$env:USERPROFILE\.oracle\browser-profile" `
  --no-first-run `
  --no-default-browser-check `
  https://chatgpt.com/
```

In a second Surface PowerShell window, start the reverse tunnel and leave it
running:

```powershell
& "$env:WINDIR\System32\OpenSSH\ssh.exe" `
  -N `
  -R 127.0.0.1:9223:127.0.0.1:9222 `
  -o ExitOnForwardFailure=yes `
  -o ServerAliveInterval=30 `
  -o ServerAliveCountMax=3 `
  joelkehle@beelink
```

If the dedicated Chrome profile is not authenticated, ask Joel to sign in on
the Surface and leave that window open. Never extract, copy, print, or transfer
ChatGPT cookies.

Verify both listeners:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 9222 |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

```bash
ss -ltnp 'sport = :9223'
curl -fsS http://127.0.0.1:9223/json/version | jq -r .Browser
```

The expected local addresses are `127.0.0.1`, never `0.0.0.0`.

## Data and session safety

- Everything in the prompt or `--file` set is disclosed to ChatGPT/OpenAI.
- Never attach `.env` files, credentials, tokens, private keys, raw mailbox
  exports, or unrelated sensitive material.
- Prefer a sanitized temporary review packet for personal or business data.
- Oracle may paste textual attachments inline. Treat inline content as
  disclosure even when no browser upload occurs.
- Use `--browser-archive auto` for successful one-shot reviews unless the task
  needs the visible ChatGPT conversation preserved.
- If a run times out, inspect and reattach instead of starting a duplicate:

```bash
npx -y @steipete/oracle@latest status --hours 72
npx -y @steipete/oracle@latest session "<slug>" --render
```

## Authority and drift

The active local skill is
`workspace-roots/projects/.agents/skills/oracle/SKILL.md`. The copy under
`vendor/steipete-agent-scripts/` is a third-party snapshot and is not Joel's
runtime authority.

Before changing model or picker guidance, verify:

- current Oracle npm help and engine requirement;
- the upstream
  [Oracle skill](https://github.com/steipete/oracle/blob/main/skills/oracle/SKILL.md);
- current [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model).
