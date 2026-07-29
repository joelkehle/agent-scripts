---
name: oracle
description: Use Oracle in ChatGPT browser mode with GPT-5.6 Pro for an independent architecture, code, risk, or work-product review; preview the disclosed context, verify Pro picker evidence, and reconcile the answer against source and tests.
---

# Oracle GPT-5.6 Pro Review

Read
`~/Projects/shared/agent-scripts/docs/oracle.md`
completely before invoking Oracle. That runbook owns the Beelink-to-Surface
browser bridge, recovery, privacy, and proof requirements.

## Required workflow

1. Keep the review one-shot and advisory. State the goal, architecture,
   constraints, relevant validation, exact question, and desired answer shape.
2. Choose the smallest necessary file set. Never attach secrets or unrelated
   sensitive data.
3. Use Node 24+ and `npx -y @steipete/oracle@latest`; do not use an unqualified
   or cached Oracle package.
4. Preview the bundle with `--dry-run summary --files-report`.
5. Invoke ChatGPT browser mode with `--model gpt-5-pro`, without
   `--browser-thinking-time`.
6. Verify `Model picker: Pro` and model-selection evidence containing
   `requested=Pro`, `resolved=Pro`, and `verified=yes`.
7. Reconcile the response against the source, tests, and live runtime. Report
   the session slug and transcript path.

## Main command

```bash
source ~/.nvm/nvm.sh
nvm use 24 --silent

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

Omit `--browser-tab` for a fresh conversation. If the bridge or authentication
is unavailable, follow
`~/Projects/shared/agent-scripts/docs/oracle.md`; do not expose Chrome
DevTools beyond loopback and do not silently substitute API mode or another model.
